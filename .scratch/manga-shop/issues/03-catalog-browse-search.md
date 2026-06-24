# 03. Browse & search catalog

Status: ready-for-agent

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
