# 06. Admin role management

Status: done

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

## Comments

Done on branch `feat/06-admin-role-management`.

**What was built**

- **Contracts** (`packages/contracts/src/auth.ts`): `UserView` (id/email/role/createdAt,
  no password hash) and `ChangeRoleInput` shared between Auth and the frontend.
- **Auth service**:
  - `GET /auth/users` — lists all accounts (oldest first) for the admin panel.
  - `PATCH /auth/users/:id/role` — sets a user's single role; 404 on unknown target.
  - Both gated with the **exact / allow-list** `@Roles('admin')` (ADR-0005),
    deliberately *not* `@MinRole` — user administration is admin-only, not
    "moderator and up". `ChangeRoleDto` uses `@IsIn` so a bad role is a 400.
- **Frontend**: `/admin` page (client-side `isAdmin` gating for UX only),
  `AdminUserPanel` component with a per-row role selector, and `lib/admin.ts`
  gateway client. No gateway change needed — `/auth/*` already routes through.

**Tests (green)**

- Auth e2e (real ephemeral Postgres, testcontainers): admin changes a role;
  promoted user's next login token carries the elevated role; admin lists users
  (no hash leaked); a customer AND a moderator are both rejected 403 (proving the
  exact `@Roles('admin')` excludes non-admins); unauthenticated → 401; unknown
  target → 404; invalid role → 400.
- `test/roles-guard.spec.ts`: unit coverage pinning the `@Roles` exact-check vs
  `@MinRole` hierarchy distinction (an admin fails exact `@Roles('moderator')`
  but passes `@MinRole('moderator')`) — the semantic difference an HTTP test
  against a top role can't show.

**Notes / follow-ups**

- Bootstrap admin: registration always yields a `customer`, so the first admin
  must be promoted out-of-band (the e2e seeds one via direct SQL). A seed
  script/deploy step for the first admin is left for ops.
- No revocation list (ADR-0007): a promoted/demoted user keeps their old role
  until their short-lived token expires and they re-login. Expected, documented.
- No self-demotion guard — an admin *can* demote themselves; UI just marks
  "(you)". Add a guard later if desired.
