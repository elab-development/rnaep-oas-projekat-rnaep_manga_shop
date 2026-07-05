"use client"

import { AuthError, login, register } from "@/lib/auth"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"

type Mode = "login" | "register"

const COPY: Record<Mode, { kicker: string; title: string; cta: string }> = {
  login: { kicker: "Welcome back", title: "Sign in", cta: "Sign in" },
  register: {
    kicker: "New reader",
    title: "Create account",
    cta: "Create account",
  },
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const copy = COPY[mode]

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      // Register, then sign the new Customer straight in so they land logged-in.
      if (mode === "register") await register(email, password)
      await login(email, password)
      router.push("/")
    } catch (err) {
      setError(
        err instanceof AuthError
          ? err.message
          : "Could not reach the shop. Is it running?"
      )
      setPending(false)
    }
  }

  return (
    <div className="border-emphasis border-foreground bg-background p-7 shadow-brutal-lg sm:p-9">
      {/* Kicker stays ink — yellow (primary) is a fill color, never text on paper. */}
      <p className="mb-1 font-mono text-xs font-medium tracking-[0.28em] text-foreground/60 uppercase">
        {copy.kicker}
      </p>
      <h1 className="mb-7 font-sans text-4xl font-black tracking-tight uppercase">
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
          placeholder={
            mode === "register" ? "At least 8 characters" : "••••••••"
          }
        />

        {error && (
          <p
            role="alert"
            className="border-l-4 border-destructive bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="mt-1 h-11 w-full border-foreground text-sm font-semibold tracking-[0.2em] uppercase shadow-brutal transition-all hover:shadow-brutal-sm disabled:opacity-70"
        >
          {pending ? "One sec…" : copy.cta}
        </Button>
      </form>

      <p className="mt-7 border-t-2 border-dashed border-border/40 pt-5 text-sm text-foreground/70">
        {mode === "login" ? (
          <>
            No shelf yet?{" "}
            <Link
              href="/register"
              className="font-semibold text-foreground underline underline-offset-4"
            >
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already a reader?{" "}
            <Link
              href="/login"
              className="font-semibold text-foreground underline underline-offset-4"
            >
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  ...input
}: {
  label: string
  value: string
  onChange: (value: string) => void
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-xs tracking-[0.18em] text-foreground/70 uppercase">
        {label}
      </span>
      <input
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-11 border-foreground bg-transparent px-3 text-sm outline-none",
          "placeholder:text-foreground/35",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "border-chip"
        )}
        {...input}
      />
    </label>
  )
}
