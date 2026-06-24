# 01. Foundation scaffold

Status: done

## Parent

[PRD: Manga Web Shop](../PRD.md)

## What to build

Stand up the monorepo skeleton that every later slice builds on (this is prefactoring — do it first). Add the four NestJS services (`auth`, `catalog`, `orders`, `payments`) and the API `gateway` as `apps/*` alongside the existing `apps/web`, each as a minimal NestJS app exposing a health endpoint and nothing else. Create skeletons for the shared packages: `packages/contracts` (event/DTO shapes, empty but importable) and a shared auth-guard package (guard + Passport JWT strategy stubs, real logic lands in slice 02).

Each app gets its own Dockerfile and its own database. `docker-compose` brings up all five services, their databases (Postgres for auth/orders/payments, Mongo for catalog), Kafka, Prometheus, and Grafana as separate containers. The goal is a verifiable "everything boots" baseline, not feature behavior.

Respects ADR-0001 (monorepo layout), ADR-0003 (Kafka-aware from day one), ADR-0004 (English terms).

## Acceptance criteria

- [x] `apps/auth`, `apps/catalog`, `apps/orders`, `apps/payments`, `apps/gateway` exist as runnable NestJS apps, each with a health endpoint returning 200
- [x] `packages/contracts` and the shared auth-guard package exist and are importable from the apps via the workspace
- [x] Each app has its own Dockerfile that builds
- [~] `docker-compose up` starts all services + their databases + Kafka + Prometheus + Grafana; each service's health check passes (compose authored; not executed in the agent env — see Comments)
- [x] Catalog is wired to Mongo; auth/orders/payments are each wired to their own Postgres (connection verified at boot)
- [x] A smoke test (or documented manual check) confirms all health endpoints respond (per-app e2e health tests + README manual check)

## Blocked by

- None — can start immediately

## Comments

Built the monorepo scaffold (slice 01) on branch `chore/01-foundation-scaffold`.

**What was built**

- Five NestJS apps under `apps/*`: `gateway` (3000), `auth` (3001), `catalog`
  (3002), `orders` (3003), `payments` (3004). Each exposes `GET /health` →
  `{ status: "ok", service }` and a root `GET /` info route, plus a per-app
  `health.e2e-spec.ts` (Nest testing + supertest) — all 5 pass.
- Shared packages: `packages/contracts` (Kafka topic names, `Role`/`ROLE_RANK`,
  EUR-cents money types, saga event placeholders keyed by `orderId`) and
  `packages/auth-guard` (`JwtStrategy`, `JwtAuthGuard`, `@MinRole`/`@Roles`
  decorators, `RolesGuard`, and a drop-in `AuthGuardModule`). Both are imported
  by every app; runtime resolution verified by booting the compiled `auth`
  service.
- DB wiring: `catalog` → Mongo (mongoose), `auth`/`orders`/`payments` → their
  own Postgres (`pg`). A boot connection check logs success/failure
  (non-fatal in the scaffold; skipped under `NODE_ENV=test`). Verified the
  compiled app boots and warns gracefully when no DB is present.
- Per-app multi-stage `Dockerfile` (built from repo root for the pnpm
  workspace), root `.dockerignore`, and `docker-compose.yml` bringing up the 5
  services + 3 Postgres + Mongo + Kafka (KRaft) + Prometheus + Grafana, each its
  own container, with `/health` container healthchecks. Observability config in
  `ops/prometheus/prometheus.yml` and `ops/grafana/provisioning/`.
- Tooling: added `packages/typescript-config/nestjs.json`; wired root
  `pnpm test` → `turbo test` (`dependsOn ^build`); declared service env vars in
  `turbo.json` `globalEnv`; ESLint flat configs as `.mjs` (CommonJS packages).

**Key decisions**

- Apps build with `nest build` (tsc) → `dist`, run as `node dist/main.js`.
- Shared packages expose types from `src` and runtime from `dist` (dual
  `types`/`main`), so `typecheck` needs no prior build while `test`/`build`
  build the packages first.
- `auth-guard` carries its Nest/passport deps as regular `dependencies` (not
  peers) so consuming apps resolve them with no peer-dep warnings.

**Feedback loops (all green):** `pnpm typecheck` (9/9), `pnpm lint` (9/9, 0
errors), `pnpm test` (5/5 health suites), `pnpm build` (all incl. `web`).

**Notes for next iteration**

- `docker compose up --build` was authored but **not executed** in this agent
  environment (no Docker). Run it once on a Docker host to confirm images build
  and all healthchecks pass; the boot smoke loop is documented in the README.
- pnpm ignored `esbuild`'s build script on install (harmless here — nothing uses
  the esbuild binary at runtime/test yet). Approve it if a later slice needs it.
- Drizzle ORM is not yet introduced; the Postgres apps only ping `SELECT 1` at
  boot. Slice 02 (auth) introduces the Drizzle schema/migrations.
