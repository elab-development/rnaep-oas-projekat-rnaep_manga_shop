# 07. Cart (server-side, login-required)

Status: done

## Parent

[PRD: Manga Web Shop](../PRD.md)

## What to build

A Customer has a persistent, server-side cart. The Orders service (Postgres, Drizzle) stores a Cart of CartItems keyed by `customer_id` (derived from the verified token, never the request body). The Customer can add a manga, change quantities, and remove items; the cart survives across devices and sessions because it lives server-side. There is no guest cart — adding to cart requires login. A Customer can only ever see and mutate their own cart (IDOR protection enforced by token-derived ownership).

Next.js shows the cart UI and, when a Guest tries to add to cart, prompts them to log in first so the cart is tied to their account.

Respects ADR-0010 (login-required server-side cart, keyed by `customer_id`, no guest cart), ADR-0012 (IDOR via token-derived ownership).

## Acceptance criteria

- [ ] Cart is keyed by `customer_id` taken from the verified token; unauthenticated cart access is rejected
- [ ] Customer can add a manga, change item quantity, and remove an item; changes persist server-side
- [ ] Cart contents survive a new session/login (persistence verified)
- [ ] Next.js cart UI works; a Guest attempting to add to cart is prompted to log in
- [ ] IDOR test: customer B's token cannot read or mutate customer A's cart
- [ ] Integration tests (real ephemeral Postgres): cart CRUD, ownership scoping, login-required enforcement

## Blocked by

- [02. Register & login (Auth, JWT)](02-auth-register-login-jwt.md)
- [03. Browse & search catalog](03-catalog-browse-search.md)

## Comments

Built the server-side, login-required cart end-to-end.

**Orders service (Postgres, Drizzle).** New `cart_items` table keyed by
`(customer_id, manga_id)` unique — a Customer's cart simply *is* the rows sharing
their `customer_id`; no separate `carts` row, an empty cart is zero rows.
`customer_id` and `manga_id` are cross-service ids stored as plain logical fields
(ADR-0010) — no foreign keys reach into Auth/Catalog. Endpoints (mounted at
`/cart`): `GET /cart`, `POST /cart/items` (add — sums quantity on the unique key
if already present), `PATCH /cart/items/:mangaId` (absolute quantity; 404 if not
in cart), `DELETE /cart/items/:mangaId` (idempotent). Every route is
`JwtAuthGuard` and the owning `customerId` comes from `@CurrentUser().userId`
(the verified token), never the body/params — that token-derived scoping *is* the
IDOR guard (ADR-0007/0012). Swapped the scaffold healthcheck `DatabaseModule` for
a real `DrizzleModule` mirroring Auth (migrations applied at boot / in tests).

**Contracts.** `packages/contracts/src/orders.ts`: `CartView`, `CartItemView`,
`AddCartItemInput`, `UpdateCartItemInput`, quantity bounds. The cart carries no
price — prices are snapshotted onto the Order at checkout (issue 08), never
supplied by the client.

**Gateway.** Added `/cart` → `ORDERS_URL` proxy (ADR-0011). Tokenless `/cart` is
passed through by `jwtFastFail` and rejected by the Orders guard (defense in
depth). No compose change — the gateway already had `ORDERS_URL`.

**Web.** `lib/cart.ts` (browser client through the gateway with the bearer
token), `AddToCart` on the catalog detail page (a Guest is routed to `/login`
first so the cart ties to their account), a `/cart` page + `CartView` that
composes each line's title/price/cover from Catalog client-side (matching the
existing admin-panel pattern, since the token is localStorage-only), with
quantity stepper + remove + total. Cart link added to the catalog header.

**Tests.** `apps/orders/test/cart.e2e-spec.ts` — real ephemeral Postgres
(testcontainers): CRUD, quantity summing, login-required (401), validation (400),
404 on unknown line, idempotent remove, and explicit IDOR coverage (customer B's
token can neither read nor mutate customer A's cart). Orders 12 green; full suite
green (typecheck + lint clean).

**Notes for next iteration (issue 08).** Checkout will read the cart, ask Catalog
to reserve all-or-nothing and return current EUR price + title per line, snapshot
those into OrderItems, then clear the cart. Add-to-cart deliberately does **not**
validate stock or that the manga exists (kept decoupled from Catalog) — that
check belongs to checkout. `CartView.fetchCartManga` already tolerates a manga
deleted from the catalog (renders "no longer available").
