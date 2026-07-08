# Order fulfillment uses a stock-reservation saga with payment-driven compensation

Stock for a Manga is tracked as two numbers in the Catalog service: `quantity` (physical copies on hand) and `reserved` (copies held for unpaid orders). **Available to sell = `quantity − reserved`.** Catalog also keeps a per-order Reservation record (keyed by order id) so a hold can be released or committed for exactly the right quantity, idempotently.

The Order → Payment → Stock flow is a saga:

1. **Order created** (`order-created`) → Catalog reserves the whole order **all-or-nothing**: a single "reserve for order" operation takes every line item, does a guarded atomic `$inc` (`reserved += qty` where `quantity − reserved ≥ qty`) per manga, and if *any* line is insufficient it rolls back the lines already reserved and returns `stock-rejected`. So one `order-created` yields exactly one `stock-reserved` *or* `stock-rejected` (no Mongo multi-doc transaction needed). At the same time Catalog is the authority for the **current EUR price + title**, which Orders snapshots into each `OrderItem` — the client never supplies prices.
2. **Payment succeeds** (`payment-succeeded`) → Catalog commits (`quantity −= qty; reserved −= qty`); Order → `paid`.
3. **Payment fails or times out** (`payment-failed`) → Catalog releases the hold (`reserved −= qty`); Order → `cancelled`. This is the compensation path.

**Payments owns the 30-minute clock.** The reservation window *is* the payment window. If the Customer doesn't pay within 30 min, Payments emits the same failure outcome as a declined payment (reason: `timeout`), reusing the existing compensation path. This makes Payments the single authority on "paid in time vs not," so "reservation expired" and "payment succeeded" can never both win — the worst race is eliminated by serialization, not locking.

**Why reservation over decrement-then-restore:** `quantity` keeps a clean meaning (physical stock), so the catalog never shows phantom shortages and a duplicated failure event can't inflate stock above physical reality. It maps directly to the strong-consistency requirement for stock via a single atomic guarded increment.

**Auto-expiry timing:** the reservation model is built from the start; the automatic timeout sweep is deferred to the Kafka phase (see ADR-0003). Before then an unpaid order simply stays `pending_payment`.

See `CONTEXT.md` for the Stock / Reservation / Order terms.
