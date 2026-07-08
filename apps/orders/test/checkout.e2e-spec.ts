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
  type AdminOrderView,
  type OrderCreatedEvent,
  type OrderView,
  type PaymentFailedEvent,
  type PaymentSucceededEvent,
  type ReservedLine,
  type StockRejectedEvent,
  type StockReservedEvent,
} from "@workspace/contracts";
import * as jwt from "jsonwebtoken";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { OrdersConsumer } from "../src/orders/orders.consumer";
import { startKafka, TestKafka, waitFor } from "./kafka-harness";

/**
 * Orders saga integration tests (issue 08, migrated to Kafka in issue 11). Drives
 * Orders through its HTTP boundary (checkout, reads, ship) and its **Kafka**
 * boundary (a real broker via testcontainers) against a real ephemeral Postgres.
 * Checkout now emits `order-created` and the reservation is asynchronous: the test
 * injects the `stock-reserved`/`stock-rejected` events Catalog would emit and the
 * `payment-succeeded`/`payment-failed` events Payments would emit, asserting the
 * observable order + cart state. Prices are always Catalog's, snapshotted onto the
 * order from the `stock-reserved` event (ADR-0010) — the client never supplies one.
 */
describe("orders saga over Kafka (e2e)", () => {
  jest.setTimeout(240_000);

  let pg: StartedPostgreSqlContainer;
  let kafka: StartedKafkaContainer;
  let app: INestApplication;
  let bus: TestKafka;

  // Catalog's authoritative price/title per manga, echoed in stock-reserved —
  // values the client never sends, so a snapshot proves it came from Catalog.
  const CATALOG: Record<string, { title: string; price: number }> = {
    "manga-one": { title: "Alpha Vol. 1", price: 1500 },
    "manga-two": { title: "Beta Vol. 2", price: 800 },
  };

  beforeAll(async () => {
    pg = await new PostgreSqlContainer("postgres:18-alpine").start();
    process.env.DATABASE_URL = pg.getConnectionUri();

    const started = await startKafka();
    kafka = started.container;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    // Wait until the saga consumer has joined its group so events the test
    // produces are seen (it consumes from the log end).
    await app.get(OrdersConsumer, { strict: false }).whenReady();

    bus = new TestKafka(started.brokers);
    await bus.connect();
  });

  afterAll(async () => {
    await bus?.stop();
    await app?.close();
    await kafka?.stop();
    await pg?.stop();
  });

  const server = () => app.getHttpServer();

  function tokenFor(
    customerId: string,
    role: "customer" | "moderator" | "admin" = "customer",
  ): string {
    return jwt.sign(
      { sub: customerId, role, email: `${role}@example.com` },
      getJwtSecret(),
      { expiresIn: "60m" },
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

  const getOrder = (token: string, id: string) =>
    request(server())
      .get(`/orders/${id}`)
      .set("Authorization", `Bearer ${token}`);

  /** Builds the priced lines Catalog would return for the given cart lines. */
  const pricedLines = (
    lines: { mangaId: string; quantity: number }[],
  ): ReservedLine[] =>
    lines.map((l) => ({
      mangaId: l.mangaId,
      title: CATALOG[l.mangaId]?.title ?? "Unknown",
      price: CATALOG[l.mangaId]?.price ?? 0,
      quantity: l.quantity,
    }));

  const reserve = (orderId: string, lines: ReservedLine[]) =>
    bus.emit<StockReservedEvent>(Topics.StockReserved, orderId, {
      orderId,
      lines,
    });

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

  it("creates a pending_payment order, emits order-created keyed by orderId, and clears the cart", async () => {
    const token = tokenFor(CUST(2));
    await addItem(token, "manga-one", 2);
    await addItem(token, "manga-two", 1);

    const created = await bus.observe<OrderCreatedEvent>(Topics.OrderCreated);
    const res = await checkout(token, SHIPPING);
    expect(res.status).toBe(201);
    const order = res.body as OrderView;

    // The order is placed but not yet priced — reservation is asynchronous now.
    expect(order.status).toBe("pending_payment");
    expect(order.shipping).toEqual(SHIPPING);
    expect(order.items).toEqual([]);
    expect(order.total).toBe(0);

    // `order-created` carries exactly the cart's lines, keyed by the order id.
    const event = await waitFor(() =>
      created.find((e) => e.orderId === order.id),
    );
    expect(event.lines).toEqual([
      { mangaId: "manga-one", quantity: 2 },
      { mangaId: "manga-two", quantity: 1 },
    ]);

    // The cart is cleared on checkout.
    expect((await getCart(token)).body).toEqual({ items: [] });
  });

  it("snapshots Catalog's price/title and the total onto the order on stock-reserved", async () => {
    const token = tokenFor(CUST(3));
    await addItem(token, "manga-one", 2);
    await addItem(token, "manga-two", 1);
    const order = (await checkout(token, SHIPPING)).body as OrderView;

    const lines = pricedLines([
      { mangaId: "manga-one", quantity: 2 },
      { mangaId: "manga-two", quantity: 1 },
    ]);
    await reserve(order.id, lines);

    // The reservation event fills in Catalog's title/price and the order total.
    const priced = await waitFor(async () => {
      const view = (await getOrder(token, order.id)).body as OrderView;
      return view.items.length > 0 ? view : undefined;
    });
    expect(priced.items).toEqual([
      { mangaId: "manga-one", title: "Alpha Vol. 1", price: 1500, quantity: 2 },
      { mangaId: "manga-two", title: "Beta Vol. 2", price: 800, quantity: 1 },
    ]);
    // Total is Σ price × quantity: 1500·2 + 800·1 = 3800.
    expect(priced.total).toBe(3800);
    expect(priced.status).toBe("pending_payment");
  });

  it("is idempotent on a redelivered stock-reserved: it does not double the items", async () => {
    const token = tokenFor(CUST(4));
    await addItem(token, "manga-one", 1);
    const order = (await checkout(token, SHIPPING)).body as OrderView;

    const lines = pricedLines([{ mangaId: "manga-one", quantity: 1 }]);
    await reserve(order.id, lines);
    await waitFor(async () => {
      const view = (await getOrder(token, order.id)).body as OrderView;
      return view.items.length > 0 ? view : undefined;
    });
    // Redeliver (at-least-once, ADR-0013).
    await reserve(order.id, lines);
    await new Promise((r) => setTimeout(r, 1500));

    const view = (await getOrder(token, order.id)).body as OrderView;
    expect(view.items).toHaveLength(1);
    expect(view.total).toBe(1500);
  });

  it("cancels the order on stock-rejected (out of stock, compensation)", async () => {
    const token = tokenFor(CUST(5));
    await addItem(token, "manga-one", 99);
    const order = (await checkout(token, SHIPPING)).body as OrderView;

    await bus.emit<StockRejectedEvent>(Topics.StockRejected, order.id, {
      orderId: order.id,
      reason: "insufficient_stock",
    });

    await waitFor(async () => {
      const view = (await getOrder(token, order.id)).body as OrderView;
      return view.status === "cancelled" ? view : undefined;
    });
  });

  it("gives the client no channel to supply prices: forged fields are rejected", async () => {
    const token = tokenFor(CUST(6));
    await addItem(token, "manga-one", 1);

    // The checkout body is shipping-only; a forged price/items/total is a
    // non-whitelisted property and rejected outright (ADR-0010, ADR-0012).
    const res = await checkout(token, {
      ...SHIPPING,
      items: [{ mangaId: "manga-one", title: "FREE", price: 1 }],
      total: 1,
    });
    expect(res.status).toBe(400);
    // The cart is intact, so the Customer can retry cleanly.
    expect((await getCart(token)).body).toEqual({
      items: [{ mangaId: "manga-one", quantity: 1 }],
    });
  });

  it("404s another Customer's order (IDOR: ownership from the token)", async () => {
    const owner = tokenFor(CUST(7));
    await addItem(owner, "manga-one", 1);
    const placed = (await checkout(owner, SHIPPING)).body as OrderView;

    const attacker = tokenFor(CUST(8));
    expect((await getOrder(attacker, placed.id)).status).toBe(404);
  });

  it("advances an order to paid on payment-succeeded, idempotently", async () => {
    const token = tokenFor(CUST(9));
    await addItem(token, "manga-one", 1);
    const order = (await checkout(token, SHIPPING)).body as OrderView;

    const paid: PaymentSucceededEvent = { orderId: order.id, amount: 1500 };
    await bus.emit(Topics.PaymentSucceeded, order.id, paid);
    await waitFor(async () => {
      const view = (await getOrder(token, order.id)).body as OrderView;
      return view.status === "paid" ? view : undefined;
    });

    // A duplicate delivery must not re-transition (at-least-once, ADR-0013).
    await bus.emit(Topics.PaymentSucceeded, order.id, paid);
    await new Promise((r) => setTimeout(r, 1000));
    expect((await getOrder(token, order.id)).body.status).toBe("paid");
  });

  it("cancels an order on payment-failed (compensation)", async () => {
    const token = tokenFor(CUST(10));
    await addItem(token, "manga-one", 1);
    const order = (await checkout(token, SHIPPING)).body as OrderView;

    await bus.emit<PaymentFailedEvent>(Topics.PaymentFailed, order.id, {
      orderId: order.id,
      reason: "timeout",
    });
    await waitFor(async () => {
      const view = (await getOrder(token, order.id)).body as OrderView;
      return view.status === "cancelled" ? view : undefined;
    });
  });

  // Order history, admin oversight, and ship (issue 10) — HTTP boundary.
  const listMyOrders = (token: string) =>
    request(server()).get("/orders").set("Authorization", `Bearer ${token}`);
  const listAllOrders = (token: string) =>
    request(server())
      .get("/orders/all")
      .set("Authorization", `Bearer ${token}`);
  const ship = (token: string, id: string) =>
    request(server())
      .patch(`/orders/${id}/ship`)
      .set("Authorization", `Bearer ${token}`);

  it("returns only the caller's own orders as history, newest first, with status", async () => {
    const mine = tokenFor(CUST(11));
    const other = tokenFor(CUST(12));
    await addItem(mine, "manga-one", 1);
    const first = (await checkout(mine, SHIPPING)).body as OrderView;
    await addItem(mine, "manga-two", 1);
    const second = (await checkout(mine, SHIPPING)).body as OrderView;
    await addItem(other, "manga-one", 1);
    await checkout(other, SHIPPING);

    const res = await listMyOrders(mine);
    expect(res.status).toBe(200);
    const orders = res.body as OrderView[];
    expect(orders.map((o) => o.id).sort()).toEqual([first.id, second.id].sort());
    // Newest first.
    expect(orders[0].id).toBe(second.id);
  });

  it("rejects order history without a token (login-required)", async () => {
    expect((await request(server()).get("/orders")).status).toBe(401);
  });

  it("lets an admin list every order with its status and owning customer", async () => {
    const cust = tokenFor(CUST(13));
    await addItem(cust, "manga-one", 1);
    const placed = (await checkout(cust, SHIPPING)).body as OrderView;

    const admin = tokenFor(CUST(14), "admin");
    const res = await listAllOrders(admin);
    expect(res.status).toBe(200);
    const row = (res.body as AdminOrderView[]).find((o) => o.id === placed.id);
    expect(row?.customerId).toBe(CUST(13));
    expect(row?.status).toBe("pending_payment");
  });

  it("forbids a non-admin from listing all orders", async () => {
    expect((await listAllOrders(tokenFor(CUST(15)))).status).toBe(403);
    expect(
      (await listAllOrders(tokenFor(CUST(15), "moderator"))).status,
    ).toBe(403);
  });

  it("lets an admin ship a paid order (paid → shipped)", async () => {
    const cust = tokenFor(CUST(16));
    await addItem(cust, "manga-one", 1);
    const placed = (await checkout(cust, SHIPPING)).body as OrderView;
    // Drive it to paid over the broker.
    await bus.emit<PaymentSucceededEvent>(Topics.PaymentSucceeded, placed.id, {
      orderId: placed.id,
      amount: 1500,
    });
    await waitFor(async () => {
      const view = (await getOrder(cust, placed.id)).body as OrderView;
      return view.status === "paid" ? view : undefined;
    });

    const admin = tokenFor(CUST(17), "admin");
    const res = await ship(admin, placed.id);
    expect(res.status).toBe(200);
    const mine = (await listMyOrders(cust)).body as OrderView[];
    expect(mine.find((o) => o.id === placed.id)?.status).toBe("shipped");
  });

  it("refuses to ship an order that is not paid (409)", async () => {
    const cust = tokenFor(CUST(18));
    await addItem(cust, "manga-one", 1);
    const placed = (await checkout(cust, SHIPPING)).body as OrderView;

    const admin = tokenFor(CUST(19), "admin");
    // Still pending_payment, not paid.
    expect((await ship(admin, placed.id)).status).toBe(409);
  });

  it("forbids a non-admin from shipping an order", async () => {
    const cust = tokenFor(CUST(20));
    await addItem(cust, "manga-one", 1);
    const placed = (await checkout(cust, SHIPPING)).body as OrderView;

    expect((await ship(cust, placed.id)).status).toBe(403);
  });

  it("404s shipping an unknown order for an admin", async () => {
    const admin = tokenFor(CUST(21), "admin");
    const res = await ship(admin, "99999999-9999-9999-9999-999999999999");
    expect(res.status).toBe(404);
  });
});
