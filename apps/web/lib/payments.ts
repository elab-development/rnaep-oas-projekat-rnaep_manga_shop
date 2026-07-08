import type { CheckoutSessionView } from "@workspace/contracts";
import { authHeader, gatewayUrl } from "./auth";

/**
 * Browser-side payments client. Talks ONLY to the API gateway (ADR-0011),
 * carrying the Customer's JWT in the Authorization header (ADR-0007). Payments
 * re-verifies the token, reads the order's authoritative amount from Orders, and
 * opens a Stripe hosted Checkout Session — this layer sends only the `orderId`
 * and surfaces the redirect URL (ADR-0008, ADR-0010).
 */

/** Thrown when a gateway payments call responds non-2xx. */
export class PaymentError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

async function messageFor(res: Response): Promise<string> {
  if (res.status === 401) return "Please sign in to pay.";
  if (res.status === 404) return "That order could not be found.";
  if (res.status === 409)
    return "This order is no longer awaiting payment.";
  if (res.status === 502)
    return "We couldn't reach the card payment provider. Please try again shortly.";
  if (res.status === 503)
    return "Payments are unavailable right now. Please try again shortly.";
  try {
    const data = (await res.json()) as { message?: string | string[] };
    const m = data.message;
    if (Array.isArray(m)) return m.join(" ");
    if (m) return m;
  } catch {
    // fall through
  }
  return "Something went wrong starting your payment. Please try again.";
}

/**
 * Opens a Stripe hosted Checkout Session for a `pending_payment` order and returns
 * the URL to redirect the Customer to. The session is the 30-minute reservation
 * clock (ADR-0008); the order is confirmed only by the signed webhook, never the
 * browser redirect, so the caller redirects here and the success page reads the
 * order status back from the server.
 */
export async function startCheckoutSession(
  orderId: string,
): Promise<CheckoutSessionView> {
  const res = await fetch(`${gatewayUrl()}/payments/checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ orderId }),
  });
  if (!res.ok) throw new PaymentError(await messageFor(res), res.status);
  return (await res.json()) as CheckoutSessionView;
}
