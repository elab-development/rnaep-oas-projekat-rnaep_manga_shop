"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OrderView } from "@workspace/contracts";
import { CheckoutError, getOrder } from "@/lib/orders";
import { formatEur } from "@/lib/money";

/** How often to re-read the order while the webhook is still confirming. */
const POLL_INTERVAL_MS = 2000;
/** Give up polling after this long and let the Customer refresh themselves. */
const POLL_TIMEOUT_MS = 90_000;

type Phase = "confirming" | "paid" | "cancelled" | "error";

/**
 * Payment success page (issue 09, ADR-0008). Stripe redirects here after the
 * Customer pays, but the redirect is **not** proof of payment — the signed
 * webhook is the source of truth. So this shows "confirming…" and polls the
 * order status from the server until it flips to `paid` (webhook processed) or
 * `cancelled` (payment failed/expired), rather than assuming success.
 */
export function PaymentStatus({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const [phase, setPhase] = useState<Phase>("confirming");
  const [message, setMessage] = useState<string | null>(null);
  // Stamped on mount (not during render — Date.now() is impure) to bound polling.
  const startedAt = useRef<number | null>(null);

  const poll = useCallback(async () => {
    try {
      const next = await getOrder(orderId);
      setOrder(next);
      if (next.status === "paid") {
        setPhase("paid");
      } else if (next.status === "cancelled") {
        setPhase("cancelled");
      }
    } catch (err) {
      setPhase("error");
      setMessage(
        err instanceof CheckoutError
          ? err.message
          : "Could not read your order. Please refresh.",
      );
    }
  }, [orderId]);

  useEffect(() => {
    startedAt.current = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void poll();
  }, [poll]);

  useEffect(() => {
    if (phase !== "confirming") return;
    const id = setInterval(() => {
      if (Date.now() - (startedAt.current ?? Date.now()) > POLL_TIMEOUT_MS) {
        clearInterval(id);
        return;
      }
      void poll();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [phase, poll]);

  return (
    <div className="flex flex-col gap-6">
      <div className="brutal-box bg-card flex flex-col gap-2 p-8">
        <p className="text-foreground/60 font-mono text-xs font-bold tracking-[0.28em] uppercase">
          {HEADINGS[phase]}
        </p>
        <p className="text-2xl font-black tracking-tight">{TITLES[phase]}</p>
        <p className="text-muted-foreground">{message ?? BODIES[phase]}</p>
        <p className="text-muted-foreground font-mono text-xs">
          Order <span className="text-foreground">{orderId}</span>
        </p>
      </div>

      {order && (
        <div className="brutal-box bg-card flex items-center justify-between p-4">
          <span className="font-mono text-sm font-bold uppercase">Total</span>
          <span className="font-mono text-2xl font-bold">
            {formatEur(order.total)}
          </span>
        </div>
      )}

      <Link
        href="/catalog"
        className="font-mono text-sm font-bold uppercase underline underline-offset-4"
      >
        Continue shopping →
      </Link>
    </div>
  );
}

const HEADINGS: Record<Phase, string> = {
  confirming: "Payment · confirming",
  paid: "Payment · confirmed",
  cancelled: "Payment · not completed",
  error: "Payment · status unknown",
};

const TITLES: Record<Phase, string> = {
  confirming: "Confirming your payment…",
  paid: "You're all set!",
  cancelled: "Payment didn't go through",
  error: "We couldn't confirm your order",
};

const BODIES: Record<Phase, string> = {
  confirming:
    "We're waiting for Stripe to confirm your payment. This usually takes a few seconds — no need to refresh.",
  paid: "Your payment is confirmed and your order is on its way to fulfillment. Thank you!",
  cancelled:
    "Your payment was cancelled or timed out, so the order was released and your card was not charged.",
  error: "Please refresh this page in a moment to see your order's status.",
};
