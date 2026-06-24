# 05. Moderator catalog management + Jikan auto-fill

Status: ready-for-agent

## Parent

[PRD: Manga Web Shop](../PRD.md)

## What to build

A Moderator can grow and maintain the catalog. They add a new manga by searching Jikan to auto-fill its data (title, author, genres, cover), with `jikan_id` kept as a snapshot at add-time (never auto-resynced). When Jikan is unavailable, the circuit breaker opens and the UI falls back to fully manual entry so catalog work is never blocked. Jikan provides neither price nor stock, so the Moderator sets those. They can edit a manga's data and price, and update stock `quantity`; their edits are never overwritten by Jikan. An Admin (who has all Moderator abilities) can also delete a manga.

All write endpoints are gated with `@MinRole('moderator')`. Next.js gets a moderator panel for add (Jikan-assisted + manual), edit, stock update, and delete.

Respects ADR-0005 (`@MinRole` hierarchy — admin passes moderator check), ADR-0009 (Jikan snapshot-at-add, breaker + "fill manually" fallback, never block creation).

## Acceptance criteria

- [ ] Moderator can add a manga via Jikan search auto-fill; `jikan_id` is stored and never auto-resynced
- [ ] When the Jikan breaker is open, add falls back to manual entry and still succeeds
- [ ] Moderator sets price and stock on add; later Jikan data never overwrites moderator edits
- [ ] Moderator can edit manga data/price and update stock `quantity`
- [ ] Admin can delete a manga; all writes are gated by `@MinRole('moderator')` (admin passes, customer is rejected)
- [ ] Next.js moderator panel covers add (Jikan + manual), edit, stock update, delete
- [ ] Integration tests (Jikan mocked): Jikan-backed add; manual add with breaker open; role-gating (customer rejected, admin allowed); edit not clobbered by Jikan

## Blocked by

- [02. Register & login (Auth, JWT)](02-auth-register-login-jwt.md)
- [03. Browse & search catalog](03-catalog-browse-search.md)
