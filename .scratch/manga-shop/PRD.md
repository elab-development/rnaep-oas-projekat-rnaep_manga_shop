# PRD: Manga Web Shop

Status: ready-for-agent

> Master PRD for the Manga Web Shop — an online store for physical manga volumes, built as NestJS microservices behind an API Gateway with a Next.js frontend. Authoritative decisions live in `docs/adr/` (ADR-0001…0013) and domain vocabulary in `CONTEXT.md`; this PRD references them rather than restating them.

## Problem Statement

Buying physical manga is scattered across unreliable sources with no clear view of availability or stock. Readers can't easily search a trustworthy catalog, see real-time availability, or pay securely with a card. Shop staff have no efficient tool to manage the catalog and keep stock accurate. The result is missed sales (overselling out-of-stock items, or hiding available ones) and a poor buying experience.

## Solution

A centralized online shop where:

- **Guests** browse and search a catalog of manga and register.
- **Customers** add manga to a cart, place orders, pay by card (Stripe), and track order status and history.
- **Moderators** manage the catalog and stock, with Jikan auto-fill to add titles quickly.
- **Admins** manage users/roles, see all orders, and mark orders shipped.

Availability is always accurate because stock is **reserved before payment** and the reservation is committed on payment success or released on failure/timeout — so customers never pay for something that's gone, and the catalog never shows phantom shortages. Prices are shown in EUR with informational USD/GBP/JPY labels. The system is split into four independent services (Auth, Catalog, Orders, Payments) plus an API Gateway, each independently containerized.

## User Stories

**Guest / browsing**
1. As a Guest, I want to browse a paginated list of manga, so that I can see what's on offer.
2. As a Guest, I want to search and filter the catalog by title and genre, so that I can find manga I care about.
3. As a Guest, I want to view a manga's details (description, author, genres, price, availability), so that I can decide whether to buy it.
4. As a Guest, I want to see each price in EUR with smaller USD/GBP/JPY labels, so that I understand roughly what I'm paying in my currency.
5. As a Guest, I want to register with email and password, so that I can become a Customer and buy manga.
6. As a Guest, I want to be prompted to log in when I try to add to cart, so that my cart is tied to my account.

**Customer / account**
7. As a Customer, I want to log in and receive a token, so that I can access my account and cart.
8. As a Customer, I want my session to use a short-lived token sent in the Authorization header, so that my account stays reasonably secure.

**Customer / cart & ordering**
9. As a Customer, I want to add a manga to my cart, so that I can prepare it for purchase.
10. As a Customer, I want to change quantities and remove items from my cart, so that I can adjust my order.
11. As a Customer, I want my cart to persist server-side against my account, so that it survives across devices and sessions.
12. As a Customer, I want to enter shipping details (recipient name, address, city, postal code, phone) at checkout, so that my order can be delivered.
13. As a Customer, I want to create an order from my cart, so that I can complete the purchase.
14. As a Customer, I want the order to capture the price and title of each item at order time, so that later catalog changes don't alter my order.
15. As a Customer, I want my order rejected if any item is out of stock, so that I'm never charged for unavailable manga.
16. As a Customer, I want to pay by card via Stripe's hosted checkout, so that I can pay securely without my card data touching the shop.
17. As a Customer, I want my order confirmed only once payment is verified, so that the status I see is trustworthy.
18. As a Customer, I want my reservation to be held for 30 minutes while I pay, so that the stock isn't taken from under me mid-checkout.
19. As a Customer, I want an unpaid order to auto-cancel after 30 minutes and release the stock, so that I'm not left with a stuck order.
20. As a Customer, I want to see my order history and each order's status, so that I can track my purchases.

