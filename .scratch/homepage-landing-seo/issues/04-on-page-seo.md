# 04. On-page SEO plumbing (metadata, canonical, robots, sitemap)

Status: done

## Parent

[PRD: Homepage landing page — Featured & New Arrivals + on-page SEO](../PRD.md)

## What to build

Make the shop discoverable to a crawler. All of this is greenfield — no `sitemap.ts`, `robots.ts`, `metadataBase`, or `openGraph` config exists yet; only per-page title `metadata` on the catalog list + detail.

- **Root-layout `metadata`** — `metadataBase` from `NEXT_PUBLIC_SITE_URL` (default the local dev origin, `http://localhost:3010`, so canonical/sitemap/OG URLs are correct without a hardcoded production domain), a title template (`%s · Manga Shop`), a default description, and Open Graph / Twitter defaults.
- **Per-page descriptions + canonical** — a description and `alternates.canonical` on each indexable page (homepage, catalog, product), so query-string variants are not treated as duplicate content.
- **`robots` route** — allow crawling and point at the sitemap.
- **`sitemap` route** — the static routes plus **every product URL**, enumerated from the catalog list.

The `NEXT_PUBLIC_SITE_URL` env var must be wired so the build/runtime picks it up (e.g. `turbo.json` `globalEnv` + a documented default) — story 28.

Semantic landmarks and the homepage's real keyword-aware copy are delivered in slice 03; this slice is the metadata/route plumbing on top of the finished page.

Out of scope (deferred per PRD): JSON-LD / structured data, dynamic per-product OG images, and migrating covers to `next/image`.

## Acceptance criteria

- [ ] Root layout exports `metadata` with `metadataBase` from `NEXT_PUBLIC_SITE_URL` (defaulting to `http://localhost:3010`), a `%s · Manga Shop` title template, a default description, and OG/Twitter defaults
- [ ] Homepage, catalog, and product pages each declare a description and `alternates.canonical`
- [ ] A `robots` route allows crawling and references the sitemap
- [ ] A `sitemap` route lists the static routes and every product URL, enumerated from the catalog
- [ ] `NEXT_PUBLIC_SITE_URL` is wired for build/runtime with a documented local-dev default; no hardcoded production domain anywhere
- [ ] Titles render through the template (e.g. a catalog page reads `… · Manga Shop`)
- [ ] `typecheck` green; web builds; verified by manual review

## Blocked by

- [03. Homepage landing page (rails + chrome + ISR)](03-homepage-landing-page.md)

## Comments

Done. On-page SEO plumbing shipped on top of the finished slice-03 landing page.

What was built:
- **`apps/web/lib/site.ts`** (new) — `siteUrl()` reads `NEXT_PUBLIC_SITE_URL`,
  defaults to the dev origin `http://localhost:3010`, normalises to `.origin`
  (mirrors `next.config.ts`'s `gatewayOrigin()`). Single source for every base
  URL — no hardcoded domain anywhere.
- **Root layout `metadata`** — `metadataBase` from `siteUrl()`, a
  `%s · Manga Shop` title template + keyword-led default title, a default
  description, and OG/Twitter defaults (website, siteName, summary_large_image).
- **Per-page description + `alternates.canonical`** on the three indexable
  routes: homepage (absolute title so the root doesn't self-template awkwardly,
  self-canonical `/`), catalog (retitled `"Catalog"` so the template renders
  `Catalog · Manga Shop`; canonical is the **bare** `/catalog`, so
  `?page`/`?q`/`?genre` variants aren't indexed as duplicates), product
  (`generateMetadata` → templated title, `createdAt`/author-aware description
  clamped to ~160 chars, canonical `/catalog/:id`).
- **`app/robots.ts`** — allow-all, `host` + `sitemap` at the configured origin.
- **`app/sitemap.ts`** — static public routes (`/`, `/catalog`, `/login`,
  `/register`; auth-gated surfaces omitted) plus one `<url>` per product with
  `lastmod=createdAt`, enumerated via a new `fetchAllManga()` that walks the
  paginated list at `CATALOG_MAX_PAGE_SIZE`. Cacheable under the ISR window and
  degrades to static-routes-only if the gateway is unreachable (mirrors the
  slice-03 rail `.catch`), so it never fails the build.
- **`NEXT_PUBLIC_SITE_URL` wired** end-to-end: `turbo.json` `globalEnv`,
  `apps/web/Dockerfile` `ARG`/`ENV` (baked in at build like `NEXT_PUBLIC_*`),
  `docker-compose.yml` web `build.args`, and documented in the README optional-env
  table with its dev default.

Verification (web has no test harness, per PRD): `typecheck` green, `lint` clean
(only the pre-existing unrelated `GATEWAY_INTERNAL_URL` warning), full `pnpm test`
green (both catalog specs pass). Web production build: `/` and `/sitemap.xml` are
ISR 1h, `/robots.txt` static, catalog/product stay dynamic. Manually curled the
running standalone server: catalog → `Catalog · Manga Shop`; product →
`<title> · Manga Shop` + clamped description + `/catalog/:id` canonical;
`/catalog?page=2&genre=Action` still canonicalises to the bare `/catalog`;
robots + sitemap bodies correct (static routes + real product URLs).

Follow-ups: none blocking. Out of scope per PRD and still deferred — JSON-LD /
structured data, dynamic per-product OG images, and migrating covers to
`next/image`. This closes the homepage-landing-seo PRD (04 was the last slice).
