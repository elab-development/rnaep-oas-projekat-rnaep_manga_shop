# PRD: Homepage landing page — Featured & New Arrivals + on-page SEO

Status: ready-for-agent

> Expands the bare homepage into a conversion-focused store landing page, backed by two honestly-named product rails (**Featured**, **New Arrivals**) and lean on-page SEO. Domain vocabulary is in `CONTEXT.md` (**Featured**, **New Arrivals** added this cycle); authoritative decisions live in `docs/adr/` — this PRD references them rather than restating. New decision this cycle: **ADR-0016** (homepage ISR as PPR preparation). Respects **ADR-0014** (neo-brutalist design system), **ADR-0011** (thin gateway composition), **ADR-0005** (`@MinRole` hierarchy), **ADR-0006** (EUR cents), **ADR-0009** (Jikan snapshot-at-add).

## Problem Statement

A visitor arriving at the shop's root sees a bare static hero — a headline, a blurb, and two links. There is nothing that reads as a real store: no products, no way to see what's on offer without first clicking into the catalog, and no fast path into the genres a reader cares about. Shop staff have no way to promote specific titles on the front page. And to a search engine the homepage is a near-empty document — no title template, no description, no crawlable landing content — so the shop is hard to find and unconvincing when found. The result is a first impression that neither converts a browsing Guest nor establishes that this is a genuine store.

## Solution

Turn the homepage into a **conversion-first landing page** whose single job is to get a Guest into the catalog quickly, while looking like a real store:

- A visitor sees an expanded **hero** with one primary call-to-action into the catalog, a **genre quick-nav** for fast entry into the titles they care about, a **Featured** rail of staff-curated manga, a **New Arrivals** rail of the most recently added manga (with a NEW badge), a compact **value-props** band, a final call-to-action, and a **footer** with navigation.
- **Moderators** (and therefore **Admins**) can curate the **Featured** rail by flagging manga — a new catalog-management ability. **New Arrivals** is automatic: the newest manga by creation time, no curation.
- The page carries lean **on-page SEO**: real keyword-aware copy, a site-wide title template and descriptions, canonical URLs, semantic HTML landmarks, and `robots`/`sitemap` so the catalog is discoverable.

The homepage is served with **ISR** (`revalidate = 3600`), a deliberate deviation from the app-wide `no-store` posture recorded in ADR-0016, both because a landing surface needs no per-request freshness and as preparation for a later Partial Prerendering pass.

## User Stories

**Guest / landing & conversion**
1. As a Guest, I want an expanded hero with a clear primary call-to-action, so that I immediately understand this is a manga store and where to start.
2. As a Guest, I want one obvious action ("browse the catalog") above the fold, so that I can start shopping within seconds of landing.
3. As a Guest, I want a genre quick-nav on the homepage, so that I can jump straight into the kind of manga I care about.
4. As a Guest, I want each genre link to take me to the catalog pre-filtered by that genre, so that I skip the manual filtering step.
5. As a Guest, I want to see a rail of Featured manga on the homepage, so that I can discover titles the shop is highlighting.
6. As a Guest, I want to see a rail of the newest manga (New Arrivals), so that I can see what has just been added.
7. As a Guest, I want the newest manga marked with a NEW badge, so that I can tell at a glance what has recently arrived.
8. As a Guest, I want each homepage manga tile to show its cover, title, author, EUR price (with USD/GBP/JPY labels), and availability, so that I get the same trustworthy information as in the catalog.
9. As a Guest, I want to click a homepage manga tile and land on its detail page, so that I can decide whether to buy it.
10. As a Guest, I want a short value-props band (authentic volumes, secure card checkout, EUR + multi-currency display, fast browsing), so that I trust the shop — with every claim being something the shop actually does.
11. As a Guest, I want a final call-to-action before the footer, so that after scrolling I still have an obvious way into the catalog.
12. As a Guest, I want a footer with navigation (catalog, genres, sign in / register), so that I can reach the main areas of the shop from the bottom of any landing visit.
13. As a Guest, I want the homepage to still look intentional when no manga are Featured yet, so that an un-curated shop does not look broken.
14. As a Guest on a phone, I want the rails to reflow into a readable grid, so that the homepage works on my device without horizontal scrolling.

**Customer**
15. As a Customer, I want the homepage to recognise my session in the nav, so that the landing experience is consistent with the rest of the shop.

**Moderator / curation**
16. As a Moderator, I want to flag a manga as Featured, so that it appears in the homepage Featured rail.
17. As a Moderator, I want to unflag a Featured manga, so that I can rotate what the front page promotes.
18. As a Moderator, I want the Featured state to be visible in the catalog-management UI, so that I can see at a glance what is currently promoted.
19. As a Moderator, I want Featured to be a deliberate editorial choice, so that the front page never silently promotes titles I did not choose.

