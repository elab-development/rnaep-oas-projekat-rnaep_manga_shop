---
status: accepted
---

# Neo-brutalist design system: B&W chassis + status accents

The web UI uses a **neo-brutalist** visual language: a stark black-and-white *chassis* — thick ink borders, hard zero-blur offset shadows, sharp (zero-radius) corners, heavy grotesk + monospace type — carrying a **small closed set of loud flat accent colors** that do all the state signalling. We picked this over a strictly monochrome look because the app must communicate four order states, three stock levels, roles, and money at a glance, which pure black/white cannot encode legibly. Accents are a *disciplined vocabulary*, not decoration: any color that isn't in the table below is a bug. The system is **light + dark**, implemented entirely through the existing Tailwind v4 + shadcn CSS-variable theme in `packages/ui/src/styles/globals.css` — no new styling machinery.

## Accent vocabulary (closed set)

State colors map to the domain's ubiquitous language (order status per ADR-0010, stock per CONTEXT.md). One meaning band per hue; the only intentional overlap is yellow, which always means "attention / act."

| Meaning | Hue | Text on it | Domain uses |
|---|---|---|---|
| Primary action / attention | **Yellow** | black | BUY / pay button, `pending_payment`, low stock |
| Good / go | **Green** | black | `paid`, in stock |
| In transit | **Blue** | white | `shipped` |
| Dead end | **Red** (shadcn `--destructive`) | white | `cancelled`, payment `failed`, out of stock |
| Neutral chrome / secondary | white fill, ink border | ink | secondary buttons, default surfaces |
| Inert | **Grey hatch** (no hue) | ink | `refunded`, expired reservation, disabled |

Text-on-accent colors are **fixed per hue** (yellow→black, green→black, blue→white, red→white) and do not vary by theme.

## Mechanical constants (the "brutalist" feel)

- **Corners:** `border-radius: 0` everywhere. Already the default (`--radius: 0` in globals.css). Non-negotiable.
- **Borders:** chunky, in three weights — `border-box` **3px** (default box), `border-emphasis` **5px** (cards, hero), `border-chip` **2px** (inputs, chips) — all ink-colored. Driven by `--border-width{,-emphasis,-chip}` CSS variables in `:root`, never hardcoded per component. Plain Tailwind `border` (1px) is reserved for thin divider rules; the built-in `border` utility is *not* overridden.
- **Shadows:** hard offset, **zero blur** — `4px 4px 0` in ink color; hero/primary `6px 6px 0`. No blurred/soft shadows anywhere.
- **Press interaction:** on `:active`, an **interactive control** translates `+2px, +2px` and its shadow shrinks to `2px 2px 0` — it physically presses *into* its shadow. This is the signature motion. No opacity fades, no easing curves. The motion belongs to controls, not surfaces: it ships as the reusable `.brutal-btn` skin, **not** on the static `.brutal-box` (see below).

## Box vs. button: two primitives, one presses

The chassis exposes two composable class primitives, split by whether the element reacts to a press:

- **`.brutal-box`** — the *static* surface: ink border + hard offset shadow, no `:active` motion. Cards, panels, the hero, the auth/catalog form containers. It must not translate, because CSS `:active` matches the activated element *and its ancestors* — a `.brutal-box` wrapping a button would jump whenever that button was clicked (this was a real catalog-form bug). Opt-in hover motion (e.g. the catalog card's lift) is fine; press is not.
- **`.brutal-btn`** — the reusable button skin: same ink border + shadow **plus** the press-into-shadow motion. Composes onto the shared `Button`/`buttonVariants()` and raw `<button>`/`<a>`. It is intentionally **unlayered** CSS (not `@layer`/`@utility`) so it overrides the cva button base's `border-transparent` and `active:translate-y-px` utilities by cascade origin, without `tailwind-merge` needing to know it exists. Use it on every real push-button (CTAs, submit, outline secondaries); leave toggle chips, pager links, and text links flat.
- **`.brutal-press`** — just the `:active` press motion, no skin. For a `.brutal-box` that is *itself* the clickable element (the catalog card `<a>`) and wants the press but not the button skin's hover-shadow-shrink — the card lifts on hover, and a shrinking shadow would fight that. Interactive elements only, never a container that wraps its own buttons (that's the ancestor-`:active` bug `.brutal-box` exists to avoid). `.brutal-btn` and `.brutal-press` share the one press rule.

## Typography

- **Headings / display:** Space Grotesk (heavy weights, uppercase, tight tracking).
- **Data / prices / labels:** Space Mono — leans technical, carries EUR prices and status labels.
- Wired via `next/font` (Google Fonts, free), exposed through `--font-heading` / `--font-mono` theme vars.

## Cover art

Full-color manga covers stay full color, wrapped in a thick ink border + hard offset shadow. Color lives in the artwork; the chrome around it stays black-and-white. Covers are the one place saturated full-spectrum color is allowed.

## Implementation (Tailwind v4 + shadcn)

- All tokens live in `packages/ui/src/styles/globals.css` (the shared `@workspace/ui` package consumed by `apps/web`), expressed as **oklch** CSS variables like the existing shadcn tokens.
- Accents are added as `--status-*` (and action) vars in `:root`/`.dark`, then surfaced as utility classes via `@theme inline` (e.g. `--color-status-paid: var(--status-paid)`), so components use real classes (`bg-status-paid`, `border-status-cancelled`) — never arbitrary values. `--primary` is overridden to yellow (black foreground); shadcn's `--destructive` is reused as our red.
- Default border width is a `--border-width` variable overridden in `:root`, not literals in component styles.

## Background texture

The one allowed background texture is a **low-alpha screentone dot field** (a manga halftone reference), exposed as the `bg-dots` utility backed by the `--dots` token (ink-based, ~8% alpha, re-resolves per theme via `color-mix`). It reads as atmosphere, not structure. Override `--dots` locally to flip the dots light on an inked panel. Used behind hero/auth surfaces, not behind dense data tables.

## Considered and rejected

- **Grid-paper / math-notebook backgrounds** — dropped. Grid behind four accents plus data tables was too noisy. Superseded by the dot field above: dots at low alpha give the same "notebook" atmosphere without the grid's structural noise.
- **Strictly monochrome** — rejected; cannot encode four order states / three stock levels without text-only fallbacks.
- **Chassis-only dark mode** (accents shared across themes) — rejected. Fully saturated accents vibrate (halation) on near-black. Accents get **toned-down `.dark` values** (lower chroma), so every accent has both a `:root` and a `.dark` value. Do not "simplify" this back to shared accents — it reintroduces the vibration on purpose-defeating grounds.

## Consequences

- Every new status/badge/button must resolve to a hue in the closed table or it breaks the system. Reviews should reject stray colors.
- Dark mode is built but verified manually by the maintainer, not in automated/agent review.
- Full retune means 4 accents × 2 themes = 8 accent values plus their fixed foregrounds to keep in sync when tuning.
