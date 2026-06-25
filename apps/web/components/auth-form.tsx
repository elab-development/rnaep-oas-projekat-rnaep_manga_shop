"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { AuthError, login, register } from "@/lib/auth";

type Mode = "login" | "register";

const COPY: Record<Mode, { kicker: string; title: string; cta: string }> = {
  login: { kicker: "Welcome back", title: "Sign in", cta: "Sign in" },
  register: {
    kicker: "New reader",
    title: "Create account",
    cta: "Create account",
  },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const copy = COPY[mode];

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      // Register, then sign the new Customer straight in so they land logged-in.
      if (mode === "register") await register(email, password);
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(
        err instanceof AuthError
          ? err.message
          : "Could not reach the shop. Is it running?",
      );
      setPending(false);
    }
  }

  return (
    <div className="border-[3px] border-[#15130f] bg-[#f3efe5] p-7 shadow-[10px_10px_0_0_#15130f] sm:p-9">
      <p className="mb-1 text-xs font-semibold tracking-[0.28em] text-primary uppercase">
        {copy.kicker}
      </p>
      <h1 className="mb-7 font-[family-name:var(--font-display)] text-4xl tracking-tight uppercase">
        {copy.title}
      </h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
        />
        <Field
          label="Password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={setPassword}
          placeholder={mode === "register" ? "At least 8 characters" : "••••••••"}
        />

        {error && (
          <p
            role="alert"
            className="border-l-[3px] border-destructive bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="mt-1 h-11 w-full text-sm font-semibold tracking-[0.2em] uppercase shadow-[4px_4px_0_0_#15130f] transition-all hover:shadow-[2px_2px_0_0_#15130f] disabled:opacity-70"
        >
          {pending ? "One sec…" : copy.cta}
        </Button>
      </form>

      <p className="mt-7 border-t-2 border-dashed border-[#15130f]/20 pt-5 text-sm text-[#15130f]/70">
        {mode === "login" ? (
          <>
            No shelf yet?{" "}
            <Link
              href="/register"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already a reader?{" "}
            <Link
              href="/login"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  ...input
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold tracking-[0.18em] text-[#15130f]/70 uppercase">
        {label}
      </span>
      <input
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-11 border-2 border-[#15130f] bg-transparent px-3 text-sm text-[#15130f] outline-none",
          "placeholder:text-[#15130f]/35",
          "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
        )}
        {...input}
      />
    </label>
  );
}
