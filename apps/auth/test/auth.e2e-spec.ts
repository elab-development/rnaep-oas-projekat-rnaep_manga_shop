import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
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

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:18-alpine").start();
    // DrizzleModule reads DATABASE_URL when the app initialises, so set it first.
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
