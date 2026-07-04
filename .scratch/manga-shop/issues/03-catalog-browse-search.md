# 03. Browse & search catalog

Status: done

## Parent

[PRD: Manga Web Shop](../PRD.md)

## What to build

A Guest can browse and explore the catalog end-to-end. The Catalog service (MongoDB) stores manga documents with title, author, genres, cover, price (EUR integer cents), and embedded `stock` (`quantity`, `reserved`). It exposes a paginated list, search/filter by title and genre, and a single-manga detail view that includes computed availability (`quantity − reserved`). The gateway routes `/catalog/*`. Next.js renders a paginated catalog list and a manga detail page, each showing the EUR price (USD/GBP/JPY labels come in slice 04).

Seed a handful of manga so the list is demoable. No auth required for any of this (Guest-accessible).

Respects ADR-0006 (EUR integer cents), CONTEXT.md stock/availability definitions, ADR-0004 (English fields).

## Acceptance criteria

- [ ] Manga documents persist in Mongo with title, author, genres, cover, price (integer cents), and embedded `stock { quantity, reserved }`
- [ ] Paginated list endpoint with search/filter by title and genre
- [ ] Detail endpoint returns a single manga including availability = `quantity − reserved`
- [ ] Gateway routes `/catalog/*` to the Catalog service (no auth required)
- [ ] Next.js catalog list (paginated, searchable/filterable) and detail page render, showing EUR price
- [ ] Integration tests (real ephemeral Mongo): pagination, title/genre search/filter, detail returns correct availability

## Blocked by

- [01. Foundation scaffold](01-foundation-scaffold.md)

## Comments

Built the Guest-accessible browse slice end-to-end (branch `feat/03-catalog-browse-search`).

**Catalog service** (`apps/catalog`, MongoDB via Mongoose):
- `Manga` schema with `title`, `author`, `genres[]`, `cover`, `description`,
  `price` (EUR integer cents, ADR-0006), embedded `stock { quantity, reserved }`,
  and an optional `jikanId` (kept for the slice-05 snapshot, ADR-0009). Timestamps on.
- `MangaService` derives `available = quantity − reserved` (CONTEXT.md) so clients
  never recompute it. Title search is a case-insensitive escaped regex; genre filter
  is array membership; results are title-sorted for stable pagination.
- `GET /catalog/manga?page&limit&q&genre` (paginated) and `GET /catalog/manga/:id`
  (detail; 404 on unknown/malformed id). Query DTO validated + coerced via
  `class-validator`/`class-transformer` and a `transform` ValidationPipe (ADR-0012).
- `database.module` now provides a real `mongoose.createConnection` (non-awaited so a
  missing DB never fails boot — the scaffold health e2e still passes). Idempotent
  seeder plants 6 demo manga on first boot (skipped under tests).

**Gateway**: added a public `/catalog/*` proxy (tokenless requests pass `jwtFastFail`,
ADR-0011). Reads `CATALOG_URL` (matches docker-compose).

**Web**: `/catalog` (searchable/filterable paginated grid) and `/catalog/[id]`
(detail with genres, description, EUR price, availability badge). Home page now routes
into the shelf. Neo-brutalist styling per ADR-0014; EUR-only pricing (USD/GBP/JPY
labels are slice 04). Shared `MangaView`/`Paginated` shapes added to
`@workspace/contracts`.

**Tests** (green): catalog integration (10) against real ephemeral Mongo
(testcontainers) — default page, pagination + no-overlap, title search, genre filter,
combined, detail availability, 404s, 400 on bad page size. Gateway (7, +1) —
`/catalog/*` proxies with no token. Also smoke-tested the running service against a
real Mongo (seed → list/search/filter/pagination/detail/404/400 all correct).
`pnpm typecheck`/`lint`/`test` pass; web builds.

**Notes / follow-ups**:
- Aligned catalog's `class-validator`/`class-transformer` versions with auth
  (`^0.15.1`/`^0.5.1`); a mismatch re-hashes the pnpm peer instance of
  `@nestjs/common` and breaks shared-guard `Reflector` DI. Keep versions in lockstep
  across services.
- No genres-facet endpoint yet — the UI filters by a free-text genre field. A
  `GET /catalog/genres` (or facet) could power a dropdown later.
- "Add to cart" routes a Guest to `/login` (cart is login-required, ADR-0010); the
  real cart lands in slice 07.
- No frontend test harness in `apps/web` yet (no jest/MSW); the AC's integration-test
  bullet is covered at the catalog seam. Wiring web tests is a separate task.
- Seed covers point at the MyAnimeList CDN; the UI degrades to alt text if an image
  fails to load.
