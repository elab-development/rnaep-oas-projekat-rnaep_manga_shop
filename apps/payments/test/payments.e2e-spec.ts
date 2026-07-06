import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { getJwtSecret } from "@workspace/auth-guard";
import type { CheckoutSessionView, OrderView } from "@workspace/contracts";
import { eq } from "drizzle-orm";
import * as jwt from "jsonwebtoken";
import Stripe from "stripe";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { DRIZZLE, type Database } from "../src/db/drizzle.module";
import { payments } from "../src/db/schema";
import { StripeService } from "../src/payments/stripe.service";

/**
 * Payments transport-boundary integration tests (issue 09, ADR-0008/0002). Drives
 * the service through its HTTP boundary against a real ephemeral Postgres
 * (testcontainers). Stripe session creation (a network call) is stubbed at the
 * StripeService seam, but signature verification stays **real** — webhook events
 * are signed with the test webhook secret exactly as Stripe would, so an unsigned
 * event genuinely fails. The saga's downstream (Catalog commit/release, Orders
 * status) is stubbed at the fetch edge, the same MSW-style seam the PRD prescribes.
 *
 * Asserts observable outcomes — the returned Stripe URL, which downstream saga
 * calls fired and how many times, and the recorded Payment status — never internal
 * method calls. Covers session creation, the success path, the expiry/timeout
 * compensation path, duplicate-event idempotency, and signature rejection.
 */
