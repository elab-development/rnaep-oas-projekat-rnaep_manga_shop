# 04. On-page SEO plumbing (metadata, canonical, robots, sitemap)

Status: ready-for-agent

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
