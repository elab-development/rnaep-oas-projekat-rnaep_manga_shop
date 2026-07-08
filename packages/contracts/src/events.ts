import type { ReservedLine } from "./catalog";
import type { Cents } from "./money";

/**
 * Saga event payloads (ADR-0002, ADR-0003, ADR-0013). All saga messages carry
 * `orderId` as the idempotency / partition key. These are the shapes on the wire
 * once the saga runs over Kafka (issue 11); they mirror the synchronous-phase
 * REST DTOs in `catalog.ts`/`orders.ts` unchanged, so producers and consumers
 * can't drift.
 */

/** One line of an order to reserve stock for: a Manga and how many copies. */
export interface OrderLine {
  mangaId: string;
  quantity: number;
}

/**
 * `order-created` — Orders → Catalog. Emitted at checkout with every cart line;
 * Catalog reserves the whole order all-or-nothing (ADR-0002). Equivalent to the
 * sync-phase `ReserveOrderInput`.
 */
export interface OrderCreatedEvent {
  orderId: string;
  lines: OrderLine[];
}

/**
 * `stock-reserved` — Catalog → Orders. The all-or-nothing hold succeeded; carries
 * Catalog's **authoritative** title + EUR price per line so Orders can snapshot
 * them onto the Order (ADR-0010) — the client never supplies a price. Equivalent
 * to the `reserved` arm of the sync-phase `ReservationResult`.
 */
export interface StockReservedEvent {
  orderId: string;
  lines: ReservedLine[];
}

/**
 * `stock-rejected` — Catalog → Orders. At least one line was out of stock, so the
 * whole order is rejected (partial holds already rolled back, ADR-0002); Orders
 * cancels the order (compensation). Equivalent to the `rejected` arm of the
 * sync-phase `ReservationResult`.
 */
export interface StockRejectedEvent {
  orderId: string;
  reason: string;
}

/**
 * `payment-succeeded` — Payments → {Orders, Catalog}. The signed Stripe webhook
 * confirmed payment (ADR-0008). Orders marks the order `paid`; Catalog commits
 * the hold (`quantity -= qty; reserved -= qty`) — two services, two consumer
 * groups, same event (ADR-0013).
 */
export interface PaymentSucceededEvent {
  orderId: string;
  amount: Cents;
}

/**
 * `payment-failed` — Payments → {Orders, Catalog}. The payment was declined or the
 * 30-min Stripe session expired (ADR-0002, ADR-0008). Orders cancels the order;
 * Catalog releases the hold (`reserved -= qty`) — the compensation path.
 */
export interface PaymentFailedEvent {
  orderId: string;
  reason: "declined" | "timeout";
}
