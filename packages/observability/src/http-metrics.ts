import { Counter, Histogram, Registry } from "prom-client";

/**
 * DI token for the per-service {@link HttpMetrics} handle. Injected by the
 * metrics controller and interceptor (see `MetricsModule`).
 */
export const HTTP_METRICS = Symbol("HTTP_METRICS");

/**
 * The Prometheus text exposition content type. Hardcoded (rather than read from
 * `registry.contentType`) so the Nest controller can declare it as a static
 * `@Header`, keeping the package free of an Express `Response` dependency.
 */
export const PROM_CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8";

/**
 * The two RED-method metrics every service exposes (request Rate, Errors,
 * Duration): a request counter and a latency histogram, both labelled by
 * method / normalized route / status code. Request rate is `rate(requests)`,
 * error rate filters `status_code=~"5.."`, and latency percentiles come from
 * the histogram buckets — so these two cover the whole acceptance story.
 */
export interface HttpMetrics {
  readonly registry: Registry;
  readonly requests: Counter<string>;
  readonly duration: Histogram<string>;
}

/** Labels attached to every HTTP metric sample. */
const LABEL_NAMES = ["method", "route", "status_code"] as const;

/** Latency buckets (seconds) centred on the NFR targets (avg < 300ms, p95 <
 * 500ms) so the histogram resolves well around the numbers we care about. */
const LATENCY_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.3, 0.5, 1, 2.5, 5, 10,
];

/**
 * Builds a fresh, self-contained metrics handle for one service. Each call owns
 * its own {@link Registry} (tagged with a `service` default label), so booting
 * several apps in one process — as the integration tests do — never collides on
 * the global prom-client registry.
 */
export function createHttpMetrics(service: string): HttpMetrics {
  const registry = new Registry();
  registry.setDefaultLabels({ service });

  const requests = new Counter({
    name: "http_requests_total",
    help: "Total HTTP requests handled, by method, route and status code.",
    labelNames: LABEL_NAMES,
    registers: [registry],
  });

  const duration = new Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request latency in seconds, by method, route and status code.",
    labelNames: LABEL_NAMES,
    buckets: LATENCY_BUCKETS,
    registers: [registry],
  });

  return { registry, requests, duration };
}

/** Matches a path segment that is an opaque id: all-digits, a Mongo ObjectId
 * (24 hex), or a UUID. Such segments are collapsed to `:id` so per-order and
 * per-manga urls don't explode label cardinality. */
const ID_SEGMENT =
  /^(?:\d+|[0-9a-fA-F]{24}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;

/**
 * Reduces a request path to a bounded route label: strips the query string and
 * replaces id-like segments with `:id` (e.g. `/orders/42?x=1` → `/orders/:id`).
 */
export function normalizeRoute(rawUrl: string): string {
  const path = (rawUrl.split("?")[0] ?? "/") || "/";
  if (path === "/") return "/";
  return path
    .split("/")
    .map((segment) => (ID_SEGMENT.test(segment) ? ":id" : segment))
    .join("/");
}

/** Minimal structural view of the request fields the recorder reads. */
export interface MetricsRequest {
  readonly method?: string;
  readonly url?: string;
  readonly originalUrl?: string;
}

/** Minimal structural view of the response the recorder observes on finish. */
export interface MetricsResponse {
  readonly statusCode: number;
  once(event: "finish", listener: () => void): void;
}

/**
 * Records one HTTP request against the metrics: measures wall-clock latency and,
 * when the response finishes, increments the counter and observes the histogram
 * with the resolved status code. Used by both the gateway's Express middleware
 * and the Nest interceptor.
 */
export function recordRequest(
  metrics: HttpMetrics,
  method: string,
  route: string,
  statusCode: number,
  durationSeconds: number,
): void {
  const labels = { method, route, status_code: String(statusCode) };
  metrics.requests.inc(labels);
  metrics.duration.observe(labels, durationSeconds);
}

/**
 * Attaches a `finish` listener that records the request once the response is
 * fully sent. Returns nothing; latency is measured from the moment this is
 * called, so invoke it as early in the pipeline as possible.
 */
export function instrumentOnFinish(
  metrics: HttpMetrics,
  req: MetricsRequest,
  res: MetricsResponse,
): void {
  const start = process.hrtime.bigint();
  res.once("finish", () => {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const route = normalizeRoute(req.originalUrl ?? req.url ?? "/");
    recordRequest(
      metrics,
      req.method ?? "GET",
      route,
      res.statusCode,
      durationSeconds,
    );
  });
}