describe("payments (e2e)", () => {
  jest.setTimeout(120_000);

  const WEBHOOK_SECRET = "whsec_test_secret";
  const stripeLib = new Stripe("sk_test_dummy");

  let container: StartedPostgreSqlContainer;
  let app: INestApplication;

  // The order Payments reads back from Orders when opening a session. Tests tweak
  // `status` to exercise the "not awaiting payment" and "not found" branches.
  const ORDER_ID = "11111111-1111-4111-8111-111111111111";
  let orderStatus: OrderView["status"] | "not-found" = "pending_payment";
  const ORDER: OrderView = {
    id: ORDER_ID,
    status: "pending_payment",
    shipping: {
      recipientName: "Ada Lovelace",
      address: "1 Analytical Way",
      city: "London",
      postalCode: "EC1A 1AA",
      phone: "+44 20 7946 0000",
    },
    items: [
      { mangaId: "manga-one", title: "Alpha Vol. 1", price: 1500, quantity: 2 },
      { mangaId: "manga-two", title: "Beta Vol. 2", price: 800, quantity: 1 },
    ],
    total: 3800,
    createdAt: "2026-07-06T00:00:00.000Z",
  };

  // Saga downstream call counters, reset per test, so idempotency is observable.
  const calls = { commit: 0, release: 0, paid: 0, cancelled: 0 };

  beforeAll(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;

    // Stub Catalog/Orders saga calls at the network edge; Orders read returns the
    // authoritative order (or 404) that session creation depends on.
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      const ok = (body: unknown): Response =>
        ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

      if (url.includes("/internal/reservations/") && url.endsWith("/commit")) {
        calls.commit++;
        return ok({ orderId: ORDER_ID, status: "committed" });
      }
      if (url.includes("/internal/reservations/") && url.endsWith("/release")) {
        calls.release++;
        return ok({ orderId: ORDER_ID, status: "released" });
      }
      if (url.includes("/internal/orders/") && url.endsWith("/paid")) {
        calls.paid++;
        return ok({ orderId: ORDER_ID, status: "paid" });
      }
      if (url.includes("/internal/orders/") && url.endsWith("/cancelled")) {
        calls.cancelled++;
        return ok({ orderId: ORDER_ID, status: "cancelled" });
      }
      if (url.includes(`/orders/${ORDER_ID}`)) {
        if (orderStatus === "not-found") {
          return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
        }
        return ok({ ...ORDER, status: orderStatus });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    container = await new PostgreSqlContainer("postgres:18-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    // Stub Stripe session creation (network); keep real signature verification.
    const stripeStub: Pick<StripeService, "createCheckoutSession" | "constructEvent"> = {
      createCheckoutSession: async ({ orderId }) => ({
        id: `cs_test_${orderId}`,
        url: `https://stripe.test/pay/${orderId}`,
      }),
      constructEvent: (payload, signature) =>
        stripeLib.webhooks.constructEvent(payload, signature, WEBHOOK_SECRET),
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(StripeService)
      .useValue(stripeStub)
      .compile();
    // `rawBody: true` mirrors main.ts so the webhook signature is verified against
    // the exact received bytes (ADR-0008).
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  beforeEach(() => {
    orderStatus = "pending_payment";
    calls.commit = calls.release = calls.paid = calls.cancelled = 0;
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app?.close();
    await container?.stop();
  });

  const server = () => app.getHttpServer();

  const paymentStatusOf = async (orderId: string): Promise<string | null> => {
    const db = app.get<Database>(DRIZZLE);
    const [row] = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId));
    return row?.status ?? null;
  };

  const tokenFor = (customerId: string): string =>
    jwt.sign(
      { sub: customerId, role: "customer", email: "c@example.com" },
      getJwtSecret(),
      { expiresIn: "15m" },
    );

  const CUSTOMER = "22222222-2222-4222-8222-222222222222";

  const openSession = (token: string, orderId: string) =>
    request(server())
      .post("/payments/checkout-session")
      .set("Authorization", `Bearer ${token}`)
      .send({ orderId });

  // Signs a Stripe event with the test webhook secret exactly as Stripe would.
  const sendWebhook = (event: object, signature?: string) => {
    const payload = JSON.stringify(event);
    const sig =
      signature ??
      stripeLib.webhooks.generateTestHeaderString({
        payload,
        secret: WEBHOOK_SECRET,
      });
    return request(server())
      .post("/payments/webhook")
      .set("stripe-signature", sig)
      .set("Content-Type", "application/json")
      .send(payload);
  };

  const sessionEvent = (id: string, type: string, orderId = ORDER_ID) => ({
    id,
    type,
    object: "event",
    data: {
      object: {
        id: "cs_test_x",
        object: "checkout.session",
        client_reference_id: orderId,
        metadata: { orderId },
      },
    },
  });

  it("opens a hosted Checkout Session for a pending_payment order and returns its URL", async () => {
    const res = await openSession(tokenFor(CUSTOMER), ORDER_ID);
    expect(res.status).toBe(201);
    expect((res.body as CheckoutSessionView).url).toBe(
      `https://stripe.test/pay/${ORDER_ID}`,
    );
  });

  it("requires a token to open a session (login-required)", async () => {
    const res = await request(server())
      .post("/payments/checkout-session")
      .send({ orderId: ORDER_ID });
    expect(res.status).toBe(401);
  });

  it("404s when the order is not the caller's (or does not exist)", async () => {
    orderStatus = "not-found";
    const res = await openSession(tokenFor(CUSTOMER), ORDER_ID);
    expect(res.status).toBe(404);
  });

  it("409s when the order is not awaiting payment", async () => {
    orderStatus = "paid";
    const res = await openSession(tokenFor(CUSTOMER), ORDER_ID);
    expect(res.status).toBe(409);
  });

  it("commits stock, marks the order paid, and records the Payment succeeded on checkout.session.completed", async () => {
    // Opening a session records the Payment as pending…
    await openSession(tokenFor(CUSTOMER), ORDER_ID);
    expect(await paymentStatusOf(ORDER_ID)).toBe("pending");

    const res = await sendWebhook(
      sessionEvent("evt_success_1", "checkout.session.completed"),
    );
    expect(res.status).toBe(201);
    expect(calls.commit).toBe(1);
    expect(calls.paid).toBe(1);
    // The success path never touches the compensation calls.
    expect(calls.release).toBe(0);
    expect(calls.cancelled).toBe(0);
    // …and the verified webhook advances it to succeeded (ADR-0008).
    expect(await paymentStatusOf(ORDER_ID)).toBe("succeeded");
  });

  it("releases stock, cancels the order, and records the Payment failed on checkout.session.expired (timeout)", async () => {
    await openSession(tokenFor(CUSTOMER), ORDER_ID);
    expect(await paymentStatusOf(ORDER_ID)).toBe("pending");

    const res = await sendWebhook(
      sessionEvent("evt_expired_1", "checkout.session.expired"),
    );
    expect(res.status).toBe(201);
    expect(calls.release).toBe(1);
    expect(calls.cancelled).toBe(1);
    expect(calls.commit).toBe(0);
    expect(calls.paid).toBe(0);
    expect(await paymentStatusOf(ORDER_ID)).toBe("failed");
  });

  it("is idempotent on the event id: a duplicate delivery does not settle twice", async () => {
    const event = sessionEvent("evt_dup_1", "checkout.session.completed");
    await sendWebhook(event);
    const second = await sendWebhook(event);

    expect(second.status).toBe(201);
    // Same event id → committed and marked paid exactly once (ADR-0013).
    expect(calls.commit).toBe(1);
    expect(calls.paid).toBe(1);
  });

  it("rejects an unsigned / invalidly-signed webhook", async () => {
    const res = await sendWebhook(
      sessionEvent("evt_forged_1", "checkout.session.completed"),
      "t=1,v1=forged",
    );
    expect(res.status).toBe(400);
    // A forged event never reaches the saga.
    expect(calls.commit).toBe(0);
    expect(calls.paid).toBe(0);
  });
});
