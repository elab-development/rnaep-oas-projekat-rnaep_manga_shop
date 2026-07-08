/**
 * Shared observability package (issue 12). Prometheus `/metrics` for every
 * service: a Nest `MetricsModule` for the four downstream services and an
 * Express installer for the thin gateway, both emitting the same request-rate /
 * latency / error metrics so the Grafana dashboards can treat them uniformly.
 */
export * from "./http-metrics";
export * from "./metrics.controller";
export * from "./metrics.interceptor";
export * from "./metrics.module";
export * from "./gateway-metrics";
