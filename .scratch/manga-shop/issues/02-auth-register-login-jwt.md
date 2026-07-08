# 02. Register & login (Auth, JWT)

Status: done

## Parent

[PRD: Manga Web Shop](../PRD.md)

## What to build

End-to-end account creation and authentication. The Auth service (Postgres, Drizzle) lets a Guest register with email + password (bcrypt-hashed) and receive the default `customer` role, then log in to receive a short-lived (15-min) JWT carrying their identity and role. The shared auth-guard package (skeletoned in slice 01) gains its real per-service JWT verification — a reusable guard + Passport strategy using the shared `JWT_SECRET`, with no central introspection endpoint.

The gateway routes `/auth/*` to the Auth service, validates the JWT for fast-fail, and owns the single CORS policy. The token travels in the `Authorization: Bearer` header, never a cookie. Ownership identity for any later check always derives from the verified token, never request body/params. Next.js gets register and login pages that store the token and use it on subsequent requests.

Respects ADR-0005 (single role enum, `customer` default), ADR-0007 (stateless JWT verification, header not cookie), ADR-0012 (header-token CSRF mitigation).

## Acceptance criteria

- [x] `POST` register creates a user with bcrypt-hashed password and role `customer`
- [x] `POST` login returns a 15-min JWT containing the user's id and role
- [x] The shared guard verifies the JWT via `JWT_SECRET` independently in any service; an invalid/expired token is rejected
- [x] The gateway routes `/auth/*`, fast-fail-validates tokens, and applies the single CORS policy locked to the frontend origin
- [x] Next.js register + login pages work against the gateway and store/send the token in the `Authorization` header
- [x] Integration tests (real ephemeral Postgres): register → default `customer`; login → token; invalid credentials rejected

## Blocked by

- [01. Foundation scaffold](01-foundation-scaffold.md)

## Comments

Built on branch `feat/02-auth-register-login-jwt`, merged into `develop`
(commit `610594f`).

**What was built**

- **Auth service** (Postgres/Drizzle): `users` table with a single hierarchical
  `role` enum defaulting to `customer` (ADR-0005); bcrypt-hashed passwords.
  drizzle-kit migrations are generated into `apps/auth/drizzle/` and applied at
  boot (non-fatal if the DB is absent, so the scaffold health check still
  answers). Endpoints: `POST /auth/register` (409 on duplicate email),
  `POST /auth/login` (15-min JWT via `@nestjs/jwt`), and a guarded
  `GET /auth/me` that echoes the token-derived identity to prove local
  verification. DTOs use `class-validator` with a global whitelist
  `ValidationPipe` (ADR-0012).
- **Shared `auth-guard`**: new `jwt-config` (single source of truth for secret +
  15m TTL, used by both signing and verifying sides) and a `@CurrentUser`
  param decorator. The `JwtStrategy` now reads the shared secret.
- **Gateway** (ADR-0011/0007): thin `/auth/*` reverse proxy, CORS locked to
  `FRONTEND_ORIGIN`, and JWT fast-fail middleware that rejects invalid/expired
  tokens before proxying (public routes with no token pass through). Bootstrap
  refactored into `createGateway()` for testability.
- **Web**: `/register` + `/login` pages (manga ink-and-paper aesthetic, Anton
  display font) sharing an `AuthForm`; `lib/auth.ts` stores the JWT in
  `localStorage` and sends it via the `Authorization` header (never a cookie).
  Register auto-logs-in for smoother UX.

**Tests (all green):** auth e2e (8) against a real ephemeral Postgres via
**testcontainers** — register→`customer`, duplicate→409, validation→400,
login→15-min token, bad/unknown creds→401, `/auth/me` identity + rejection of
missing/garbage tokens. Gateway e2e (6) against a stub downstream — proxy with
body intact, fast-fail, valid-token passthrough, CORS lock. `pnpm typecheck`,
`pnpm lint`, `pnpm test` all pass; the web app builds and `/login` + `/register`
render (HTTP 200).

**Key fixes / decisions**

- Made `@nestjs/core` + `@nestjs/common` **peer** deps of `auth-guard`: adding
  `@nestjs/jwt` had split `@nestjs/core` into two peer-hash copies, breaking
  `Reflector` DI for `RolesGuard`. Peers force a single copy.
- `http-proxy-middleware` pinned to **v2** (v3 is ESM-only; the gateway builds
  to CommonJS — v3 would also fail at runtime, not just under ts-jest).
- Kept **bcrypt** (native) over a JS shim; its build script is whitelisted in
  `pnpm-workspace.yaml` `allowBuilds`.

**Follow-ups**

- Dockerfiles must `COPY apps/auth/drizzle` into the image (slice 07).
- No refresh-token flow (ADR-0007 — short-lived tokens only).
- `/auth/me` exists mainly to exercise the guard; later slices add real
  protected routes.
