# Manga Web Shop

An online shop for physical manga volumes — NestJS microservices behind an API
gateway with a Next.js frontend. Guests browse and search a catalog; customers
build a cart, check out, and pay by card (Stripe); moderators curate the catalog
and stock; admins manage users and oversee orders. Stock is **reserved before
payment** and committed on success or released on failure/timeout, so customers
never pay for something that's gone.

Authoritative decisions live in `docs/adr/` (ADR-0001…0016); domain vocabulary
in `CONTEXT.md`; the master PRD and issues in `.scratch/manga-shop/` (plus the
homepage/SEO cycle in `.scratch/homepage-landing-seo/`).

## Layout

A pnpm + Turborepo monorepo (ADR-0001):

| Workspace                  | Role                                              | DB        | Port |
| -------------------------- | ------------------------------------------------- | --------- | ---- |
| `apps/gateway`             | Thin API gateway (JWT, CORS, routing) — ADR-0011  | —         | 3000 |
| `apps/auth`                | Users, roles, JWT issuance                        | Postgres  | 3001 |
| `apps/catalog`             | Manga, stock, Jikan/Frankfurter, reservations     | MongoDB   | 3002 |
| `apps/orders`              | Cart, orders, order status                        | Postgres  | 3003 |
| `apps/payments`            | Stripe payments + payment events                  | Postgres  | 3004 |
| `apps/web`                 | Next.js storefront + admin/moderator panels       | —         | 3010 |
| `packages/contracts`       | Shared event/DTO contracts (Kafka-aware)          | —         | —    |
| `packages/auth-guard`      | Shared JWT strategy + role guards (ADR-0007/0005) | —         | —    |
| `packages/messaging`       | Shared Kafka client + saga topics (ADR-0013)      | —         | —    |
| `packages/observability`   | Shared Prometheus metrics (ADR-0012 phase)        | —         | —    |
| `packages/ui`              | Shared neo-brutalist primitives (ADR-0014/0015)   | —         | —    |
| `packages/{eslint,typescript}-config` | Shared lint / tsconfig bases          | —         | —    |

`tools/diagram-brand/` holds the neo-brutalist toolkit that renders every
generated diagram (ADR-0014 house style) to SVG + PNG.

## Develop

```bash
pnpm install
pnpm typecheck   # type-check every workspace
pnpm lint        # lint every workspace
pnpm build       # build every workspace
pnpm test        # run each service's integration tests (builds shared packages first)
```

