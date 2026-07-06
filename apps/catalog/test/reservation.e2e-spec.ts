import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  MongoDBContainer,
  type StartedMongoDBContainer,
} from "@testcontainers/mongodb";
import type { StartedKafkaContainer } from "@testcontainers/kafka";
import {
  Topics,
  type OrderCreatedEvent,
  type PaymentFailedEvent,
  type PaymentSucceededEvent,
  type StockRejectedEvent,
  type StockReservedEvent,
} from "@workspace/contracts";
import { AppModule } from "../src/app.module";
import {
  MANGA_MODEL,
  type MangaModel,
} from "../src/manga/manga.schema";
import { ReservationConsumer } from "../src/reservation/reservation.consumer";
import {
  RESERVATION_MODEL,
  type ReservationModel,
} from "../src/reservation/reservation.schema";
import { startKafka, TestKafka, waitFor } from "./kafka-harness";

/**
 * Catalog saga Kafka-boundary integration tests (issue 11, ADR-0002/0003/0013).
 * Drives the stock side of the saga through a **real broker** (testcontainers)
 * against a real ephemeral Mongo: the test injects the events Orders/Payments
 * would emit (`order-created`, `payment-succeeded`, `payment-failed`) and observes
 * the events Catalog emits (`stock-reserved`, `stock-rejected`), asserting the
 * observable stock state (`quantity`/`reserved`) and reservation records. This is
 * the reserve → commit / release flow (and its all-or-nothing + idempotency
 * guarantees) as it runs over Kafka, replacing the sync-phase REST endpoints.
 */
