# diagram-brand

House-style branding + font-correct rasterization for **any** diagram in this
project. Keeps generated diagrams (architecture canvases, C4 views, flowcharts,
ER/sequence diagrams, slides) in the same neo-brutalist language as the web UI
(ADR-0014), and guarantees they render with the real brand fonts.

This directory is **not** part of the pnpm workspace (`pnpm-workspace.yaml` only
globs `apps/*` and `packages/*`), so it has its own `package.json` /
`node_modules` and never interferes with the app build.

## What's here

| Path | Purpose |
|---|---|
| `brand.md` | The style guide — apply it to every diagram. Read this first. |
| `brand.json` | Same tokens, machine-readable (colors, fonts, borders, shadows). |
| `render.mjs` | Skill-agnostic finalizer: embeds fonts into an SVG + rasterizes a PNG. |
| `fonts/` | Space Grotesk 700 + Space Mono 400/700 (TTF for raster, woff2 for embedding) + OFL licenses. |
| `generators/architecture-canvas.py` | Branded generator for the Software Architecture Canvas skill. |

## The one command

Any generator (or skill) just needs to emit an SVG whose text uses the brand
font families — `'Space Grotesk'` for headings, `'Space Mono'` for body (see
`brand.md`). Then finalize:

```bash
node tools/diagram-brand/render.mjs mydiagram.svg -o .ignore/diagrams
```

Produces, in `-o` (default: input's dir):

- `mydiagram.svg` — self-contained: fonts embedded as base64 `@font-face`, so it
  renders identically in any browser with no network and no installed fonts.
- `mydiagram.png` — rasterized with `@resvg/resvg-js` (font-aware), loading the
  real TTFs. **`sharp`/`librsvg` is deliberately not used — it ignores `@font-face`.**

Flags: `--scale N` (PNG zoom, default 2), `--width PX` (exact PNG width),
`--svg-only` / `--png-only`. Re-running is idempotent (fonts embed once).

First run installs `@resvg/resvg-js` automatically; to pre-install: `npm install`
in this directory.

## Architecture Canvas (worked example)

```bash
# 1. write a spec (see the software-architecture-canvas skill), then:
python tools/diagram-brand/generators/architecture-canvas.py spec.json -o out.svg
# 2. finalize to branded SVG + PNG:
node tools/diagram-brand/render.mjs out.svg -o .ignore/diagrams
```

## Fonts / licensing

Space Grotesk and Space Mono are SIL Open Font License 1.1 (see `fonts/OFL-*.txt`),
the same faces the web app loads via `next/font` in `apps/web/app/layout.tsx`.
Redistribution within this repo is permitted under the OFL.
