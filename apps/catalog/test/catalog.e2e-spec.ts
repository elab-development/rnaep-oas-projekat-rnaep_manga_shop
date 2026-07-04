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

  beforeAll(async () => {
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

  it("filters by genre", async () => {
    const body = (await list("?genre=Romance")).body as Paginated<MangaView>;
    // Five fixtures carry the Romance genre.
    expect(body.total).toBe(5);
    expect(body.items.every((m) => m.genres.includes("Romance"))).toBe(true);
  });

  it("combines title search and genre filter", async () => {
    const body = (await list("?q=kaguya&genre=Romance"))
      .body as Paginated<MangaView>;
    expect(body.total).toBe(1);
    expect(body.items[0].title).toBe("Kaguya-sama");
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
