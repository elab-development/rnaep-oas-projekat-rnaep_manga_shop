---
status: accepted
---

# Homepage ISR, diverging from the app-wide no-store posture, as PPR preparation

ADR-0011 established `no-store` / `force-dynamic` SSR for the whole Next.js gateway composition — every page re-fetches through the gateway per request. The homepage is the one exception we make deliberately: it is a **landing/marketing surface** (hero, Featured rail, New Arrivals rail, value props, footer) whose content changes rarely and whose shell carries **no per-user personalization** — `SiteNav` is a client island that reads the session client-side, so the server-rendered shell is identical for every visitor. We set the homepage to **ISR** via `export const revalidate = 3600` (1 hour), for two reasons: (1) a cacheable static shell is the right performance posture for a conversion landing page, and (2) a static-shell-plus-dynamic-islands page is exactly the shape Next 16 **Partial Prerendering** wants, so this is intentional runway for a later PPR pass. Catalog, product, cart, and all authenticated pages stay dynamic / `no-store`.

## Considered options

- **Keep `force-dynamic` / `no-store`** (match the rest of the app) — simplest and consistent, but re-fetches Featured/New Arrivals on every request for data that changes on the order of hours, and leaves no PPR runway.
- **ISR with `revalidate = 3600`** (chosen) — caches the landing shell, revalidates hourly, and sets up PPR.

## Consequences

- Featured and New Arrivals can be **stale by up to one hour**. Acceptable for a landing surface; a Moderator flagging a manga as Featured will not appear on the homepage instantly. If that ever becomes a problem, shorten `revalidate` or trigger on-demand revalidation — do **not** revert to `no-store`.
- This is the **first place web content is cached**. The divergence from ADR-0011 is deliberate; a future reader seeing the homepage cache while `/catalog` does not should not "fix" it to match — that would defeat the PPR preparation this ADR exists to record.
