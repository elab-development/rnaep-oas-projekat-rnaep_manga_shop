# 02. Moderator Featured toggle (curation UI)

Status: done

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

## Comments

**Done** on branch `feat/02-moderator-featured-toggle` (merged to `develop`).

What was built:

- **`lib/moderation.ts`**: added `setFeatured(id, featured)` — a thin wrapper over
  the existing `updateManga(id, { featured })` PATCH path (slice 01; no dedicated
  endpoint per the PRD). Returns the persisted `MangaView`, so callers reflect the
  read model. The gateway/catalog service re-enforces `@MinRole('moderator')`; a
  customer token surfaces a 403 through the existing `ModerationError` handling.
- **`components/moderator-panel.tsx`** (`MangaRow`): each management row now
  surfaces Featured state at a glance with a yellow (`bg-primary`) **★ Featured**
  chip beside the title, and a toggle button in the actions cluster
  (`☆ Feature` / filled-yellow `★ Featured`, `aria-pressed`, descriptive `title`).
  Toggling calls `setFeatured(id, !manga.featured)` then `onChanged()`, which
  refetches the catalog — so the control reflects the persisted `MangaView.featured`
  rather than optimistic-only state. Shares the row's existing `busy`/`error`
  state with the stock/delete actions.

Design (ADR-0014): Featured maps to the closed-set **yellow "attention/act"** accent
(`bg-primary` / `text-primary-foreground`), reusing `.brutal-btn` for the control
skin and `border-chip` for the indicator chip — zero-radius, ink borders, hard
offset shadow, no stray colour.

Testing: web layer has no automated harness (deliberate, per PRD); client gating is
UX-only and service-enforced. Verified by `pnpm typecheck` (green), `pnpm lint`
(0 errors — only the pre-existing unrelated `GATEWAY_INTERNAL_URL` warning), the
web production build (green), and the full `pnpm test` suite (catalog 54 / payments
13 / orders 32, all green — unchanged, backend untouched).

Follow-ups: unblocks nothing new directly (slice 03 is only blocked by 01), but the
toggle is what keeps the `CONTEXT.md` glossary honest once slice 03 ships the
Featured rail. No blockers.
