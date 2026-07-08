# External API integration: snapshot enrichment + circuit breakers on read-side only

**Jikan enrichment is a snapshot, not a sync.** When a moderator adds a manga, Catalog queries Jikan, the moderator picks a result and the fields prefill (title, author, genres, synopsis, cover, score); the moderator then sets price and stock (Jikan has neither) and saves. After that the Catalog record is the source of truth — `jikan_id` is kept for reference but data is never auto-resynced, so moderator edits (FZ-11) are never clobbered and the catalog doesn't depend on Jikan's availability.

**Circuit breakers (the Seminarski bonus pattern, e.g. `opossum`) wrap the read-side externals only:**
- **Jikan** — on open circuit, tell the moderator enrichment is unavailable and let them **fill the manga manually**; creation is never blocked.
- **Frankfurter** — on open circuit, serve the last cached rates. Safe because currency is display-only (ADR-0006) and never affects the charge.
- **Stripe** — **no breaker fallback.** There is no safe default answer to "did money move?", so Stripe calls fail loudly and the order stays `pending_payment`. Timeouts/retries are fine; a fallback *verdict* is not.

**Caching is in-memory with TTL, per service** (no Redis): Frankfurter rates cached 12–24h, Jikan responses cached opportunistically. With ~3 Catalog instances the cache isn't shared, but that only means a few extra daily fetches — negligible — and it avoids adding infrastructure not in the deployment plan.
