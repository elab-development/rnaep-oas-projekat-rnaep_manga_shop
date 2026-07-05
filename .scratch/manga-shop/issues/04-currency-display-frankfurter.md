# 04. Currency display labels (Frankfurter)

Status: done

## Parent

[PRD: Manga Web Shop](../PRD.md)

## What to build

Show each manga's EUR price alongside smaller informational USD/GBP/JPY labels, so a Guest understands roughly what they'd pay. The Catalog service converts the stored EUR (integer cents) into USD/GBP/JPY using cached Frankfurter rates (12–24h TTL, in-memory per-service cache — no Redis). The Frankfurter call is wrapped in a circuit breaker; when it's open or failing, fall back to the last cached rates. Conversions are display-only and never affect any stored price or charge. RSD is not offered.

Next.js renders the USD/GBP/JPY labels beneath the EUR price on the list and detail views.

Respects ADR-0006 (EUR settlement, display-only conversion, no RSD), ADR-0009 (circuit breaker + cache fallback, in-memory TTL).

## Acceptance criteria

- [x] EUR prices are converted to USD/GBP/JPY via Frankfurter, with rates cached in-memory at a 12–24h TTL
- [x] A circuit breaker wraps the Frankfurter call; when open, conversion falls back to the last cached rates
- [x] Conversions never mutate the stored EUR price or any charge amount
- [x] Next.js shows USD/GBP/JPY labels alongside the EUR price on list and detail views
- [x] Integration tests (Frankfurter mocked at the HTTP boundary): conversion correctness; cache reuse within TTL; breaker-open fallback to cached rates

## Blocked by

- [03. Browse & search catalog](03-catalog-browse-search.md)

## Comments

Built the display-currency slice on the Catalog service (source of truth for
conversion) plus the Next.js labels.

**What was built**

- `apps/catalog/src/currency/` — `CurrencyService` fetches EUR→USD/GBP/JPY rates
  from Frankfurter (`/latest?base=EUR&symbols=…`), caches them in-memory with a
  12h TTL (fresh cache short-circuits the fetch), and wraps the call in an
  **opossum** circuit breaker (ADR-0009). The breaker's `fallback` serves the
  last cached rates on any failure or open circuit; before the first success it
  yields `undefined` → no labels rather than an error. Pure `convert(cents,
  rates)` rounds to each currency's major unit (display-only, never charged).
- `packages/contracts` — added `DisplayPrices` and an optional `display` field
  on `MangaView`. `MangaService` attaches it to every list/detail view.
- `apps/web` — `DisplayPriceLabels` component + `formatDisplayPrice` (Intl per
  currency, so JPY shows no decimals); rendered beneath the EUR price on the
  catalog card and detail view. Renders nothing when `display` is absent.
- `turbo.json` — declared `FRANKFURTER_URL` in `globalEnv`.

**Decisions**

- Used opossum, the breaker named in ADR-0009, rather than hand-rolling one.
- Conversions are stored as major-unit numbers in the contract (not integer
  cents) — they are display-only and JPY has no minor unit; EUR settlement
  stays integer cents untouched (ADR-0006).
- `CurrencyService` takes an `@Optional()` options bag (baseUrl/ttl/fetchImpl/
  breaker) so tests mock Frankfurter at the fetch boundary deterministically;
  Nest injects nothing and the defaults apply.

**Tests** — `currency.service.spec.ts` (conversion correctness, cache reuse
within TTL, breaker-open/failure fallback to cached rates, breaker opens after
repeated failures) + two catalog e2e assertions that list and detail views
carry the converted labels (fetch mocked in the suite so it never hits network).

**Follow-ups / notes**

- No web-layer render test was added — the repo has no frontend test harness yet
  (deferred with the broader frontend testing seam); the label component is a
  typechecked presentational map of the verified `display` field.
- `FRANKFURTER_URL` env var is optional; defaults to the public Frankfurter API.
