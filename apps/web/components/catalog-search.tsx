"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";

/**
 * Catalog search + genre filter. Title is a small form (submit to search);
 * genres are multi-select toggle chips that navigate on each toggle (OR filter).
 * Any change resets to page 1. State is read straight from the URL so the chips
 * always reflect the applied filter after the server re-renders.
 */
export function CatalogSearch({ genres }: { genres: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = new Set(searchParams.getAll("genre"));
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  function navigate(next: URLSearchParams): void {
    next.delete("page"); // any filter change returns to the first page
    const qs = next.toString();
    router.push(qs ? `/catalog?${qs}` : "/catalog");
  }

  function submitSearch(event: React.FormEvent): void {
    event.preventDefault();
    const next = new URLSearchParams(searchParams.toString());
    const trimmed = query.trim();
    if (trimmed) next.set("q", trimmed);
    else next.delete("q");
    navigate(next);
  }

  function toggleGenre(genre: string): void {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("genre");
    const active = new Set(selected);
    if (active.has(genre)) active.delete(genre);
    else active.add(genre);
    for (const g of active) next.append("genre", g);
    navigate(next);
  }

  function reset(): void {
    setQuery("");
    router.push("/catalog");
  }

  const hasFilters = selected.size > 0 || query.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submitSearch} className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1">
          <span className="font-mono text-xs font-bold tracking-wide uppercase">
            Title
          </span>
          <input
            type="search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title…"
            className="border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <Button type="submit" size="lg" className="self-end">
          Search
        </Button>
      </form>

      {genres.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="font-mono text-xs font-bold tracking-wide uppercase">
            Genres
          </legend>
          <div className="flex flex-wrap gap-2">
            {genres.map((genre) => {
              const active = selected.has(genre);
              return (
                <button
                  key={genre}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleGenre(genre)}
                  className={cn(
                    "border-chip px-2.5 py-1 font-mono text-xs font-bold tracking-tight uppercase transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-card hover:bg-muted",
                  )}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {hasFilters && (
        <button
          type="button"
          onClick={reset}
          className="self-start font-mono text-xs font-bold uppercase underline underline-offset-4"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
