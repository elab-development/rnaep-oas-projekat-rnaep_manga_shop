import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { getJwtSecret } from "@workspace/auth-guard";
import type {
  OrderView,
  ReservationResult,
  ReserveOrderInput,
} from "@workspace/contracts";
import * as jwt from "jsonwebtoken";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Orders checkout transport-boundary integration tests (issue 08). Drives the
 * service through its HTTP controllers against a real ephemeral Postgres
 * (testcontainers), with Catalog's reserve stubbed at the HTTP boundary (global
 * fetch) — the same MSW-style seam the PRD prescribes. Asserts observable order
 * state and cart state, never internal calls: the pending_payment order with
 * server-sourced price/title snapshots + cart clear, the all-or-nothing rejection
 * leaving no order, empty-cart and login-required guards, and that item prices
 * come from Catalog rather than the client.
 */
describe("checkout (e2e)", () => {
  jest.setTimeout(120_000);

  let container: StartedPostgreSqlContainer;
  let app: INestApplication;

  // Catalog's authoritative price/title per manga, returned by the reserve stub —
  // deliberately not values the client ever sends, so a snapshot proves it came
  // from Catalog (ADR-0010).
  const CATALOG: Record<string, { title: string; price: number }> = {
    "manga-one": { title: "Alpha Vol. 1", price: 1500 },
    "manga-two": { title: "Beta Vol. 2", price: 800 },
  };

  // Test knobs for the reserve stub.
  let reserveRejects = false;
  let lastReserve: ReserveOrderInput | null = null;

  beforeAll(async () => {
    // Stub Catalog's internal reserve at the network edge. All-or-nothing: reserve
    // echoes each requested line with Catalog's title + price, or rejects wholesale.
    jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.includes("/internal/reservations")) {
          const body = JSON.parse(String(init?.body)) as ReserveOrderInput;
          lastReserve = body;
          const result: ReservationResult = reserveRejects
            ? {
                status: "rejected",
                orderId: body.orderId,
                reason: "insufficient_stock",
              }
            : {
                status: "reserved",
                orderId: body.orderId,
                lines: body.lines.map((l) => ({
                  mangaId: l.mangaId,
                  title: CATALOG[l.mangaId]?.title ?? "Unknown",
                  price: CATALOG[l.mangaId]?.price ?? 0,
                  quantity: l.quantity,
                })),
              };
          return {
            ok: true,
            status: 201,
            json: async () => result,
          } as unknown as Response;
        }
        throw new Error(`unexpected fetch: ${url}`);
      });

    container = await new PostgreSqlContainer("postgres:18-alpine").start();
    process.env.DATABASE_URL = container.getConnectionUri();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  beforeEach(() => {
    reserveRejects = false;
    lastReserve = null;
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app?.close();
    await container?.stop();
  });

  const server = () => app.getHttpServer();

  function tokenFor(customerId: string): string {
    return jwt.sign(
      { sub: customerId, role: "customer", email: "c@example.com" },
      getJwtSecret(),
      { expiresIn: "15m" },
    );
  }

  const addItem = (token: string, mangaId: string, quantity: number) =>
    request(server())
      .post("/cart/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ mangaId, quantity });

  const getCart = (token: string) =>
    request(server()).get("/cart").set("Authorization", `Bearer ${token}`);

  const checkout = (token: string, shipping: object) =>
    request(server())
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send(shipping);

  const SHIPPING = {
    recipientName: "Ada Lovelace",
    address: "1 Analytical Way",
    city: "London",
    postalCode: "EC1A 1AA",
    phone: "+44 20 7946 0000",
  };

  // A distinct customer id per behaviour so carts don't collide.
  const CUST = (n: number) =>
    `44444444-4444-4444-4444-${String(n).padStart(12, "0")}`;

  it("rejects checkout without a token (login-required)", async () => {
    const res = await request(server()).post("/orders").send(SHIPPING);
    expect(res.status).toBe(401);
  });

  it("400s when checking out an empty cart", async () => {
    const res = await checkout(tokenFor(CUST(1)), SHIPPING);
    expect(res.status).toBe(400);
  });

  it("creates a pending_payment order, snapshots Catalog price/title, and clears the cart", async () => {
    const token = tokenFor(CUST(2));
    await addItem(token, "manga-one", 2);
    await addItem(token, "manga-two", 1);

    const res = await checkout(token, SHIPPING);
    expect(res.status).toBe(201);
    const order = res.body as OrderView;

    expect(order.status).toBe("pending_payment");
    expect(order.shipping).toEqual(SHIPPING);
    // Titles + prices are Catalog's, snapshotted onto the order (ADR-0010).
    expect(order.items).toEqual([
      { mangaId: "manga-one", title: "Alpha Vol. 1", price: 1500, quantity: 2 },
      { mangaId: "manga-two", title: "Beta Vol. 2", price: 800, quantity: 1 },
    ]);
    // Total is Σ price × quantity from Catalog's prices: 1500·2 + 800·1 = 3800.
    expect(order.total).toBe(3800);

    // Orders reserved exactly the cart's lines, keyed by the order id.
    expect(lastReserve?.orderId).toBe(order.id);
    expect(lastReserve?.lines).toEqual([
      { mangaId: "manga-one", quantity: 2 },
      { mangaId: "manga-two", quantity: 1 },
    ]);

    // The cart is cleared on a successful checkout.
    expect((await getCart(token)).body).toEqual({ items: [] });
  });

  it("gives the client no channel to supply prices: forged fields are rejected", async () => {
    const token = tokenFor(CUST(3));
    await addItem(token, "manga-one", 1);

    // The checkout body is shipping-only; a forged price/items/total is a
    // non-whitelisted property and rejected outright (ADR-0010, ADR-0012). Prices
    // can only ever come from Catalog (asserted by the snapshot test above).
    const res = await checkout(token, {
      ...SHIPPING,
      items: [{ mangaId: "manga-one", title: "FREE", price: 1 }],
      total: 1,
    });

    expect(res.status).toBe(400);
    // Nothing was reserved — checkout never got past validation.
    expect(lastReserve).toBeNull();
    // The cart is intact, so the Customer can retry cleanly.
    expect((await getCart(token)).body).toEqual({
      items: [{ mangaId: "manga-one", quantity: 1 }],
    });
  });

  it("409s and leaves no order or emptied cart when a line is out of stock", async () => {
    reserveRejects = true;
    const token = tokenFor(CUST(4));
    await addItem(token, "manga-one", 99);

    const res = await checkout(token, SHIPPING);
    expect(res.status).toBe(409);

    // All-or-nothing: the cart is untouched so the Customer can adjust and retry.
    expect((await getCart(token)).body).toEqual({
      items: [{ mangaId: "manga-one", quantity: 99 }],
    });
  });

  it("400s a malformed shipping body", async () => {
    const token = tokenFor(CUST(5));
    await addItem(token, "manga-one", 1);
    const res = await checkout(token, { ...SHIPPING, recipientName: "" });
    expect(res.status).toBe(400);
  });
});
