import { cn } from "@workspace/ui/lib/utils";

/**
 * The **NEW** marker for a New Arrivals tile (CONTEXT.md: New Arrivals) — a
 * Manga created within the last 30 days. Purely presentational; callers gate it
 * on {@link isNewArrival}. Uses the ADR-0014 closed-set yellow "attention / act"
 * accent (`bg-primary`), the same hue the Featured badge uses, so both loud
 * markers read as one vocabulary. `className` lets a caller position it (e.g.
 * absolute on a card corner).
 */
export function NewBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "border-chip bg-primary text-primary-foreground inline-flex items-center gap-1 px-2 py-0.5",
        "font-mono text-[0.65rem] font-bold tracking-wider uppercase",
        className,
      )}
    >
      New
    </span>
  );
}
