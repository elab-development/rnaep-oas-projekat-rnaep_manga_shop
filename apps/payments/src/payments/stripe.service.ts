import { Injectable } from "@nestjs/common";
import type { OrderItemView } from "@workspace/contracts";
import Stripe from "stripe";

/** The reservation window (ADR-0002): the Checkout Session *is* the 30-min clock. */
const SESSION_TTL_SECONDS = 30 * 60;

/** Where the browser lands after paying / cancelling on Stripe's hosted page. */
function webBaseUrl(): string {
  return process.env.WEB_URL ?? "http://localhost:3010";
}

function secretKey(): string {
  // A dummy default keeps the module importable without secrets; session
  // creation still needs a real key at runtime, and tests override this service.
  return process.env.STRIPE_SECRET_KEY ?? "sk_test_dummy";
}

function webhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_test_dummy";
}

/** Inputs to open a hosted Checkout Session for an order. */
export interface CheckoutSessionParams {
  orderId: string;
  items: OrderItemView[];
}

/** What Payments keeps from a created session. */
export interface CreatedSession {
  id: string;
  url: string;
}

/**
 * Thin wrapper over the Stripe SDK (ADR-0008). Isolates the two Stripe touch
 * points so the rest of Payments depends on our own shapes, and so integration
 * tests can stub session creation (a network call) at this seam while keeping the
 * **real** offline signature verification. There is deliberately no circuit
 * breaker here — payment outcomes must fail loudly (ADR-0009).
 */
@Injectable()
export class StripeService {
  private readonly stripe = new Stripe(secretKey());

  /**
   * Opens a hosted Checkout Session with `expires_at = now + 30 min` (ADR-0008):
   * Stripe owns the timer and fires `checkout.session.expired` when it lapses, so
   * Payments needs no separate scheduler. `orderId` rides in `metadata` and
   * `client_reference_id` so the webhook can tie the outcome back to the order.
   * Money is charged in EUR (ADR-0006); line prices are Catalog's, snapshotted
   * onto the order — never the client's.
   */
  async createCheckoutSession(
    params: CheckoutSessionParams,
  ): Promise<CreatedSession> {
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
      client_reference_id: params.orderId,
      metadata: { orderId: params.orderId },
      line_items: params.items.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: "eur",
          unit_amount: item.price,
          product_data: { name: item.title },
        },
      })),
      success_url: `${webBaseUrl()}/checkout/success?orderId=${params.orderId}`,
      cancel_url: `${webBaseUrl()}/checkout/cancelled?orderId=${params.orderId}`,
    });
    return { id: session.id, url: session.url ?? "" };
  }

  /**
   * Verifies a webhook payload's signature against `STRIPE_WEBHOOK_SECRET` and
   * returns the parsed event (ADR-0008: the signed webhook is the source of
   * truth, not the browser redirect). This is an **offline** HMAC check — no
   * network — so it runs identically in tests. Throws on a missing/invalid
   * signature, which the caller turns into a 400.
   */
  constructEvent(payload: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret(),
    );
  }
}
