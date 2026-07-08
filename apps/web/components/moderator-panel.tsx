"use client";

import type { MangaView } from "@workspace/contracts";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/utils";
import { useCallback, useEffect, useState } from "react";
import { fetchCatalog } from "@/lib/catalog";
import {
  deleteManga,
  ModerationError,
  setFeatured,
  updateStock,
} from "@/lib/moderation";
import { formatEur } from "@/lib/money";
import { FeaturedBadge } from "@/components/featured-badge";
import { MangaForm } from "@/components/manga-form";

type View = { kind: "list" } | { kind: "create" } | { kind: "edit"; manga: MangaView };

// One catalog page is plenty for a management list; the search endpoint already
// paginates and moderators work against a modest catalog at student scale.
const MANAGE_LIMIT = 60;

/**
 * The moderator catalog panel (issue 05): list, add (Jikan-assisted or manual),
 * edit, stock update, and delete. Deletes are admin-only (an Admin ability per
 * the PRD), so the button is shown only to admins — but the catalog service
 * re-enforces it regardless (ADR-0005). All writes go through the gateway with
 * the moderator's token (ADR-0011).
 */
export function ModeratorPanel({ canDelete }: { canDelete: boolean }) {
  const [items, setItems] = useState<MangaView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "list" });

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const page = await fetchCatalog({ limit: MANAGE_LIMIT });
      setItems(page.items);
    } catch {
      setLoadError("Could not load the catalog. Is the shop running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load the catalog once on mount; refresh() owns its own loading/error
    // state, so the setState it triggers here is the intended data-fetch sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  function onSaved(): void {
    setView({ kind: "list" });
    void refresh();
  }

  if (view.kind === "create") {
    return (
      <Section title="Add manga">
        <MangaForm
          mode="create"
          onSaved={onSaved}
          onCancel={() => setView({ kind: "list" })}
        />
      </Section>
    );
  }

  if (view.kind === "edit") {
    return (
      <Section title={`Edit · ${view.manga.title}`}>
        <MangaForm
          mode="edit"
          initial={view.manga}
          onSaved={onSaved}
          onCancel={() => setView({ kind: "list" })}
        />
      </Section>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground font-mono text-sm">
          {loading ? "Loading…" : `${items.length} title${items.length === 1 ? "" : "s"}`}
        </p>
        <Button
          size="lg"
          onClick={() => setView({ kind: "create" })}
          className="brutal-btn h-11"
        >
          + Add manga
        </Button>
      </div>

      {loadError && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {loadError}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {items.map((manga) => (
          <MangaRow
            key={manga.id}
            manga={manga}
            canDelete={canDelete}
            onEdit={() => setView({ kind: "edit", manga })}
            onChanged={refresh}
          />
        ))}
      </ul>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-sans text-2xl font-black tracking-tight uppercase">
        {title}
      </h2>
      {children}
    </div>
  );
}

/** One manageable row: identity + inline stock editor + edit/delete actions. */
function MangaRow({
  manga,
  canDelete,
  onEdit,
  onChanged,
}: {
  manga: MangaView;
  canDelete: boolean;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [quantity, setQuantity] = useState(String(manga.stock.quantity));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = quantity.trim() !== String(manga.stock.quantity);

  async function saveStock(): Promise<void> {
    const n = Number(quantity.trim());
    if (!Number.isInteger(n) || n < 0) {
      setError("Whole number only.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateStock(manga.id, n);
      onChanged();
    } catch (err) {
      setError(err instanceof ModerationError ? err.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    if (!window.confirm(`Delete "${manga.title}"? This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteManga(manga.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ModerationError ? err.message : "Failed.");
      setBusy(false);
    }
  }

  // Curate this title into / out of the homepage Featured rail. onChanged()
  // refetches the catalog, so the toggle then reflects the persisted read-model
  // `featured` (MangaView) rather than optimistic-only state.
  async function toggleFeatured(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await setFeatured(manga.id, !manga.featured);
      onChanged();
    } catch (err) {
      setError(err instanceof ModerationError ? err.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="brutal-box bg-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={manga.cover}
        alt=""
        className="h-20 w-14 shrink-0 self-start object-cover"
        loading="lazy"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="min-w-0 truncate font-bold tracking-tight">
            {manga.title}
          </h3>
          {manga.featured && <FeaturedBadge className="shrink-0" />}
        </div>
        <p className="text-muted-foreground truncate text-sm">{manga.author}</p>
        <p className="font-mono text-sm">
          {formatEur(manga.price)} · reserved {manga.stock.reserved} · available{" "}
          {manga.available}
        </p>
        {error && (
          <p role="alert" className="text-destructive mt-1 text-xs font-medium">
            {error}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.65rem] font-bold uppercase">
            Stock
          </span>
          <div className="flex gap-1">
            <Input
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-9 w-20"
              aria-label={`Stock quantity for ${manga.title}`}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || !dirty}
              onClick={saveStock}
              className="brutal-btn h-9"
            >
              Set
            </Button>
          </div>
        </label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          aria-pressed={manga.featured}
          onClick={toggleFeatured}
          title={
            manga.featured
              ? "Remove from the homepage Featured rail"
              : "Add to the homepage Featured rail"
          }
          className={cn(
            "brutal-btn h-9",
            manga.featured && "bg-primary text-primary-foreground",
          )}
        >
          {manga.featured ? "★ Featured" : "☆ Feature"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onEdit}
          className="brutal-btn h-9"
        >
          Edit
        </Button>
        {canDelete && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={remove}
            className="brutal-btn border-destructive text-destructive h-9"
          >
            Delete
          </Button>
        )}
      </div>
    </li>
  );
}
