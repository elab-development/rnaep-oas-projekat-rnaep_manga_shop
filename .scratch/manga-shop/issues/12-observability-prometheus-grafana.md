# 12. Observability (Prometheus + Grafana)

Status: ready-for-agent

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
