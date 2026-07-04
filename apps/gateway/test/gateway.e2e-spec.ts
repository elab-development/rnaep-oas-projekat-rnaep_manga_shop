import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import request from "supertest";
import { createGateway } from "../src/create-gateway";

/**
 * Gateway transport-boundary tests: drive the thin gateway and assert it
 * routes, fast-fails, and applies CORS (ADR-0007, ADR-0011). The downstream
 * "auth service" is a stub HTTP server so we observe exactly what the gateway
 * forwards (path, method, body) without booting the real service.
 */
describe("gateway (e2e)", () => {
  const SECRET = "gateway-test-secret";
  const ORIGIN = "http://localhost:3010";

  let downstream: Server;
  let received: { url?: string; method?: string; body?: string };
  let app: INestApplication;

  beforeAll(async () => {
    received = {};
    downstream = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        received = { url: req.url, method: req.method, body };
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: true, path: req.url }));
      });
    });
    await new Promise<void>((resolve) => downstream.listen(0, resolve));
    const port = (downstream.address() as AddressInfo).port;

    process.env.JWT_SECRET = SECRET;
    process.env.FRONTEND_ORIGIN = ORIGIN;
    process.env.AUTH_SERVICE_URL = `http://127.0.0.1:${port}`;
    process.env.CATALOG_URL = `http://127.0.0.1:${port}`;

    app = await createGateway();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await new Promise<void>((resolve) => downstream.close(() => resolve()));
  });

  it("serves its own health route without proxying", async () => {
    const res = await request(app.getHttpServer()).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "gateway" });
  });

  it("proxies /auth/* to the auth service with the body intact and no token required", async () => {
    received = {};
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "a@b.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(received.method).toBe("POST");
    expect(received.url).toBe("/auth/login");
    expect(JSON.parse(received.body ?? "{}")).toEqual({
      email: "a@b.com",
      password: "password123",
    });
  });

  it("proxies /catalog/* to the catalog service with no token required (Guest browse)", async () => {
    received = {};
    const res = await request(app.getHttpServer()).get(
      "/catalog/manga?q=naruto&page=1",
    );

    expect(res.status).toBe(200);
    expect(received.method).toBe("GET");
    expect(received.url).toBe("/catalog/manga?q=naruto&page=1");
  });

  it("rejects an invalid token before it reaches the service (fast-fail)", async () => {
    received = {};
    const res = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", "Bearer not-a-valid-token");

    expect(res.status).toBe(401);
    expect(received.url).toBeUndefined();
  });

  it("lets a validly-signed token through to the service", async () => {
    received = {};
    const token = jwt.sign({ sub: "u1", role: "customer" }, SECRET, {
      expiresIn: "15m",
    });
    const res = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(received.url).toBe("/auth/me");
  });

  it("locks CORS to the frontend origin and never echoes another origin", async () => {
    const allowed = await request(app.getHttpServer())
      .options("/auth/login")
      .set("Origin", ORIGIN)
      .set("Access-Control-Request-Method", "POST");
    expect(allowed.headers["access-control-allow-origin"]).toBe(ORIGIN);

    // A foreign origin must never be reflected back; the gateway only ever
    // advertises the single configured frontend origin (the browser then
    // blocks the mismatch). This is the load-bearing CSRF/CORS guarantee.
    const foreign = await request(app.getHttpServer())
      .options("/auth/login")
      .set("Origin", "http://evil.example")
      .set("Access-Control-Request-Method", "POST");
    expect(foreign.headers["access-control-allow-origin"]).not.toBe(
      "http://evil.example",
    );
  });
});
