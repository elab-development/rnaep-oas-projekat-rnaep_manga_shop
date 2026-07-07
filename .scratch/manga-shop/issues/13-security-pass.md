# 13. Security pass

Status: done

## Parent

[PRD: Manga Web Shop](../PRD.md)

## What to build

A focused hardening pass that makes the by-design security posture real and audited across the system. Because the token lives in the `Authorization` header (no cookie), CSRF is mitigated by-design and no CSRF tokens are added — the consequence is that **XSS is the load-bearing risk**, so this slice nails that down. Apply a strict Content-Security-Policy on the Next.js frontend, confirm there is no `dangerouslySetInnerHTML` (rely on React/Next escaping), ensure `class-validator` validates every inbound DTO across all services, lock CORS to the frontend origin, and audit IDOR: for every owned resource (cart, order), confirm another customer's token can neither read nor mutate it. SQL injection is prevented by Drizzle's parameterized queries (verify no raw string-built queries).

Respects ADR-0012 (header-token CSRF mitigation, XSS as primary risk, strict CSP, IDOR guards), ADR-0007 (identity from token), PRD spec §3.

## Acceptance criteria

- [ ] Strict CSP is applied on the Next.js frontend; no `dangerouslySetInnerHTML` remains
- [ ] Every inbound DTO across all services is validated with `class-validator` (validation pipe enforced globally)
- [ ] CORS is locked to the frontend origin at the gateway (cross-origin requests from other origins are rejected)
- [ ] IDOR audit: tests assert another customer's token cannot read or mutate any owned cart or order
- [ ] No raw/string-concatenated SQL — all queries go through Drizzle parameterization (verified)
- [ ] A short security checklist in the repo records what was checked against ADR-0012 / spec §3

## Blocked by

- [05. Moderator catalog management + Jikan auto-fill](05-moderator-catalog-management-jikan.md)
- [10. Order history + admin oversight + ship](10-order-history-admin-oversight-ship.md)

## Comments

Done. This turned out to be **90% audit of already-enforced controls + one new
control (strict CSP) + a checklist doc** — the by-design posture was largely
already in place and test-covered, so the work was to make the frontend CSP real
and record the audit.

**New code**

- `apps/web/middleware.ts` — per-request nonce Content-Security-Policy on every
  document response. `script-src` is strict (`'self' 'nonce-…' 'strict-dynamic'`);
  `style-src` keeps `'unsafe-inline'` deliberately (style injection can't run JS,
  and it avoids fighting `next/font`). Also sets `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`. `connect-src` is self + the gateway
  origin (client fetches the gateway cross-origin, ADR-0011).
- `apps/web/app/layout.tsx` — reads the `x-nonce` request header and passes it to
  `next-themes` so its inline anti-flash script is trusted under the strict CSP.
- Runtime-verified: `curl` on the dev server shows the CSP header, and **all 28
  rendered `<script>` tags carry the nonce (0 without)** — Next auto-nonces its
  framework scripts and next-themes gets the prop, so the strict policy does not
  break hydration.

**Audited (already enforced, cited with their proving tests) — see
`docs/security-checklist.md`**

- No `dangerouslySetInnerHTML` in `apps/web` (verified absent).
- Global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`) on auth/catalog/
  orders/payments; gateway is a thin proxy with no DTOs.
- CORS locked to the frontend origin at the gateway (test: gateway never echoes a
  foreign origin).
- IDOR: cart + order ownership is token-derived; existing tests assert another
  customer's token can't read/mutate a cart or order (404) and non-admins can't
  list-all/ship (403).
- No raw SQL — only Drizzle parameterized `sql`\`\` tags (values bound as params).

**Decisions / notes**

- Chose `style-src 'unsafe-inline'` over a style nonce: keeps `script-src` genuinely
  strict without brittle `next/font` interplay; injected CSS can't execute JS.
- The web app still has **no unit-test harness** (jest lives only in the services);
  the CSP is verified at runtime rather than by a web unit test, to avoid standing
  up a frontend test runner for this issue. Wiring the MSW-based frontend test seam
  the PRD describes remains open follow-up work (not owned by this issue).
