import { cn } from "@workspace/ui/lib/utils";

/**
 * The editorial **Featured** marker (CONTEXT.md: Featured) — a Manga a
 * Moderator/Admin has curated into the homepage Featured rail. Purely
 * presentational; render it only when `MangaView.featured` is true.
 *
 * Featured maps to the ADR-0014 closed-set yellow "attention / act" accent
 * (`bg-primary`), the same hue the moderator toggle uses, so the flag reads the
 * same wherever a Guest meets it (catalog tile, detail page). `className` lets a
 * caller position it (e.g. absolute on a card corner) without reshaping the chip.
 */
export function FeaturedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "border-chip bg-primary text-primary-foreground inline-flex items-center gap-1 px-2 py-0.5",
        "font-mono text-[0.65rem] font-bold tracking-wider uppercase",
        className,
      )}
    >
      ★ Featured
    </span>
  );
}
