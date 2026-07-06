import type { CreateOrderInput, OrderView } from "@workspace/contracts";
import { authHeader, gatewayUrl } from "./auth";

/**
 * Browser-side checkout client. Talks ONLY to the API gateway (ADR-0011),
 * carrying the Customer's JWT in the Authorization header (ADR-0007). The Orders
 * service re-verifies the token, derives the owning customer from it, reads the
 * server-side cart, and sources every price/title from Catalog — this layer sends
 * only the shipping details and surfaces the result (ADR-0010). Checkout is
 * login-required: every call here needs a signed-in session.
 */

/** Thrown when a gateway checkout call responds non-2xx. */
export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

async function messageFor(res: Response): Promise<string> {
  if (res.status === 401) return "Please sign in to check out.";
  if (res.status === 409)
    return "One or more items are out of stock. Adjust your cart and try again.";
  if (res.status === 400) return "Your cart is empty, or the details are invalid.";
  if (res.status === 503)
    return "The catalog is unavailable right now. Please try again shortly.";
  try {
    const data = (await res.json()) as { message?: string | string[] };
    const m = data.message;
    if (Array.isArray(m)) return m.join(" ");
    if (m) return m;
  } catch {
    // fall through
  }
  return "Something went wrong. Please try again.";
}

/**
 * Creates an Order from the signed-in Customer's cart with the given shipping
 * details. On success the cart is cleared server-side and the returned order is
 * `pending_payment` (payment lands in the next slice). Items and prices in the
 * returned order are Catalog's, snapshotted onto the order (ADR-0010).
 */
export async function createOrder(
  shipping: CreateOrderInput,
): Promise<OrderView> {
  const res = await fetch(`${gatewayUrl()}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(shipping),
  });
  if (!res.ok) throw new CheckoutError(await messageFor(res), res.status);
  return (await res.json()) as OrderView;
}

/**
 * Reads one of the signed-in Customer's own orders (issue 09). Backs the payment
 * success page, which shows "confirming…" and polls this until the signed Stripe
 * webhook has advanced the order to `paid` (or `cancelled`) — the redirect itself
 * is never trusted as proof of payment (ADR-0008). Ownership is enforced by the
 * server from the token; a foreign or unknown id is a 404 (ADR-0007, ADR-0012).
 */
export async function getOrder(orderId: string): Promise<OrderView> {
  const res = await fetch(
    `${gatewayUrl()}/orders/${encodeURIComponent(orderId)}`,
    { headers: { ...authHeader() } },
  );
  if (!res.ok) throw new CheckoutError(await messageFor(res), res.status);
  return (await res.json()) as OrderView;
}
