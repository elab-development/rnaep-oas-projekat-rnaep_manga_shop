# 09. Payment (Stripe Checkout + webhook saga)

Status: done

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

## Comments

Built the synchronous-first commit/release step of the saga (ADR-0003), the
Payments service, and the pay-by-card UI flow.

**What was built**

- **Payments service** (Postgres/Drizzle, new): `payments` (one row per order,
  `pending → succeeded/failed`) + `processed_events` (Stripe event-id idempotency)
  tables + migration. `StripeService` wraps the two Stripe touch points — hosted
  Checkout Session creation (`expires_at = now + 30 min`, the reservation clock)
  and **real** `constructEvent` signature verification against
  `STRIPE_WEBHOOK_SECRET`. `POST /payments/checkout-session` (JWT-guarded; reads
  the order amount back from Orders with the customer's forwarded token, so the
  amount is authoritative and ownership-scoped) and `POST /payments/webhook` (raw
  body, no guard — authenticated by signature). Webhook drives the saga:
  `completed` → Catalog commit + Orders paid + Payment succeeded; `expired` →
  Catalog release + Orders cancelled + Payment failed. Idempotent on event id.
- **Catalog**: `commit`/`release` on the Reservation (guarded atomic status flip
  so stock moves exactly once) + `POST /internal/reservations/:orderId/{commit,release}`.
- **Orders**: public `GET /orders/:id` (token-scoped, backs the success page and
  Payments' amount read) + internal `POST /internal/orders/:id/{paid,cancelled}`
  (guarded on `pending_payment`, idempotent).
- **Gateway**: `/payments/*` → PAYMENTS_URL (`/internal/*` still unexposed).
- **Web**: `lib/payments.ts` (start session), checkout redirects to Stripe after
  placing the order, and `/checkout/success?orderId=…` shows "confirming…" and
  polls order status (never trusts the redirect as proof of payment, ADR-0008).
- **Contracts**: `payments.ts` (CreateCheckoutSessionInput/CheckoutSessionView/
  PaymentStatus), catalog `ReservationStatus`/`SettlementResult`, orders
  `OrderStatusResult`. **docker-compose**: payments gets CATALOG_URL/ORDERS_URL/
  WEB_URL + Stripe secrets + depends_on catalog/orders.

**Tests (all green; typecheck + lint clean)**: payments e2e 9 (real Postgres,
Stripe session stubbed at the service seam but signatures verified for real,
Catalog/Orders stubbed at the fetch edge) — session creation, login-required,
not-owned 404, not-pending 409, success path (commit+paid+Payment succeeded),
expiry/timeout path (release+cancelled+Payment failed), duplicate-event
idempotency, forged-signature rejection. Catalog reservation +5 (commit/release +
idempotency + 404). Orders checkout +5 (own-order read, IDOR 404, paid/cancelled
idempotent, unknown-order 404). Gateway +1 (tokenless webhook proxied).

**Notes for next iteration**

- Webhook idempotency is record-first (claim event id, then settle): a downstream
  failure *after* claiming leaves the order un-advanced until… nothing sweeps it
  yet. This is the accepted ADR-0013 log-and-drop limitation; the Kafka phase
  (issue 11) adds retry/replay and the 30-min auto-expiry sweep.
- `expires_at` is exactly `now + 30 min` per ADR-0008; against live Stripe this is
  the inclusive minimum, so add a small buffer if a real session is ever rejected.
- No web test infra exists (prior UI slices shipped without it); the payment flow
  is covered at the service transport boundaries, not in the browser layer.
- Issue 10 (order history/detail + admin oversight + ship) builds on the new
  `GET /orders/:id` and the `paid` status this slice produces.
