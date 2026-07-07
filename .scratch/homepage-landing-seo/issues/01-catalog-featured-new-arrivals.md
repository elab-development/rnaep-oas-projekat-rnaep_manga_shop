# 01. Catalog: Featured flag + New Arrivals ordering

Status: ready-for-agent

## Parent

[PRD: Homepage landing page — Featured & New Arrivals + on-page SEO](../PRD.md)

## What to build

The data backbone for both homepage rails — the one slice carrying real new backend logic. A Manga gains an editorial `featured` boolean (default `false`) and exposes its creation time so the catalog can be ordered newest-first.

End-to-end behaviour:

- `GET /catalog/manga?featured=true` returns **only** Featured manga, newest-first by creation time.
- `GET /catalog/manga` (no sort param) returns all manga **newest-first by creation time** — this becomes the catalog's default sort, replacing the current title sort. Genre/title/pagination behaviour is otherwise unchanged.
- `featured` is set through the existing `PATCH /catalog/manga/:id` update (extended to accept `featured`), gated `@MinRole('moderator')` — admin passes via the ADR-0005 hierarchy, customer is rejected. No new `/catalog/featured` endpoint; reuse the existing pager (least machinery, one query path).
- `MangaView` gains `featured: boolean` and `createdAt: string` (ISO); the list query contract gains an optional `featured?: boolean`. The list stays `Paginated<MangaView>` — no new response shape. `CreateMangaInput` continues to omit `featured` (a manga is created un-featured; featuring is a separate edit).

`timestamps: true` is **already enabled** on the Manga schema, so `createdAt` is already persisted — it is simply not on `MangaDoc`, not mapped in `toView`, and not exposed on `MangaView`. Surfacing it (and adding the `{ createdAt: -1 }` sort) is the cross-cutting change. Because timestamps have been on since the schema's creation, backfilling `createdAt` from Mongo `ObjectId` generation time (story 29) is a safety net that is likely a **no-op** in practice — implement it defensively so New Arrivals ordering is correct from day one even if any legacy document lacks a timestamp, but do not expect it to touch rows.

The gateway `/catalog/*` route is a pure pass-through — no gateway work.

## Acceptance criteria

- [ ] `Manga` schema has `featured: boolean` (default `false`); `createdAt` is surfaced on `MangaDoc` and mapped through `toView`
- [ ] `MangaView` exposes `featured: boolean` and `createdAt` (ISO string); the list query contract gains an optional `featured?: boolean`
- [ ] `GET /catalog/manga?featured=true` returns only Featured manga, newest-first
- [ ] `GET /catalog/manga` (no sort param) defaults to newest-first by `createdAt`; genre/title/pagination otherwise unchanged
- [ ] `PATCH /catalog/manga/:id` accepts `featured` and persists it; gated `@MinRole('moderator')` (customer 403, moderator + admin allowed)
- [ ] `createdAt` is backfilled from `ObjectId` for any document missing it (defensive; expected no-op)
- [ ] `catalog.e2e-spec.ts` extended: fixtures gain `featured` flags + distinct creation times; assert the `featured=true` filter, the default newest-first sort, and that existing pagination / title-search / genre-filter cases still hold under the new default sort
- [ ] `catalog-moderation.e2e-spec.ts` extended: a Moderator `PATCH`es `featured: true` and it persists on the read model; a Customer is rejected (403); an Admin is allowed (ADR-0005)
- [ ] `typecheck` and both Catalog specs green

## Blocked by

None - can start immediately.
