import { Injectable } from "@nestjs/common";
import {
  Topics,
  type PaymentFailedEvent,
  type PaymentSucceededEvent,
  type StockRejectedEvent,
  type StockReservedEvent,
  type Topic,
} from "@workspace/contracts";
import { KafkaConsumer } from "@workspace/messaging";
import { OrdersService } from "./orders.service";

/**
 * Orders' saga consumer (issue 11, ADR-0002/0003/0013). The Kafka-phase transport
 * for the order side of the saga — it replaces the sync-phase reserve reply and
 * the `/internal/orders/*` REST controller, calling the **unchanged**
 * {@link OrdersService} domain logic:
 *
 * - `stock-reserved` → snapshot Catalog's priced lines onto the order + set total.
 * - `stock-rejected` → cancel the order (compensation).
 * - `payment-succeeded` → advance the order to `paid`.
 * - `payment-failed` → cancel the order (compensation).
 *
 * Orders is its own consumer group, so it advances order status independently of
 * Catalog consuming the same `payment-*` events to settle stock (ADR-0013). Every
 * handler is state-based idempotent, so an at-least-once redelivery is safe.
 */
@Injectable()
export class OrdersConsumer extends KafkaConsumer {
  protected readonly groupId = "orders";
  protected readonly topics: Topic[] = [
    Topics.StockReserved,
    Topics.StockRejected,
    Topics.PaymentSucceeded,
    Topics.PaymentFailed,
  ];

  constructor(private readonly orders: OrdersService) {
    super();
  }

  protected async handle(topic: string, message: unknown): Promise<void> {
    switch (topic) {
      case Topics.StockReserved: {
        const event = message as StockReservedEvent;
        await this.orders.applyReservation(event.orderId, event.lines);
        return;
      }
      case Topics.StockRejected:
        await this.orders.rejectReservation(
          (message as StockRejectedEvent).orderId,
        );
        return;
      case Topics.PaymentSucceeded:
        await this.orders.markPaid((message as PaymentSucceededEvent).orderId);
        return;
      case Topics.PaymentFailed:
        await this.orders.markCancelled(
          (message as PaymentFailedEvent).orderId,
        );
        return;
    }
  }
}
