import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  MongoDBContainer,
  type StartedMongoDBContainer,
} from "@testcontainers/mongodb";
import type {
  ReservationResult,
  SettlementResult,
} from "@workspace/contracts";
import request from "supertest";
import { AppModule } from "../src/app.module";
import {
  MANGA_MODEL,
  type MangaModel,
} from "../src/manga/manga.schema";
import {
  RESERVATION_MODEL,
  type ReservationModel,
} from "../src/reservation/reservation.schema";

/**
 * Catalog reserve-for-order transport-boundary tests (issue 08, ADR-0002). Drives
 * the internal reserve endpoint against a real ephemeral Mongo (testcontainers),
 * asserting observable stock state (`reserved`) and the returned priced lines —
 * never internal calls. Covers all-or-nothing success, partial-failure rollback,
 * server-sourced price/title, idempotency on `orderId`, and the per-order
 * reservation record.
 */
describe("catalog reservation (e2e)", () => {
  jest.setTimeout(180_000);

  let container: StartedMongoDBContainer;
  let app: INestApplication;
  let manga: MangaModel;
  let reservations: ReservationModel;

  beforeAll(async () => {
    container = await new MongoDBContainer("mongo:8").start();
    process.env.MONGODB_URI = `${container.getConnectionString()}?directConnection=true`;

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
    await app.init();
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
    await app?.close();
    await container?.stop();
  });

  const server = () => app.getHttpServer();

  /** Seeds a manga with the given physical/held stock and returns its id. */
  async function seedManga(
    over: Partial<{ title: string; price: number; quantity: number; reserved: number }> = {},
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

  const reserve = (
    orderId: string,
    lines: { mangaId: string; quantity: number }[],
  ) =>
    request(server()).post("/internal/reservations").send({ orderId, lines });

  const reservedOf = async (id: string): Promise<number> =>
    (await manga.findById(id).exec())!.stock.reserved;

  const quantityOf = async (id: string): Promise<number> =>
    (await manga.findById(id).exec())!.stock.quantity;

  const commit = (orderId: string) =>
    request(server()).post(`/internal/reservations/${orderId}/commit`);

  const release = (orderId: string) =>
    request(server()).post(`/internal/reservations/${orderId}/release`);

  it("reserves the whole order all-or-nothing and holds the stock", async () => {
    const a = await seedManga({ title: "Alpha", price: 1500, quantity: 5 });
    const b = await seedManga({ title: "Beta", price: 800, quantity: 3 });

    const res = await reserve("order-1", [
      { mangaId: a, quantity: 2 },
      { mangaId: b, quantity: 3 },
    ]);

    expect(res.status).toBe(201);
    const body = res.body as ReservationResult;
    expect(body.status).toBe("reserved");

    // Each line carries Catalog's authoritative title + price (ADR-0010), not
    // anything the caller could supply.
    if (body.status !== "reserved") throw new Error("expected reserved");
    expect(body.lines).toEqual([
      { mangaId: a, title: "Alpha", price: 1500, quantity: 2 },
      { mangaId: b, title: "Beta", price: 800, quantity: 3 },
    ]);

    // Stock is held: reserved rose by the ordered quantities.
    expect(await reservedOf(a)).toBe(2);
    expect(await reservedOf(b)).toBe(3);

    // A per-order reservation record exists so a later commit/release is exact.
    const record = await reservations.findOne({ orderId: "order-1" }).exec();
    expect(record?.status).toBe("reserved");
    expect(record?.lines).toHaveLength(2);
  });

  it("rolls back every hold and rejects when any line is short (all-or-nothing)", async () => {
    const a = await seedManga({ title: "Alpha", quantity: 5 });
    const b = await seedManga({ title: "Beta", quantity: 1 });

    // A is available (2 ≤ 5) but B is short (5 > 1): the whole order must reject
    // and A's earlier hold must be rolled back — no partial reservation left.
    const res = await reserve("order-2", [
      { mangaId: a, quantity: 2 },
      { mangaId: b, quantity: 5 },
    ]);

    expect(res.status).toBe(201);
    expect((res.body as ReservationResult).status).toBe("rejected");

    expect(await reservedOf(a)).toBe(0);
    expect(await reservedOf(b)).toBe(0);
    expect(await reservations.findOne({ orderId: "order-2" }).exec()).toBeNull();
  });

  it("guards against overselling: available is quantity − reserved", async () => {
    // 4 on hand, 3 already held → only 1 available; asking for 2 must reject.
    const a = await seedManga({ quantity: 4, reserved: 3 });

    const res = await reserve("order-3", [{ mangaId: a, quantity: 2 }]);
    expect((res.body as ReservationResult).status).toBe("rejected");
    // The pre-existing hold is untouched.
    expect(await reservedOf(a)).toBe(3);
  });

  it("is idempotent on orderId: a repeat reserve does not double-hold", async () => {
    const a = await seedManga({ quantity: 10 });

    const first = await reserve("order-4", [{ mangaId: a, quantity: 3 }]);
    const second = await reserve("order-4", [{ mangaId: a, quantity: 3 }]);

    expect((first.body as ReservationResult).status).toBe("reserved");
    expect((second.body as ReservationResult).status).toBe("reserved");
    // Held exactly once despite two calls.
    expect(await reservedOf(a)).toBe(3);
  });

  it("rejects an order referencing a manga that does not exist", async () => {
    const a = await seedManga({ quantity: 5 });
    const missing = "0123456789abcdef01234567"; // valid ObjectId, no such doc

    const res = await reserve("order-5", [
      { mangaId: a, quantity: 1 },
      { mangaId: missing, quantity: 1 },
    ]);

    expect((res.body as ReservationResult).status).toBe("rejected");
    // The real manga's hold was rolled back — no partial reservation survives.
    expect(await reservedOf(a)).toBe(0);
  });

  it("rejects a malformed reserve body with 400", async () => {
    const res = await request(server())
      .post("/internal/reservations")
      .send({ orderId: "order-6", lines: [] });
    expect(res.status).toBe(400);
  });

  it("commits a hold: both quantity and reserved fall by the held amount (payment succeeded)", async () => {
    const a = await seedManga({ quantity: 5 });
    await reserve("order-commit", [{ mangaId: a, quantity: 2 }]);
    expect(await reservedOf(a)).toBe(2);

    const res = await commit("order-commit");
    expect(res.status).toBe(201);
    expect((res.body as SettlementResult).status).toBe("committed");

    // Commit removes the copies from physical stock and clears the hold (ADR-0002).
    expect(await quantityOf(a)).toBe(3);
    expect(await reservedOf(a)).toBe(0);
    const record = await reservations.findOne({ orderId: "order-commit" }).exec();
    expect(record?.status).toBe("committed");
  });

  it("is idempotent on commit: a duplicate commit does not decrement stock twice", async () => {
    const a = await seedManga({ quantity: 5 });
    await reserve("order-commit-2", [{ mangaId: a, quantity: 2 }]);

    await commit("order-commit-2");
    const second = await commit("order-commit-2");

    // The duplicate is a no-op that echoes the already-committed status.
    expect((second.body as SettlementResult).status).toBe("committed");
    expect(await quantityOf(a)).toBe(3);
    expect(await reservedOf(a)).toBe(0);
  });

  it("releases a hold: reserved falls but quantity is untouched (payment failed/timeout)", async () => {
    const a = await seedManga({ quantity: 5 });
    await reserve("order-release", [{ mangaId: a, quantity: 2 }]);
    expect(await reservedOf(a)).toBe(2);

    const res = await release("order-release");
    expect(res.status).toBe(201);
    expect((res.body as SettlementResult).status).toBe("released");

    // Release frees the hold; the copies return to available, quantity unchanged.
    expect(await quantityOf(a)).toBe(5);
    expect(await reservedOf(a)).toBe(0);
    const record = await reservations.findOne({ orderId: "order-release" }).exec();
    expect(record?.status).toBe("released");
  });

  it("is idempotent on release: a duplicate release does not free stock twice", async () => {
    const a = await seedManga({ quantity: 5, reserved: 1 });
    await reserve("order-release-2", [{ mangaId: a, quantity: 2 }]);
    expect(await reservedOf(a)).toBe(3);

    await release("order-release-2");
    const second = await release("order-release-2");

    expect((second.body as SettlementResult).status).toBe("released");
    // Only this order's hold (2) was freed; the unrelated pre-existing hold stays.
    expect(await reservedOf(a)).toBe(1);
  });

  it("404s a commit for an order with no reservation", async () => {
    const res = await commit("order-never");
    expect(res.status).toBe(404);
  });
});
