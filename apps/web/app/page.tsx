import Link from "next/link";
import type { MangaView } from "@workspace/contracts";
import { buttonVariants } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { MangaCard } from "@/components/manga-card";
import { SiteFooter } from "@/components/site-footer";
import {
  fetchFeatured,
  fetchGenres,
  fetchNewArrivals,
  HOME_REVALIDATE,
} from "@/lib/catalog";

/**
 * Homepage landing (issue 03). A conversion-first shell — hero, genre quick-nav,
 * the Featured and New Arrivals rails, value props, a final CTA, and the footer —
 * whose one job is to get a Guest into the catalog quickly while looking like a
 * real store.
 *
 * Served under ISR (ADR-0016): the server-rendered shell carries no per-user
 * state (session-aware chrome is `SiteNav`, a client island), so it is identical
 * for every visitor and cacheable. Catalog / product / cart / authed pages keep
 * their `no-store` posture; the rail fetches below opt into the same revalidate
 * window so nothing forces this route dynamic.
 *
 * Next parses this segment config statically, so it must be an inline literal —
 * it mirrors `HOME_REVALIDATE` (the value the rail fetches use); keep them equal.
 */
export const revalidate = 3600;

// How many genre chips the quick-nav shows before it stops being "quick".
const GENRE_NAV_LIMIT = 12;

// The homepage prerenders at build under ISR (ADR-0016), so — unlike the
// per-request catalog page — a rail fetch failing (e.g. the gateway unreachable
// at build time) would otherwise crash the whole build. A landing surface should
// degrade to its shell + empty states instead, then recover on the next
// revalidate. Extends story 13 ("an un-curated shop must not look broken") to a
// transiently unreachable one.
function onRailError(label: string) {
  return (err: unknown): never[] => {
    console.error(`Homepage ${label} failed to load:`, err);
    return [];
  };
}

export default async function HomePage() {
  const [featured, newArrivals, genres] = await Promise.all([
    fetchFeatured().catch(onRailError("Featured")),
    fetchNewArrivals().catch(onRailError("New Arrivals")),
    fetchGenres({ revalidate: HOME_REVALIDATE }).catch(onRailError("genres")),
  ]);

  return (
    <>
      <main className="mx-auto flex max-w-6xl flex-col gap-20 px-6 py-16 sm:gap-28">
        <Hero />
        <GenreNav genres={genres.slice(0, GENRE_NAV_LIMIT)} />
        <HomeRail
          eyebrow="Staff picks"
          title="Featured"
          blurb="Titles our shop is highlighting right now — hand-picked, not an algorithm."
          items={featured}
          emptyMessage="No featured titles yet. Our shelf editors are still choosing — check back soon."
        />
        <HomeRail
          eyebrow="Just landed"
          title="New Arrivals"
          blurb="The most recently added volumes, newest first."
          items={newArrivals}
          viewAllHref="/catalog"
          viewAllLabel="Browse the catalog"
          showNew
        />
        <ValueProps />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}

function Hero() {
  return (
    <section aria-label="Introduction" className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <span className="font-mono text-xs font-bold tracking-[0.3em] uppercase">
          漫 · The manga shop
        </span>
        <h1 className="font-[family-name:var(--font-sans)] max-w-4xl text-5xl leading-[0.95] font-bold tracking-tight uppercase sm:text-7xl">
          Physical manga,
          <br />
          <span className="bg-primary text-primary-foreground box-decoration-clone px-2">
            on your shelf.
          </span>
        </h1>
        <p className="text-muted-foreground max-w-prose text-lg">
          Browse a catalog of authentic physical manga volumes — search by title,
          filter by genre, and see real stock and EUR prices before you buy.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/catalog"
          className={buttonVariants({ size: "lg", className: "brutal-btn min-w-48" })}
        >
          Browse the catalog
        </Link>
        <Link
          href="/register"
          className={buttonVariants({
            variant: "outline",
            size: "lg",
            className: "brutal-btn min-w-48",
          })}
        >
          Create an account
        </Link>
      </div>
    </section>
  );
}

function GenreNav({ genres }: { genres: string[] }) {
  if (genres.length === 0) return null;
  return (
    <section aria-label="Browse by genre" className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-xs font-bold tracking-[0.25em] uppercase">
          Jump straight in
        </span>
        <h2 className="font-[family-name:var(--font-sans)] text-2xl font-bold tracking-tight uppercase">
          Shop by genre
        </h2>
      </div>
      <nav aria-label="Genres" className="flex flex-wrap gap-2">
        {genres.map((genre) => (
          <Link
            key={genre}
            href={`/catalog?genre=${encodeURIComponent(genre)}`}
            className="border-chip bg-card hover:bg-primary hover:text-primary-foreground inline-block px-3 py-1.5 font-mono text-sm font-bold tracking-tight uppercase"
          >
            {genre}
          </Link>
        ))}
      </nav>
    </section>
  );
}

function HomeRail({
  eyebrow,
  title,
  blurb,
  items,
  emptyMessage,
  viewAllHref,
  viewAllLabel,
  showNew = false,
}: {
  eyebrow: string;
  title: string;
  blurb: string;
  items: MangaView[];
  emptyMessage?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  showNew?: boolean;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs font-bold tracking-[0.25em] uppercase">
            {eyebrow}
          </span>
          <h2 className="font-[family-name:var(--font-sans)] text-3xl font-bold tracking-tight uppercase sm:text-4xl">
            {title}
          </h2>
          <p className="text-muted-foreground max-w-prose">{blurb}</p>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="border-chip bg-card hover:bg-primary hover:text-primary-foreground shrink-0 px-3 py-1.5 font-mono text-sm font-bold uppercase"
          >
            {viewAllLabel ?? "View all"} →
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="brutal-box bg-card flex flex-col items-center gap-2 p-12 text-center">
          <p className="text-lg font-bold">Nothing here yet.</p>
          <p className="text-muted-foreground max-w-prose">{emptyMessage}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {items.map((manga) => (
            <MangaCard key={manga.id} manga={manga} showNew={showNew} />
          ))}
        </div>
      )}
    </section>
  );
}

