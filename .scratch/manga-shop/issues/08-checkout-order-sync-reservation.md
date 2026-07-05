# 08. Checkout → order + synchronous reservation

Status: done

## Parent

[PRD: Manga Web Shop](../PRD.md)

## What to build

A Customer turns their cart into an Order at checkout. The Customer enters shipping details (recipient name, address, city, postal code, phone). Orders then asks Catalog — synchronously over REST — to reserve the whole order all-or-nothing and to return the current EUR price + title per item (the client never supplies prices). Catalog performs a guarded atomic `$inc reserved` per line; if any line is insufficient, it rolls back the partial reservations and rejects the whole order (`stock-rejected` semantics). Catalog keeps a per-order reservation record so a later commit/release is exact and idempotent.

On success, Orders snapshots the returned price + title into OrderItems, stores the shipping fields on the Order, sets status `pending_payment`, and clears the cart. An out-of-stock order is rejected so the Customer is never charged for unavailable manga. Next.js gets a checkout form (shipping + review) that creates the order.

This is the synchronous-first build of the saga's reserve step (ADR-0003); the Kafka migration is slice 11.

Respects ADR-0002 (reserve all-or-nothing, rollback, per-order reservation records, available = `quantity − reserved`), ADR-0010 (server-sourced price/title snapshot, shipping on order, clear cart).

## Acceptance criteria

- [ ] Checkout collects shipping fields (recipient name, address, city, postal code, phone) and stores them on the Order
- [ ] Orders calls Catalog to reserve the whole order all-or-nothing; partial-failure rolls back all reservations and rejects the order
- [ ] Catalog returns current EUR price + title per item; Orders snapshots these into OrderItems (client-supplied prices are ignored)
- [ ] Successful checkout sets order status `pending_payment` and clears the cart; a per-order reservation record exists in Catalog
- [ ] An order containing an out-of-stock line is rejected with no charge and no partial reservation left behind
- [ ] Next.js checkout form (shipping + review) creates the order
- [ ] Integration tests: successful reserve + snapshot + cart-clear; all-or-nothing rollback on a short line; price/title sourced from Catalog, not client

## Blocked by

- [07. Cart (server-side, login-required)](07-cart-server-side.md)

## Comments

Built the synchronous reserve step of the saga (ADR-0002/0003) end to end.

**Catalog — reserve-for-order (new `reservation` feature).** A per-order
Reservation record (Mongo, keyed by `orderId`, unique) plus an internal
`POST /internal/reservations` boundary — mounted at `/internal`, a path the thin
gateway deliberately does **not** route (ADR-0011), so it is reachable only
service-to-service, never from a browser. Reserve is all-or-nothing: a guarded
atomic `$inc reserved` per line (`available = quantity − reserved ≥ qty`) so two
orders can't both take the last copy; any short/missing line rolls back the holds
already taken this pass and returns `rejected`. Catalog is the authority for the
current EUR price + title, returned per line for Orders to snapshot. Idempotent on
`orderId` (a repeat reserve returns the existing hold, never double-holds).

**Orders — checkout (new `orders` feature).** New `orders` + `order_items` tables
(migration `0001`). `POST /orders` is login-required; the `customerId` comes from
the token (ADR-0007, IDOR). Checkout reads the cart, generates the `orderId`,
calls Catalog to reserve, then in one DB transaction snapshots the returned
price/title into OrderItems, stores shipping on the Order, sets status
`pending_payment`, and clears the cart. Empty cart → 400; `rejected` reservation →
409 with no order and no leftover hold (Catalog already rolled back). The client
has **no channel** to supply a price — the checkout body is shipping-only and
`forbidNonWhitelisted` rejects forged item/price/total fields.

**Wiring.** Gateway routes `/orders` → Orders. `CatalogClient` calls Catalog over
REST (`CATALOG_URL`); a non-2xx is a 503 so checkout fails loudly rather than
placing an unbacked order. docker-compose gives Orders `CATALOG_URL` +
`depends_on: catalog(healthy)`. Contracts: `ReserveOrderInput`/`ReservedLine`/
`ReservationResult` (catalog) and `OrderStatus`/`ShippingDetails`/`CreateOrderInput`/
`OrderView` (orders). Next.js: `/checkout` (review + shipping form → confirmation),
`lib/orders.ts`, and a Checkout button on the cart.

**Tests.** Catalog reservation e2e (6, real Mongo): all-or-nothing success +
priced lines, partial-failure rollback, oversell guard, idempotency, missing-manga
rejection, 400. Orders checkout e2e (6, real Postgres, Catalog stubbed at the fetch
edge): pending_payment order + Catalog-sourced snapshot + cart clear, forged-price
rejection, out-of-stock 409 leaving the cart intact, empty-cart 400, login-required,
malformed-shipping 400. Full suite green (typecheck + lint clean).

**Follow-ups / notes.**
- `commit`/`release` and the 30-min auto-expiry sweep are deferred to Payments
  (issue 09) / the Kafka phase (issue 11); the Reservation schema already carries a
  `committed`/`released` status for them.
- If the DB transaction failed after a successful reserve, the hold would dangle
  until the future expiry sweep — accepted at student scale (no sweep yet).
- Order history / detail reads (GET) are issue 10; this slice only creates orders.