**Admin**
20. As an Admin, I want all Moderator curation abilities, so that I can manage the Featured rail as well (ADR-0005 hierarchy).

**Search engine / discoverability**
21. As a search crawler, I want the homepage to carry a descriptive title and meta description, so that it can be indexed and shown meaningfully in results.
22. As a search crawler, I want a site-wide title template so that every page has a coherent, unique title.
23. As a search crawler, I want each indexable page to declare a canonical URL, so that I do not treat query-string variants as duplicate content.
24. As a search crawler, I want the homepage's landing content (headings, copy, links) rendered in the server HTML, so that I can read it without executing JavaScript.
25. As a search crawler, I want semantic landmarks (single `h1`, `nav`, `section`, `footer`), so that I can understand the page structure.
26. As a search crawler, I want a `robots` directive and a `sitemap` listing the static routes and every product URL, so that I can discover and crawl the catalog efficiently.
27. As a search crawler, I want the homepage served as cacheable HTML, so that it responds fast — a ranking factor.

**Maintainer / operations**
28. As a Maintainer, I want the site's base URL to come from an environment variable (defaulting to the local dev origin), so that canonical/sitemap/Open Graph URLs are correct without a hardcoded production domain.
29. As a Maintainer, I want existing manga (added before this feature) to still sort sensibly by recency, so that New Arrivals is correct from day one without a manual data fix.

## Implementation Decisions

**Domain vocabulary (already recorded in `CONTEXT.md`).**
- **Featured** — an editorial boolean flag on a Manga, set by a Moderator/Admin; never derived from sales, stock, or recency.
- **New Arrivals** — the automatic rail of the most recently added Manga, newest-first by creation time. Creation time also becomes the Catalog's default sort.

**Catalog service (Mongo).**
- Add two fields to the Manga schema: `featured: boolean` (default `false`) and a creation timestamp (via Mongoose `timestamps`).
- Backfill the creation timestamp for pre-existing documents from their Mongo `ObjectId` generation time, so New Arrivals ordering is correct without manual data entry.
- The catalog list query gains an optional `featured` filter and defaults its sort to newest-first by creation time. Genre/title/pagination behaviour is unchanged except for the new default ordering.

**Contracts (`@workspace/contracts`).**
- `MangaView` gains `featured: boolean` and a `createdAt: string` (ISO) field. `createdAt` is exposed so the web can compute the NEW badge.
- The catalog list query contract gains an optional `featured?: boolean` parameter. The list stays a `Paginated<MangaView>`; no new response shape.
- `CreateMangaInput` continues to omit `featured` (a manga is created un-featured; featuring is a separate edit). The Featured toggle rides the existing partial-update path rather than a new endpoint.

**Catalog API surface (gateway + service).**
- `GET /catalog/manga?featured=true` returns only Featured manga, newest-first.
- `GET /catalog/manga` (no sort param) returns newest-first by creation time.
- Featured is set through the existing `PATCH /catalog/manga/:id` update, extended to accept `featured`. Gated `@MinRole('moderator')` like the other catalog writes (admin passes via the ADR-0005 hierarchy; customer rejected).
- Reuse the existing pager rather than a dedicated `/catalog/featured` endpoint — least machinery, one query path.

**Web — data layer.**
- The catalog fetch client gains support for the `featured` filter and a small limit. Two homepage helpers derive from it: one for Featured (`featured=true`, limit 4), one for New Arrivals (default newest-first, limit 4).

**Web — homepage (root route).**
- Section order, top to bottom: **hero → genre quick-nav → Featured (4) → New Arrivals (4) → value props → final CTA → footer**.
- Rails render as a responsive `grid`/`flex` layout (no carousel, no JS scroller), reusing the existing manga tile component.
- Featured empty state: render the section heading plus a short "No featured manga yet"-style message, never a bare heading over a void.
- New Arrivals tiles show a **NEW** badge when the manga was created within the last **30 days**, styled in the design system's attention (yellow) accent (ADR-0014).
- Value props: 3–4 static cells in the brutalist box style; every claim maps to a real capability (authentic volumes, Stripe checkout, EUR + display currencies, fast browse). No testimonials, no newsletter.
- A new **footer** component with navigation (catalog, genres, sign in / register) and copyright.
- The homepage is rendered with **ISR**: `revalidate = 3600` (ADR-0016). Catalog, product, cart, and authenticated pages keep their dynamic/`no-store` posture.
- All new UI uses only the ADR-0014 closed vocabulary (zero-radius, ink borders, hard offset shadows, `brutal-box`/`brutal-btn`, dot texture behind the hero, covers stay full-colour). Any stray colour is a defect.

