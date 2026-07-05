---
status: accepted
---

# Form inputs: Base UI Field/Input on native forms; react-hook-form only when needed

Text inputs move off ad-hoc `<label><input/></label>` markup onto shadcn's `base-lyra` `field` + `input` components (thin wrappers over `@base-ui/react`). shadcn no longer ships a `Form` component — forms are just the presentational `Field` family, and **react-hook-form is an opt-in pattern you wire yourself** (`Controller` + `zod` + `@hookform/resolvers`, per <https://ui.shadcn.com/docs/forms/react-hook-form>). We do **not** adopt RHF now: our forms use plain native `<form>` elements, because nothing we have needs programmatic form state. Validation is **hybrid** — cheap client checks via native HTML constraints (`type="email"`, `required`, `minLength`), the server stays the source of truth — and errors route by origin: **client validation renders per-field (in `FieldError`), server errors render in one form-level box.** `field`/`input` are shared in `packages/ui` (alongside `Button`) with ADR-0014 styling baked in, so call sites need no design classes.

## Considered options

- **react-hook-form now** — rejected (deferred). It's the documented path for complex forms, but auth is two fields with native-expressible constraints and search is a navigate box. RHF earns its keep on dynamic field arrays, cross-field/async validation, or wizard state — none of which we have. Adding `react-hook-form` + `@hookform/resolvers` + zod resolvers would be machinery a two-field form doesn't need. **RHF is the deliberate escape hatch** for a future form (e.g. a multi-step checkout) that actually needs it — wire it then, per the shadcn guide, without disturbing these.
- **Per-field server errors** — rejected as the default. The auth 401 is intentionally the ambiguous "wrong email or password" (account-enumeration resistance, in the ADR-0012 security posture); pinning it to the password field would leak that the email exists. So server `AuthError`s stay in the existing single `role="alert"` box; only client checks bind to individual fields via `FieldError`. This is also the least wiring.
- **`Field`/`Input` on the search box too, but no validation** — accepted. The catalog search navigates to a URL (`router.push`), it never validates or submits to a service, and the genre chips are navigate-on-toggle `<button>`s that can't be fields. We use `Field` + `Input` there purely for the shared look + label/aria wiring, on a plain native `<form>`. The *reused* thing is the styled input, not any form machinery.
- **Stock components + per-call-site styling** — rejected. ADR-0014 already mandates `border-chip` (2px ink) for inputs and zero radius globally (`--radius: 0`); baking those into the shared `Input`/`Field` (as `Button` bakes its own) keeps every input on-system and drift-proof. Catalog's plain 1px `border` was the pre-existing drift this corrects.

## Consequences

- The default for any input is native `<form>` + `Field` + `Input`. Reaching for react-hook-form is a signal that a form crossed into genuinely-complex territory; a reviewer should expect a one-line justification.
- Two error channels coexist by design — per-field (client, in `FieldError`) and one form-level box (server). This is not an inconsistency to "clean up"; the split is what preserves the 401 ambiguity.
- Client-side per-field messages need a small amount of state to feed `FieldError` (native constraint validity read on submit/blur) — there is no form library computing it for us. That is the accepted cost of staying RHF-free.
- These are UI-implementation terms, not domain language — deliberately kept out of `CONTEXT.md`.
