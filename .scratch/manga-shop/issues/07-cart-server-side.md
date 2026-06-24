# 07. Cart (server-side, login-required)

Status: ready-for-agent

## Parent

[PRD: Manga Web Shop](../PRD.md)

## What to build

A Customer has a persistent, server-side cart. The Orders service (Postgres, Drizzle) stores a Cart of CartItems keyed by `customer_id` (derived from the verified token, never the request body). The Customer can add a manga, change quantities, and remove items; the cart survives across devices and sessions because it lives server-side. There is no guest cart — adding to cart requires login. A Customer can only ever see and mutate their own cart (IDOR protection enforced by token-derived ownership).

Next.js shows the cart UI and, when a Guest tries to add to cart, prompts them to log in first so the cart is tied to their account.

Respects ADR-0010 (login-required server-side cart, keyed by `customer_id`, no guest cart), ADR-0012 (IDOR via token-derived ownership).

## Acceptance criteria

- [ ] Cart is keyed by `customer_id` taken from the verified token; unauthenticated cart access is rejected
- [ ] Customer can add a manga, change item quantity, and remove an item; changes persist server-side
- [ ] Cart contents survive a new session/login (persistence verified)
- [ ] Next.js cart UI works; a Guest attempting to add to cart is prompted to log in
- [ ] IDOR test: customer B's token cannot read or mutate customer A's cart
- [ ] Integration tests (real ephemeral Postgres): cart CRUD, ownership scoping, login-required enforcement

## Blocked by

- [02. Register & login (Auth, JWT)](02-auth-register-login-jwt.md)
- [03. Browse & search catalog](03-catalog-browse-search.md)
