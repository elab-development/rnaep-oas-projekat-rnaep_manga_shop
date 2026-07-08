import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("orders health (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health returns 200 with status ok", async () => {
    const res = await request(app.getHttpServer()).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "orders" });
  });

  it("exposes /metrics in Prometheus format tagged with the service", async () => {
    const res = await request(app.getHttpServer()).get("/metrics");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.text).toContain("http_requests_total");
    expect(res.text).toContain('service="orders"');
  });

  it("records handled requests in the metrics", async () => {
    await request(app.getHttpServer()).get("/health");

    const res = await request(app.getHttpServer()).get("/metrics");
    expect(res.text).toMatch(
      /http_requests_total\{[^}]*route="\/health"[^}]*\}\s+[1-9]/,
    );
  });
});
