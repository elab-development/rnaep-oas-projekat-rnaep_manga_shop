# 13. Security pass

Status: ready-for-agent

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