**Moderator / catalog & stock**
21. As a Moderator, I want to add a new manga and auto-fill its data by searching Jikan, so that I can expand the catalog quickly.
22. As a Moderator, I want to still add a manga manually when Jikan is unavailable, so that catalog work is never blocked.
23. As a Moderator, I want to set a manga's price and stock myself (Jikan provides neither), so that the listing is sellable.
24. As a Moderator, I want to edit a manga's data and price, so that the catalog stays accurate.
25. As a Moderator, I want my edits to never be overwritten by Jikan, so that my corrections stick.
26. As a Moderator, I want to update a manga's stock quantity, so that availability reflects reality and overselling is prevented.

**Admin / users & oversight**
27. As an Admin, I want to change a user's role (customer/moderator/admin), so that I can grant moderation rights.
28. As an Admin, I want all Moderator abilities too, so that I can manage the catalog as well.
29. As an Admin, I want to delete a manga, so that I can remove invalid listings.
30. As an Admin, I want to see all orders and their statuses, so that I can monitor the business.
31. As an Admin, I want to see the customer behind an order (resolved on demand), so that I can handle support.
32. As an Admin, I want to mark a paid order as shipped, so that fulfillment status is tracked.

**Cross-cutting / quality**
33. As a Customer, I want to only ever see and act on my own cart and orders, so that other users can't access my data (IDOR protection).
34. As any user, I want the system to stay available and responsive under normal load, so that shopping isn't disrupted.
35. As an operator, I want each service to expose metrics and a dashboard, so that I can monitor health and throughput.

## Implementation Decisions

**Architecture & layout (ADR-0001).** A pnpm + Turborepo monorepo. Four NestJS services (`auth`, `catalog`, `orders`, `payments`) and a NestJS API `gateway` live as `apps/*` alongside the existing `apps/web` (Next.js 16). Shared event/DTO contracts live in `packages/*` (`packages/contracts`). Each app has its own Dockerfile and its own database; `docker-compose` brings up all services + databases + Kafka + Prometheus + Grafana as separate containers.

**Services & data ownership.**
- **Auth** — Postgres (Drizzle). Users, roles, JWT issuance, role changes.
- **Catalog** — MongoDB. Manga documents with embedded `stock` (`quantity`, `reserved`), search, Jikan enrichment, Frankfurter conversion, per-order reservation records.
- **Orders** — Postgres (Drizzle). Cart, Order, OrderItem, order status.
- **Payments** — Postgres (Drizzle). Payment records + payment events, Stripe integration.

**Ubiquitous language is English (ADR-0004).** Code, DB columns, Mongo fields, Kafka topics, and the glossary are all English, deviating from the Serbian spec/diagrams. Canonical terms in `CONTEXT.md`. Topics: `order-created`, `stock-reserved`, `stock-rejected`, `payment-succeeded`, `payment-failed`.

**Roles (ADR-0005).** A single hierarchical `role` enum (`customer | moderator | admin`), not an M:N table. Authorization offers `@MinRole('x')` (hierarchical — admin passes a moderator check) and `@Roles('x', …)` (exact / allow-list, no inheritance). Default role on registration is `customer`.

**Auth (ADR-0007).** Each service verifies the JWT itself via a reusable guard + Passport strategy in a shared package, using the shared `JWT_SECRET`. The gateway also validates for fast-fail and owns routing + the single CORS policy. No central introspection endpoint. Token lives in the `Authorization: Bearer` header, never a cookie; identity for ownership checks always comes from the verified token, never request body/params. Tokens are short-lived (15 min); no revocation list in v1.

