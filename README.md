# Manga Web Shop

An online shop for physical manga volumes — NestJS microservices behind an API
gateway with a Next.js frontend. Authoritative decisions live in `docs/adr/`
(ADR-0001…0013); domain vocabulary in `CONTEXT.md`; the master PRD and issues in
`.scratch/manga-shop/`.

## Layout

A pnpm + Turborepo monorepo (ADR-0001):

| Workspace                  | Role                                              | DB        | Port |
| -------------------------- | ------------------------------------------------- | --------- | ---- |
| `apps/gateway`             | Thin API gateway (JWT, CORS, routing) — ADR-0011  | —         | 3000 |
| `apps/auth`                | Users, roles, JWT issuance                        | Postgres  | 3001 |
| `apps/catalog`             | Manga, stock, Jikan/Frankfurter                   | MongoDB   | 3002 |
| `apps/orders`              | Cart, orders, order status                        | Postgres  | 3003 |
| `apps/payments`            | Stripe payments + payment events                  | Postgres  | 3004 |
| `apps/web`                 | Next.js storefront + admin/moderator panels       | —         | —    |
| `packages/contracts`       | Shared event/DTO contracts (Kafka-aware)          | —         | —    |
| `packages/auth-guard`      | Shared JWT strategy + role guards (ADR-0007/0005) | —         | —    |

## Develop

```bash
pnpm install
pnpm typecheck   # type-check every workspace
pnpm lint        # lint every workspace
pnpm test        # run each service's tests (builds shared packages first)
```

## Run

Two workflows share one `docker-compose.yml` (ADR-0001 — a database per
service).

### Dev servers + dockerized databases (day-to-day)

Bring up just the backing infra (the four databases + Kafka, with host ports
published), then run every app as a hot-reloading dev server:

```bash
docker compose up -d   # postgres-auth :55432, postgres-orders :55433,
                       # postgres-payments :55434, mongo :27017, kafka :9092
                       # (5543x on the host avoids clashing with a native Postgres)
pnpm dev               # turbo runs each app's dev server (web on :3010)
```

The services fall back to those `localhost` databases when `DATABASE_URL` /
`MONGODB_URI` are unset, so no `.env` file is needed.

### Full stack in containers

The `full` profile additionally builds and runs the five services plus the
Next.js web app:

```bash
docker compose --profile full up --build
```

Prometheus + Grafana live on a separate, opt-in `observability` profile (they're
only useful once the services are running). Add it to bring the metrics stack up
alongside the app:

```bash
docker compose --profile full --profile observability up --build
```

### Boot smoke check

Slice 01 only proves "everything boots". Each service exposes a `/health`
endpoint (also wired as its container healthcheck). Once `docker compose ps`
shows the services healthy, confirm each one:

```bash
for port in 3000 3001 3002 3003 3004; do
  echo "port $port:" && curl -s "http://localhost:$port/health"; echo
done
# each should print: {"status":"ok","service":"<name>"}
```

