# 05. Moderator catalog management + Jikan auto-fill

Status: done

## Parent

[PRD: Manga Web Shop](../PRD.md)

## What to build

A Moderator can grow and maintain the catalog. They add a new manga by searching Jikan to auto-fill its data (title, author, genres, cover), with `jikan_id` kept as a snapshot at add-time (never auto-resynced). When Jikan is unavailable, the circuit breaker opens and the UI falls back to fully manual entry so catalog work is never blocked. Jikan provides neither price nor stock, so the Moderator sets those. They can edit a manga's data and price, and update stock `quantity`; their edits are never overwritten by Jikan. An Admin (who has all Moderator abilities) can also delete a manga.

All write endpoints are gated with `@MinRole('moderator')`. Next.js gets a moderator panel for add (Jikan-assisted + manual), edit, stock update, and delete.

Respects ADR-0005 (`@MinRole` hierarchy — admin passes moderator check), ADR-0009 (Jikan snapshot-at-add, breaker + "fill manually" fallback, never block creation).

## Acceptance criteria

- [ ] Moderator can add a manga via Jikan search auto-fill; `jikan_id` is stored and never auto-resynced
- [ ] When the Jikan breaker is open, add falls back to manual entry and still succeeds
- [ ] Moderator sets price and stock on add; later Jikan data never overwrites moderator edits
- [ ] Moderator can edit manga data/price and update stock `quantity`
- [ ] Admin can delete a manga; all writes are gated by `@MinRole('moderator')` (admin passes, customer is rejected)
- [ ] Next.js moderator panel covers add (Jikan + manual), edit, stock update, delete
- [ ] Integration tests (Jikan mocked): Jikan-backed add; manual add with breaker open; role-gating (customer rejected, admin allowed); edit not clobbered by Jikan

## Blocked by

- [02. Register & login (Auth, JWT)](02-auth-register-login-jwt.md)
- [03. Browse & search catalog](03-catalog-browse-search.md)

## Comments

Implemented on `feat/05-moderator-catalog-management-jikan` (merged to `develop`).

**Backend (catalog service)**
- `JikanService` (`src/jikan/`) mirrors `CurrencyService`: opossum circuit
  breaker around the Jikan `/manga?q=` search, `@Optional()` options bag
  (baseUrl/limit/fetchImpl/breaker) for tests. On any failure or open circuit the
  fallback yields `[]` — "fill manually" — so add is never blocked (ADR-0009). No
  cache: search queries vary and the fallback already decouples uptime.
- Guarded write endpoints on `MangaController`: `POST /catalog/manga`,
  `PATCH /catalog/manga/:id`, `PATCH /catalog/manga/:id/stock`,
  `DELETE /catalog/manga/:id`, plus `GET /catalog/jikan/search`. All use
  `@UseGuards(JwtAuthGuard, RolesGuard)`.
- `MangaService.create/update/updateStock/remove`. `create` sets `reserved: 0`
  and stores `jikanId` as an add-time snapshot; `update` patches data/price only
  and never touches `jikanId` or stock, so edits stick (no resync path exists).
  `updateStock` refuses to drop `quantity` below `reserved` (409) to prevent
  negative availability / overselling (ADR-0002).
- Contracts: added `JikanSuggestion`, `CreateMangaInput`, `UpdateMangaInput`;
  DTOs `implement` the input types so wire shape stays locked to the contract.

**Decision — delete is admin-gated, not moderator-gated.** The AC line reads
"all writes gated by `@MinRole('moderator')`", but PRD user story 29 lists delete
as an **Admin** ability (story 28: admin "has all moderator abilities too"). To
honor the domain, add/edit/stock use `@MinRole('moderator')` and delete uses
`@MinRole('admin')` (admin still passes every moderator check via the hierarchy).
Surfacing here per the "contradict the spec → comment, don't silently override"
rule.

**Frontend (web)** — `/moderator` panel (client-gated on the token's role, UX
only; the service re-enforces). `MangaForm` (create embeds `JikanSearch` →
pick prefills fields; edit patches data/price), inline per-row stock editor, and
an admin-only delete. New `lib/session.ts` (decode token for gating),
`lib/moderation.ts` (gateway write client), `money.ts` euro↔cents helpers.

**Tests** — `jikan.service.spec` (map/blank/fallback/breaker-opens) +
`catalog-moderation.e2e-spec` (13 cases: role gating 401/403/201 for
customer/moderator/admin, malformed 400, Jikan-backed add persisting `jikan_id`,
Jikan search gating, manual add with Jikan down, edit-not-clobbered, stock update
+ reserved-guard 409, admin delete 204 + moderator delete 403). Jikan/Frankfurter
mocked at the fetch boundary; JWTs minted with the shared HS256 secret so the
suite drives role-gated routes without the Auth service. `typecheck`/`lint`/`test`
all green (catalog 37 tests).

**Follow-ups** — No web render test (repo still has no frontend test harness;
deferred with the broader frontend seam, as in issue 04). `JIKAN_URL` added to
`turbo.json` globalEnv; optional, defaults to the public API.
