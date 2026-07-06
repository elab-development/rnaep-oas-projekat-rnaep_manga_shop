"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminOrdersPanel } from "@/components/admin-orders-panel";
import { currentSession, isAdmin, type Session } from "@/lib/session";

/**
 * Admin order-oversight page (issue 10). Role gating here is client-side and for
 * UX only — it decides what to render from the token the browser holds. The
 * Orders and Auth services re-verify the JWT and enforce `@Roles('admin')` on
 * every call (ADR-0005, ADR-0007), so this page never carries the security
 * decision.
 */
export default function AdminOrdersPage() {
  // Session is derived from localStorage, unavailable during SSR — resolve it
  // after mount to keep the server and first client render in agreement.
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(currentSession());
    setReady(true);
  }, []);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-foreground/60 font-mono text-xs font-medium tracking-[0.28em] uppercase">
          Staff
        </p>
        <h1 className="font-sans text-4xl font-black tracking-tight uppercase">
          Order Desk
        </h1>
        <p className="text-muted-foreground max-w-prose">
          Every order in the shop. Resolve the customer behind each and mark paid
          orders as shipped.
        </p>
      </header>

      {!ready ? (
        <p className="text-muted-foreground font-mono text-sm">Checking access…</p>
      ) : isAdmin(session) ? (
        <AdminOrdersPanel />
      ) : (
        <NoAccess signedIn={session !== null} />
      )}
    </main>
  );
}

function NoAccess({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="brutal-box bg-card flex flex-col items-start gap-2 p-8">
      <p className="text-lg font-bold">Admins only.</p>
      <p className="text-muted-foreground">
        {signedIn
          ? "Your account doesn't have admin access."
          : "Sign in with an admin account to oversee orders."}
      </p>
      {!signedIn && (
        <Link
          href="/login"
          className="mt-2 font-semibold underline underline-offset-4"
        >
          Sign in
        </Link>
      )}
    </div>
  );
}