**Pricing & currency (ADR-0006).** Money is EUR stored as **integer cents** everywhere (Mongo, Postgres, contracts). EUR is the only settlement currency; USD/GBP/JPY are display-only conversions via cached Frankfurter rates (12–24h TTL) and never affect the charge. RSD is not offered (ECB/Frankfurter doesn't publish it).

**Cart & order creation (ADR-0010, ADR-0002).** Cart is login-required and server-side, keyed by `customer_id`; no guest cart. At checkout, Orders asks Catalog to **reserve the whole order all-or-nothing** and to return the **current EUR price + title** per item (the client never supplies prices); Orders snapshots those into OrderItems, stores shipping fields on the Order, sets status `pending_payment`, and clears the cart.

**Order-fulfillment saga (ADR-0002).** Stock has `quantity` (physical on hand) and `reserved` (held for unpaid orders); **available = quantity − reserved**.
- Order created → Catalog reserves (guarded atomic `$inc reserved`, all-or-nothing; rollback partial reservations on any insufficient line → `stock-rejected`).
- Payment succeeds → Catalog commits (`quantity -= qty; reserved -= qty`); Order → `paid`.
- Payment fails/times out → Catalog releases (`reserved -= qty`); Order → `cancelled` (compensation).
- Catalog keeps per-order reservation records so releases/commits are exact and idempotent.

**Payments (ADR-0008).** Stripe **hosted Checkout Session** with `expires_at = now + 30 min` — the session *is* the reservation clock; `checkout.session.expired` → `payment-failed(timeout)`. The **signature-verified webhook is the source of truth** (`STRIPE_WEBHOOK_SECRET`), not the browser redirect; success page shows "confirming…" and reads order status. Webhook handling is idempotent on the Stripe event id.

**Transport sequencing (ADR-0003).** Build the inter-service flow **synchronously (REST) first**, then migrate to **Kafka** in the event-driven phase. Kept Kafka-aware from day one: Catalog stock ops are explicit `reserve`/`commit`/`release`; `order_id` is the idempotency key everywhere; payload shapes live in `packages/contracts` so REST DTOs become Kafka message schemas unchanged.

**Kafka delivery semantics (ADR-0013).** At-least-once delivery. Consumers are **state-based idempotent** (e.g. ignore `payment-succeeded` if already `paid`). Saga messages are **keyed by `order_id`** for per-order ordering. **One consumer group per service.** Failures are **logged and dropped** (no dead-letter topic) — accepted student-scale limitation.

**External APIs & resilience (ADR-0009).** Jikan enrichment is a **snapshot at add-time** (`jikan_id` kept, never auto-resynced). **Circuit breakers on Jikan + Frankfurter only**, each with a cache fallback (Jikan fallback = "fill manually"; never block creation). **No breaker fallback on Stripe** — payment outcomes must fail loudly. Caching is **in-memory TTL per service** (no Redis).

**Gateway (ADR-0011).** Thin: JWT validation, CORS, path→service routing only. Cross-service composition (e.g. admin orders + customer emails) happens in the **Next.js server layer**; the frontend talks only to the gateway. Account email is **resolved on demand** via batch Auth lookup, never duplicated onto orders.

**Security (ADR-0012 + spec §3).** CSRF is mitigated by-design (header token, no cookie) → no CSRF tokens; the consequence is **XSS is the load-bearing risk** (React/Next escaping, no `dangerouslySetInnerHTML`, `class-validator` on every DTO, strict CSP). IDOR via token-derived ownership guards; CORS locked to the frontend origin; SQL injection prevented by Drizzle parameterized queries.

**Order lifecycle (ADR-0010).** `pending_payment → paid (webhook) → shipped (admin)`; `cancelled` only automatically (payment failure / 30-min expiry). **No manual customer cancellation; no refund flow** (`refunded` reserved as a future enum value — reserving before payment means there's no paid-but-undeliverable path).

## Testing Decisions

A good test asserts **external behavior at the highest boundary**, never implementation details — drive a unit through its public transport boundary and assert observable state or emitted events, with externals mocked at the network edge. This is greenfield: no test infra exists yet, so these patterns establish the prior art.

- **Primary seam — each service's transport boundary (one seam per service).** Black-box integration tests drive a service through its public boundary (HTTP controllers in the sync phase; HTTP + Kafka message handlers in the async phase), backed by a **real ephemeral database** (Postgres/Mongo via testcontainers or a throwaway docker instance). Assert outcomes like order status and `quantity`/`reserved` values — not internal method calls. Outbound externals (Jikan, Frankfurter, Stripe) are stubbed **at the HTTP boundary** with MSW (already in the workspace); Stripe webhooks are fed as signed test events.
  - **Auth**: register → default `customer`; login → token; role change by admin; `@MinRole`/`@Roles` guard behavior.
  - **Catalog**: search/filter/pagination; Jikan-backed add (mocked) and manual add when the breaker is open; reserve-for-order all-or-nothing (including partial-failure rollback); commit and release; Frankfurter conversion + cache/fallback.
  - **Orders**: cart CRUD (login-required, ownership-scoped); checkout creates a `pending_payment` order with server-sourced price snapshots and clears the cart; status transitions; history (own) vs all (admin).
  - **Payments**: Checkout Session creation with 30-min expiry; webhook (signed) → `payment-succeeded`; expiry → `payment-failed(timeout)`; idempotency on duplicate webhook event ids.
- **One cross-service happy-path** for order → pay → ship, driven through the **gateway** (and a real broker in the Kafka phase) — a thin smoke test asserting the order reaches `shipped` and stock numbers are correct. Not exhaustive.
- **Contract tests on `packages/contracts`** — validate the event/DTO schemas so producers and consumers can't drift; the same schemas are exercised by both the sync DTO tests and the Kafka message tests.
- **Frontend** — Next.js server actions/components tested at the data boundary with the gateway mocked (MSW): catalog browse, cart, checkout redirect, order history, admin/moderator panels, auth-gated actions.
- **IDOR coverage** is explicit: for every owned resource (cart, order), a test asserts another customer's token cannot read or mutate it.

## Out of Scope

- **Refunds** and **manual order cancellation** (ADR-0010) — `refunded` is a reserved enum value only.
- **Guest carts / cart merge on login** (ADR-0010) — cart is login-required.
- **RSD and any non-Frankfurter currency** (ADR-0006).
- **Instant token revocation / refresh-token rotation** beyond short-lived tokens (ADR-0007) — refresh token is optional, not required for v1.
- **Dead-letter topics / message replay** (ADR-0013) — failures are logged and dropped.
- **Redis or any shared cache** (ADR-0009) — in-memory only.
- **Live Jikan re-sync / scheduled enrichment** (ADR-0009).
- **Paying in a non-EUR currency** (ADR-0006) — multi-currency is display-only.
- **Production hardening** generally (HA databases, autoscaling policies, secrets management beyond env vars).

## Further Notes

- **Delivery phases** (single final submission — see memory; only the final event-driven version is submitted): (1) skeleton + docker-compose; (2) Auth + gateway JWT; (3) Catalog CRUD + Jikan/Frankfurter; (4) Orders (cart, checkout, sync reserve); (5) Payments (Stripe Checkout, webhook); (6) Next.js UI; (7) Dockerfiles + README; (8) GitFlow/issues; (9) migrate the saga to Kafka; (10) Saga choreography + Circuit Breaker; (11) security pass; (12) Prometheus + Grafana; (13) CI/CD GitHub Actions.
- **Diagram realignment owed**: the submitted Serbian diagrams (ER, EventStorming, C4) still assume M:N roles, `double` money, and decrement semantics. For the final submission they must be redrawn to match ADR-0002/0004/0005/0006: English terms, single `role`, integer-cents EUR, reserve/commit/release.
- **Known limitation** (ADR-0013): log-and-drop can leave an order out of sync if a `payment-succeeded` fails processing (paid in Stripe but not advanced). Acceptable for project scope.
- **External APIs**: Jikan (`https://api.jikan.moe/v4`) and Frankfurter (`https://api.frankfurter.dev`) are the two required open-source/free APIs; Stripe (test mode) is an additional non-open-source integration.
- **NFR targets** (spec §2.3): 99.5% monthly availability; ~3 instances/service, 50 req/s, 100 concurrent users; strong consistency for stock/payment, eventual (<2s) for catalog; API p95 < 500ms, avg < 300ms; bcrypt password hashing; 15-min token.
