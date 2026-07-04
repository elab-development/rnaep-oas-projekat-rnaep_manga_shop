import Link from "next/link";
import type { MangaView } from "@workspace/contracts";
import { AvailabilityBadge } from "@/components/availability-badge";
import { formatEur } from "@/lib/money";

/**
 * A single catalog tile: cover, title, author, price, availability. The whole
 * card links to the manga's detail page. Covers are remote (MyAnimeList CDN)
 * and may fail — a plain `<img>` degrades to its alt text, and the ink border
 * keeps the layout intact regardless.
 */
export function MangaCard({ manga }: { manga: MangaView }) {
  return (
    <Link
      href={`/catalog/${manga.id}`}
      className="brutal-box group flex flex-col bg-card hover:-translate-y-0.5"
    >
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
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="font-mono text-lg font-bold">
            {formatEur(manga.price)}
          </span>
          <AvailabilityBadge available={manga.available} />
        </div>
      </div>
    </Link>
  );
}
