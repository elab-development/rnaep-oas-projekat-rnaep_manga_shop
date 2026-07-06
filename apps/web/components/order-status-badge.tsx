import type { OrderStatus } from "@workspace/contracts";
import { cn } from "@workspace/ui/lib/utils";

/**
 * A small badge for an Order's lifecycle status (CONTEXT.md, ADR-0010):
 * `pending_payment → paid → shipped`, or `cancelled`. Shared by the Customer's
 * order history and the Admin oversight panel so a status reads the same
 * everywhere. Purely presentational.
 */

const LABELS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  shipped: "Shipped",
  cancelled: "Cancelled",
};

const TONES: Record<OrderStatus, string> = {
  pending_payment: "bg-muted text-foreground",
  paid: "bg-primary text-primary-foreground",
  shipped: "bg-foreground text-background",
  cancelled: "bg-destructive/15 text-destructive",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "border-foreground inline-block border-2 px-2 py-0.5 font-mono text-[0.65rem] font-bold tracking-wider uppercase",
        TONES[status],
      )}
    >
      {LABELS[status]}
    </span>
  );
}
