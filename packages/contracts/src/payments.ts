/**
 * Payments read/write models shared between the Payments service and the Next.js
 * frontend (ADR-0003: payload shapes live in `@workspace/contracts`). Fields are
 * English (ADR-0004); money is EUR integer cents (ADR-0006).
 *
 * Payment follows Stripe's **hosted Checkout Session** (ADR-0008): the browser is
 * redirected to Stripe's page, and the signature-verified webhook — not the
 * redirect — is the source of truth for the outcome.
 */

/**
 * Request to start paying for a `pending_payment` Order. The client supplies only
 * the `orderId`; the amount is Catalog/Orders' authority (never the client), and
 * the owning customer comes from the verified token (ADR-0007, ADR-0010).
 */
export interface CreateCheckoutSessionInput {
  orderId: string;
}

/**
 * The hosted Stripe Checkout Session to redirect the Customer to. Only the URL
 * crosses to the browser; the session itself is the 30-minute reservation clock
 * (ADR-0008).
 */
export interface CheckoutSessionView {
  url: string;
}

/**
 * A Payment's lifecycle (CONTEXT.md: Payment). `pending` once a Checkout Session
 * is created; `succeeded`/`failed` only when the signed webhook confirms the
 * outcome (ADR-0008) — never inferred from the browser redirect.
 */
export type PaymentStatus = "pending" | "succeeded" | "failed";
