import { DISPLAY_CURRENCIES, type DisplayPrices } from "@workspace/contracts";
import { cn } from "@workspace/ui/lib/utils";
import { formatDisplayPrice } from "@/lib/money";

/**
 * The small USD/GBP/JPY labels shown beneath a manga's EUR price (ADR-0006:
 * display-only conversions). Renders nothing when the Catalog service had no
 * exchange rates to convert with (e.g. the Frankfurter breaker is open before
 * any successful fetch) — EUR alone still stands.
 */
export function DisplayPriceLabels({
  display,
  className,
}: {
  display?: DisplayPrices;
  className?: string;
}) {
  if (!display) return null;
  return (
    <p className={cn("text-muted-foreground font-mono text-xs", className)}>
      {DISPLAY_CURRENCIES.map((currency) =>
        formatDisplayPrice(display[currency], currency),
      ).join(" · ")}
    </p>
  );
}
