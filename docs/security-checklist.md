# Security checklist (issue 13)

A focused hardening pass that makes the by-design security posture of ADR-0012
and spec §3 real and audited. The token lives in the `Authorization` header (no
cookie), so **CSRF is mitigated by design** and no anti-CSRF tokens are added —
the trade-off is that **XSS is the load-bearing risk**, which this pass nails
down. Each row records what was checked, where it is enforced, and the test that
proves it. Re-run `pnpm typecheck && pnpm lint && pnpm test` to re-verify the
audited items.

## Threats (Seminarski spec §3) and their disposition

| Threat | Disposition | ADR |
| --- | --- | --- |
| CSRF | Mitigated by design — header-token auth, cookies deliberately avoided, so the browser never auto-attaches credentials cross-site. No CSRF tokens. | ADR-0012, ADR-0007 |
| XSS | Load-bearing risk. React/Next auto-escaping, no `dangerouslySetInnerHTML`, strict CSP, `class-validator` on every DTO. | ADR-0012 |
| IDOR | Ownership derived from the verified token, never the path/body; per-resource scoping on cart and order. | ADR-0007, ADR-0010 |
| SQL injection | Drizzle parameterized queries only; no string-built SQL. | ADR-0012 |
| Cross-origin abuse | CORS locked to the single frontend origin at the gateway. | ADR-0011 |

## Audited controls

### 1. Strict Content-Security-Policy (XSS) — added in this pass

- A per-request nonce CSP is emitted for every document response in
  `apps/web/middleware.ts`. `script-src` is strict: `'self' 'nonce-…'
  'strict-dynamic'` — only same-origin and nonce-carrying scripts run.
- Next stamps the nonce onto its own framework scripts (it reads the nonce back
  from the CSP request header); `next-themes`' inline anti-flash script receives
  the same nonce via its `nonce` prop in `apps/web/app/layout.tsx`.
- `style-src` keeps `'unsafe-inline'` deliberately — injected styles cannot
  execute JavaScript, and it avoids fighting `next/font`'s injected styles for no
  security gain. `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`,
  and `form-action 'self'` close the usual bypasses. `connect-src` is limited to
  self + the configured gateway origin.
- Defense-in-depth response headers set alongside the CSP: `X-Content-Type-Options:
  nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.

### 2. No `dangerouslySetInnerHTML` (XSS)

- Verified absent across `apps/web` (React/Next escaping is relied on). Any future
  use would defeat the CSP rationale above.

### 3. `class-validator` on every inbound DTO (XSS / input integrity)

- A global `ValidationPipe` is enforced on every service that accepts DTOs:
  `apps/auth/src/main.ts`, `apps/orders/src/main.ts`, `apps/payments/src/main.ts`
  (all `whitelist: true, forbidNonWhitelisted: true`), and
  `apps/catalog/src/main.ts` (same, plus `transform: true`). Unknown fields are
  stripped/rejected, so a client can never smuggle extra fields.
- The gateway holds no DTOs — it is a thin JWT/CORS/routing proxy (ADR-0011) with
  its body parser disabled, so requests stream to the owning service unmodified.
- Proof: malformed-write rejection tests, e.g. `apps/orders/test/cart.e2e-spec.ts`
  ("rejects malformed cart writes with 400") and the forged-field rejection test
  in `apps/orders/test/checkout.e2e-spec.ts` ("forged fields are rejected").

### 4. CORS locked to the frontend origin (cross-origin abuse)

- Enforced once at the gateway: `apps/gateway/src/create-gateway.ts`
  (`origin: FRONTEND_ORIGIN`).
- Proof: `apps/gateway/test/gateway.e2e-spec.ts` ("locks CORS to the frontend
  origin and never echoes another origin") — a foreign `Origin` is never
  reflected.

### 5. IDOR — token-derived ownership on every owned resource

- Cart and order routes derive the owning `customerId` from `@CurrentUser`
  (the verified token), never the path/body: `apps/orders/src/cart/cart.controller.ts`,
  `apps/orders/src/orders/orders.controller.ts`. `getOrder`/`listForCustomer`
  filter by `customerId` in the query itself (`apps/orders/src/orders/orders.service.ts`).
- Admin-only oversight (`GET /orders/all`, `PATCH /orders/:id/ship`) adds the exact
  `@Roles('admin')` check on top of the JWT guard (ADR-0005).
- Proof (all existing, passing):
  - `apps/orders/test/cart.e2e-spec.ts` — "keeps each customer's cart private and
    separate"; "stops B from mutating A's cart via the same manga id".
  - `apps/orders/test/checkout.e2e-spec.ts` — "404s another Customer's order (IDOR:
    ownership from the token)"; "forbids a non-admin from listing all orders" (403);
    "forbids a non-admin from shipping an order" (403).

### 6. No raw/string-built SQL (SQL injection)

- All Postgres access goes through Drizzle's query builder. The only `sql`\`\` usages
  are Drizzle's parameterized tagged template with interpolated **values** (not
  identifiers), which Drizzle binds as parameters: `apps/orders/src/cart/cart.service.ts`
  (`quantity: sql\`${cartItems.quantity} + ${quantity}\``, `updatedAt: sql\`now()\``).
  No `db.execute` of a concatenated string, no `sql.raw` on user input.

## Residual / out of scope

- Instant token revocation is not implemented; tokens are short-lived (15 min,
  ADR-0007). A denylist can be added later if needed.
- Log-and-drop Kafka failure handling (ADR-0013) can leave an order out of sync;
  accepted at project scope.
- HTTPS/HSTS is a deployment concern; `upgrade-insecure-requests` is present in the
  CSP, and cookies are not used, so there is no cookie `Secure`/`SameSite` surface.