**Web — moderator/admin curation UI.**
- The catalog-management panel surfaces each manga's Featured state and a toggle to set/unset it, calling the extended update endpoint. Client role-gating is UX-only; the service re-enforces `@MinRole` (consistent with prior web increments).

**Web — SEO.**
- Root layout gains `metadata`: `metadataBase` from `NEXT_PUBLIC_SITE_URL` (default the local dev origin, `http://localhost:3010`), a title template (`%s · Manga Shop`), a default description, and Open Graph/Twitter defaults.
- Per-page descriptions and `alternates.canonical` on indexable pages (homepage, catalog, product).
- Real, keyword-aware **SEO copy** in the hero, section headings, value props, and footer.
- Semantic HTML: exactly one `h1`, and `nav`/`section`/`footer` landmarks.
- A `robots` route (allow crawling, point at the sitemap) and a `sitemap` route (static routes + every product URL, enumerated from the catalog).

## Testing Decisions

**What a good test is here:** asserts observable outcomes at the transport boundary — response bodies, ordering, filtering, status codes — never internal calls or implementation shape. This matches the existing Catalog e2e philosophy.

**Catalog list (`apps/catalog/test/catalog.e2e-spec.ts` — extend the existing seam).** This is the one seam carrying real new logic. Extend `FIXTURES` with `featured` flags and distinct creation timestamps, then assert:
- `GET /catalog/manga?featured=true` returns only the featured fixtures, newest-first.
- `GET /catalog/manga` (no sort) returns all fixtures newest-first by creation time.
- Existing pagination, title search, and genre-filter cases still hold under the new default sort.
- Prior art: the whole file — real ephemeral Mongo via testcontainers, Frankfurter mocked at the `fetch` boundary, assertions on `Paginated<MangaView>` page counts and filtered contents.

**Featured toggle (`apps/catalog/test/catalog-moderation.e2e-spec.ts` — reuse the existing seam).** Add cases to the existing role-gating spec:
- A Moderator `PATCH`es `featured: true` and it persists on the read model.
- A Customer is rejected (403); an Admin is allowed (ADR-0005).
- Prior art: this file already mints HS256 JWTs for each role and asserts 401/403/201/204 against the guarded write endpoints.

**Web layer — no automated tests, deliberately.** The repo has no frontend test harness (issues 04 & 05 deferred it) and the web layer's role-gating is UX-only (service-enforced). Homepage rails, NEW badge, metadata, canonical, robots, and sitemap are verified by `typecheck` and manual review, consistent with every prior web increment. Introducing a Next render harness is out of scope for this feature.

**Suite discipline:** run `typecheck` and the affected single spec files during development; run the full test suite once at the end. Both Catalog specs must stay green.

## Out of Scope

- **Structured data / JSON-LD** (Product/Offer/Organization/BreadcrumbList), dynamic per-product Open Graph images, and migrating covers from `<img>` to `next/image`. Explicitly deferred; the SEO scope is on-page copy, metadata, canonical, semantic HTML, robots, and sitemap only.
- **Testimonials and newsletter sections** — cut. Testimonials would be fabricated (no customers); a newsletter would need email infrastructure that does not exist. Both were rejected on honesty grounds.
- **Carousel / JS scroller** for the rails — rejected; a responsive grid serves 4 items better and avoids a dependency and design-system re-skin.
- **Partial Prerendering (PPR)** itself — this feature only prepares for it via homepage ISR; the PPR pass is a separate session.
- **A dedicated `/catalog/featured` endpoint** — the existing list endpoint with a `featured` filter is used instead.
- **Sales-based or popularity-based ranking** — New Arrivals is purely time-ordered; there is no sales/popularity concept in the domain and none is introduced.
- **Live public deployment / real ranking** — there is no production domain; SEO is implemented correctly behind an env-configured base URL, not measured against live search ranking.

## Further Notes

- **Two rails, two honest mechanisms.** Featured answers "why is this here?" with "a human chose it"; New Arrivals answers "it's the most recent." Keeping them distinct is the point — do not collapse one into the other, and never label a time-ordered rail "Featured" or a curated rail "New."
- **Glossary honesty depends on the toggle.** `CONTEXT.md` states Moderators curate Featured. The moderator toggle is in scope precisely so that statement stays true; shipping the rail without the toggle would make the glossary lie.
- **`createdAt` serves two purposes:** the New Arrivals ordering / catalog default sort, and the NEW-badge recency check (30-day threshold) on the web.
- **ISR staleness is acceptable and recorded.** A newly-Featured manga may take up to an hour to appear on the homepage (ADR-0016). If that ever matters, shorten `revalidate` or add on-demand revalidation — do not revert the homepage to `no-store`.
- **Design-system compliance is a review gate.** Per ADR-0014, any colour outside the closed accent table is a defect; reviewers should reject stray colours in the new sections.
