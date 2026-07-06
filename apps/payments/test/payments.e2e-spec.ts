import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { StartedKafkaContainer } from "@testcontainers/kafka";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { getJwtSecret } from "@workspace/auth-guard";
import {
  Topics,
  type CheckoutSessionView,
  type OrderView,
  type PaymentFailedEvent,
  type PaymentSucceededEvent,
} from "@workspace/contracts";
import { eq } from "drizzle-orm";
import * as jwt from "jsonwebtoken";
import Stripe from "stripe";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { DRIZZLE, type Database } from "../src/db/drizzle.module";
import { payments } from "../src/db/schema";
import { StripeService } from "../src/payments/stripe.service";
import { startKafka, TestKafka, waitFor } from "./kafka-harness";

/**
 * Payments saga integration tests (issue 09, migrated to Kafka in issue 11,
 * ADR-0008/0002). Drives the service through its HTTP boundary against a real
 * ephemeral Postgres, with the Orders read stubbed at the fetch edge and Stripe
 * session creation stubbed at the StripeService seam — but **signature
 * verification stays real**. The saga downstream is now Kafka: on the signed
 * webhook Payments emits `payment-succeeded` / `payment-failed` (observed on a
 * real broker) and records its own Payment status; Orders and Catalog settle from
 * those events in their own consumer groups. Covers session creation, the success
 * and expiry/timeout paths, duplicate-event idempotency, and signature rejection.
 */
describe("payments saga over Kafka (e2e)", () => {
  jest.setTimeout(240_000);

  const WEBHOOK_SECRET = "whsec_test_secret";
  const stripeLib = new Stripe("sk_test_dummy");

  let pg: StartedPostgreSqlContainer;
  let kafka: StartedKafkaContainer;
  let app: INestApplication;
  let bus: TestKafka;

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

  beforeAll(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;

    // Stub only the Orders read that session creation depends on.
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes(`/orders/${ORDER_ID}`)) {
        if (orderStatus === "not-found") {
          return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ ...ORDER, status: orderStatus }),
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    pg = await new PostgreSqlContainer("postgres:18-alpine").start();
    process.env.DATABASE_URL = pg.getConnectionUri();

    const started = await startKafka();
    kafka = started.container;

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
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    bus = new TestKafka(started.brokers);
    await bus.connect();
  });

  beforeEach(() => {
    orderStatus = "pending_payment";
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await bus?.stop();
    await app?.close();
    await kafka?.stop();
    await pg?.stop();
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

  it("emits payment-succeeded and records the Payment succeeded on checkout.session.completed", async () => {
    // Opening a session records the Payment as pending…
    await openSession(tokenFor(CUSTOMER), ORDER_ID);
    expect(await paymentStatusOf(ORDER_ID)).toBe("pending");

    const succeeded = await bus.observe<PaymentSucceededEvent>(
      Topics.PaymentSucceeded,
    );
    const res = await sendWebhook(
      sessionEvent("evt_success_1", "checkout.session.completed"),
    );
    expect(res.status).toBe(201);

    const event = await waitFor(() =>
      succeeded.find((e) => e.orderId === ORDER_ID),
    );
    // The amount is Catalog/Orders' authority, recorded when the session opened.
    expect(event.amount).toBe(3800);
    expect(await paymentStatusOf(ORDER_ID)).toBe("succeeded");
  });

  it("emits payment-failed(timeout) and records the Payment failed on checkout.session.expired", async () => {
    await openSession(tokenFor(CUSTOMER), ORDER_ID);

    const failed = await bus.observe<PaymentFailedEvent>(Topics.PaymentFailed);
    const res = await sendWebhook(
      sessionEvent("evt_expired_1", "checkout.session.expired"),
    );
    expect(res.status).toBe(201);

    const event = await waitFor(() =>
      failed.find((e) => e.orderId === ORDER_ID),
    );
    expect(event.reason).toBe("timeout");
    expect(await paymentStatusOf(ORDER_ID)).toBe("failed");
  });

  it("is idempotent on the event id: a duplicate delivery emits the outcome once", async () => {
    const succeeded = await bus.observe<PaymentSucceededEvent>(
      Topics.PaymentSucceeded,
    );
    const event = sessionEvent("evt_dup_1", "checkout.session.completed");
    await sendWebhook(event);
    const second = await sendWebhook(event);
    expect(second.status).toBe(201);

    // Wait for the first, then confirm no second emission lands.
    await waitFor(() => succeeded.find((e) => e.orderId === ORDER_ID));
    await new Promise((r) => setTimeout(r, 1500));
    expect(succeeded.filter((e) => e.orderId === ORDER_ID)).toHaveLength(1);
  });

  it("rejects an unsigned / invalidly-signed webhook and emits nothing", async () => {
    const succeeded = await bus.observe<PaymentSucceededEvent>(
      Topics.PaymentSucceeded,
    );
    const res = await sendWebhook(
      sessionEvent("evt_forged_1", "checkout.session.completed"),
      "t=1,v1=forged",
    );
    expect(res.status).toBe(400);
    await new Promise((r) => setTimeout(r, 1000));
    expect(succeeded.filter((e) => e.orderId === ORDER_ID)).toHaveLength(0);
  });
});
