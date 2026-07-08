# Roles are a single hierarchical enum, not a many-to-many

A user has exactly one `role` (`customer | moderator | admin`) stored as an enum column on the user, with the roles ordered as a hierarchy: `customer ⊂ moderator ⊂ admin`. This replaces the spec's `User` M:N `Role` (`user_roles` join table).

Authorization offers two guard styles over that single value: a **hierarchical minimum** (`@MinRole('moderator')` — admin also passes) for the common "this role and up" case, and an **exact / allow-list** check (`@Roles('moderator')` / `@Roles('customer','moderator')` — only the listed roles pass, no inheritance) for when a specific role must match and higher roles must be excluded.

**Why:** the system behaves as a hierarchy, not as additive independent roles — admin "has all moderator functions," moderator implies customer, and an admin changes a user's (singular) role. An M:N would model a many-to-many that is always one-to-one in practice, adding a join on every auth check and the awkward question of someone being "moderator and admin at once." The mandatory data-model requirement is the relational/non-relational *mix*, not an M:N specifically, so dropping the join doesn't fail any checklist item.

**Cost we accept:** diverges from the spec's ER diagram, which shows the M:N relationship; the final-submission diagram should show a single `role` attribute instead.
