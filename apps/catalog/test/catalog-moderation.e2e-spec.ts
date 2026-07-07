import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  MongoDBContainer,
  type StartedMongoDBContainer,
} from "@testcontainers/mongodb";
import { getJwtSecret } from "@workspace/auth-guard";
import type { JikanSuggestion, MangaView, Role } from "@workspace/contracts";
import { createHmac } from "node:crypto";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { MANGA_MODEL, type MangaModel } from "../src/manga/manga.schema";

/**
 * Catalog moderation transport-boundary tests (issue 05). Drives the write side
 * through its HTTP controllers against a real ephemeral Mongo (testcontainers),
 * asserting observable outcomes — persisted documents, role rejections, the
 * Jikan fill-manually fallback — never internal calls. Jikan and Frankfurter are
 * mocked at the HTTP boundary (global fetch), so the suite never hits network.
 */
describe("catalog moderation (e2e)", () => {
  jest.setTimeout(180_000);

  let container: StartedMongoDBContainer;
  let app: INestApplication;
  let model: MangaModel;

  // Fixed Frankfurter rates so any display conversions are deterministic.
  const RATES = { USD: 1.08, GBP: 0.85, JPY: 160 };

  // Whether the mocked Jikan endpoint should fail — toggled per test to exercise
  // the "fill manually" fallback (ADR-0009).
  let jikanDown = false;

  beforeAll(async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
        const url = String(input);
        if (url.includes("frankfurter")) {
          return {
            ok: true,
            json: async () => ({ base: "EUR", rates: RATES }),
          } as unknown as Response;
        }
        // Jikan `/manga?q=` search.
        if (jikanDown) throw new Error("Jikan unavailable");
        return {
          ok: true,
          json: async () => ({ data: [JIKAN_BERSERK] }),
        } as unknown as Response;
      });

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
    model = app.get<MangaModel>(MANGA_MODEL, { strict: false });
  });

  beforeEach(async () => {
    jikanDown = false;
    await model.deleteMany({});
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app?.close();
    await container?.stop();
  });

  const server = () => app.getHttpServer();

  const validBody = () => ({
    title: "Berserk",
    author: "Miura, Kentarou",
    genres: ["Action", "Fantasy"],
    cover: "https://cdn.test/berserk.jpg",
    description: "Guts, a former mercenary...",
    price: 1999,
    quantity: 7,
  });

  describe("role gating (@MinRole)", () => {
    it("rejects an anonymous create with 401", async () => {
      const res = await request(server())
        .post("/catalog/manga")
        .send(validBody());
      expect(res.status).toBe(401);
    });

    it("rejects a customer create with 403", async () => {
      const res = await request(server())
        .post("/catalog/manga")
        .set("Authorization", `Bearer ${token("customer")}`)
        .send(validBody());
      expect(res.status).toBe(403);
    });

    it("lets a moderator create (201) and persists the manga", async () => {
      const res = await request(server())
        .post("/catalog/manga")
        .set("Authorization", `Bearer ${token("moderator")}`)
        .send(validBody());

      expect(res.status).toBe(201);
      const view = res.body as MangaView;
      expect(view.title).toBe("Berserk");
      expect(view.price).toBe(1999);
      expect(view.stock).toEqual({ quantity: 7, reserved: 0 });
      expect(view.available).toBe(7);

      const stored = await model.findById(view.id).exec();
      expect(stored?.title).toBe("Berserk");
    });

    it("lets an admin create too (admin passes the moderator check)", async () => {
      const res = await request(server())
        .post("/catalog/manga")
        .set("Authorization", `Bearer ${token("admin")}`)
        .send(validBody());
      expect(res.status).toBe(201);
    });

    it("rejects a malformed create body with 400", async () => {
      const res = await request(server())
        .post("/catalog/manga")
        .set("Authorization", `Bearer ${token("moderator")}`)
        .send({ title: "", price: -1, quantity: 7 });
      expect(res.status).toBe(400);
    });
  });

  describe("Jikan-backed add", () => {
    it("prefills from a Jikan search and stores jikan_id as an add-time snapshot", async () => {
      const search = await request(server())
        .get("/catalog/jikan/search?q=berserk")
        .set("Authorization", `Bearer ${token("moderator")}`);

      expect(search.status).toBe(200);
      const suggestions = search.body as JikanSuggestion[];
      expect(suggestions).toHaveLength(1);
      const pick = suggestions[0];
      expect(pick.jikanId).toBe(2);
      expect(pick.title).toBe("Berserk");

      // Moderator picks the suggestion, adds price + stock, and creates.
      const res = await request(server())
        .post("/catalog/manga")
        .set("Authorization", `Bearer ${token("moderator")}`)
        .send({ ...pick, price: 1999, quantity: 7 });

      expect(res.status).toBe(201);
      const stored = await model.findById((res.body as MangaView).id).exec();
      expect(stored?.jikanId).toBe(2);
    });

    it("gates the Jikan search behind @MinRole('moderator')", async () => {
      const anon = await request(server()).get("/catalog/jikan/search?q=berserk");
      expect(anon.status).toBe(401);

      const customer = await request(server())
        .get("/catalog/jikan/search?q=berserk")
        .set("Authorization", `Bearer ${token("customer")}`);
      expect(customer.status).toBe(403);
    });
  });

  describe("manual add when Jikan is down (breaker fallback)", () => {
    it("serves no suggestions but still lets the moderator add manually", async () => {
      jikanDown = true;

      const search = await request(server())
        .get("/catalog/jikan/search?q=berserk")
        .set("Authorization", `Bearer ${token("moderator")}`);
      // Fallback: empty list → the UI falls back to manual entry (ADR-0009).
      expect(search.status).toBe(200);
      expect(search.body).toEqual([]);

      // Manual create never touches Jikan, so it succeeds regardless.
      const res = await request(server())
        .post("/catalog/manga")
        .set("Authorization", `Bearer ${token("moderator")}`)
        .send({ ...validBody(), title: "Hand-typed Title" });
      expect(res.status).toBe(201);
      expect((res.body as MangaView).title).toBe("Hand-typed Title");
    });
  });

  describe("edit is never clobbered by Jikan", () => {
    it("keeps moderator edits and the original jikan_id (no auto-resync)", async () => {
      const created = await request(server())
        .post("/catalog/manga")
        .set("Authorization", `Bearer ${token("moderator")}`)
        .send({ ...validBody(), jikanId: 2 });
      const id = (created.body as MangaView).id;

      // Moderator corrects the Jikan-sourced title and price.
      const edited = await request(server())
        .patch(`/catalog/manga/${id}`)
        .set("Authorization", `Bearer ${token("moderator")}`)
        .send({ title: "Berserk (Deluxe)", price: 2999 });
      expect(edited.status).toBe(200);

      // Re-fetch: the correction stuck; jikan_id is retained but never resynced.
      const detail = await request(server()).get(`/catalog/manga/${id}`);
      const view = detail.body as MangaView;
      expect(view.title).toBe("Berserk (Deluxe)");
      expect(view.price).toBe(2999);
      const stored = await model.findById(id).exec();
      expect(stored?.jikanId).toBe(2);
    });
  });

  describe("featured toggle (@MinRole('moderator'))", () => {
    const createManga = async () => {
      const created = await request(server())
        .post("/catalog/manga")
        .set("Authorization", `Bearer ${token("moderator")}`)
        .send(validBody());
      return (created.body as MangaView).id;
    };

    it("lets a moderator flag a manga as Featured and it persists", async () => {
      const id = await createManga();

      const patched = await request(server())
        .patch(`/catalog/manga/${id}`)
        .set("Authorization", `Bearer ${token("moderator")}`)
        .send({ featured: true });
      expect(patched.status).toBe(200);
      expect((patched.body as MangaView).featured).toBe(true);

      // Persists on the read model and survives a reload.
      const stored = await model.findById(id).exec();
      expect(stored?.featured).toBe(true);
      const detail = await request(server()).get(`/catalog/manga/${id}`);
      expect((detail.body as MangaView).featured).toBe(true);
    });

    it("lets a moderator unflag a Featured manga (rotate what is promoted)", async () => {
      const id = await createManga();
      await request(server())
        .patch(`/catalog/manga/${id}`)
        .set("Authorization", `Bearer ${token("moderator")}`)
        .send({ featured: true });

      const off = await request(server())
        .patch(`/catalog/manga/${id}`)
        .set("Authorization", `Bearer ${token("moderator")}`)
        .send({ featured: false });
      expect(off.status).toBe(200);
      expect((off.body as MangaView).featured).toBe(false);

      const stored = await model.findById(id).exec();
      expect(stored?.featured).toBe(false);
    });

    it("lets an admin set Featured too (ADR-0005 hierarchy)", async () => {
      const id = await createManga();

      const patched = await request(server())
        .patch(`/catalog/manga/${id}`)
        .set("Authorization", `Bearer ${token("admin")}`)
        .send({ featured: true });
      expect(patched.status).toBe(200);
      expect((patched.body as MangaView).featured).toBe(true);
    });

    it("rejects a customer Featured toggle with 403", async () => {
      const id = await createManga();

      const patched = await request(server())
        .patch(`/catalog/manga/${id}`)
        .set("Authorization", `Bearer ${token("customer")}`)
        .send({ featured: true });
      expect(patched.status).toBe(403);

      const stored = await model.findById(id).exec();
      expect(stored?.featured).toBe(false);
    });
  });

  describe("stock update", () => {
    it("updates the physical quantity", async () => {
      const created = await request(server())
        .post("/catalog/manga")
        .set("Authorization", `Bearer ${token("moderator")}`)
        .send(validBody());
      const id = (created.body as MangaView).id;

      const res = await request(server())
        .patch(`/catalog/manga/${id}/stock`)
        .set("Authorization", `Bearer ${token("moderator")}`)
        .send({ quantity: 42 });

      expect(res.status).toBe(200);
      expect((res.body as MangaView).stock.quantity).toBe(42);
    });

    it("refuses to drop quantity below reserved (overselling protection)", async () => {
      // Seed a manga already holding 3 reserved copies.
      const doc = await model.create({
        ...validBody(),
        stock: { quantity: 10, reserved: 3 },
      });

      const res = await request(server())
        .patch(`/catalog/manga/${doc.id}/stock`)
        .set("Authorization", `Bearer ${token("moderator")}`)
        .send({ quantity: 2 });

      expect(res.status).toBe(409);
    });
  });

  describe("delete (@MinRole('admin'))", () => {
    it("lets an admin delete a manga (204) and removes it", async () => {
      const created = await request(server())
        .post("/catalog/manga")
        .set("Authorization", `Bearer ${token("moderator")}`)
        .send(validBody());
      const id = (created.body as MangaView).id;

      const del = await request(server())
        .delete(`/catalog/manga/${id}`)
        .set("Authorization", `Bearer ${token("admin")}`);
      expect(del.status).toBe(204);

      expect(await model.findById(id).exec()).toBeNull();
    });

    it("rejects a moderator delete with 403 (delete is an Admin ability)", async () => {
      const created = await request(server())
        .post("/catalog/manga")
        .set("Authorization", `Bearer ${token("moderator")}`)
        .send(validBody());
      const id = (created.body as MangaView).id;

      const del = await request(server())
        .delete(`/catalog/manga/${id}`)
        .set("Authorization", `Bearer ${token("moderator")}`);
      expect(del.status).toBe(403);
    });
  });
});

/** The one Jikan `/manga` result the mock returns, in Jikan's response shape. */
const JIKAN_BERSERK = {
  mal_id: 2,
  title: "Berserk",
  authors: [{ name: "Miura, Kentarou" }],
  genres: [{ name: "Action" }, { name: "Fantasy" }],
  synopsis: "Guts, a former mercenary...",
  images: { jpg: { image_url: "https://cdn.test/berserk.jpg" } },
} satisfies Record<string, unknown>;

/**
 * Mints a JWT for a role signed with the shared secret (HS256) — the same
 * verification path any service uses (ADR-0007). Lets these tests drive
 * role-gated endpoints without standing up the Auth service.
 */
function token(role: Role): string {
  const b64 = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: `user-${role}`,
    role,
    email: `${role}@example.com`,
    iat: now,
    exp: now + 3600,
  });
  const data = `${header}.${payload}`;
  const sig = createHmac("sha256", getJwtSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}
