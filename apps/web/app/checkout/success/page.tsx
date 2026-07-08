"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PaymentStatus } from "@/components/payment-status";
import { currentSession, type Session } from "@/lib/session";

/**
 * Payment success landing page (issue 09, ADR-0008). Stripe redirects the
 * Customer here after checkout with `?orderId=…`. The redirect is not treated as
 * proof of payment — {@link PaymentStatus} shows "confirming…" and reads the order
 * status back from the server (the signed webhook is the source of truth). The
 * session read is client-side UX only; the server re-verifies the token on every
 * read (ADR-0007, ADR-0012).
 */
export default function CheckoutSuccessPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-foreground/60 font-mono text-xs font-medium tracking-[0.28em] uppercase">
          Your account
        </p>
        <h1 className="font-sans text-4xl font-black tracking-tight uppercase">
          Payment
        </h1>
      </header>
      <Suspense
        fallback={
          <p className="text-muted-foreground font-mono text-sm">Loading…</p>
        }
      >
        <SuccessBody />
      </Suspense>
    </main>
  );
}

function SuccessBody() {
  const params = useSearchParams();
  const orderId = params.get("orderId");

  // Session lives in localStorage, unavailable during SSR — resolve after mount.
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(currentSession());
    setReady(true);
  }, []);

  if (!ready) {
    return <p className="text-muted-foreground font-mono text-sm">Loading…</p>;
  }

  if (!session) {
    return (
      <div className="brutal-box bg-card flex flex-col items-start gap-2 p-8">
        <p className="text-lg font-bold">Sign in to see your order.</p>
        <Link
          href="/login"
          className="mt-2 font-semibold underline underline-offset-4"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (!orderId) {
    return (
      <div className="brutal-box bg-card flex flex-col items-start gap-2 p-8">
        <p className="text-lg font-bold">No order to show.</p>
        <Link
          href="/catalog"
          className="mt-2 font-semibold underline underline-offset-4"
        >
          Browse the catalog
        </Link>
      </div>
    );
  }

  return <PaymentStatus orderId={orderId} />;
}
