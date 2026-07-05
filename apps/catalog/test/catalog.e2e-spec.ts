import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  MongoDBContainer,
  type StartedMongoDBContainer,
} from "@testcontainers/mongodb";
import type { MangaView, Paginated } from "@workspace/contracts";
import { Types } from "mongoose";
import request from "supertest";
import { AppModule } from "../src/app.module";
import {
  MANGA_MODEL,
  type MangaDoc,
  type MangaModel,
} from "../src/manga/manga.schema";

/**
 * Catalog transport-boundary integration tests (PRD testing seam): drive the
 * service through its HTTP controllers against a real ephemeral Mongo
 * (testcontainers), asserting observable outcomes — page counts, filtered
 * results, derived availability — never internal calls.
 */
describe("catalog browse & search (e2e)", () => {
  jest.setTimeout(180_000);

  let container: StartedMongoDBContainer;
  let app: INestApplication;

  // Fixed EUR→display rates so conversions are deterministic; Frankfurter is
  // mocked at the HTTP boundary (global fetch) so the suite never hits network.
  const RATES = { USD: 1.08, GBP: 0.85, JPY: 160 };

  beforeAll(async () => {
    jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ base: "EUR", rates: RATES }),
    } as unknown as Response);

    container = await new MongoDBContainer("mongo:8").start();
    // DatabaseModule reads MONGODB_URI when the app initialises, so set it first.
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

    const model = app.get<MangaModel>(MANGA_MODEL, { strict: false });
    await model.deleteMany({});
    await model.insertMany(FIXTURES);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app?.close();
    await container?.stop();
  });

  const list = (query = "") =>
    request(app.getHttpServer()).get(`/catalog/manga${query}`);

  it("returns the whole catalog on the default page", async () => {
    const res = await list();

    expect(res.status).toBe(200);
    const body = res.body as Paginated<MangaView>;
    expect(body.total).toBe(FIXTURES.length);
    expect(body.items).toHaveLength(FIXTURES.length);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(12);
    expect(body.totalPages).toBe(1);
  });

  it("paginates with page and limit", async () => {
    const first = (await list("?page=1&limit=5")).body as Paginated<MangaView>;
    expect(first.items).toHaveLength(5);
    expect(first.total).toBe(12);
    expect(first.totalPages).toBe(3);
    expect(first.page).toBe(1);

    const last = (await list("?page=3&limit=5")).body as Paginated<MangaView>;
    expect(last.items).toHaveLength(2);
    expect(last.page).toBe(3);
  });

  it("does not repeat items across pages", async () => {
    const a = (await list("?page=1&limit=5")).body as Paginated<MangaView>;
    const b = (await list("?page=2&limit=5")).body as Paginated<MangaView>;
    const ids = new Set([...a.items, ...b.items].map((m) => m.id));
    expect(ids.size).toBe(10);
  });

  it("searches by title (case-insensitive substring)", async () => {
    const body = (await list("?q=naruto")).body as Paginated<MangaView>;
    expect(body.total).toBe(1);
    expect(body.items[0].title).toBe("Naruto Special");
  });

  it("matches every search term in any order (token search)", async () => {
    // "special naruto" — both terms present in "Naruto Special", reversed order.
    const body = (await list("?q=special%20naruto")).body as Paginated<
      MangaView
    >;
    expect(body.total).toBe(1);
    expect(body.items[0].title).toBe("Naruto Special");
  });

  it("filters by genre", async () => {
    const body = (await list("?genre=Romance")).body as Paginated<MangaView>;
    // Five fixtures carry the Romance genre.
    expect(body.total).toBe(5);
    expect(body.items.every((m) => m.genres.includes("Romance"))).toBe(true);
  });

  it("filters by genre case-insensitively", async () => {
    const body = (await list("?genre=romance")).body as Paginated<MangaView>;
    expect(body.total).toBe(5);
  });

  it("filters by multiple genres with OR semantics", async () => {
    // Horror → Dorohedoro; Sci-Fi → Akira, Gantz → three distinct titles.
    const body = (await list("?genre=Horror&genre=Sci-Fi"))
      .body as Paginated<MangaView>;
    expect(body.total).toBe(3);
    expect(body.items.map((m) => m.title).sort()).toEqual([
      "Akira",
      "Dorohedoro",
      "Gantz",
    ]);
  });

  it("combines title search and genre filter", async () => {
    const body = (await list("?q=kaguya&genre=Romance"))
      .body as Paginated<MangaView>;
    expect(body.total).toBe(1);
    expect(body.items[0].title).toBe("Kaguya-sama");
  });

  it("lists the distinct genres present in the catalog, sorted", async () => {
    const res = await request(app.getHttpServer()).get("/catalog/genres");
    expect(res.status).toBe(200);

    const expected = [...new Set(FIXTURES.flatMap((m) => m.genres))].sort(
      (a, b) => a.localeCompare(b),
    );
    expect(res.body).toEqual(expected);
  });

  it("returns a manga's detail with computed availability", async () => {
    // Akira has quantity 10, reserved 3 → available 7.
    const { body: page } = await list("?q=akira");
    const id = (page as Paginated<MangaView>).items[0].id;

    const res = await request(app.getHttpServer()).get(`/catalog/manga/${id}`);

    expect(res.status).toBe(200);
    const manga = res.body as MangaView;
    expect(manga.title).toBe("Akira");
    expect(manga.price).toBe(1500);
    expect(manga.stock).toEqual({ quantity: 10, reserved: 3 });
    expect(manga.available).toBe(7);
  });

  it("labels each list item with display-currency conversions of its EUR price", async () => {
    // Akira is €15.00 (1500 cents) → USD 15×1.08, GBP 15×0.85, JPY 15×160.
    const body = (await list("?q=akira")).body as Paginated<MangaView>;
    expect(body.items[0].display).toEqual({
      USD: 16.2,
      GBP: 12.75,
      JPY: 2400,
    });
  });

  it("labels the detail view with display-currency conversions", async () => {
    const { body: page } = await list("?q=bakuman");
    const id = (page as Paginated<MangaView>).items[0].id;

    const res = await request(app.getHttpServer()).get(`/catalog/manga/${id}`);

    // Bakuman is €9.00 (900 cents) → USD 9×1.08, GBP 9×0.85, JPY 9×160.
    const manga = res.body as MangaView;
    expect(manga.display).toEqual({ USD: 9.72, GBP: 7.65, JPY: 1440 });
  });

  it("404s an unknown or malformed manga id", async () => {
    const missing = new Types.ObjectId().toString();
    expect(
      (await request(app.getHttpServer()).get(`/catalog/manga/${missing}`))
        .status,
    ).toBe(404);
    expect(
      (await request(app.getHttpServer()).get("/catalog/manga/not-an-id"))
        .status,
    ).toBe(404);
  });

  it("rejects an out-of-range page size with 400", async () => {
    expect((await list("?limit=0")).status).toBe(400);
    expect((await list("?limit=999")).status).toBe(400);
  });
});

