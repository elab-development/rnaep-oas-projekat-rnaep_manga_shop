# 11. Migrate saga to Kafka (choreography)

Status: ready-for-agent

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
