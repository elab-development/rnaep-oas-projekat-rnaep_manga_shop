# CSRF is mitigated by header-token auth (no CSRF tokens); XSS is the primary residual risk

The JWT is stored client-side (memory/localStorage) and sent in the `Authorization: Bearer` header, never in a cookie. Because the browser does not auto-attach this token to cross-site requests and an attacker's site cannot read it, **CSRF is not exploitable against the API**, so we implement **no anti-CSRF tokens**. The Seminarski's CSRF requirement is satisfied by documenting this architectural mitigation (non-ambient header auth, cookies deliberately avoided); `SameSite`/CSP are noted as defense-in-depth.

**Trade-off we accept:** a header/localStorage token is readable by JavaScript, so it is vulnerable to **XSS theft** (whereas an httpOnly cookie would be XSS-safe but reintroduce CSRF). We chose the spec's header approach, which means **XSS protections are load-bearing, not optional**: React/Next auto-escaping, no `dangerouslySetInnerHTML`, `class-validator` on every DTO, and a strict CSP header.

The other Seminarski vulnerabilities are settled by earlier decisions: IDOR via token-derived ownership guards (ADR-0007/0010), CORS locked to the frontend origin at the gateway (ADR-0011), SQL injection prevented by Drizzle parameterized queries on the Postgres services.

**Rejected — httpOnly cookie + real CSRF tokens:** would let us literally implement a CSRF defense and protect the token from XSS, but contradicts the spec's header-token choice and adds CSRF-token machinery the header design makes unnecessary.
