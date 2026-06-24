# 06. Admin role management

Status: ready-for-agent

## Parent

[PRD: Manga Web Shop](../PRD.md)

## What to build

An Admin can change a user's role between `customer`, `moderator`, and `admin`, so they can grant moderation rights. The Auth service exposes a role-change endpoint gated so only an admin may call it, demonstrating the exact/allow-list guard (`@Roles('admin')`) distinct from the hierarchical `@MinRole`. Next.js gets an admin user panel listing users and letting an admin set each user's single role.

Respects ADR-0005 (single `role` enum, `@Roles` exact check vs `@MinRole` hierarchy), ADR-0007 (identity from verified token).

## Acceptance criteria

- [ ] Admin-only endpoint changes a target user's `role` to one of `customer | moderator | admin`
- [ ] Endpoint is gated so a non-admin (customer/moderator) is rejected
- [ ] A newly promoted moderator/admin immediately passes the corresponding guard checks
- [ ] Next.js admin user panel lists users and sets each user's role
- [ ] Integration tests (real ephemeral Postgres): admin can change a role; non-admin is rejected; `@Roles('admin')` exact-check vs `@MinRole` behavior is covered

## Blocked by

- [02. Register & login (Auth, JWT)](02-auth-register-login-jwt.md)
