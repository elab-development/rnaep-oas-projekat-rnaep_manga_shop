"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
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

  // Reflect *applied* filters (from the URL), not the live input — otherwise
  // "Clear filters" shows while typing, before a search has been submitted.
  const appliedQuery = searchParams.get("q") ?? "";
  const hasFilters = selected.size > 0 || appliedQuery.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* A search box, not a data-entry form (ADR-0015): plain navigate-on-submit
          <form>, no validation. Field + Input only for the shared on-system look. */}
      <form onSubmit={submitSearch} className="flex gap-3">
        <Field className="flex-1">
          <FieldLabel htmlFor="catalog-q">Title</FieldLabel>
          <Input
            id="catalog-q"
            type="search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title…"
          />
        </Field>
        <Button type="submit" size="lg" className="brutal-btn h-11 self-end">
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
