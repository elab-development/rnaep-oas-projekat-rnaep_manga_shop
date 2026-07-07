# 03. Homepage landing page (rails + chrome + ISR)

Status: ready-for-agent

## Parent

[PRD: Homepage landing page — Featured & New Arrivals + on-page SEO](../PRD.md)

## What to build

Turn the bare static hero at `/` into a conversion-first landing page that looks like a real store and gets a Guest into the catalog quickly.

Section order, top to bottom:

**hero → genre quick-nav → Featured (4) → New Arrivals (4) → value props → final CTA → footer**

- **Hero** — expanded, with one primary call-to-action into the catalog above the fold, keyword-aware copy, over the existing `bg-dots` texture (ADR-0014).
- **Genre quick-nav** — links that jump straight into `/catalog` pre-filtered by genre (reuses the existing `?genre=` query mechanism; no new endpoint).
- **Featured rail** — up to 4 staff-curated manga (`featured=true`, limit 4). Empty state: render the section heading plus a short "No featured manga yet"-style message — never a bare heading over a void.
- **New Arrivals rail** — up to 4 most-recently-created manga (default newest-first, limit 4). Tiles show a **NEW** badge when the manga was created within the last **30 days**, in the design system's yellow attention accent (ADR-0014). `createdAt` (from slice 01) drives both the ordering and the badge check.
- Both rails render as a responsive `grid`/`flex` layout — **no carousel, no JS scroller** — reusing the existing `MangaCard` tile (cover, title, author, EUR price with USD/GBP/JPY labels, availability; whole tile links to `/catalog/[id]`).
- **Value props** — 3–4 static brutalist cells; every claim maps to a real capability (authentic volumes, Stripe checkout, EUR + multi-currency display, fast browse). No testimonials, no newsletter.
- **Final CTA** — an obvious way into the catalog after scrolling.
- **Footer** — a new component with navigation (catalog, genres, sign in / register) and copyright.

Two small homepage data helpers derive from the catalog fetch client (`lib/catalog.ts`): one for Featured (`featured=true`, limit 4), one for New Arrivals (default newest-first, limit 4).

The page is rendered with **ISR**: `export const revalidate = 3600` (ADR-0016) — a deliberate deviation from the app-wide `no-store` posture. `SiteNav` stays a client island that reads the session client-side, so the server-rendered shell is identical for every visitor and a Customer's session is still recognised in the nav. Catalog, product, cart, and authenticated pages keep their dynamic/`no-store` posture.

Semantic HTML is built here (it is part of the markup): exactly one `h1`, and `nav`/`section`/`footer` landmarks, with the landing content (headings, copy, links) present in the server HTML. The metadata/canonical/robots/sitemap plumbing is slice 04.

All new UI uses only the ADR-0014 closed vocabulary (zero-radius, ink borders, hard offset shadows, `brutal-box`/`brutal-btn`; covers stay full-colour). Any stray colour is a defect.

## Acceptance criteria

- [ ] Homepage renders, in order: hero → genre quick-nav → Featured (4) → New Arrivals (4) → value props → final CTA → footer
- [ ] Hero has one primary CTA into the catalog above the fold
- [ ] Genre quick-nav links land on `/catalog` pre-filtered by the chosen genre
- [ ] Featured rail shows up to 4 `featured=true` manga; with none featured it shows the heading + an intentional empty-state message
- [ ] New Arrivals rail shows up to 4 newest manga; tiles created within 30 days carry a NEW badge in the yellow accent
- [ ] Rails reuse `MangaCard` (cover, title, author, EUR + USD/GBP/JPY labels, availability); each tile links to its detail page
- [ ] Value-props band has 3–4 cells, each mapping to a real capability; no testimonials/newsletter
- [ ] A footer component provides catalog / genres / sign in / register navigation + copyright
- [ ] Rails reflow into a readable grid on mobile with no horizontal scroll; no carousel/JS scroller
- [ ] `export const revalidate = 3600` on the homepage; other pages keep their dynamic/`no-store` posture
- [ ] Exactly one `h1`; `nav`/`section`/`footer` landmarks; landing content present in server HTML
- [ ] ADR-0014 compliant — no stray colour outside the closed accent table
- [ ] `typecheck` green; web builds; verified by manual review

## Blocked by

- [01. Catalog: Featured flag + New Arrivals ordering](01-catalog-featured-new-arrivals.md)