describe("catalog reservation saga over Kafka (e2e)", () => {
  jest.setTimeout(240_000);

  let mongo: StartedMongoDBContainer;
  let kafka: StartedKafkaContainer;
  let app: INestApplication;
  let manga: MangaModel;
  let reservations: ReservationModel;
  let bus: TestKafka;

  beforeAll(async () => {
    mongo = await new MongoDBContainer("mongo:8").start();
    process.env.MONGODB_URI = `${mongo.getConnectionString()}?directConnection=true`;

    const started = await startKafka();
    kafka = started.container;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    // Bootstrap starts the ReservationConsumer and awaits its group join, so an
    // event produced after this resolves is guaranteed to be consumed.
    await app.init();
    // Wait until the saga consumer has joined its group so events the test
    // produces are seen (it consumes from the log end).
    await app.get(ReservationConsumer, { strict: false }).whenReady();

    bus = new TestKafka(started.brokers);
    await bus.connect();

    manga = app.get<MangaModel>(MANGA_MODEL, { strict: false });
    reservations = app.get<ReservationModel>(RESERVATION_MODEL, {
      strict: false,
    });
  });

  beforeEach(async () => {
    await manga.deleteMany({});
    await reservations.deleteMany({});
  });

  afterAll(async () => {
    await bus?.stop();
    await app?.close();
    await kafka?.stop();
    await mongo?.stop();
  });

  /** Seeds a manga with the given physical/held stock and returns its id. */
  async function seedManga(
    over: Partial<{
      title: string;
      price: number;
      quantity: number;
      reserved: number;
    }> = {},
  ): Promise<string> {
    const doc = await manga.create({
      title: over.title ?? "Berserk",
      author: "Miura, Kentarou",
      genres: ["Action"],
      cover: "https://cdn.test/cover.jpg",
      description: "…",
      price: over.price ?? 1999,
      stock: { quantity: over.quantity ?? 10, reserved: over.reserved ?? 0 },
    });
    return doc.id as string;
  }

  const orderCreated = (orderId: string, event: OrderCreatedEvent) =>
    bus.emit<OrderCreatedEvent>(Topics.OrderCreated, orderId, event);

  const reservedOf = async (id: string): Promise<number> =>
    (await manga.findById(id).exec())!.stock.reserved;

  const quantityOf = async (id: string): Promise<number> =>
    (await manga.findById(id).exec())!.stock.quantity;

  const reservationStatus = async (
    orderId: string,
  ): Promise<string | undefined> =>
    (await reservations.findOne({ orderId }).exec())?.status;

  it("reserves the whole order all-or-nothing, holds stock, and emits stock-reserved", async () => {
    const a = await seedManga({ title: "Alpha", price: 1500, quantity: 5 });
    const b = await seedManga({ title: "Beta", price: 800, quantity: 3 });

    const reserved = await bus.observe<StockReservedEvent>(Topics.StockReserved);
    await orderCreated("order-1", {
      orderId: "order-1",
      lines: [
        { mangaId: a, quantity: 2 },
        { mangaId: b, quantity: 3 },
      ],
    });

    const event = await waitFor(() =>
      reserved.find((e) => e.orderId === "order-1"),
    );
    // Each line carries Catalog's authoritative title + price (ADR-0010).
    expect(event.lines).toEqual([
      { mangaId: a, title: "Alpha", price: 1500, quantity: 2 },
      { mangaId: b, title: "Beta", price: 800, quantity: 3 },
    ]);

    expect(await reservedOf(a)).toBe(2);
    expect(await reservedOf(b)).toBe(3);
    expect(await reservationStatus("order-1")).toBe("reserved");
  });

  it("rolls back every hold and emits stock-rejected when any line is short", async () => {
    const a = await seedManga({ title: "Alpha", quantity: 5 });
    const b = await seedManga({ title: "Beta", quantity: 1 });

    const rejected = await bus.observe<StockRejectedEvent>(Topics.StockRejected);
    // A is available (2 ≤ 5) but B is short (5 > 1): whole order rejects and A's
    // hold is rolled back — no partial reservation left.
    await orderCreated("order-2", {
      orderId: "order-2",
      lines: [
        { mangaId: a, quantity: 2 },
        { mangaId: b, quantity: 5 },
      ],
    });

    await waitFor(() => rejected.find((e) => e.orderId === "order-2"));
    expect(await reservedOf(a)).toBe(0);
    expect(await reservedOf(b)).toBe(0);
    expect(await reservations.findOne({ orderId: "order-2" }).exec()).toBeNull();
  });

  it("guards against overselling: available is quantity − reserved", async () => {
    // 4 on hand, 3 already held → only 1 available; asking for 2 must reject.
    const a = await seedManga({ quantity: 4, reserved: 3 });

    const rejected = await bus.observe<StockRejectedEvent>(Topics.StockRejected);
    await orderCreated("order-3", {
      orderId: "order-3",
      lines: [{ mangaId: a, quantity: 2 }],
    });

    await waitFor(() => rejected.find((e) => e.orderId === "order-3"));
    // The pre-existing hold is untouched.
    expect(await reservedOf(a)).toBe(3);
  });

  it("is idempotent on a redelivered order-created: it does not double-hold", async () => {
    const a = await seedManga({ quantity: 10 });

    const reserved = await bus.observe<StockReservedEvent>(Topics.StockReserved);
    const event: OrderCreatedEvent = {
      orderId: "order-4",
      lines: [{ mangaId: a, quantity: 3 }],
    };
    await orderCreated("order-4", event);
    await waitFor(() => reserved.find((e) => e.orderId === "order-4"));
    // Redeliver (at-least-once, ADR-0013).
    await orderCreated("order-4", event);
    await waitFor(
      () => reserved.filter((e) => e.orderId === "order-4").length >= 2,
    );

    // Held exactly once despite two deliveries.
    expect(await reservedOf(a)).toBe(3);
  });

  it("commits a hold on payment-succeeded: quantity and reserved both fall", async () => {
    const a = await seedManga({ quantity: 5 });
    const reserved = await bus.observe<StockReservedEvent>(Topics.StockReserved);
    await orderCreated("order-commit", {
      orderId: "order-commit",
      lines: [{ mangaId: a, quantity: 2 }],
    });
    await waitFor(() => reserved.find((e) => e.orderId === "order-commit"));
    expect(await reservedOf(a)).toBe(2);

    await bus.emit<PaymentSucceededEvent>(
      Topics.PaymentSucceeded,
      "order-commit",
      { orderId: "order-commit", amount: 3998 },
    );

    // Commit removes the copies from physical stock and clears the hold (ADR-0002).
    await waitFor(async () => (await reservationStatus("order-commit")) === "committed");
    expect(await quantityOf(a)).toBe(3);
    expect(await reservedOf(a)).toBe(0);
  });

  it("is idempotent on a redelivered payment-succeeded: it does not commit twice", async () => {
    const a = await seedManga({ quantity: 5 });
    const reserved = await bus.observe<StockReservedEvent>(Topics.StockReserved);
    await orderCreated("order-commit-2", {
      orderId: "order-commit-2",
      lines: [{ mangaId: a, quantity: 2 }],
    });
    await waitFor(() => reserved.find((e) => e.orderId === "order-commit-2"));

    const paid: PaymentSucceededEvent = {
      orderId: "order-commit-2",
      amount: 3998,
    };
    await bus.emit(Topics.PaymentSucceeded, "order-commit-2", paid);
    await waitFor(async () => (await reservationStatus("order-commit-2")) === "committed");
    // Redeliver.
    await bus.emit(Topics.PaymentSucceeded, "order-commit-2", paid);
    // Give the redelivery time to be (idempotently) processed.
    await new Promise((r) => setTimeout(r, 1500));

    expect(await quantityOf(a)).toBe(3);
    expect(await reservedOf(a)).toBe(0);
  });

  it("releases a hold on payment-failed: reserved falls but quantity is untouched", async () => {
    const a = await seedManga({ quantity: 5, reserved: 1 });
    const reserved = await bus.observe<StockReservedEvent>(Topics.StockReserved);
    await orderCreated("order-release", {
      orderId: "order-release",
      lines: [{ mangaId: a, quantity: 2 }],
    });
    await waitFor(() => reserved.find((e) => e.orderId === "order-release"));
    expect(await reservedOf(a)).toBe(3);

    await bus.emit<PaymentFailedEvent>(Topics.PaymentFailed, "order-release", {
      orderId: "order-release",
      reason: "timeout",
    });

    // Release frees this order's hold; quantity is unchanged, the unrelated
    // pre-existing hold (1) stays.
    await waitFor(async () => (await reservationStatus("order-release")) === "released");
    expect(await quantityOf(a)).toBe(5);
    expect(await reservedOf(a)).toBe(1);
  });
});
