"use client"

import { AuthError, login, register } from "@/lib/auth"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
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

type FieldErrors = { email?: string; password?: string }

// Client-side checks only (ADR-0015 hybrid): cheap format/length feedback per
// field. The server stays authoritative for auth failures (wrong password,
// email taken) — those surface in the form-level box below, not here. Password
// length is only enforced on register; login must not reject a legacy password.
function validate(mode: Mode, email: string, password: string): FieldErrors {
  const errors: FieldErrors = {}
  if (!email.trim()) errors.email = "Enter your email."
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = "Enter a valid email address."
  if (!password) errors.password = "Enter your password."
  else if (mode === "register" && password.length < 8)
    errors.password = "Use at least 8 characters."
  return errors
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const copy = COPY[mode]

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const errors = validate(mode, email, password)
    setFieldErrors(errors)
    if (errors.email || errors.password) return

    setPending(true)
    try {
      // Register, then sign the new Customer straight in so they land logged-in.
      if (mode === "register") await register(email, password)
      await login(email, password)
      router.push("/")
    } catch (err) {
      // Server errors stay form-level: the 401 is deliberately ambiguous
      // ("wrong email or password") so we never reveal which field was wrong.
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
        <Field data-invalid={fieldErrors.email ? "true" : undefined}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={!!fieldErrors.email}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (fieldErrors.email)
                setFieldErrors((p) => ({ ...p, email: undefined }))
            }}
            placeholder="you@example.com"
          />
          <FieldError>{fieldErrors.email}</FieldError>
        </Field>

        <Field data-invalid={fieldErrors.password ? "true" : undefined}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            required
            minLength={mode === "register" ? 8 : undefined}
            aria-invalid={!!fieldErrors.password}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (fieldErrors.password)
                setFieldErrors((p) => ({ ...p, password: undefined }))
            }}
            placeholder={
              mode === "register" ? "At least 8 characters" : "••••••••"
            }
          />
          <FieldError>{fieldErrors.password}</FieldError>
        </Field>

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
