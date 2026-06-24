# 08. Checkout → order + synchronous reservation

Status: ready-for-agent

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
