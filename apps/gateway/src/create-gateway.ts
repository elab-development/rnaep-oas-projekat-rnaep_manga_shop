import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { createProxyMiddleware } from "http-proxy-middleware";
import { AppModule } from "./app.module";
import { jwtFastFail } from "./jwt-fast-fail.middleware";

const DEFAULT_FRONTEND_ORIGIN = "http://localhost:3010";
const DEFAULT_AUTH_SERVICE_URL = "http://localhost:3001";
const DEFAULT_CATALOG_SERVICE_URL = "http://localhost:3002";
const DEFAULT_ORDERS_SERVICE_URL = "http://localhost:3003";
const DEFAULT_PAYMENTS_SERVICE_URL = "http://localhost:3004";

/**
 * Builds the thin API gateway (ADR-0011): the single CORS boundary locked to
 * the frontend origin, fast-fail JWT validation, and path→service routing. It
 * owns no database and composes nothing — cross-service stitching lives in the
 * Next.js server layer. Exported (not auto-started) so tests can drive it.
 */
export async function createGateway(): Promise<INestApplication> {
  // Disable Nest's body parser so proxied request bodies stream through
  // untouched to the downstream service.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? DEFAULT_FRONTEND_ORIGIN,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  });

  app.use(jwtFastFail);

  app.use(
    createProxyMiddleware((pathname) => pathname.startsWith("/auth"), {
      target: process.env.AUTH_SERVICE_URL ?? DEFAULT_AUTH_SERVICE_URL,
      changeOrigin: true,
    }),
  );

  // Catalog browse/search is Guest-accessible: jwtFastFail lets tokenless
  // requests through, so no auth is required to reach `/catalog/*` (ADR-0011).
  app.use(
    createProxyMiddleware((pathname) => pathname.startsWith("/catalog"), {
      target: process.env.CATALOG_URL ?? DEFAULT_CATALOG_SERVICE_URL,
      changeOrigin: true,
    }),
  );

  // Cart is login-required (ADR-0010): a tokenless `/cart` request is passed
  // through by jwtFastFail and rejected by the Orders service's own guard, which
  // also derives the owning customer from the verified token (ADR-0007).
  app.use(
    createProxyMiddleware((pathname) => pathname.startsWith("/cart"), {
      target: process.env.ORDERS_URL ?? DEFAULT_ORDERS_SERVICE_URL,
      changeOrigin: true,
    }),
  );

  // Checkout (issue 08) is likewise login-required and lives in Orders. Only
  // `/orders` and `/cart` route there; Catalog's `/internal/*` reserve boundary
  // is deliberately not exposed by the gateway (ADR-0011), so a browser can never
  // reach it — Orders calls it service-to-service.
  app.use(
    createProxyMiddleware((pathname) => pathname.startsWith("/orders"), {
      target: process.env.ORDERS_URL ?? DEFAULT_ORDERS_SERVICE_URL,
      changeOrigin: true,
    }),
  );

  // Payments (issue 09) lives in the Payments service. `/payments/checkout-session`
  // is login-required (Payments' own guard verifies the token); `/payments/webhook`
  // is called by Stripe, not the browser — it carries no JWT (jwtFastFail lets a
  // tokenless request through) and is authenticated by its signature instead
  // (ADR-0008). Catalog/Orders `/internal/*` settle boundaries are still never
  // exposed here (ADR-0011); Payments calls those service-to-service.
  app.use(
    createProxyMiddleware((pathname) => pathname.startsWith("/payments"), {
      target: process.env.PAYMENTS_URL ?? DEFAULT_PAYMENTS_SERVICE_URL,
      changeOrigin: true,
    }),
  );

  app.enableShutdownHooks();
  return app;
}
