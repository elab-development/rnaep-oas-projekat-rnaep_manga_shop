import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/add-to-cart";
import { AvailabilityBadge } from "@/components/availability-badge";
import { DisplayPriceLabels } from "@/components/display-prices";
import { FeaturedBadge } from "@/components/featured-badge";
import { fetchManga } from "@/lib/catalog";
import { formatEur } from "@/lib/money";

export const dynamic = "force-dynamic";

interface DetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: DetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const manga = await fetchManga(id);
  if (!manga) {
    // Titles render through the root template → "Not found · Manga Shop".
    return { title: "Not found" };
  }
  const lead = `${manga.title} by ${manga.author} — an authentic physical manga volume, priced in EUR.`;
  return {
    // → "<title> · Manga Shop" via the root template.
    title: manga.title,
    description: clampDescription(`${lead} ${manga.description}`),
    alternates: { canonical: `/catalog/${manga.id}` },
  };
}

/** Keep meta descriptions to a search-snippet length (~160 chars). */
function clampDescription(text: string): string {
  const max = 160;
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

export default async function MangaDetailPage({ params }: DetailPageProps) {
  const { id } = await params;
  const manga = await fetchManga(id);
  if (!manga) notFound();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <Link
        href="/catalog"
        className="font-mono text-sm font-bold uppercase underline underline-offset-4"
      >
        ← Back to the shelf
      </Link>

      <article className="grid gap-8 md:grid-cols-[minmax(0,18rem)_1fr]">
        <div className="brutal-box bg-muted aspect-[2/3] self-start overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={manga.cover}
            alt={`Cover of ${manga.title}`}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            {manga.featured && <FeaturedBadge className="self-start" />}
            <h1 className="font-[family-name:var(--font-sans)] text-4xl font-bold tracking-tight uppercase">
              {manga.title}
            </h1>
            <p className="text-muted-foreground text-lg">by {manga.author}</p>
          </div>

          {manga.genres.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {manga.genres.map((genre) => (
                <li key={genre}>
                  <Link
                    href={`/catalog?genre=${encodeURIComponent(genre)}`}
                    className="border-chip bg-card inline-block px-2 py-0.5 font-mono text-xs font-bold tracking-tight uppercase hover:bg-primary hover:text-primary-foreground"
                  >
                    {genre}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <p className="max-w-prose leading-relaxed">{manga.description}</p>

          <div className="brutal-box bg-card mt-auto flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-3xl font-bold">
                {formatEur(manga.price)}
              </span>
              <DisplayPriceLabels display={manga.display} className="text-sm" />
              <AvailabilityBadge available={manga.available} />
            </div>
            {/* Cart is login-required (ADR-0010): a Guest is routed to sign in
                first so the cart ties to their account. */}
            <AddToCart mangaId={manga.id} available={manga.available} />
          </div>
        </div>
      </article>
    </main>
  );
}
