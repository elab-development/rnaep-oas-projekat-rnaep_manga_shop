# 09. Payment (Stripe Checkout + webhook saga)

Status: ready-for-agent

## Parent

[PRD: Manga Web Shop](../PRD.md)

## What to build

A Customer pays for a `pending_payment` order by card. The Payments service (Postgres, Drizzle) creates a Stripe **hosted Checkout Session** with `expires_at = now + 30 min` — the session itself is the reservation clock. The signature-verified webhook (`STRIPE_WEBHOOK_SECRET`) is the source of truth, not the browser redirect:

- `checkout.session.completed` → `payment-succeeded` → Catalog commits stock (`quantity -= qty; reserved -= qty`) → Order → `paid`.
- `checkout.session.expired` (or payment failure) → `payment-failed(timeout)` → Catalog releases (`reserved -= qty`) → Order → `cancelled`.

Webhook handling is idempotent on the Stripe event id, and the commit/release uses Catalog's per-order reservation record so it applies the exact quantities exactly once. There is **no** circuit-breaker fallback on Stripe — payment outcomes must fail loudly. Payment records track `pending → succeeded/failed`. The Next.js success page shows "confirming…" and reads order status (it does not assume success from the redirect).

This is the synchronous-first build of the saga's commit/release step (ADR-0003); the Kafka migration is slice 11.

Respects ADR-0008 (hosted Checkout as the clock, webhook = source of truth, idempotent on event id, no Stripe fallback), ADR-0002 (commit/release semantics), ADR-0010 (`paid`/`cancelled` transitions).

## Acceptance criteria

- [ ] Payments creates a Stripe hosted Checkout Session with a 30-min `expires_at` for a `pending_payment` order
- [ ] The signed webhook is verified with `STRIPE_WEBHOOK_SECRET`; an unsigned/invalid event is rejected
- [ ] `completed` → stock committed (`quantity` and `reserved` both decremented by qty) → Order `paid`
- [ ] `expired`/failure → stock released (`reserved` decremented) → Order `cancelled`
- [ ] Webhook processing is idempotent on the Stripe event id (a duplicate event causes no double commit/release)
- [ ] Next.js success page shows "confirming…" and reflects the order status read back from the server
- [ ] Integration tests (signed Stripe test events fed at the HTTP boundary): success path; expiry/timeout path; duplicate-event idempotency

## Blocked by

- [08. Checkout → order + synchronous reservation](08-checkout-order-sync-reservation.md)
