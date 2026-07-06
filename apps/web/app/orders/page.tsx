"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OrderHistory } from "@/components/order-history";
import { currentSession, type Session } from "@/lib/session";

/**
 * Customer order-history page (issue 10). Order history is login-required — the
 * gateway forwards the token and the Orders service scopes every read to the
 * token's owner (ADR-0007, ADR-0012). The signed-in check here is UX only:
 * it decides whether to render the list or prompt for sign-in.
 */
export default function OrdersPage() {
  // Session comes from localStorage (unavailable during SSR); resolve after mount
  // to keep the server and first client render in agreement.
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(currentSession());
    setReady(true);
  }, []);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-foreground/60 font-mono text-xs font-medium tracking-[0.28em] uppercase">
          Account
        </p>
        <h1 className="font-sans text-4xl font-black tracking-tight uppercase">
          Your Orders
        </h1>
        <p className="text-muted-foreground max-w-prose">
          Every order you&apos;ve placed and where each one stands.
        </p>
      </header>

      {!ready ? (
        <p className="text-muted-foreground font-mono text-sm">Loading…</p>
      ) : session ? (
        <OrderHistory />
      ) : (
        <div className="brutal-box bg-card flex flex-col items-start gap-2 p-8">
          <p className="text-lg font-bold">Sign in to see your orders.</p>
          <p className="text-muted-foreground">
            Your order history is tied to your account.
          </p>
          <Link
            href="/login"
            className="mt-2 font-semibold underline underline-offset-4"
          >
            Sign in
          </Link>
        </div>
      )}
    </main>
  );
}