CI runs exactly this quality gate plus a Dockerfile build matrix on every push
and PR — see [CI](#ci-slice-14).

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
`MONGODB_URI` are unset, so no `.env` file is needed. `pnpm dev` also starts the
Stripe webhook listener alongside the apps.

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

Each service exposes a `/health` endpoint (also wired as its container
healthcheck). Once `docker compose ps` shows the services healthy, confirm each
one:

```bash
for port in 3000 3001 3002 3003 3004; do
  echo "port $port:" && curl -s "http://localhost:$port/health"; echo
done
# each should print: {"status":"ok","service":"<name>"}
```

With the `observability` profile up, Prometheus is at <http://localhost:9090>
and Grafana at <http://localhost:3030> (admin/admin). See
[Observability](#observability-slice-12) below.

## Roles & access (ADR-0005)

A single hierarchical `role` enum — `customer | moderator | admin` — not an M:N
table. Registration defaults to `customer`. Two guard styles ship in
`@workspace/auth-guard`:

- `@MinRole('moderator')` — hierarchical, so an admin passes a moderator check.
- `@Roles('admin', …)` — exact allow-list, no inheritance.

Identity for every ownership check comes from the **verified token**, never the
request body or params (IDOR protection). Web role gating (`isAdmin` /
`isModerator`) is UX-only; the services are the real authority.

| Role      | Can                                                                    |
| --------- | --------------------------------------------------------------------- |
| Guest     | Browse & search the catalog, view details, register                   |
| Customer  | Everything a guest can + cart, checkout, pay, view own order history   |
| Moderator | Everything a customer can + manage catalog/stock, toggle **Featured**  |
| Admin     | Everything a moderator can + manage user roles, see all orders, ship   |

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
| `NEXT_PUBLIC_SITE_URL`   | web     | `http://localhost:3010` (SEO base URL: canonical / sitemap / robots / OG) |

Auth runs Drizzle migrations at boot; the schema lives in `apps/auth/drizzle/`
(`pnpm --filter auth exec drizzle-kit generate` regenerates after schema edits).

## Catalog: browse, search & currency (slices 03, 04)

The Catalog service (MongoDB) owns manga documents with embedded stock
(`quantity`, `reserved`). Guests browse a paginated grid at `/catalog` and open
`/catalog/[id]` for details. Search is **token-based and case-insensitive**, and
**genre toggle chips** narrow the list; both refine the same query.

Prices are stored as **integer EUR cents** everywhere (ADR-0006) and rendered as
EUR with smaller, **display-only** USD/GBP/JPY labels converted via cached
**Frankfurter** rates (ADR-0006/0009). The conversion never affects the charge;
EUR is the only settlement currency. Frankfurter sits behind a circuit breaker
with an in-memory TTL cache fallback, so rate-provider hiccups degrade to the
last-known labels rather than failing the page.

Availability shown to buyers is always **available = quantity − reserved**.

## Catalog management: moderator & admin (slices 05, 06, homepage 02)

Moderators (and, by hierarchy, admins) manage the catalog from `/moderator`:

- **Add via Jikan auto-fill** — search Jikan by title and pre-fill description,
  author, and genres; the moderator sets price and stock (Jikan provides
  neither). Jikan is a **snapshot at add-time** (`jikan_id` kept, never
  auto-resynced — ADR-0009).
- **Add manually** when Jikan is unavailable — a circuit breaker keeps catalog
  work unblocked; the fallback is "fill it in by hand," never a blocked create.
- **Edit** a manga's data and price; moderator edits are never overwritten by
  Jikan.
- **Update stock** quantity so availability reflects reality.
- **Toggle Featured** — flag a manga for the homepage Featured rail.
- **Admins additionally delete** manga (`/admin` panel) and manage user roles.

Admin user management (slice 06) lives at `/admin`: change a user's role
(`customer` / `moderator` / `admin`) through Auth's admin endpoints.

## Cart & checkout (slices 07, 08)

The cart is **login-required and server-side**, keyed by `customer_id` — no guest
cart, no cart merge (ADR-0010). A guest who tries to add to cart is prompted to
log in. Customers change quantities and remove items at `/cart`.

At checkout (`/checkout`) the customer enters shipping details (recipient, address,
city, postal code, phone). Orders then asks Catalog to **reserve the whole order
all-or-nothing** and to return the **current EUR price + title per item** — the
client never supplies prices. Orders snapshots those into `OrderItem`s (so later
catalog edits don't alter a placed order), stores the shipping fields, sets the
order to `pending_payment`, and clears the cart. Any out-of-stock line rejects
the whole order.

## Payments & Stripe (slice 09)

Payment uses Stripe's **hosted Checkout Session** (ADR-0008): the browser is
redirected to Stripe's page, and the **signature-verified webhook — not the
redirect — is the source of truth** for the outcome. The session's 30-minute
`expires_at` is the reservation clock; `completed` commits stock and marks the
order `paid`, `expired`/failure releases stock and cancels it. Webhook handling
is idempotent on the Stripe event id.

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
to actually flip to `paid`, Stripe must reach the webhook — `pnpm dev` starts the
Stripe CLI listener for you; to run it standalone in a second terminal, copy the
`whsec_…` it prints into `apps/payments/.env`:

```bash
stripe listen --forward-to localhost:3000/payments/webhook
```

That CLI secret is **stable across runs** for your account — set it once. A
deployed endpoint registered in the Stripe Dashboard gets its **own** signing
secret; use that value for `STRIPE_WEBHOOK_SECRET` in production.

Payments runs Drizzle migrations at boot; the schema lives in
`apps/payments/drizzle/`.

## Order fulfillment saga & Kafka (slices 10, 11)

Stock has `quantity` (physical on hand) and `reserved` (held for unpaid orders).
The fulfillment saga (ADR-0002) coordinates Orders, Catalog, and Payments:

1. **Order created** → Catalog reserves (guarded atomic `$inc reserved`,
   all-or-nothing; partial reservations roll back on any short line →
   `stock-rejected`).
2. **Payment succeeds** → Catalog commits (`quantity -= qty; reserved -= qty`);
   order → `paid`.
3. **Payment fails / times out** → Catalog releases (`reserved -= qty`); order →
   `cancelled` (compensation).

Catalog keeps **per-order reservation records** so releases and commits are exact
and idempotent. The saga was built **synchronously (REST) first** then migrated
to **Kafka choreography** (ADR-0003, slice 11): topics `order-created`,
`stock-reserved`, `stock-rejected`, `payment-succeeded`, `payment-failed`
(`@workspace/messaging`). Delivery is **at-least-once**; consumers are
**state-based idempotent** and messages are **keyed by `order_id`** for per-order
ordering (ADR-0013). Failures are logged and dropped — no dead-letter topic
(accepted student-scale limitation).

Order lifecycle (ADR-0010): `pending_payment → paid (webhook) → shipped (admin)`;
`cancelled` only automatically (payment failure / 30-min expiry). No manual
customer cancellation and no refund flow.

- **Customers** see their own history and each order's status at `/orders`.
- **Admins** see all orders at `/admin/orders`, with the customer's email
  **resolved on demand** via a batch Auth lookup in the Next.js server layer
  (never duplicated onto orders — ADR-0011), and can **mark a paid order
  shipped**.

## Homepage & on-page SEO (homepage slices 01–04)

The root `/` is a conversion-first landing page (see
`.scratch/homepage-landing-seo/`): an expanded hero with one primary CTA into the
catalog, a **genre quick-nav** (each link pre-filters the catalog), a
**Featured** rail (staff-curated via the moderator toggle), a **New Arrivals**
rail (newest by creation time, automatic, with a **NEW** badge), a value-props
band, a closing CTA, and a footer. It stays intentional even when nothing is
Featured yet.

The homepage is served with **ISR** (`revalidate = 3600`) — a deliberate
deviation from the app-wide `no-store` posture, recorded in **ADR-0016** as
preparation for a later Partial Prerendering pass.

On-page SEO (slice 04): a site-wide title template + descriptions, canonical
URLs, semantic landmarks, and `robots` + `sitemap`, all based on
`NEXT_PUBLIC_SITE_URL`.

## Design system (ADR-0014, ADR-0015)

The frontend uses a **neo-brutalist design system** (ADR-0014) — shared
`.brutal-btn` / `.brutal-press` primitives and a screentone dot field — with
form inputs built on **Base UI Field/Input** primitives (ADR-0015). Shared UI
lives in `packages/ui`. A global, role-aware navbar (with a mobile dropdown)
spans every page.

## Security (slice 13)

CSRF is mitigated **by-design** (header token, no cookie), so there are no CSRF
tokens; the consequence is that **XSS is the load-bearing risk** (ADR-0012).
Controls: React/Next escaping with no `dangerouslySetInnerHTML`, `class-validator`
on every DTO, a **strict Content-Security-Policy** served as a static
`next.config` header, IDOR prevention via token-derived ownership guards, CORS
locked to the frontend origin, and Drizzle parameterized queries against SQL
injection.

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

## CI (slice 14)

`.github/workflows/ci.yml` runs on every push (`develop` / `main` / `master`)
and pull request, with two concurrent jobs:

- **verify** — `pnpm install --frozen-lockfile`, then lint → typecheck → build →
  test, with the Turborepo `.turbo` cache restored so unchanged tasks are
  replayed. The per-service integration suites spin up ephemeral
  Postgres/Mongo/Kafka via **testcontainers**; the root `test` script pins
  `turbo test --concurrency=1` so the throwaway Kafka brokers never boot at once.
- **docker** — a matrix that builds each app's Dockerfile
  (`auth`, `catalog`, `orders`, `payments`, `gateway`, `web`) without pushing,
  proving every image still builds.

A newer push to the same ref cancels the in-flight run.

## Docs & diagrams

- **`docs/adr/`** — ADR-0001…0016, the authoritative decisions.
- **`CONTEXT.md`** — the ubiquitous language (English — ADR-0004).
- **`.scratch/manga-shop/`**, **`.scratch/homepage-landing-seo/`** — the PRDs and
  vertical-slice issues.
- **`tools/diagram-brand/`** — the neo-brutalist toolkit
  (`render.mjs`) that renders every generated diagram (C4, EventStorming, UML
  data models, architecture canvas) to branded SVG + PNG in the ADR-0014 house
  style.
</content>
</invoke>
