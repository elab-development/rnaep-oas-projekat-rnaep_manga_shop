"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { addToCart, CartError } from "@/lib/cart";
import { currentSession, type Session } from "@/lib/session";

/**
 * The catalog detail page's "Add to cart" control (issue 07). The cart is
 * login-required (ADR-0010): a Guest is routed to sign in first so the cart ties
 * to their account. The session read here is client-side UX only — the Orders
 * service re-verifies the token and owns the security decision (ADR-0012).
 */
export function AddToCart({
  mangaId,
  available,
}: {
  mangaId: string;
  available: number;
}) {
  // Session comes from localStorage, unavailable during SSR — resolve it after
  // mount so the server and first client render agree (same pattern as /admin).
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reading the token is a genuine external-system sync (no localStorage on the
    // server), so the post-mount setState here is intended.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(currentSession());
    setReady(true);
  }, []);

  if (available <= 0) {
    return (
      <Button disabled size="lg" className="brutal-btn min-w-40">
        Out of stock
      </Button>
    );
  }

  // Before the session resolves, render the same neutral affordance the server
  // did to avoid a hydration flash.
  if (!ready || !session) {
    return (
      <Link
        href="/login"
        className={buttonVariants({ size: "lg", className: "brutal-btn min-w-40" })}
      >
        Sign in to add
      </Link>
    );
  }

  async function add(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await addToCart(mangaId, 1);
      setAdded(true);
    } catch (err) {
      setError(err instanceof CartError ? err.message : "Couldn't add to cart.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        size="lg"
        className="brutal-btn min-w-40"
        disabled={busy}
        onClick={add}
      >
        {busy ? "Adding…" : added ? "Add another" : "Add to cart"}
      </Button>
      {added && (
        <Link
          href="/cart"
          className="font-mono text-sm font-bold uppercase underline underline-offset-4"
        >
          View cart →
        </Link>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
