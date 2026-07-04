import type { Metadata } from "next";
import Link from "next/link";
import { CATALOG_PAGE_SIZE } from "@workspace/contracts";
import { cn } from "@workspace/ui/lib/utils";
import { CatalogSearch } from "@/components/catalog-search";
import { MangaCard } from "@/components/manga-card";
import { fetchCatalog } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Catalog · Manga Shop",
};

// Prices and stock change; always render against fresh data.
export const dynamic = "force-dynamic";

interface CatalogPageProps {
  searchParams: Promise<{ page?: string; q?: string; genre?: string }>;
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const q = params.q?.trim() || undefined;
  const genre = params.genre?.trim() || undefined;

  const result = await fetchCatalog({
    page,
    limit: CATALOG_PAGE_SIZE,
    q,
    genre,
  });

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-[family-name:var(--font-sans)] text-4xl font-bold tracking-tight uppercase">
          The Shelf
        </h1>
        <p className="text-muted-foreground max-w-prose">
          Real volumes, real ink, real availability. Browse the catalog, search
          by title, and filter by genre.
        </p>
      </header>

      <section className="brutal-box bg-card p-4">
        <CatalogSearch q={q} genre={genre} />
      </section>

      {result.items.length === 0 ? (
        <EmptyState />
      ) : (
        <section
          aria-label="Catalog"
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
        >
          {result.items.map((manga) => (
            <MangaCard key={manga.id} manga={manga} />
          ))}
        </section>
      )}

      <Pager
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        q={q}
        genre={genre}
      />
    </main>
  );
}

function EmptyState() {
  return (
    <div className="brutal-box bg-card flex flex-col items-center gap-2 p-12 text-center">
      <p className="text-lg font-bold">No manga match your search.</p>
      <p className="text-muted-foreground">
        Try a different title or clear the genre filter.
      </p>
      <Link href="/catalog" className="mt-2 font-mono text-sm underline">
        Reset
      </Link>
    </div>
  );
}

function Pager({
  page,
  totalPages,
  total,
  q,
  genre,
}: {
  page: number;
  totalPages: number;
  total: number;
  q?: string;
  genre?: string;
}) {
  if (total === 0) return null;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav className="flex items-center justify-between gap-4 font-mono text-sm">
      <PagerLink page={page - 1} q={q} genre={genre} disabled={!hasPrev}>
        ← Prev
      </PagerLink>
      <span className="text-muted-foreground">
        Page {page} of {Math.max(totalPages, 1)} · {total} title
        {total === 1 ? "" : "s"}
      </span>
      <PagerLink page={page + 1} q={q} genre={genre} disabled={!hasNext}>
        Next →
      </PagerLink>
    </nav>
  );
}

function PagerLink({
  page,
  q,
  genre,
  disabled,
  children,
}: {
  page: number;
  q?: string;
  genre?: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const base = "border-chip px-3 py-1.5 font-bold uppercase";
  if (disabled) {
    return (
      <span
        aria-disabled
        className={cn(base, "text-muted-foreground opacity-40")}
      >
        {children}
      </span>
    );
  }
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (q) params.set("q", q);
  if (genre) params.set("genre", genre);
  return (
    <Link
      href={`/catalog?${params.toString()}`}
      className={cn(base, "bg-card hover:bg-primary hover:text-primary-foreground")}
    >
      {children}
    </Link>
  );
}

function parsePage(raw?: string): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}
