"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminUserPanel } from "@/components/admin-user-panel";
import { currentSession, isAdmin, type Session } from "@/lib/session";

/**
 * Admin user panel (issue 06). Role gating here is client-side and for UX only —
 * it decides what to render from the token the browser holds. The Auth service
 * re-verifies the JWT and enforces `@Roles('admin')` on every call (ADR-0005,
 * ADR-0007), so this page never carries the security decision.
 */
export default function AdminPage() {
  // Session is derived from localStorage, unavailable during SSR — resolve it
  // after mount to keep the server and first client render in agreement.
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Reading the token is a genuine external-system sync (localStorage is
    // unavailable during SSR), so the post-mount setState here is intended.
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
          User Desk
        </h1>
        <p className="text-muted-foreground max-w-prose">
          See every account and grant moderation rights by setting each user&apos;s
          role.
        </p>
      </header>

      {!ready ? (
        <p className="text-muted-foreground font-mono text-sm">Checking access…</p>
      ) : isAdmin(session) && session ? (
        <AdminUserPanel selfId={session.userId} />
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
          : "Sign in with an admin account to manage users."}
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
