import { Controller, Param, Post } from "@nestjs/common";
import type { OrderStatusResult } from "@workspace/contracts";
import { OrdersService } from "./orders.service";

/**
 * Internal order-status boundary for the payment saga (issue 09, ADR-0002).
 * Mounted at `/internal/orders` — a path the thin gateway deliberately does
 * **not** route (ADR-0011) — so it is reachable only service-to-service inside
 * the cluster, never from a browser. Payments calls it from the signature-
 * verified Stripe webhook to advance an order once payment settles.
 *
 * There is no auth guard here: the transition is not a user action but a
 * consequence of a verified payment outcome, and the endpoint is unreachable from
 * outside the cluster. Both transitions are guarded on `pending_payment` and
 * idempotent on `orderId`, so a duplicate delivery (at-least-once, ADR-0013) is
 * safe. In the Kafka phase (issue 11) this transport becomes a `payment-succeeded`
 * / `payment-failed` consumer, the domain logic unchanged.
 */
@Controller("internal/orders")
export class InternalOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post(":id/paid")
  markPaid(@Param("id") id: string): Promise<OrderStatusResult> {
    return this.orders.markPaid(id);
  }

  @Post(":id/cancelled")
  markCancelled(@Param("id") id: string): Promise<OrderStatusResult> {
    return this.orders.markCancelled(id);
  }
}
