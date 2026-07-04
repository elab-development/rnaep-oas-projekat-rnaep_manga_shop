import { cn } from "@workspace/ui/lib/utils";

/**
 * Availability chip driven by derived stock (CONTEXT.md: available =
 * quantity − reserved). Colours follow the ADR-0014 closed accent set:
 * green = in stock, yellow = low stock, red = out of stock.
 */
export function AvailabilityBadge({
  available,
  className,
}: {
  available: number;
  className?: string;
}) {
  const { label, tone } = describe(available);
  return (
    <span
      className={cn(
        "border-chip inline-flex items-center gap-1 px-2 py-0.5",
        "font-mono text-xs font-bold tracking-tight uppercase",
        tone,
        className,
      )}
    >
      {label}
    </span>
  );
}

const LOW_STOCK_THRESHOLD = 5;

function describe(available: number): { label: string; tone: string } {
  if (available <= 0) {
    return {
      label: "Out of stock",
      tone: "bg-status-cancelled text-status-cancelled-foreground",
    };
  }
  if (available <= LOW_STOCK_THRESHOLD) {
    return {
      label: `Only ${available} left`,
      tone: "bg-status-pending text-status-pending-foreground",
    };
  }
  return {
    label: "In stock",
    tone: "bg-status-paid text-status-paid-foreground",
  };
}
