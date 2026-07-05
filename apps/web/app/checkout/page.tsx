"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckoutForm } from "@/components/checkout-form";
import { currentSession, type Session } from "@/lib/session";

/**
 * The checkout page (issue 08). Login-required (ADR-0010): a Guest is prompted to
 * sign in first, since an order is tied to their account. The session read here is
 * client-side UX only — the Orders service re-verifies the token on checkout and
 * owns the security decision (ADR-0007, ADR-0012).
 */
export default function CheckoutPage() {
  // Session lives in localStorage, unavailable during SSR — resolve after mount.
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
          Your account
        </p>
        <h1 className="font-sans text-4xl font-black tracking-tight uppercase">
          Checkout
        </h1>
      </header>

      {!ready ? (
        <p className="text-muted-foreground font-mono text-sm">Loading…</p>
      ) : session ? (
        <CheckoutForm />
      ) : (
        <SignInPrompt />
      )}
    </main>
  );
}

function SignInPrompt() {
  return (
    <div className="brutal-box bg-card flex flex-col items-start gap-2 p-8">
      <p className="text-lg font-bold">Sign in to check out.</p>
      <p className="text-muted-foreground">
        Your order is tied to your account so you can track it later.
      </p>
      <Link
        href="/login"
        className="mt-2 font-semibold underline underline-offset-4"
      >
        Sign in
      </Link>
    </div>
  );
}
