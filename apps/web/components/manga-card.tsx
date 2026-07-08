import Link from "next/link";
import type { MangaView } from "@workspace/contracts";
import { AvailabilityBadge } from "@/components/availability-badge";
import { DisplayPriceLabels } from "@/components/display-prices";
import { FeaturedBadge } from "@/components/featured-badge";
import { NewBadge } from "@/components/new-badge";
import { formatEur } from "@/lib/money";
import { isNewArrival } from "@/lib/recency";

/**
 * A single catalog tile: cover, title, author, price, availability. The whole
 * card links to the manga's detail page. Covers are remote (MyAnimeList CDN)
 * and may fail — a plain `<img>` degrades to its alt text, and the ink border
 * keeps the layout intact regardless.
 *
 * `showNew` opts the tile into the New Arrivals **NEW** badge — set only by the
 * homepage New Arrivals rail, and then only when the manga is actually recent
 * (CONTEXT.md: New Arrivals). The catalog grid leaves it off.
 */
export function MangaCard({
  manga,
  showNew = false,
}: {
  manga: MangaView;
  showNew?: boolean;
}) {
  return (
    <Link
      href={`/catalog/${manga.id}`}
      className="brutal-box brutal-press group relative flex flex-col bg-card hover:-translate-y-0.5"
    >
      {manga.featured && (
        <FeaturedBadge className="absolute top-2 right-2 z-10" />
      )}
      {showNew && isNewArrival(manga.createdAt) && (
        <NewBadge className="absolute top-2 left-2 z-10" />
      )}
      <div className="border-b bg-muted aspect-[2/3] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={manga.cover}
          alt={`Cover of ${manga.title}`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="leading-tight font-bold tracking-tight">
          {manga.title}
        </h3>
        <p className="text-muted-foreground text-sm">{manga.author}</p>
        <div className="mt-auto flex flex-col gap-1 pt-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-lg font-bold">
              {formatEur(manga.price)}
            </span>
            <AvailabilityBadge available={manga.available} />
          </div>
          <DisplayPriceLabels display={manga.display} />
        </div>
      </div>
    </Link>
  );
}
