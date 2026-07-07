import type { INestApplication } from "@nestjs/common";
import {
  createHttpMetrics,
  instrumentOnFinish,
  type MetricsRequest,
  type MetricsResponse,
  PROM_CONTENT_TYPE,
} from "./http-metrics";

/** The response shape the gateway middleware writes the scrape body to. */
interface GatewayResponse extends MetricsResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(chunk?: string): void;
}

/**
 * Installs metrics on the gateway (issue 12). The gateway forwards raw traffic
 * with `http-proxy-middleware`, which ends the response itself and never hands
 * off to a Nest handler — so, unlike the four downstream services, it can't use
 * the Nest interceptor. Instead a single Express middleware, registered first so
 * it wraps the proxies, both serves `GET /metrics` and records every other
 * request when its response finishes.
 */
export function installGatewayMetrics(
  app: INestApplication,
  service: string,
): void {
  const metrics = createHttpMetrics(service);

  app.use(
    (req: MetricsRequest, res: GatewayResponse, next: () => void): void => {
      const path = (req.url ?? "/").split("?")[0];
      if (req.method === "GET" && path === "/metrics") {
        res.setHeader("Content-Type", PROM_CONTENT_TYPE);
        metrics.registry
          .metrics()
          .then((body) => res.end(body))
          .catch(() => {
            res.statusCode = 500;
            res.end();
          });
        return;
      }
      instrumentOnFinish(metrics, req, res);
      next();
    },
  );
}
