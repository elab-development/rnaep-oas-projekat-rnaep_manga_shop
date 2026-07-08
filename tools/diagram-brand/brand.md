# Diagram house style (ADR-0014)

Apply this to **every** diagram, chart, or canvas generated for this project —
architecture canvases, C4 views, flowcharts, sequence diagrams, ER diagrams,
slides. It is the same neo-brutalist language as the web UI, so diagrams sit
next to the product. Source of truth: [ADR-0014](../../docs/adr/0014-neo-brutalist-design-system.md)
and `packages/ui/src/styles/globals.css`. Machine-readable values: [`brand.json`](./brand.json).

## The look in one line

White chassis + a low-alpha screentone **dot field**, **thick ink borders**, **hard
zero-blur offset shadows**, **sharp (zero-radius) corners**, a **small closed set of
loud flat accents**, Space Grotesk headings (heavy, UPPERCASE), Space Mono body.

## Palette

- **Ink** `#18181B` — every border, shadow, and body glyph. **Paper** `#FFFFFF`.
- **Screentone dots**: ink at ~8% alpha, 12px grid, behind surfaces (not behind dense tables).
- **Closed accent set** — do not introduce any hue outside this table (a stray color is a bug):

  | Accent | Hex | Text on it | Meaning |
  |---|---|---|---|
  | Yellow | `#F4C518` | black | primary / attention · `pending_payment` · low stock |
  | Green | `#2FC06E` | black | good / go · `paid` · in stock |
  | Blue | `#3457DD` | white | in transit · `shipped` |
  | Red | `#E03127` | white | dead end · `cancelled` / `failed` · out of stock |
  | Grey | `#D4D4D8` | `#52525B` | inert · `refunded` · expired · disabled |

  Text-on-accent is **fixed per hue** (yellow/green→black, blue/red→white) — never theme-varied.

## Mechanical constants (the "brutalist" feel)

- **Corners:** radius `0` everywhere. Non-negotiable.
- **Borders:** ink, three weights — chip `2px`, box `3px`, emphasis `5px` (cards/hero).
- **Shadows:** hard offset, **zero blur**, ink-colored — `7px 7px 0` boxes, `10px 10px 0` hero.
  In SVG this is a second ink-filled rect offset behind the shape (no blur filter).
- No soft/blurred shadows, no gradients on chrome, no rounded corners, no easing.

## Typography

- **Headings / labels:** **Space Grotesk**, weight **700**, **UPPERCASE**, tracking ~0.6.
  Uppercase in the *text itself* — CSS `text-transform` is ignored by the rasterizer.
- **Body / data / values:** **Space Mono** (400; 700 for emphasis). Carries EUR prices,
  ports, IDs, status labels — the technical voice.
- Reference them by family name: `font-family="'Space Grotesk', sans-serif"` /
  `font-family="'Space Mono', monospace"`. The renderer supplies the real fonts.

## Applying it to common diagram types

- **Boxes/nodes** (canvas cells, C4 containers, ER tables): paper fill, `3px` ink border,
  `7px` hard shadow, an accent **header bar** flush inside the border, uppercase Grotesk title.
- **Bands/groups**: assign one accent per group from the closed set; reuse its meaning where it maps.
- **Bullets/markers**: small filled **squares** (accent fill, ink border), never round dots.
- **Edges/arrows**: ink, `2–3px`, right angles or straight runs; label in Space Mono.
- **Legends**: accent chips with a `2px` border, uppercase Space Mono labels.

## Rendering (always emit BOTH, with real fonts)

Never hand-rasterize with sharp/librsvg — it ignores embedded `@font-face`. Pipe the
SVG through the toolkit renderer, which embeds the fonts (self-contained SVG) and
rasterizes a PNG with a font-aware engine:

```bash
node tools/diagram-brand/render.mjs path/to/diagram.svg -o .ignore/diagrams
# → .ignore/diagrams/diagram.svg (fonts embedded) + diagram.png
```

Generators only need to emit an SVG whose text uses the two font families above;
`render.mjs` does the fonts + PNG. See [`README.md`](./README.md).