/** Builds a Manga fixture with sensible defaults for the fields under test. */
function mk(
  title: string,
  genres: string[],
  quantity: number,
  reserved: number,
  price: number,
): MangaDoc {
  return {
    title,
    author: "Test Author",
    genres,
    cover: "https://example.test/cover.jpg",
    description: `${title} description`,
    price,
    stock: { quantity, reserved },
  };
}

// Twelve manga; five carry "Romance". "Naruto Special" is the lone title match
// for the search test; "Akira" (10/3) is the availability target.
const FIXTURES: MangaDoc[] = [
  mk("Akira", ["Action", "Sci-Fi"], 10, 3, 1500),
  mk("Bakuman", ["Comedy", "Romance"], 5, 0, 900),
  mk("Clover", ["Romance"], 4, 1, 800),
  mk("Dorohedoro", ["Action", "Horror"], 8, 0, 1200),
  mk("Emma", ["Romance", "Historical"], 6, 2, 1100),
  mk("Frieren", ["Adventure", "Fantasy"], 12, 0, 1300),
  mk("Gantz", ["Action", "Sci-Fi"], 7, 0, 1000),
  mk("Hunter x Hunter", ["Action", "Adventure"], 20, 5, 999),
  mk("Inuyasha", ["Adventure", "Romance"], 9, 0, 850),
  mk("Jujutsu Kaisen", ["Action", "Supernatural"], 15, 0, 1099),
  mk("Kaguya-sama", ["Comedy", "Romance"], 11, 0, 950),
  mk("Naruto Special", ["Action", "Adventure"], 25, 0, 999),
];
