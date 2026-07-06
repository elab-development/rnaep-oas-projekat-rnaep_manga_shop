import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { OrderStatusResult, OrderView } from "@workspace/contracts";

/** Where the Orders service lives; defaults to its docker-compose host port. */
function ordersUrl(): string {
  return process.env.ORDERS_URL ?? "http://localhost:3003";
}

/**
 * Payments' client for the Orders service (ADR-0003, ADR-0011). Two transports:
 *
 * - {@link getOrder} reads an order **on behalf of the Customer** — it forwards
 *   the caller's Bearer token so Orders re-verifies it and scopes the read to
 *   that customer (ADR-0007). Payments never trusts a client-supplied amount; the
 *   total comes from this authoritative read.
 * - {@link markPaid}/{@link markCancelled} advance the order from the verified
 *   Stripe webhook via Orders' internal, gateway-unexposed boundary. Both are
 *   idempotent on `orderId`, so a webhook retry is safe (ADR-0013).
 */
@Injectable()
export class OrdersClient {
  /**
   * Reads the order the customer is paying for, scoped by their forwarded token.
   * A 404 (not theirs, or unknown) propagates as a 404; any other non-2xx is a
   * 503 so session creation fails loudly rather than charging for a phantom order.
   */
  async getOrder(orderId: string, bearerToken: string): Promise<OrderView> {
    let res: Response;
    try {
      res = await fetch(`${ordersUrl()}/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
    } catch {
      throw new ServiceUnavailableException("Orders unavailable");
    }
    if (res.status === 404) {
      throw new NotFoundException("Order not found");
    }
    if (!res.ok) {
      throw new ServiceUnavailableException("Orders read failed");
    }
    return (await res.json()) as OrderView;
  }

  /** Advance the order to `paid` on payment success. */
  markPaid(orderId: string): Promise<OrderStatusResult> {
    return this.transition(orderId, "paid");
  }

  /** Advance the order to `cancelled` on payment failure/timeout (compensation). */
  markCancelled(orderId: string): Promise<OrderStatusResult> {
    return this.transition(orderId, "cancelled");
  }

  private async transition(
    orderId: string,
    op: "paid" | "cancelled",
  ): Promise<OrderStatusResult> {
    const url = `${ordersUrl()}/internal/orders/${orderId}/${op}`;
    let res: Response;
    try {
      res = await fetch(url, { method: "POST" });
    } catch {
      throw new ServiceUnavailableException("Orders unavailable");
    }
    if (!res.ok) {
      throw new ServiceUnavailableException(`Orders ${op} transition failed`);
    }
    return (await res.json()) as OrderStatusResult;
  }
}
