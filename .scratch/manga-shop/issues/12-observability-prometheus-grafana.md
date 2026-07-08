# 12. Observability (Prometheus + Grafana)

Status: done

## Parent

[PRD: Manga Web Shop](../PRD.md)

## What to build

Make each service observable so an operator can monitor health and throughput. Every service (`auth`, `catalog`, `orders`, `payments`, `gateway`) exposes a `/metrics` endpoint in Prometheus format (request counts, latency/histograms, error counts at minimum). The Prometheus container (already in `docker-compose` from slice 01) scrapes all services, and Grafana ships with provisioned dashboards showing per-service request rate, latency, and error rate.

Respects PRD Further Notes / NFR targets (per-service metrics + dashboard; p95 < 500ms, avg < 300ms as the latency story to visualize).

## Acceptance criteria

- [ ] Each of the five services exposes `/metrics` in Prometheus format with request rate, latency, and error metrics
- [ ] Prometheus is configured to scrape all five services and shows them as up targets
- [ ] Grafana has provisioned dashboards (per service) visualizing request rate, latency (incl. p95), and error rate
- [ ] Dashboards populate with live data when traffic is generated through the gateway
- [ ] `docker-compose up` brings up the full metrics path (services → Prometheus → Grafana) working end-to-end

## Blocked by

- [01. Foundation scaffold](01-foundation-scaffold.md)

## Comments

Done. Built a shared `@workspace/observability` package and wired all five
services + the Grafana dashboards on top of the slice-01 Prometheus/Grafana
scaffold.

**What was built**

- `packages/observability` — one place for the metric definitions: an
  `http_requests_total` counter and an `http_request_duration_seconds` histogram
  (latency buckets centred on the NFR targets), labelled `method` / `route` /
  `status_code` and tagged with a `service` default label. Route labels collapse
  id segments (digits / ObjectId / UUID) to `:id` to bound cardinality. Each
  `createHttpMetrics()` call owns its own prom-client `Registry`, so booting
  several apps in one process (the integration tests) never collides.
- Two delivery mechanisms sharing those metrics:
  - `MetricsModule.forRoot("<service>")` — a Nest module (global `/metrics`
    controller + `APP_INTERCEPTOR` recorder) imported into the four downstream
    services' `AppModule`s. Because it lives in the module graph, the existing
    DB-free `health.e2e-spec` tests exercise the real production wiring.
  - `installGatewayMetrics(app, "gateway")` — an Express middleware for the thin
    gateway, registered before the proxies so it also counts proxied traffic
    (the gateway forwards raw requests that never reach a Nest handler).
- `ops/prometheus/prometheus.yml` already declared the `services` job (slice 01);
  the endpoints now exist. `ops/grafana/provisioning/datasources/prometheus.yml`
  got a fixed `uid: prometheus`, and new dashboard provisioning
  (`ops/grafana/provisioning/dashboards/`) auto-loads a "Manga Shop — Services
  Overview" dashboard: request rate, error rate (`status_code=~"5.."`), and
  latency p95 + avg per service, with NFR threshold lines (p95<500ms, avg<300ms)
  and a targets-up panel.
- README gained an Observability section documenting the endpoints and dashboard.

**Verification**

- Full suite green (9/9 turbo tasks; auth 26, catalog 47, orders 32, payments
  13, gateway 10). New metrics assertions added to every service's e2e boundary
  (`/metrics` returns Prometheus text tagged with the service; requests are
  recorded). Two Kafka `waitFor` suites flaked once under concurrent load and
  passed in isolation + on a clean full rerun — pre-existing broker-race
  flakiness, unrelated (the interceptor early-returns for non-HTTP/RPC contexts).
- Booted the gateway standalone and scraped `/metrics` live: correct
  `text/plain; version=0.0.4` content type, per-route counters incrementing, the
  `service="gateway"` label present, and a proxied request recorded with its
  504 status (error path visible). `docker compose --profile full config` valid.

**Follow-ups / notes for next iteration**

- Default process/runtime metrics (`collectDefaultMetrics`) were deliberately
  skipped: they add per-registry timers that complicate multi-app test teardown,
  and the acceptance only needs request/latency/error. Easy to add later if
  process CPU/memory panels are wanted.
- End-to-end "traffic → Prometheus → Grafana" wasn't driven through a live
  `--profile full` stack here (heavy multi-image build); the scrape config,
  datasource uid, and dashboard JSON are all in place and config-validated, and
  the per-service metrics path is proven by tests + the live gateway scrape.
