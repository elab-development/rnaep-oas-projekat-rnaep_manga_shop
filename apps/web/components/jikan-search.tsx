"use client";

import type { JikanSuggestion } from "@workspace/contracts";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { useState } from "react";
import { ModerationError, searchJikan } from "@/lib/moderation";

/**
 * Add-time Jikan search (ADR-0009): the moderator searches, picks a result, and
 * its data prefills the form. Enrichment is a snapshot — picking copies the
 * fields once; nothing auto-resyncs. When Jikan is unavailable the search
 * returns no results and a hint steers the moderator to type the manga manually,
 * so catalog work is never blocked.
 */
export function JikanSearch({
  onPick,
}: {
  onPick: (suggestion: JikanSuggestion) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JikanSuggestion[]>([]);
  const [pending, setPending] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    setPending(true);
    setError(null);
    try {
      setResults(await searchJikan(q));
      setSearched(true);
    } catch (err) {
      setError(
        err instanceof ModerationError
          ? err.message
          : "Could not reach the shop.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="brutal-box bg-muted/40 flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-xs font-bold tracking-wide uppercase">
          Auto-fill from Jikan
        </p>
        <p className="text-muted-foreground text-sm">
          Search MyAnimeList to prefill title, author, genres and cover. You set
          price and stock.
        </p>
      </div>

      <form onSubmit={run} className="flex gap-3">
        <Field className="flex-1">
          <FieldLabel htmlFor="jikan-q">Search title</FieldLabel>
          <Input
            id="jikan-q"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Berserk"
          />
        </Field>
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="brutal-btn h-11 self-end"
        >
          {pending ? "Searching…" : "Search"}
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}

      {searched && !error && results.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No Jikan results — fill the form manually below.
        </p>
      )}

      {results.length > 0 && (
        <ul className="flex flex-col gap-2">
          {results.map((s) => (
            <li key={s.jikanId}>
              <button
                type="button"
                onClick={() => onPick(s)}
                className="border-chip bg-card hover:bg-primary hover:text-primary-foreground flex w-full items-center gap-3 p-2 text-left transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.cover}
                  alt=""
                  className="h-16 w-11 shrink-0 object-cover"
                  loading="lazy"
                />
                <span className="flex flex-col">
                  <span className="font-bold tracking-tight">{s.title}</span>
                  <span className="text-sm opacity-80">
                    {s.author || "Unknown author"}
                  </span>
                  <span className="font-mono text-xs opacity-70">
                    {s.genres.slice(0, 3).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
