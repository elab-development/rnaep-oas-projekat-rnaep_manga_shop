"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type {
  CartItemView,
  MangaView,
  OrderView,
  ShippingDetails,
} from "@workspace/contracts";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { CartError, fetchCartManga, getCart } from "@/lib/cart";
import { CheckoutError, createOrder, getOrder } from "@/lib/orders";
import { PaymentError, startCheckoutSession } from "@/lib/payments";
import { formatEur } from "@/lib/money";

/** A cart line joined with its Catalog details (null if the manga was deleted). */
interface EnrichedLine extends CartItemView {
  manga: MangaView | null;
}

type ShippingErrors = Partial<Record<keyof ShippingDetails, string>>;

/** How often to re-read the order while stock is being reserved (issue 11). */
const RESERVATION_POLL_MS = 800;
/** Give up waiting on the reservation and let the payment step take over. */
const RESERVATION_TIMEOUT_MS = 20_000;

const EMPTY_SHIPPING: ShippingDetails = {
  recipientName: "",
  address: "",
  city: "",
  postalCode: "",
  phone: "",
};

// The shipping fields, in form order, with their labels + autocomplete hints.
const FIELDS: {
  key: keyof ShippingDetails;
  label: string;
  autoComplete: string;
  placeholder: string;
}[] = [
  { key: "recipientName", label: "Recipient name", autoComplete: "name", placeholder: "Ada Lovelace" },
  { key: "address", label: "Address", autoComplete: "street-address", placeholder: "1 Analytical Way" },
  { key: "city", label: "City", autoComplete: "address-level2", placeholder: "London" },
  { key: "postalCode", label: "Postal code", autoComplete: "postal-code", placeholder: "EC1A 1AA" },
  { key: "phone", label: "Phone", autoComplete: "tel", placeholder: "+44 20 7946 0000" },
];

/**
 * The checkout form (issue 08): review the cart, enter shipping, place the order.
 * The cart and every price come from the server (ADR-0010) — this composes the
 * review from Catalog the same way the cart does, and sends only shipping. On
 * success the order is `pending_payment` and the cart is cleared; paying for it
 * arrives in the next slice.
 */
