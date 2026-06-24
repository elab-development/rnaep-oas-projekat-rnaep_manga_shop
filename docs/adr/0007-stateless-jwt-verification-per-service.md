# Each service verifies the JWT locally; no central validation endpoint

Every service verifies the JWT itself using the shared `JWT_SECRET`, via a reusable `JwtAuthGuard` + Passport strategy in a shared package, and extracts `{ userId, role }` from the verified token. The API Gateway also validates the token for early fail-fast, and owns routing and the single CORS boundary. Auth remains the authority only for *issuing* tokens, role changes, and refresh — it is **not** called per request.

**Considered and rejected — a central Auth introspection endpoint** (gateway/services call Auth to validate each token):
- It is *safe* against info leaks (a forged/random token fails signature verification and returns nothing; the secret can't be brute-forced), so that concern doesn't decide it.
- But it makes **Auth a synchronous dependency and single point of failure on every request across every service**, fighting the 99.5% availability and <300ms latency NFRs and the loose-coupling goal, and forces Auth to scale to total traffic. JWTs are self-contained specifically to avoid this.

**Rejected — gateway-only validation with services trusting injected identity headers:** spoofable if a service is ever reachable off the internal network; security would rest solely on network isolation. Local per-service verification is defense-in-depth and is what the Seminarski's per-service IDOR guards need (a trustworthy `userId` at the service).

**Revocation:** tokens are short-lived (15 min), so a compromised token's exposure is small; instant revocation is not implemented. If needed later, add a small revoked-token denylist rather than per-request introspection.

Identity for ownership/IDOR checks always comes from the verified token, never from the request body or params. The token travels in the `Authorization: Bearer` header (not a cookie), per the CSRF mitigation.
