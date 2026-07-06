import { Injectable } from "@nestjs/common";
import {
  Topics,
  type OrderCreatedEvent,
  type PaymentFailedEvent,
  type PaymentSucceededEvent,
  type StockRejectedEvent,
  type StockReservedEvent,
  type Topic,
} from "@workspace/contracts";
import { KafkaConsumer, KafkaProducer } from "@workspace/messaging";
import { ReservationService } from "./reservation.service";

/**
 * Catalog's saga consumer (issue 11, ADR-0002/0003/0013). This is the Kafka-phase
 * transport for the stock side of the saga — it replaces the sync-phase
 * `/internal/reservations*` REST controller, calling the **unchanged**
 * {@link ReservationService} domain logic:
 *
 * - `order-created` → reserve the whole order all-or-nothing, then emit
 *   `stock-reserved` (with Catalog's authoritative priced lines) or
 *   `stock-rejected`.
 * - `payment-succeeded` → commit the hold (`quantity -= qty; reserved -= qty`).
 * - `payment-failed` → release the hold (`reserved -= qty`) — compensation.
 *
 * Catalog is its own consumer group, so it settles stock independently of Orders
 * consuming the same `payment-*` events to advance order status (ADR-0013). The
 * reserve/commit/release operations are already idempotent on `orderId`, so a
 * redelivery is a harmless no-op.
 */
@Injectable()
export class ReservationConsumer extends KafkaConsumer {
  protected readonly groupId = "catalog";
  protected readonly topics: Topic[] = [
    Topics.OrderCreated,
    Topics.PaymentSucceeded,
    Topics.PaymentFailed,
  ];

  constructor(
    private readonly reservations: ReservationService,
    private readonly producer: KafkaProducer,
  ) {
    super();
  }

  protected async handle(topic: string, message: unknown): Promise<void> {
    switch (topic) {
      case Topics.OrderCreated:
        return this.onOrderCreated(message as OrderCreatedEvent);
      case Topics.PaymentSucceeded:
        await this.reservations.commit(
          (message as PaymentSucceededEvent).orderId,
        );
        return;
      case Topics.PaymentFailed:
        await this.reservations.release(
          (message as PaymentFailedEvent).orderId,
        );
        return;
    }
  }

  /** Reserve the order and announce the outcome (`stock-reserved`/`stock-rejected`). */
  private async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    const result = await this.reservations.reserve({
      orderId: event.orderId,
      lines: event.lines,
    });

    if (result.status === "reserved") {
      await this.producer.emit<StockReservedEvent>(
        Topics.StockReserved,
        event.orderId,
        { orderId: event.orderId, lines: result.lines },
      );
    } else {
      await this.producer.emit<StockRejectedEvent>(
        Topics.StockRejected,
        event.orderId,
        { orderId: event.orderId, reason: result.reason },
      );
    }
  }
}
