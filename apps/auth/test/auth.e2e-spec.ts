import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { Pool } from "pg";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Auth transport-boundary integration tests (PRD testing seam): drive the
 * service through its HTTP controllers against a real ephemeral Postgres
 * (testcontainers), asserting observable outcomes — role, token, rejections —
 * never internal calls.
 */
describe("auth (e2e)", () => {
  jest.setTimeout(120_000);

  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:18-alpine").start();
    // DrizzleModule reads DATABASE_URL when the app initialises, so set it first.
    // DrizzleModule reads DATABASE_URL when the app initialises (below), so
    // setting it here — before app.init() — is what matters, not import order.
    process.env.DATABASE_URL = container.getConnectionUri();
    // Direct handle for seeding the bootstrap admin — there's no API to mint the
    // first admin (registration always yields a customer), so an out-of-band SQL
    // promotion stands in for the operator seeding one at deploy time.
    pool = new Pool({ connectionString: container.getConnectionUri() });

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
    await pool?.end();
    await container?.stop();
  });

  const register = (email: string, password: string) =>
    request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password });

  const login = (email: string, password: string) =>
    request(app.getHttpServer()).post("/auth/login").send({ email, password });

  it("registers a new user as a customer without leaking the password", async () => {
    const res = await register("alice@example.com", "password123");

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      email: "alice@example.com",
      role: "customer",
    });
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.body.password).toBeUndefined();
  });

  it("rejects a duplicate email with 409", async () => {
    await register("dup@example.com", "password123");
    const res = await register("dup@example.com", "password123");

    expect(res.status).toBe(409);
  });

  it("rejects malformed registration input with 400", async () => {
    expect((await register("not-an-email", "password123")).status).toBe(400);
    expect((await register("short@example.com", "short")).status).toBe(400);
  });

  it("logs in with valid credentials and returns a 15-minute token", async () => {
    await register("bob@example.com", "password123");
    const res = await login("bob@example.com", "password123");

    expect(res.status).toBe(200);
    const token: string = res.body.accessToken;
    expect(token).toEqual(expect.any(String));

    const payload = decodeJwt(token);
    expect(payload.role).toBe("customer");
    expect(payload.email).toBe("bob@example.com");
    expect(payload.sub).toEqual(expect.any(String));
    expect(payload.exp - payload.iat).toBe(15 * 60);
  });

  it("rejects a wrong password and an unknown email alike with 401", async () => {
    await register("carol@example.com", "password123");

    expect((await login("carol@example.com", "wrongpass")).status).toBe(401);
    expect((await login("nobody@example.com", "password123")).status).toBe(401);
  });

  it("returns the token-derived identity from the guarded /auth/me", async () => {
    await register("dave@example.com", "password123");
    const { body } = await login("dave@example.com", "password123");

    const me = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${body.accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      email: "dave@example.com",
      role: "customer",
    });
    expect(me.body.userId).toEqual(expect.any(String));
  });

  it("rejects /auth/me without a token and with a garbage token", async () => {
    const noToken = await request(app.getHttpServer()).get("/auth/me");
    expect(noToken.status).toBe(401);

    const badToken = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", "Bearer not.a.real.token");
    expect(badToken.status).toBe(401);
  });

  describe("admin role management (issue 06)", () => {
    /** Registers a user, promotes them to admin out-of-band, returns their token. */
    async function seedAdmin(email: string): Promise<string> {
      await register(email, "password123");
      await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [
        email,
      ]);
      return (await login(email, "password123")).body.accessToken as string;
    }

    const changeRole = (token: string, id: string, role: string) =>
      request(app.getHttpServer())
        .patch(`/auth/users/${id}/role`)
        .set("Authorization", `Bearer ${token}`)
        .send({ role });

    it("lets an admin change a customer's role to moderator", async () => {
      const adminToken = await seedAdmin("admin1@example.com");
      const target = await register("promote-me@example.com", "password123");
      expect(target.body.role).toBe("customer");

      const res = await changeRole(adminToken, target.body.id, "moderator");

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: target.body.id,
        email: "promote-me@example.com",
        role: "moderator",
      });
    });

    it("issues the elevated role in the promoted user's next token", async () => {
      const adminToken = await seedAdmin("admin2@example.com");
      const target = await register("newmod@example.com", "password123");

      // Before promotion the login token is a customer.
      const before = await login("newmod@example.com", "password123");
      expect(decodeJwt(before.body.accessToken).role).toBe("customer");

      await changeRole(adminToken, target.body.id, "moderator");

      // After promotion a fresh login carries moderator — so every service's
      // guard (which reads the role from the token) now admits moderator routes.
      const after = await login("newmod@example.com", "password123");
      expect(decodeJwt(after.body.accessToken).role).toBe("moderator");
    });

    it("lists all accounts for an admin", async () => {
      const adminToken = await seedAdmin("admin3@example.com");

      const res = await request(app.getHttpServer())
        .get("/auth/users")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const emails = (res.body as Array<{ email: string }>).map((u) => u.email);
      expect(emails).toContain("admin3@example.com");
      // Never leak the password hash from the admin listing.
      expect(
        (res.body as Array<Record<string, unknown>>).every(
          (u) => u.passwordHash === undefined,
        ),
      ).toBe(true);
    });

    it("rejects a customer from managing roles with 403 (exact @Roles('admin'))", async () => {
      await register("cust@example.com", "password123");
      const target = await register("victim1@example.com", "password123");
      const { body } = await login("cust@example.com", "password123");

      const change = await changeRole(body.accessToken, target.body.id, "admin");
      expect(change.status).toBe(403);

      const listed = await request(app.getHttpServer())
        .get("/auth/users")
        .set("Authorization", `Bearer ${body.accessToken}`);
      expect(listed.status).toBe(403);
    });

    it("rejects a moderator too — @Roles('admin') is exact, not hierarchical", async () => {
      const adminToken = await seedAdmin("admin4@example.com");
      const mod = await register("mod@example.com", "password123");
      await changeRole(adminToken, mod.body.id, "moderator");
      const { body } = await login("mod@example.com", "password123");
      expect(decodeJwt(body.accessToken).role).toBe("moderator");

      const target = await register("victim2@example.com", "password123");
      const change = await changeRole(body.accessToken, target.body.id, "admin");
      expect(change.status).toBe(403);
    });

    it("rejects an unauthenticated role change with 401", async () => {
      const target = await register("victim3@example.com", "password123");
      const res = await request(app.getHttpServer())
        .patch(`/auth/users/${target.body.id}/role`)
        .send({ role: "moderator" });
      expect(res.status).toBe(401);
    });

    it("404s when the target user does not exist", async () => {
      const adminToken = await seedAdmin("admin5@example.com");
      const res = await changeRole(
        adminToken,
        "00000000-0000-0000-0000-000000000000",
        "moderator",
      );
      expect(res.status).toBe(404);
    });

    it("400s an invalid target role", async () => {
      const adminToken = await seedAdmin("admin6@example.com");
      const target = await register("victim4@example.com", "password123");
      const res = await changeRole(adminToken, target.body.id, "superuser");
      expect(res.status).toBe(400);
    });
  });

  describe("batch email resolution (issue 10)", () => {
    async function seedAdmin(email: string): Promise<string> {
      await register(email, "password123");
      await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [
        email,
      ]);
      return (await login(email, "password123")).body.accessToken as string;
    }

    const resolveEmails = (token: string | null, ids: string[]) => {
      const req = request(app.getHttpServer())
        .post("/auth/users/emails")
        .send({ ids });
      return token ? req.set("Authorization", `Bearer ${token}`) : req;
    };

    it("resolves a batch of ids to emails for an admin, omitting unknown ids", async () => {
      const adminToken = await seedAdmin("resolver@example.com");
      const a = await register("order-cust-a@example.com", "password123");
      const b = await register("order-cust-b@example.com", "password123");
      const unknown = "00000000-0000-0000-0000-000000000000";

      const res = await resolveEmails(adminToken, [
        a.body.id,
        b.body.id,
        unknown,
      ]);

      expect(res.status).toBe(200);
      const resolved = res.body as Array<{ id: string; email: string }>;
      // Both known users are resolved; the unknown id is simply absent.
      expect(resolved).toHaveLength(2);
      expect(resolved).toContainEqual({
        id: a.body.id,
        email: "order-cust-a@example.com",
      });
      expect(resolved).toContainEqual({
        id: b.body.id,
        email: "order-cust-b@example.com",
      });
      // Never leak the password hash through the resolver.
      expect(
        resolved.every(
          (u) => (u as Record<string, unknown>).passwordHash === undefined,
        ),
      ).toBe(true);
    });

    it("returns an empty list for an empty batch", async () => {
      const adminToken = await seedAdmin("resolver-empty@example.com");
      const res = await resolveEmails(adminToken, []);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("forbids a non-admin from resolving emails (exact @Roles('admin'))", async () => {
      await register("nosy-cust@example.com", "password123");
      const { body } = await login("nosy-cust@example.com", "password123");
      const res = await resolveEmails(body.accessToken, [
        "00000000-0000-0000-0000-000000000000",
      ]);
      expect(res.status).toBe(403);
    });

    it("rejects an unauthenticated resolve with 401", async () => {
      const res = await resolveEmails(null, [
        "00000000-0000-0000-0000-000000000000",
      ]);
      expect(res.status).toBe(401);
    });

    it("400s a malformed batch (ids not uuids)", async () => {
      const adminToken = await seedAdmin("resolver-bad@example.com");
      const res = await resolveEmails(adminToken, ["not-a-uuid"]);
      expect(res.status).toBe(400);
    });
  });
});

interface DecodedPayload {
  sub: string;
  role: string;
  email: string;
  iat: number;
  exp: number;
}

function decodeJwt(token: string): DecodedPayload {
  const [, payload] = token.split(".");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}
