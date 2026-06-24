import type { Cents } from "./money";

/**
 * Saga event payloads (ADR-0002, ADR-0003). All saga messages carry `orderId`
 * as the idempotency / partition key. These are minimal placeholders for the
 * scaffold; later slices add fields as the producing/consuming features land.
 */

export interface OrderLine {
  mangaId: string;
  quantity: number;
}

export interface OrderCreatedEvent {
  orderId: string;
  lines: OrderLine[];
}

export interface StockReservedEvent {
  orderId: string;
}

export interface StockRejectedEvent {
  orderId: string;
  reason: string;
}

export interface PaymentSucceededEvent {
  orderId: string;
  amount: Cents;
}

export interface PaymentFailedEvent {
  orderId: string;
  reason: "declined" | "timeout";
}
