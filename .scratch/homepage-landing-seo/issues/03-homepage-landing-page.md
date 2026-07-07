# 03. Homepage landing page (rails + chrome + ISR)

Status: done

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

## Comments

**Done** on branch `feat/03-homepage-landing-page` (merged to `develop`).

What was built (all in `apps/web`):

- **`lib/catalog.ts`** — `CatalogQuery` gains `featured?`; extracted a `catalogQuery()`
  query-string builder. Two cacheable rail helpers, `fetchFeatured()` (`featured=true`,
  limit 4) and `fetchNewArrivals()` (default newest-first, limit 4), fetch with
  `next: { revalidate: 3600 }` (exported `HOME_RAIL_LIMIT` / `HOME_REVALIDATE`) so
  they don't force the ISR route dynamic. `fetchGenres()` gained an optional
  `{ revalidate }` so the homepage genre nav is cacheable while the catalog page
  keeps `no-store`. Catalog/detail fetches are unchanged (`no-store`).
- **`lib/recency.ts`** — `isNewArrival(createdAt)`: true within a 30-day window
  (drives the NEW badge; `createdAt` is from slice 01).
- **`components/new-badge.tsx`** — presentational NEW badge, ADR-0014 yellow
  `bg-primary` accent (mirrors `FeaturedBadge`).
- **`components/manga-card.tsx`** — opt-in `showNew?` prop: renders `NewBadge`
  absolute top-left when set **and** the manga is recent. Catalog grid leaves it
  off; only the New Arrivals rail passes it. Featured badge stays top-right.
- **`components/site-footer.tsx`** — server-rendered footer: brand, Browse
  (catalog, genres) + Account (sign in, register) nav, copyright. Static year
  constant to keep the ISR HTML deterministic.
- **`app/page.tsx`** — rewritten landing page: hero (single `h1`, one primary CTA
  into the catalog, over `bg-dots`) → genre quick-nav (`?genre=`, capped at 12) →
  Featured rail → New Arrivals rail (`showNew`) → value props (4 real-capability
  cells) → final CTA (inked panel + yellow button) → footer. `export const
  revalidate = 3600` (ADR-0016).

Key decisions:

- **ISR literal, not imported.** Next statically parses the `revalidate` segment
  export, so it must be an inline literal (`3600`), kept equal to `HOME_REVALIDATE`
  by a comment — an imported constant fails the build ("Invalid segment
  configuration export").
- **Graceful rail degradation.** Because the homepage now prerenders at build under
  ISR (unlike the per-request `force-dynamic` catalog), a rail fetch failing (e.g.
  gateway unreachable at build time) would crash the whole web build. Each homepage
  fetch has a `.catch()` that logs and returns empty, so the shell + empty states
  render and recover on the next revalidate — extends story 13 ("an un-curated shop
  must not look broken") to a transiently unreachable one.
- **NEW badge is opt-in per rail**, not computed unconditionally in `MangaCard`, so
  the badge stays exclusive to New Arrivals and never leaks onto the catalog grid.
- **ADR-0014 compliance:** only closed-vocabulary classes (`bg-primary`, `bg-card`,
  `bg-foreground`/`text-background`, `border-chip`, `brutal-box`/`-lg`/`brutal-btn`,
  `bg-dots`); the one arbitrary value is the ADR-sanctioned `--dots` override on the
  inked final-CTA panel. No stray colour.

Feedback loops: `pnpm typecheck` green, `pnpm lint` (0 errors — only the
pre-existing unrelated `GATEWAY_INTERNAL_URL` warning), `pnpm --filter web build`
green (route table confirms `/` = Revalidate 1h, `/catalog` + `/catalog/[id]` stay
dynamic), full `pnpm test` green (backend untouched). Manual verification against
the running dev server (`:3010`): server HTML has exactly one `h1`, `nav`/`section`/
`footer` landmarks, all landing copy, tiles linking to `/catalog/[id]`, 4 NEW badges,
Featured badges, and genre chips — per the PRD's web-verification approach (no
frontend test harness, deliberately).

Follow-ups: unblocks **04** (on-page SEO plumbing — metadata/canonical/robots/
sitemap on top of this finished page). The catalog default sort is already
newest-first from slice 01, so the New Arrivals "Browse the catalog" link lands on
newest-first results with no extra work.
