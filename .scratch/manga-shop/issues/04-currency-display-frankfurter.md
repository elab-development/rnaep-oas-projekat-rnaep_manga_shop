# 04. Currency display labels (Frankfurter)

Status: ready-for-agent

## Parent

[PRD: Manga Web Shop](../PRD.md)

## What to build

Show each manga's EUR price alongside smaller informational USD/GBP/JPY labels, so a Guest understands roughly what they'd pay. The Catalog service converts the stored EUR (integer cents) into USD/GBP/JPY using cached Frankfurter rates (12–24h TTL, in-memory per-service cache — no Redis). The Frankfurter call is wrapped in a circuit breaker; when it's open or failing, fall back to the last cached rates. Conversions are display-only and never affect any stored price or charge. RSD is not offered.

Next.js renders the USD/GBP/JPY labels beneath the EUR price on the list and detail views.

Respects ADR-0006 (EUR settlement, display-only conversion, no RSD), ADR-0009 (circuit breaker + cache fallback, in-memory TTL).

## Acceptance criteria

- [ ] EUR prices are converted to USD/GBP/JPY via Frankfurter, with rates cached in-memory at a 12–24h TTL
- [ ] A circuit breaker wraps the Frankfurter call; when open, conversion falls back to the last cached rates
- [ ] Conversions never mutate the stored EUR price or any charge amount
- [ ] Next.js shows USD/GBP/JPY labels alongside the EUR price on list and detail views
- [ ] Integration tests (Frankfurter mocked at the HTTP boundary): conversion correctness; cache reuse within TTL; breaker-open fallback to cached rates

## Blocked by

- [03. Browse & search catalog](03-catalog-browse-search.md)
