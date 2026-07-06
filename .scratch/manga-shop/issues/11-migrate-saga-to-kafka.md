# 11. Migrate saga to Kafka (choreography)

Status: done

## Parent

[PRD: Manga Web Shop](../PRD.md)

## What to build

Migrate the order-fulfillment saga from synchronous REST (slices 08–09) to event-driven Kafka choreography, without changing the saga's observable outcomes. The reserve/commit/release flow now runs over topics: `order-created`, `stock-reserved`, `stock-rejected`, `payment-succeeded`, `payment-failed`. Because the payload shapes already live in `packages/contracts`, the REST DTOs become Kafka message schemas unchanged.

Delivery is at-least-once. Consumers are **state-based idempotent** (e.g. ignore `payment-succeeded` if the order is already `paid`; ignore a re-delivered reserve if a per-order reservation record already exists). Saga messages are **keyed by `order_id`** for per-order ordering, with **one consumer group per service**. Failures are logged and dropped — no dead-letter topic (accepted student-scale limitation). The known limitation (a `payment-succeeded` that fails processing can leave an order paid-in-Stripe but not advanced) is acceptable for scope.

Respects ADR-0003 (sync-first then Kafka), ADR-0013 (at-least-once, state-based idempotency, `order_id` keying, one consumer group/service, log-and-drop), ADR-0004 (English topic names).

## Acceptance criteria

- [ ] Order creation, reservation, commit, and release flow over `order-created` / `stock-reserved` / `stock-rejected` / `payment-succeeded` / `payment-failed` instead of synchronous REST
- [ ] Messages are keyed by `order_id`; each service consumes in its own consumer group
- [ ] Consumers are state-based idempotent: re-delivered events cause no double reserve/commit/release and no incorrect status change
- [ ] Contracts in `packages/contracts` back both the (former) REST DTOs and the Kafka message schemas
- [ ] End-to-end happy path (create → reserve → pay → commit → `paid`) works over the broker with correct final stock numbers
- [ ] Integration tests drive services through the Kafka message boundary (real broker) and assert order status + stock outcomes, including re-delivery idempotency

## Blocked by

- [08. Checkout → order + synchronous reservation](08-checkout-order-sync-reservation.md)
- [09. Payment (Stripe Checkout + webhook saga)](09-payment-stripe-checkout-webhook.md)
- [10. Order history + admin oversight + ship](10-order-history-admin-oversight-ship.md)

## Comments

Done. The order-fulfillment saga now runs over Kafka choreography; the domain
logic (reserve/commit/release, guarded status transitions) is unchanged — only
the transport was swapped, as ADR-0003 intended.

**What was built**

- New shared package `@workspace/messaging` (kafkajs): `KafkaProducer`
  (`emit(topic, orderId, payload)`, always keyed by `orderId`) and an abstract
  `KafkaConsumer` base (declares a service's group + topics, log-and-drop on
  handler failure, at-least-once). Connection is non-blocking and self-healing
  (background retry), so a late/absent broker never blocks boot; `whenReady()`
  lets tests await a join deterministically. Under tests it connects only when a
  broker is explicitly configured (`KAFKA_BROKERS`), so non-saga tests skip Kafka.
- `packages/contracts/events.ts` fleshed out to the real wire shapes; notably
  `StockReservedEvent` now carries the priced `ReservedLine[]` so Orders can
  snapshot title/price from the event.
- **Catalog** — `ReservationConsumer` (group `catalog`): `order-created` → reserve
  → emit `stock-reserved`/`stock-rejected`; `payment-succeeded` → commit;
  `payment-failed` → release. Internal REST controller + DTO removed.
- **Orders** — checkout persists a `pending_payment` order (unpriced), clears the
  cart, and emits `order-created`. `OrdersConsumer` (group `orders`):
  `stock-reserved` → snapshot items + total (idempotent); `stock-rejected` →
  cancel; `payment-succeeded` → paid; `payment-failed` → cancel. Catalog HTTP
  client + internal controller removed.
- **Payments** — webhook now emits `payment-succeeded`/`payment-failed` (keeps the
  Orders read over REST for the authoritative amount, a query not a saga step).
  Catalog client + Orders status-advance client removed.
- **Frontend** — checkout now waits (polls the order) for the async reservation to
  price it (or cancel it) before starting the Stripe session.
- **docker-compose** — `KAFKA_BROKERS` wired into the three saga services + Kafka
  healthcheck + `depends_on: kafka (healthy)`; obsolete `CATALOG_URL`/`ORDERS_URL`
  saga wiring dropped.
- **Tests** — the three saga integration suites now drive services through a **real
  broker** (`@testcontainers/kafka`): Catalog reserve/commit/release + emitted
  `stock-*`; Orders status lifecycle from injected events; Payments emitted
  `payment-*`; all including at-least-once redelivery idempotency. `pnpm test`,
  `pnpm typecheck`, `pnpm lint` all green.

**Behavioural change worth noting (surfaced per ADR-0002/0010).** Because
reservation is now asynchronous, an out-of-stock checkout no longer fails with a
synchronous 409 leaving no order; instead an order is created `pending_payment`
and then **cancelled** on `stock-rejected`, and the cart is cleared at checkout.
This slightly widens the "cancelled automatically" set in ADR-0010 (previously
payment-failure / 30-min-expiry only) to include a rejected reservation. It does
not contradict the saga model (ADR-0002 always had `order-created` → exactly one
`stock-reserved`/`stock-rejected`); flagging it in case a future ADR edit wants
to make the reservation-rejection cancellation explicit.

**Follow-ups / notes for next iteration**

- End-to-end-over-broker coverage is split across the Catalog suite (create →
  reserve → pay → commit with correct final stock) and the Orders suite (order
  reaches `paid`); a single 3-process test isn't feasible under per-app jest
  (each app only has its own deps). A true cross-service smoke test would fit CI
  (issue 14) via docker-compose.
- Log-and-drop is the accepted student-scale failure mode (ADR-0013): a handler
  that throws is dropped, so a `payment-succeeded` that fails processing can leave
  an order paid-in-Stripe but not advanced. No dead-letter topic.
- Topics are created with a single partition (single-node dev broker). Messages
  are already keyed by `orderId`, so scaling to more partitions preserves
  per-order ordering with no code change.
