import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import type {
  CheckoutSessionView,
  PaymentFailedEvent,
  PaymentSucceededEvent,
} from "@workspace/contracts";
import { Topics } from "@workspace/contracts";
import { KafkaProducer } from "@workspace/messaging";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { DRIZZLE, type Database } from "../db/drizzle.module";
import { payments, processedEvents } from "../db/schema";
import { OrdersClient } from "./orders.client";
import { StripeService } from "./stripe.service";

/**
 * Pays for a `pending_payment` Order via Stripe hosted Checkout (ADR-0008). The
 * Checkout Session is the 30-minute reservation clock (ADR-0002), and the
 * **signature-verified webhook — not the browser redirect — is the source of
 * truth** for the outcome. On success the saga commits stock and the order goes
 * `paid`; on expiry/failure it releases stock and the order goes `cancelled`
 * (ADR-0002 compensation). Webhook handling is idempotent on the Stripe event id
 * (ADR-0013).
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly stripe: StripeService,
    private readonly orders: OrdersClient,
    private readonly producer: KafkaProducer,
  ) {}

  /**
   * Opens a hosted Checkout Session for one of the Customer's own orders. The
   * order is read back through Orders with the Customer's forwarded token, so the
   * amount is authoritative (never the client's) and a foreign order is a 404
   * (ADR-0007, ADR-0010). Only a `pending_payment` order can be paid — anything
   * else is a 409. The Payment row is recorded `pending`; it advances only when
   * the webhook confirms the outcome.
   */
  async createCheckoutSession(
    customerId: string,
    orderId: string,
    bearerToken: string,
  ): Promise<CheckoutSessionView> {
    const order = await this.orders.getOrder(orderId, bearerToken);
    if (order.status !== "pending_payment") {
      throw new ConflictException(
        `Order ${orderId} is ${order.status}, not awaiting payment`,
      );
    }

    const session = await this.stripe.createCheckoutSession({
      orderId,
      items: order.items,
    });

    // One Payment per order (orderId is unique): re-opening checkout updates the
    // existing row with the new session rather than creating a duplicate.
    await this.db
      .insert(payments)
      .values({
        orderId,
        customerId,
        amount: order.total,
        status: "pending",
        stripeSessionId: session.id,
      })
      .onConflictDoUpdate({
        target: payments.orderId,
        set: {
          status: "pending",
          stripeSessionId: session.id,
          amount: order.total,
          updatedAt: new Date(),
        },
      });

    return { url: session.url };
  }

  /**
   * Handles a Stripe webhook (ADR-0008). Verifies the signature first — an
   * unsigned or tampered event is a 400 and never touches the saga. The event id
   * is then claimed exactly once (ADR-0013): a duplicate delivery is skipped, so
   * stock is never committed or released twice. A `completed` event drives the
   * success path; an `expired` event drives the compensation path; anything else
   * is acknowledged and ignored.
   */
  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;
    try {
      event = this.stripe.constructEvent(payload, signature);
    } catch (err) {
      throw new BadRequestException(
        `Webhook signature verification failed: ${(err as Error).message}`,
      );
    }

    const claimed = await this.claimEvent(event.id, event.type);
    if (!claimed) {
      this.logger.log(`Duplicate webhook ${event.id} ignored (idempotent)`);
      return;
    }

    switch (event.type) {
      case "checkout.session.completed":
        await this.settleSuccess(orderIdOf(event));
        break;
      case "checkout.session.expired":
        await this.settleFailure(orderIdOf(event));
        break;
      default:
        this.logger.log(`Ignoring unhandled webhook type ${event.type}`);
    }
  }

  /**
   * Payment succeeded: emit `payment-succeeded` and record the Payment succeeded
   * (issue 11). The event is Payments' single announcement of the outcome — Orders
   * (mark `paid`) and Catalog (commit the hold) each consume it in their own group
   * (ADR-0002/0013), replacing the sync-phase HTTP settle calls. Keyed by `orderId`.
   */
  private async settleSuccess(orderId: string): Promise<void> {
    await this.producer.emit<PaymentSucceededEvent>(
      Topics.PaymentSucceeded,
      orderId,
      { orderId, amount: await this.amountFor(orderId) },
    );
    await this.db
      .update(payments)
      .set({ status: "succeeded", updatedAt: new Date() })
      .where(eq(payments.orderId, orderId));
  }

  /**
   * Payment failed/timed out: emit `payment-failed` and record the Payment failed
   * (issue 11). Orders cancels the order and Catalog releases the hold — the
   * compensation path — each consuming it in its own group (ADR-0002/0013). An
   * expired Stripe session is a `timeout` (ADR-0008). Keyed by `orderId`.
   */
  private async settleFailure(orderId: string): Promise<void> {
    await this.producer.emit<PaymentFailedEvent>(
      Topics.PaymentFailed,
      orderId,
      { orderId, reason: "timeout" },
    );
    await this.db
      .update(payments)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(payments.orderId, orderId));
  }

  /** The order's EUR amount (integer cents) recorded when its session was opened. */
  private async amountFor(orderId: string): Promise<number> {
    const [row] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId));
    return row?.amount ?? 0;
  }

  /**
   * Claims a Stripe event id, returning true only the first time it is seen. The
   * insert is atomic (`onConflictDoNothing`), so concurrent duplicate deliveries
   * cannot both proceed — the idempotency guard for at-least-once delivery.
   */
  private async claimEvent(id: string, type: string): Promise<boolean> {
    const inserted = await this.db
      .insert(processedEvents)
      .values({ stripeEventId: id, type })
      .onConflictDoNothing()
      .returning();
    return inserted.length > 0;
  }
}

/** Pulls the order id a Checkout Session was opened for (ADR-0008). */
function orderIdOf(event: Stripe.Event): string {
  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = session.metadata?.orderId ?? session.client_reference_id;
  if (!orderId) {
    throw new BadRequestException("Checkout session has no order id");
  }
  return orderId;
}