const VALUE_PROPS: { title: string; body: string }[] = [
  {
    title: "Authentic volumes",
    body: "Real, licensed physical manga — the printed book, not a scan or a download.",
  },
  {
    title: "Secure checkout",
    body: "Card payments handled by Stripe. We never see or store your card details.",
  },
  {
    title: "EUR, shown your way",
    body: "Priced in euros and charged in euros — with live USD, GBP and JPY labels alongside.",
  },
  {
    title: "Fast browsing",
    body: "Search by title, filter by genre, and see real stock before you add to cart.",
  },
];

function ValueProps() {
  return (
    <section aria-label="Why shop with us" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-xs font-bold tracking-[0.25em] uppercase">
          The shop, plainly
        </span>
        <h2 className="font-[family-name:var(--font-sans)] text-3xl font-bold tracking-tight uppercase sm:text-4xl">
          Why shop here
        </h2>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {VALUE_PROPS.map((prop, i) => (
          <li
            key={prop.title}
            className="brutal-box bg-card flex flex-col gap-3 p-5"
          >
            <span className="text-muted-foreground font-mono text-sm font-bold">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="text-lg leading-tight font-bold tracking-tight">
              {prop.title}
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {prop.body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FinalCta() {
  return (
    <section
      aria-label="Start browsing"
      className={cn(
        "brutal-box-lg bg-foreground text-background bg-dots flex flex-col items-start gap-6 p-8 sm:p-12",
        // Flip the dot field light so the screentone reads on the inked panel.
        "[--dots:color-mix(in_oklab,var(--background)_16%,transparent)]",
      )}
    >
      <h2 className="font-[family-name:var(--font-sans)] max-w-2xl text-3xl leading-[1.05] font-bold tracking-tight uppercase sm:text-5xl">
        Your next volume is on the shelf.
      </h2>
      <p className="max-w-prose text-lg opacity-80">
        Hundreds of authentic manga volumes, priced in EUR, ready to ship. Start
        browsing — no account needed to look.
      </p>
      <Link
        href="/catalog"
        className={buttonVariants({ size: "lg", className: "brutal-btn min-w-48" })}
      >
        Browse the catalog
      </Link>
    </section>
  );
}
