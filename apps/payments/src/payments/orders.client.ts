import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { OrderView } from "@workspace/contracts";

/** Where the Orders service lives; defaults to its docker-compose host port. */
function ordersUrl(): string {
  return process.env.ORDERS_URL ?? "http://localhost:3003";
}

/**
 * Payments' client for reading an order from the Orders service (ADR-0003,
 * ADR-0011). {@link getOrder} reads an order **on behalf of the Customer** — it
 * forwards the caller's Bearer token so Orders re-verifies it and scopes the read
 * to that customer (ADR-0007). Payments never trusts a client-supplied amount; the
 * total comes from this authoritative read.
 *
 * This is a plain query, not a saga step, so it stays synchronous REST even after
 * the saga moves to Kafka (issue 11): the sync-phase status-advance calls
 * (`markPaid`/`markCancelled`) are gone — Payments now emits `payment-succeeded` /
 * `payment-failed` and Orders advances its own status from those events.
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
}
