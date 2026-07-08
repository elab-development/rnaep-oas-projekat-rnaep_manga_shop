import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { getJwtSecret } from "@workspace/auth-guard";
import * as jwt from "jsonwebtoken";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Orders cart transport-boundary integration tests (PRD testing seam, issue 07):
 * drive the service through its HTTP controllers against a real ephemeral
 * Postgres (testcontainers), asserting observable cart state — never internal
 * calls. Covers cart CRUD, login-required enforcement, ownership scoping (IDOR),
 * and persistence across sessions.
 */
describe("cart (e2e)", () => {
  jest.setTimeout(120_000);

  let container: StartedPostgreSqlContainer;
  let app: INestApplication;

  // Deterministic customer ids so we can mint tokens for two distinct customers.
  const CUSTOMER_A = "11111111-1111-1111-1111-111111111111";
  const CUSTOMER_B = "22222222-2222-2222-2222-222222222222";
  // Catalog Manga ids are cross-service references (ADR-0010); any opaque string.
  const MANGA_ONE = "manga-one";
  const MANGA_TWO = "manga-two";

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:18-alpine").start();
    // DrizzleModule reads DATABASE_URL when the app initialises (below), so
    // setting it here — before app.init() — is what matters, not import order.
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

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  /** Mints a valid customer token — stands in for the Auth service's login. */
  function tokenFor(customerId: string, email = "c@example.com"): string {
    return jwt.sign({ sub: customerId, role: "customer", email }, getJwtSecret(), {
      expiresIn: "60m",
    });
  }

  const getCart = (token: string) =>
    request(app.getHttpServer())
      .get("/cart")
      .set("Authorization", `Bearer ${token}`);

  const addItem = (token: string, mangaId: string, quantity: number) =>
    request(app.getHttpServer())
      .post("/cart/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ mangaId, quantity });

  const setQuantity = (token: string, mangaId: string, quantity: number) =>
    request(app.getHttpServer())
      .patch(`/cart/items/${mangaId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ quantity });

  const removeItem = (token: string, mangaId: string) =>
    request(app.getHttpServer())
      .delete(`/cart/items/${mangaId}`)
      .set("Authorization", `Bearer ${token}`);

  // Each behaviour uses its own customer id so the tests don't share cart state.
  const CUST = (n: number) =>
    `33333333-3333-3333-3333-${String(n).padStart(12, "0")}`;

  it("rejects cart access without a token (login-required, no guest cart)", async () => {
    expect((await request(app.getHttpServer()).get("/cart")).status).toBe(401);
    expect(
      (
        await request(app.getHttpServer())
          .post("/cart/items")
          .send({ mangaId: MANGA_ONE, quantity: 1 })
      ).status,
    ).toBe(401);
  });

  it("starts with an empty cart for a new customer", async () => {
    const res = await getCart(tokenFor(CUST(1)));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
  });

  it("adds a manga to the cart and persists it", async () => {
    const token = tokenFor(CUST(2));
    const added = await addItem(token, MANGA_ONE, 2);

    expect(added.status).toBe(201);
    expect(added.body.items).toEqual([{ mangaId: MANGA_ONE, quantity: 2 }]);
    // Persisted server-side: a fresh read (new "session") still sees it.
    const reread = await getCart(tokenFor(CUST(2)));
    expect(reread.body.items).toEqual([{ mangaId: MANGA_ONE, quantity: 2 }]);
  });

  it("sums the quantity when the same manga is added again", async () => {
    const token = tokenFor(CUST(3));
    await addItem(token, MANGA_ONE, 2);
    const again = await addItem(token, MANGA_ONE, 3);

    expect(again.body.items).toEqual([{ mangaId: MANGA_ONE, quantity: 5 }]);
  });

  it("keeps distinct manga as separate lines", async () => {
    const token = tokenFor(CUST(4));
    await addItem(token, MANGA_ONE, 1);
    await addItem(token, MANGA_TWO, 4);

    const res = await getCart(token);
    expect(res.body.items).toEqual([
      { mangaId: MANGA_ONE, quantity: 1 },
      { mangaId: MANGA_TWO, quantity: 4 },
    ]);
  });

  it("sets an item's absolute quantity", async () => {
    const token = tokenFor(CUST(5));
    await addItem(token, MANGA_ONE, 2);
    const updated = await setQuantity(token, MANGA_ONE, 7);

    expect(updated.status).toBe(200);
    expect(updated.body.items).toEqual([{ mangaId: MANGA_ONE, quantity: 7 }]);
  });

  it("404s when setting the quantity of a manga not in the cart", async () => {
    const res = await setQuantity(tokenFor(CUST(6)), MANGA_ONE, 3);
    expect(res.status).toBe(404);
  });

  it("removes an item and is idempotent on a repeat removal", async () => {
    const token = tokenFor(CUST(7));
    await addItem(token, MANGA_ONE, 1);
    await addItem(token, MANGA_TWO, 1);

    const afterRemove = await removeItem(token, MANGA_ONE);
    expect(afterRemove.status).toBe(200);
    expect(afterRemove.body.items).toEqual([{ mangaId: MANGA_TWO, quantity: 1 }]);

    // Removing again is a no-op, not a 404.
    const again = await removeItem(token, MANGA_ONE);
    expect(again.status).toBe(200);
    expect(again.body.items).toEqual([{ mangaId: MANGA_TWO, quantity: 1 }]);
  });

  it("rejects malformed cart writes with 400", async () => {
    const token = tokenFor(CUST(8));
    expect((await addItem(token, MANGA_ONE, 0)).status).toBe(400);
    expect((await addItem(token, "", 1)).status).toBe(400);
    expect((await addItem(token, MANGA_ONE, 1000)).status).toBe(400);
    await addItem(token, MANGA_ONE, 1);
    expect((await setQuantity(token, MANGA_ONE, 0)).status).toBe(400);
  });

  describe("ownership scoping (IDOR, ADR-0012)", () => {
    it("keeps each customer's cart private and separate", async () => {
      await addItem(tokenFor(CUSTOMER_A), MANGA_ONE, 3);

      // B reads their own cart — never A's — so B sees nothing of A's.
      const bCart = await getCart(tokenFor(CUSTOMER_B));
      expect(bCart.body.items).toEqual([]);

      // A still holds their line.
      const aCart = await getCart(tokenFor(CUSTOMER_A));
      expect(aCart.body.items).toEqual([{ mangaId: MANGA_ONE, quantity: 3 }]);
    });

    it("stops B from mutating A's cart via the same manga id", async () => {
      await addItem(tokenFor(CUSTOMER_A), MANGA_TWO, 2);

      // B's PATCH addresses B's cart, which has no such line → 404, and A is
      // untouched (ownership is token-derived, never the path/body — ADR-0007).
      const bPatch = await setQuantity(tokenFor(CUSTOMER_B), MANGA_TWO, 99);
      expect(bPatch.status).toBe(404);

      // B's DELETE likewise only ever touches B's own (empty) cart.
      const bDelete = await removeItem(tokenFor(CUSTOMER_B), MANGA_TWO);
      expect(bDelete.status).toBe(200);
      expect(bDelete.body.items).toEqual([]);

      // A's line survives B's attempts.
      const aCart = await getCart(tokenFor(CUSTOMER_A));
      expect(aCart.body.items).toContainEqual({
        mangaId: MANGA_TWO,
        quantity: 2,
      });
    });
  });
});
