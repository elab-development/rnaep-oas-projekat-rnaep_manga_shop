# Payment uses Stripe hosted Checkout, with the session as the reservation clock

Payments integrates Stripe via **hosted Checkout Sessions** (redirect to Stripe's page), not a self-built PaymentIntent + Elements form. The flow: checkout → Orders creates the Order (`pending_payment`) and reserves stock → Payments creates a Checkout Session with `expires_at = now + 30 min` and returns its URL → the customer pays on Stripe.

**The Checkout Session is the 30-minute reservation clock** from ADR-0002. Stripe enforces `expires_at` and fires `checkout.session.expired`, which Payments turns into `payment-failed` (reason `timeout`) → the compensation path releases the hold and cancels the order. So Payments needs no separate scheduler — Stripe owns the timer.

**The signature-verified webhook is the source of truth for payment outcome, not the browser redirect.** Payments marks the order `paid` (emits `payment-succeeded`) only on a `STRIPE_WEBHOOK_SECRET`-verified `checkout.session.completed`, because the customer may never return to `success_url` and the redirect can be skipped or forged. The success page shows "confirming…" and reads order status. Webhook handling is **idempotent**, keyed on the Stripe event id, so duplicate deliveries can't double-commit stock or re-update the order.

**Why hosted Checkout:** it provides the 30-min `expires_at` + expiry webhook for free (matching ADR-0002 with zero extra code), keeps cardholder data entirely off our systems (minimal PCI scope — a strong point for the security write-up), and is far less frontend work. The trade-off — redirecting to Stripe's page instead of an in-app form — is acceptable here.

See ADR-0002 for the saga this payment outcome drives.