With the `observability` profile up, Prometheus is at <http://localhost:9090>
and Grafana at <http://localhost:3030> (admin/admin). See
[Observability](#observability-slice-12) below.

## Observability (slice 12)

Every service (`gateway`, `auth`, `catalog`, `orders`, `payments`) exposes a
Prometheus `/metrics` endpoint via the shared `@workspace/observability`
package: an `http_requests_total` counter and an `http_request_duration_seconds`
histogram, both labelled by `method`, `route` (id segments collapsed to `:id`),
and `status_code`, and tagged with the service name. From those, dashboards
derive request rate, error rate (`status_code=~"5.."`), and latency (p95 + avg).

The four downstream NestJS services record via a global interceptor
(`MetricsModule.forRoot(...)`); the thin gateway uses an Express middleware
(`installGatewayMetrics`) so it also counts the traffic it proxies.

```bash
for port in 3000 3001 3002 3003 3004; do
  echo "== port $port ==" && curl -s "http://localhost:$port/metrics" | head -3
done
```

Prometheus (<http://localhost:9090>) scrapes all five as the `services` job;
its **Status → Targets** page should show them **up**. Grafana
(<http://localhost:3030>, admin/admin) auto-loads the **Manga Shop — Services
Overview** dashboard (request rate, error rate, p95/avg latency per service).
Generate some traffic through the gateway (browse the catalog, place an order)
and the panels populate within a scrape interval or two.

## Auth (slice 02)

Account creation and login (ADR-0005 single role, ADR-0007 stateless JWT). The
frontend talks only to the gateway, which proxies `/auth/*` to the Auth service:

| Route                | Auth   | Purpose                                          |
| -------------------- | ------ | ------------------------------------------------ |
| `POST /auth/register`| public | Create a `customer`; bcrypt-hashed password      |
| `POST /auth/login`   | public | Returns a 15-min JWT `{ accessToken }`           |
| `GET  /auth/me`      | Bearer | Echoes the token-derived identity (guard demo)   |

The token travels in the `Authorization: Bearer` header (never a cookie) and is
verified locally by each service via `@workspace/auth-guard`. The gateway
fast-fails an invalid/expired token before proxying. Web pages: `/register`,
`/login` (the token is kept in `localStorage`).

Optional env (sensible dev fallbacks if unset):

| Var                      | Used by | Default                                  |
| ------------------------ | ------- | ---------------------------------------- |
| `JWT_SECRET`             | all     | shared dev secret (set in prod)          |
| `FRONTEND_ORIGIN`        | gateway | `http://localhost:3010` (CORS allow-list)|
| `AUTH_SERVICE_URL`       | gateway | `http://localhost:3001`                  |
| `NEXT_PUBLIC_GATEWAY_URL`| web     | `http://localhost:3000`                  |

Auth runs Drizzle migrations at boot; the schema lives in `apps/auth/drizzle/`
(`pnpm --filter auth exec drizzle-kit generate` regenerates after schema edits).

## Payments & Stripe (slice 09)

Payment uses Stripe's **hosted Checkout Session** (ADR-0008): the browser is
redirected to Stripe's page, and the **signature-verified webhook — not the
redirect — is the source of truth** for the outcome. The session's 30-minute
`expires_at` is the reservation clock; `completed` commits stock and marks the
order `paid`, `expired`/failure releases stock and cancels it.

This needs two secrets. Without a valid `STRIPE_SECRET_KEY`, "Pay with card"
fails loudly with a **502** ("couldn't reach the card payment provider") — never
a misleading sign-in prompt.

| Var                     | Required for                | Where to get it                                     |
| ----------------------- | --------------------------- | --------------------------------------------------- |
| `STRIPE_SECRET_KEY`     | reaching Stripe checkout    | Dashboard → Developers → API keys (Test mode). Prefer a **restricted key** (`rk_test_…`) scoped to _Checkout Sessions: Write_ over a full secret key (`sk_test_…`) — least privilege if it leaks |
| `STRIPE_WEBHOOK_SECRET` | orders **confirming** (paid)| Stripe CLI `stripe listen` (`whsec_…`, stable per account) |

### Where to put the secrets

The image **never** contains secrets — it's a generic artifact; config is
injected at runtime (`.env` files are excluded via `.dockerignore`). One
git-ignored file, `apps/payments/.env`, feeds both local runtimes:

```bash
cp apps/payments/.env.example apps/payments/.env   # then fill in your test keys
```

| Runtime                          | How `apps/payments/.env` is loaded                    |
| -------------------------------- | ----------------------------------------------------- |
| `pnpm dev`                       | `apps/payments/src/load-env.ts` reads it at startup   |
| `docker compose --profile full`  | `env_file:` injects it into the container             |
| GHCR image (CI / prod)           | inject at runtime (`--env-file`, `-e`, or a secrets store) — **not** in `.env` |

Under docker-compose the `environment:` block overrides the file's dev-only
`localhost` URLs (`DATABASE_URL`, `CATALOG_URL`, …) with the in-cluster
hostnames, so leave those commented out in `.env`.

### Confirming payments locally

To reach Stripe's checkout page you only need `STRIPE_SECRET_KEY`. For an order
to actually flip to `paid`, Stripe must reach the webhook — run the Stripe CLI in
a second terminal and copy the `whsec_…` it prints into `apps/payments/.env`:

```bash
stripe listen --forward-to localhost:3000/payments/webhook
```

That CLI secret is **stable across runs** for your account — set it once. A
deployed endpoint registered in the Stripe Dashboard gets its **own** signing
secret; use that value for `STRIPE_WEBHOOK_SECRET` in production.

Payments runs Drizzle migrations at boot; the schema lives in
`apps/payments/drizzle/`.
