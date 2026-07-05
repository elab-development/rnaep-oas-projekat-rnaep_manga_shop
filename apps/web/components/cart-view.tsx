"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CartItemView, MangaView } from "@workspace/contracts";
import {
  CartError,
  fetchCartManga,
  getCart,
  removeItem,
  setQuantity,
} from "@/lib/cart";
import { formatEur } from "@/lib/money";

/** A cart line joined with its Catalog details (null if the manga was deleted). */
interface EnrichedLine extends CartItemView {
  manga: MangaView | null;
}

/**
 * The Customer's cart (issue 07). The cart stores only manga ids server-side
 * (ADR-0010); this composes each line's title/price/cover from Catalog through
 * the gateway (ADR-0011). Quantity changes and removals persist server-side, so
 * the cart survives across devices and sessions. All calls carry the Customer's
 * token; the Orders service enforces ownership (ADR-0012).
 */
export function CartView() {
  const [lines, setLines] = useState<EnrichedLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cart = await getCart();
      const enriched = await Promise.all(
        cart.items.map(async (item) => ({
          ...item,
          manga: await fetchCartManga(item.mangaId),
        })),
      );
      setLines(enriched);
    } catch (err) {
      setError(
        err instanceof CartError
          ? err.message
          : "Could not load your cart. Is the shop running?",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load once on mount; load() owns its own loading/error state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const onLineChanged = useCallback((items: CartItemView[]) => {
    // A mutation returns the fresh server cart; keep known manga details and drop
    // lines the server removed, re-joining by id.
    setLines((prev) =>
      items.map((item) => ({
        ...item,
        manga: prev.find((l) => l.mangaId === item.mangaId)?.manga ?? null,
      })),
    );
  }, []);

  if (loading) {
    return <p className="text-muted-foreground font-mono text-sm">Loading…</p>;
  }

  if (error) {
    return (
      <p role="alert" className="text-destructive text-sm font-medium">
        {error}
      </p>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="brutal-box bg-card flex flex-col items-start gap-2 p-8">
        <p className="text-lg font-bold">Your cart is empty.</p>
        <p className="text-muted-foreground">
          Find something on the shelf and add it here.
        </p>
        <Link
          href="/catalog"
          className="mt-2 font-semibold underline underline-offset-4"
        >
          Browse the catalog
        </Link>
      </div>
    );
  }

  const total = lines.reduce(
    (sum, l) => sum + (l.manga ? l.manga.price * l.quantity : 0),
    0,
  );

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-3">
        {lines.map((line) => (
          <CartLine key={line.mangaId} line={line} onChanged={onLineChanged} />
        ))}
      </ul>

      <div className="brutal-box bg-card flex items-center justify-between p-4">
        <span className="font-mono text-sm font-bold uppercase">Total</span>
        <span className="font-mono text-2xl font-bold">{formatEur(total)}</span>
      </div>
      <p className="text-muted-foreground font-mono text-xs">
        Checkout arrives in the next slice. Your cart is saved to your account.
      </p>
    </div>
  );
}

/** One cart line: cover + title + a quantity stepper and a remove control. */
function CartLine({
  line,
  onChanged,
}: {
  line: EnrichedLine;
  onChanged: (items: CartItemView[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(op: () => Promise<{ items: CartItemView[] }>) {
    setBusy(true);
    setError(null);
    try {
      onChanged((await op()).items);
    } catch (err) {
      setError(err instanceof CartError ? err.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  const changeQty = (next: number) => {
    if (next < 1) return;
    void run(() => setQuantity(line.mangaId, next));
  };

  const { manga } = line;

  return (
    <li className="brutal-box bg-card flex gap-4 p-4">
      <div className="bg-muted aspect-[2/3] w-16 shrink-0 overflow-hidden">
        {manga && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={manga.cover}
            alt={`Cover of ${manga.title}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {manga ? (
              <Link
                href={`/catalog/${line.mangaId}`}
                className="block truncate font-bold tracking-tight hover:underline"
              >
                {manga.title}
              </Link>
            ) : (
              <p className="font-bold tracking-tight">
                This title is no longer available
              </p>
            )}
            <p className="text-muted-foreground font-mono text-sm">
              {manga ? formatEur(manga.price) : "—"} each
            </p>
          </div>
          <span className="font-mono text-lg font-bold whitespace-nowrap">
            {manga ? formatEur(manga.price * line.quantity) : "—"}
          </span>
        </div>

        <div className="mt-auto flex items-center gap-3">
          <div className="border-chip flex items-center">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={busy || line.quantity <= 1}
              onClick={() => changeQty(line.quantity - 1)}
              className="h-8 w-8 font-mono font-bold disabled:opacity-40"
            >
              −
            </button>
            <span className="w-8 text-center font-mono font-bold">
              {line.quantity}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={busy}
              onClick={() => changeQty(line.quantity + 1)}
              className="h-8 w-8 font-mono font-bold disabled:opacity-40"
            >
              +
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => removeItem(line.mangaId))}
            className="font-mono text-xs font-bold uppercase underline underline-offset-4 disabled:opacity-40"
          >
            Remove
          </button>
        </div>

        {error && (
          <p role="alert" className="text-destructive text-xs font-medium">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}
