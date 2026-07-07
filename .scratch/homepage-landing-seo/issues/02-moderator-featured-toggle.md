# 02. Moderator Featured toggle (curation UI)

Status: ready-for-agent

## Parent

[PRD: Homepage landing page — Featured & New Arrivals + on-page SEO](../PRD.md)

## What to build

The web curation ability that makes the Featured rail a deliberate editorial choice — and keeps the `CONTEXT.md` glossary honest (it states Moderators curate Featured; shipping the rail without this toggle would make that a lie).

In the catalog-management panel, each manga surfaces its current **Featured** state and a control to set/unset it. Toggling calls the extended `PATCH /catalog/manga/:id` from slice 01 with `{ featured }`. A Moderator can flag a manga so it appears in the homepage Featured rail, and unflag it to rotate what the front page promotes; the state is visible at a glance so they can see what is currently promoted.

Client role-gating is UX-only, consistent with prior web increments — the Catalog service re-enforces `@MinRole('moderator')` (admin passes via the ADR-0005 hierarchy). All new UI uses only the ADR-0014 closed vocabulary.

## Acceptance criteria

- [ ] The catalog-management panel shows each manga's current Featured state
- [ ] A Moderator can flag a manga as Featured and unflag it; the change persists via the extended `PATCH` and survives reload
- [ ] The toggle reflects the value returned by the read model (`MangaView.featured`), not optimistic-only state
- [ ] Client gating is UX-only; a customer token cannot succeed (service returns 403)
- [ ] New UI is ADR-0014 compliant (zero-radius, ink borders, hard offset shadows, `brutal-box`/`brutal-btn`; no stray colour)
- [ ] `typecheck` green; verified by manual review (no frontend test harness in the repo)

## Blocked by

- [01. Catalog: Featured flag + New Arrivals ordering](01-catalog-featured-new-arrivals.md)