export function CheckoutForm() {
  const [lines, setLines] = useState<EnrichedLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [shipping, setShipping] = useState<ShippingDetails>(EMPTY_SHIPPING);
  const [fieldErrors, setFieldErrors] = useState<ShippingErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<OrderView | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const cart = await getCart();
      const enriched = await Promise.all(
        cart.items.map(async (item) => ({
          ...item,
          manga: await fetchCartManga(item.mangaId),
        })),
      );
      setLines(enriched);
    } catch (err) {
      setLoadError(
        err instanceof CartError
          ? err.message
          : "Could not load your cart. Is the shop running?",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const errors: ShippingErrors = {};
    for (const { key, label } of FIELDS) {
      if (!shipping[key].trim()) errors[key] = `Enter the ${label.toLowerCase()}.`;
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      // Checkout places the order and emits `order-created`; stock is reserved
      // asynchronously by Catalog (issue 11, ADR-0003), so the order comes back
      // without prices. Wait for the `stock-reserved` event to price it (or a
      // `stock-rejected` to cancel it) before handing off to Stripe.
      const placedOrder = await createOrder(shipping);
      const reserved = await awaitReservation(placedOrder.id);
      if (reserved === "cancelled") {
        setSubmitError(
          "One or more items are out of stock, so your order was cancelled. Please try again.",
        );
        setSubmitting(false);
        return;
      }
      setPlaced(reserved);
      // Now the order is reserved and priced: hand the browser to Stripe's hosted
      // page — the session is the 30-min hold clock (ADR-0008).
      await redirectToPayment(reserved.id);
    } catch (err) {
      setSubmitError(
        err instanceof CheckoutError
          ? err.message
          : "Could not place your order. Please try again.",
      );
      setSubmitting(false);
    }
  }

  /**
   * Polls the order until Catalog's `stock-reserved` has priced it (items + total
   * present) or `stock-rejected` has cancelled it — the async reservation window
   * (~eventual, ADR-0002). Returns the priced order, or `"cancelled"` if it was
   * rejected. On timeout it returns the latest order and lets the payment step
   * surface any remaining problem rather than hanging forever.
   */
  async function awaitReservation(
    orderId: string,
  ): Promise<OrderView | "cancelled"> {
    const deadline = Date.now() + RESERVATION_TIMEOUT_MS;
    for (;;) {
      const current = await getOrder(orderId);
      if (current.status === "cancelled") return "cancelled";
      if (current.items.length > 0 && current.total > 0) return current;
      if (Date.now() > deadline) return current;
      await new Promise((resolve) =>
        setTimeout(resolve, RESERVATION_POLL_MS),
      );
    }
  }

  /**
   * Opens a Stripe Checkout Session and hands the browser to Stripe's hosted page.
   * On failure the order still exists (reserved, awaiting payment), so we surface a
   * retry rather than losing it.
   */
  async function redirectToPayment(orderId: string): Promise<void> {
    setPayError(null);
    try {
      const { url } = await startCheckoutSession(orderId);
      window.location.href = url;
    } catch (err) {
      setPayError(
        err instanceof PaymentError
          ? err.message
          : "Could not start payment. Please try again.",
      );
      setSubmitting(false);
    }
  }

  if (placed)
    return (
      <PaymentRedirect
        order={placed}
        error={payError}
        onRetry={() => redirectToPayment(placed.id)}
      />
    );

  if (loading) {
    return <p className="text-muted-foreground font-mono text-sm">Loading…</p>;
  }

  if (loadError) {
    return (
      <p role="alert" className="text-destructive text-sm font-medium">
        {loadError}
      </p>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="brutal-box bg-card flex flex-col items-start gap-2 p-8">
        <p className="text-lg font-bold">Your cart is empty.</p>
        <p className="text-muted-foreground">
          Add something to your cart before checking out.
        </p>
        <Link
          href="/catalog"
          className="mt-2 font-semibold underline underline-offset-4"
        >
          Browse the catalog
        </Link>
      </div>
    );
  }

  const total = lines.reduce(
    (sum, l) => sum + (l.manga ? l.manga.price * l.quantity : 0),
    0,
  );

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_1.1fr]">
      {/* Review — server-sourced prices, shown for confirmation only. */}
      <section className="flex flex-col gap-4">
        <h2 className="font-mono text-xs font-bold tracking-[0.28em] uppercase">
          Review
        </h2>
        <ul className="flex flex-col gap-3">
          {lines.map((line) => (
            <li key={line.mangaId} className="brutal-box bg-card flex gap-4 p-4">
              <div className="bg-muted aspect-[2/3] w-14 shrink-0 overflow-hidden">
                {line.manga && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={line.manga.cover}
                    alt={`Cover of ${line.manga.title}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <p className="truncate font-bold tracking-tight">
                  {line.manga ? line.manga.title : "This title is no longer available"}
                </p>
                <div className="text-muted-foreground flex items-center justify-between font-mono text-sm">
                  <span>
                    {line.manga ? formatEur(line.manga.price) : "—"} × {line.quantity}
                  </span>
                  <span className="text-foreground font-bold">
                    {line.manga
                      ? formatEur(line.manga.price * line.quantity)
                      : "—"}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="brutal-box bg-card flex items-center justify-between p-4">
          <span className="font-mono text-sm font-bold uppercase">Total</span>
          <span className="font-mono text-2xl font-bold">{formatEur(total)}</span>
        </div>
      </section>

      {/* Shipping — the only thing the client supplies (ADR-0010). */}
      <section className="flex flex-col gap-4">
        <h2 className="font-mono text-xs font-bold tracking-[0.28em] uppercase">
          Shipping
        </h2>
        <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
          {FIELDS.map(({ key, label, autoComplete, placeholder }) => (
            <Field
              key={key}
              data-invalid={fieldErrors[key] ? "true" : undefined}
            >
              <FieldLabel htmlFor={key}>{label}</FieldLabel>
              <Input
                id={key}
                name={key}
                autoComplete={autoComplete}
                required
                maxLength={200}
                aria-invalid={!!fieldErrors[key]}
                value={shipping[key]}
                placeholder={placeholder}
                onChange={(e) => {
                  const value = e.target.value;
                  setShipping((prev) => ({ ...prev, [key]: value }));
                  if (fieldErrors[key])
                    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
                }}
              />
              <FieldError>{fieldErrors[key]}</FieldError>
            </Field>
          ))}

          {submitError && (
            <p
              role="alert"
              className="border-destructive bg-destructive/10 text-destructive border-l-4 px-3 py-2 text-sm font-medium"
            >
              {submitError}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            className="brutal-btn mt-1 h-11 w-full text-sm font-semibold tracking-[0.2em] uppercase disabled:opacity-70"
          >
            {submitting
              ? "Placing order…"
              : `Pay ${formatEur(total)} with card`}
          </Button>
          <p className="text-muted-foreground font-mono text-xs">
            You&apos;ll be taken to Stripe&apos;s secure checkout to pay by card.
            Placing an order reserves your copies and holds them for 30 minutes
            while you pay.
          </p>
        </form>
      </section>
    </div>
  );
}

/**
 * Post-checkout: the order is placed and reserved, and we're handing the browser
 * to Stripe's hosted checkout. If the redirect fails to start, the order still
 * exists (awaiting payment) so we offer a retry rather than losing it.
 */
function PaymentRedirect({
  order,
  error,
  onRetry,
}: {
  order: OrderView;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="brutal-box bg-card flex flex-col gap-2 p-8">
        <p className="text-foreground/60 font-mono text-xs font-bold tracking-[0.28em] uppercase">
          Order placed · {error ? "awaiting payment" : "redirecting to payment"}
        </p>
        <p className="text-2xl font-black tracking-tight">
          Thanks, {order.shipping.recipientName.split(" ")[0]}!
        </p>
        <p className="text-muted-foreground">
          {error
            ? "Your copies are reserved and held for 30 minutes. Continue to Stripe's secure checkout to pay by card."
            : "Taking you to Stripe's secure checkout to pay by card…"}
        </p>
        <p className="text-muted-foreground font-mono text-xs">
          Order <span className="text-foreground">{order.id}</span>
        </p>
      </div>

      <div className="brutal-box bg-card flex items-center justify-between p-4">
        <span className="font-mono text-sm font-bold uppercase">Total</span>
        <span className="font-mono text-2xl font-bold">
          {formatEur(order.total)}
        </span>
      </div>

      {error && (
        <div className="flex flex-col gap-3">
          <p
            role="alert"
            className="border-destructive bg-destructive/10 text-destructive border-l-4 px-3 py-2 text-sm font-medium"
          >
            {error}
          </p>
          <Button
            type="button"
            size="lg"
            onClick={onRetry}
            className="brutal-btn h-11 w-full text-sm font-semibold tracking-[0.2em] uppercase"
          >
            Continue to payment · {formatEur(order.total)}
          </Button>
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
