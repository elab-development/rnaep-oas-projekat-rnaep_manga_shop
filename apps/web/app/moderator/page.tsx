"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ModeratorPanel } from "@/components/moderator-panel";
import { currentSession, isAdmin, isModerator, type Session } from "@/lib/session";

/**
 * Moderator catalog panel (issue 05). Role gating here is client-side and for UX
 * only — it decides what to render from the token the browser holds. The catalog
 * service re-verifies the JWT and enforces `@MinRole` on every write (ADR-0005,
 * ADR-0007), so this page never carries the security decision.
 */
export default function ModeratorPage() {
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
          Catalog Desk
        </h1>
        <p className="text-muted-foreground max-w-prose">
          Add manga with Jikan auto-fill, correct details, keep stock honest.
        </p>
      </header>

      {!ready ? (
        <p className="text-muted-foreground font-mono text-sm">Checking access…</p>
      ) : isModerator(session) ? (
        <ModeratorPanel canDelete={isAdmin(session)} />
      ) : (
        <NoAccess signedIn={session !== null} />
      )}
    </main>
  );
}

function NoAccess({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="brutal-box bg-card flex flex-col items-start gap-2 p-8">
      <p className="text-lg font-bold">Moderators only.</p>
      <p className="text-muted-foreground">
        {signedIn
          ? "Your account doesn't have moderator access."
          : "Sign in with a moderator account to manage the catalog."}
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
