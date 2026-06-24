# 02. Register & login (Auth, JWT)

Status: ready-for-agent

## Parent

[PRD: Manga Web Shop](../PRD.md)

## What to build

End-to-end account creation and authentication. The Auth service (Postgres, Drizzle) lets a Guest register with email + password (bcrypt-hashed) and receive the default `customer` role, then log in to receive a short-lived (15-min) JWT carrying their identity and role. The shared auth-guard package (skeletoned in slice 01) gains its real per-service JWT verification — a reusable guard + Passport strategy using the shared `JWT_SECRET`, with no central introspection endpoint.

The gateway routes `/auth/*` to the Auth service, validates the JWT for fast-fail, and owns the single CORS policy. The token travels in the `Authorization: Bearer` header, never a cookie. Ownership identity for any later check always derives from the verified token, never request body/params. Next.js gets register and login pages that store the token and use it on subsequent requests.

Respects ADR-0005 (single role enum, `customer` default), ADR-0007 (stateless JWT verification, header not cookie), ADR-0012 (header-token CSRF mitigation).

## Acceptance criteria

- [ ] `POST` register creates a user with bcrypt-hashed password and role `customer`
- [ ] `POST` login returns a 15-min JWT containing the user's id and role
- [ ] The shared guard verifies the JWT via `JWT_SECRET` independently in any service; an invalid/expired token is rejected
- [ ] The gateway routes `/auth/*`, fast-fail-validates tokens, and applies the single CORS policy locked to the frontend origin
- [ ] Next.js register + login pages work against the gateway and store/send the token in the `Authorization` header
- [ ] Integration tests (real ephemeral Postgres): register → default `customer`; login → token; invalid credentials rejected

## Blocked by

- [01. Foundation scaffold](01-foundation-scaffold.md)
