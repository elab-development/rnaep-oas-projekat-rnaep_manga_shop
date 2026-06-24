# 01. Foundation scaffold

Status: ready-for-agent

## Parent

[PRD: Manga Web Shop](../PRD.md)

## What to build

Stand up the monorepo skeleton that every later slice builds on (this is prefactoring — do it first). Add the four NestJS services (`auth`, `catalog`, `orders`, `payments`) and the API `gateway` as `apps/*` alongside the existing `apps/web`, each as a minimal NestJS app exposing a health endpoint and nothing else. Create skeletons for the shared packages: `packages/contracts` (event/DTO shapes, empty but importable) and a shared auth-guard package (guard + Passport JWT strategy stubs, real logic lands in slice 02).

Each app gets its own Dockerfile and its own database. `docker-compose` brings up all five services, their databases (Postgres for auth/orders/payments, Mongo for catalog), Kafka, Prometheus, and Grafana as separate containers. The goal is a verifiable "everything boots" baseline, not feature behavior.

Respects ADR-0001 (monorepo layout), ADR-0003 (Kafka-aware from day one), ADR-0004 (English terms).

## Acceptance criteria

- [ ] `apps/auth`, `apps/catalog`, `apps/orders`, `apps/payments`, `apps/gateway` exist as runnable NestJS apps, each with a health endpoint returning 200
- [ ] `packages/contracts` and the shared auth-guard package exist and are importable from the apps via the workspace
- [ ] Each app has its own Dockerfile that builds
- [ ] `docker-compose up` starts all services + their databases + Kafka + Prometheus + Grafana; each service's health check passes
- [ ] Catalog is wired to Mongo; auth/orders/payments are each wired to their own Postgres (connection verified at boot)
- [ ] A smoke test (or documented manual check) confirms all health endpoints respond through `docker-compose`

## Blocked by

- None — can start immediately
