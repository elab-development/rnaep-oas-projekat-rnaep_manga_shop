#!/usr/bin/env python3
"""
Software Architecture Canvas — Manga Web Shop neo-brutalist brand skin (ADR-0014).

Same fixed 11-section grid as the base generator, restyled to the project's
design system: white chassis + screentone dots, thick ink borders, hard
zero-blur offset shadows, sharp (zero-radius) corners, Space Grotesk headings +
Space Mono body, and the closed accent set (yellow / green / blue / red).

Usage:
    python generate_canvas_brutal.py spec.json -o canvas-v2.svg
"""

import argparse
import base64
import html
import json
import os

# ---------------------------------------------------------------------------
# Canvas layout — identical grid to the base generator
# ---------------------------------------------------------------------------

SVG_W, SVG_H = 1680, 1160
MARGIN = 40
HEADER_H = 108
GAP = 20

GRID_LEFT = MARGIN
GRID_TOP = MARGIN + HEADER_H + GAP
GRID_W = SVG_W - 2 * MARGIN
COL_W = (GRID_W - 2 * GAP) / 3
ROW_H = (SVG_H - MARGIN - GRID_TOP - 3 * GAP) / 4

# ---------------------------------------------------------------------------
# ADR-0014 brand tokens (oklch → approx sRGB hex)
# ---------------------------------------------------------------------------

INK = "#18181B"            # --foreground (near-black ink)
PAPER = "#FFFFFF"          # --background
MUTED = "#6B7280"          # muted label text
DOTS = "#18181B"           # screentone dot field, drawn at low alpha

# Closed accent vocabulary. header text-on-accent is fixed per hue.
YELLOW = "#F4C518"         # --status-pending / --primary  (text: black)
GREEN = "#2FC06E"          # --status-paid                 (text: black)
BLUE = "#3457DD"           # --status-shipped              (text: white)
RED = "#E03127"            # --status-cancelled/destructive(text: white)
GREY = "#D4D4D8"           # --status-inert

# Band → (accent fill, header text on accent)
BANDS = {
    "context":     (YELLOW, "#000000"),   # attention / primary
    "system":      (BLUE,   "#FFFFFF"),   # in transit / what it's made of
    "foundations": (GREEN,  "#000000"),   # good / go / what it's built on
    "operations":  (RED,    "#FFFFFF"),   # decisions & risks
}

BAND_LABEL = {
    "context": "Context", "system": "System",
    "foundations": "Foundations", "operations": "Operations",
}

SECTIONS = [
    ("stakeholders",  "Stakeholders & Users",           "context",     0, 0, 1),
    ("goals",         "Business Goals & Value",          "context",     1, 0, 1),
    ("constraints",   "Constraints & Assumptions",       "context",     2, 0, 1),
    ("external",      "External Systems & Integrations", "system",      0, 1, 1),
    ("components",    "Core Components & Modules",        "system",      1, 1, 1),
    ("data",          "Data & Storage",                  "system",      2, 1, 1),
    ("techstack",     "Technology Stack",                "foundations", 0, 2, 1),
    ("quality",       "Quality Attributes (NFRs)",       "foundations", 1, 2, 1),
    ("crosscutting",  "Cross-cutting Concerns",          "foundations", 2, 2, 1),
    ("decisions",     "Architecture Decisions & Risks",  "operations",  0, 3, 2),
    ("deployment",    "Deployment & Infrastructure",     "operations",  2, 3, 1),
]

# Neo-brutalist mechanical constants
BORDER_BOX = 3            # --border-width
BORDER_EMPH = 5          # --border-width-emphasis
SHADOW = 7               # hard offset shadow (zero blur)
SHADOW_HERO = 10

TITLE_FS = 15.5
ITEM_FS = 12.5
LINE_H = 18
PAD_X = 16
HEAD_BAR_H = 38

HEAD_FONT = "'Space Grotesk', 'Arial Narrow', 'Arial Black', sans-serif"
MONO_FONT = "'Space Mono', 'DejaVu Sans Mono', 'Courier New', monospace"


def esc(s):
    return html.escape(str(s), quote=True)


def font_face_style(fonts_dir):
    """Build an SVG <style> block with base64-embedded @font-face rules so the
    file renders with the brand fonts in any browser, no network. Returns "" if
    the woff2 files aren't present."""
    faces = [
        ("Space Grotesk", 700, "sg-700.woff2"),
        ("Space Mono", 400, "sm-400.woff2"),
    ]
    rules = []
    for family, weight, fname in faces:
        path = os.path.join(fonts_dir, fname)
        if not os.path.exists(path):
            continue
        with open(path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        rules.append(
            f"@font-face{{font-family:'{family}';font-style:normal;"
            f"font-weight:{weight};font-display:block;"
            f"src:url(data:font/woff2;base64,{b64}) format('woff2');}}"
        )
    if not rules:
        return ""
    return "<style>\n" + "\n".join(rules) + "\n</style>"


def mono_w(ch, fs):
    # Space Mono is monospaced; every glyph ~0.60em.
    return 0.60 * fs


def head_w(ch, fs):
    # Space Grotesk-ish, uppercase with tracking.
    if ch in "iIl.,:;'|!":
        return 0.34 * fs
    if ch in "mwMW":
        return 0.80 * fs
    return 0.62 * fs


def wrap(text, fs, max_w, measure):
    words = str(text).split()
    lines, cur = [], ""
    for word in words:
        trial = word if not cur else cur + " " + word
        if sum(measure(c, fs) for c in trial) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines or [""]


def cell_rect(col, row, colspan):
    x = GRID_LEFT + col * (COL_W + GAP)
    y = GRID_TOP + row * (ROW_H + GAP)
    w = colspan * COL_W + (colspan - 1) * GAP
    return x, y, w, ROW_H


def brutal_box(out, x, y, w, h, fill, shadow=SHADOW, border=BORDER_BOX):
    """Hard offset shadow (zero blur) + ink border, sharp corners."""
    out.append(
        f'<rect x="{x + shadow:.1f}" y="{y + shadow:.1f}" width="{w:.1f}" '
        f'height="{h:.1f}" fill="{INK}"/>'
    )
    out.append(
        f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" '
        f'fill="{fill}" stroke="{INK}" stroke-width="{border}"/>'
    )


def render(spec, fonts_dir=None):
    title = spec.get("title", "Software Architecture Canvas")
    subtitle = spec.get("subtitle", "")
    content = spec.get("sections", {})

    out = []
    out.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{SVG_W}" height="{SVG_H}" '
        f'viewBox="0 0 {SVG_W} {SVG_H}">'
    )
    # embed brand fonts so the SVG is self-contained in any browser
    if fonts_dir:
        style = font_face_style(fonts_dir)
        if style:
            out.append(style)
    # screentone dot field (ADR-0014 bg-dots) — low-alpha ink dots on paper
    out.append(
        '<defs>'
        '<pattern id="dots" width="12" height="12" patternUnits="userSpaceOnUse">'
        f'<circle cx="1.1" cy="1.1" r="1.1" fill="{DOTS}" fill-opacity="0.08"/>'
        '</pattern>'
        '</defs>'
    )
    out.append(f'<rect width="{SVG_W}" height="{SVG_H}" fill="{PAPER}"/>')
    out.append(f'<rect width="{SVG_W}" height="{SVG_H}" fill="url(#dots)"/>')

    # ---- header: ink hero box, white display heading, yellow accent tab ----
    brutal_box(out, MARGIN, MARGIN, GRID_W, HEADER_H, INK,
               shadow=SHADOW_HERO, border=BORDER_EMPH)
    # yellow primary accent block on the left edge of the hero
    out.append(
        f'<rect x="{MARGIN}" y="{MARGIN}" width="18" height="{HEADER_H}" '
        f'fill="{YELLOW}" stroke="{INK}" stroke-width="{BORDER_EMPH}"/>'
    )
    out.append(
        f'<text x="{MARGIN + 44}" y="{MARGIN + 50}" fill="{PAPER}" '
        f'font-family="{HEAD_FONT}" font-size="30" font-weight="700" '
        f'letter-spacing="1.5">{esc(title.upper())}</text>'
    )
    if subtitle:
        out.append(
            f'<text x="{MARGIN + 46}" y="{MARGIN + 82}" fill="#B4B4BD" '
            f'font-family="{MONO_FONT}" font-size="14">{esc(subtitle)}</text>'
        )

    # legend chips (band accents) bottom-right of the hero
    lx = SVG_W - MARGIN - 28
    ly = MARGIN + HEADER_H - 24
    placed = []
    for band in ("operations", "foundations", "system", "context"):
        name = BAND_LABEL[band]
        label_w = sum(head_w(c, 11) for c in name.upper())
        block_w = 18 + 8 + label_w + 22
        lx -= block_w
        placed.append((lx, name, BANDS[band][0], label_w))
    for x, name, color, _ in placed:
        out.append(
            f'<rect x="{x:.0f}" y="{ly - 13:.0f}" width="18" height="18" '
            f'fill="{color}" stroke="{PAPER}" stroke-width="2"/>'
        )
        out.append(
            f'<text x="{x + 26:.0f}" y="{ly + 1:.0f}" fill="#D4D4D8" '
            f'font-family="{MONO_FONT}" font-size="11" '
            f'letter-spacing="0.5">{esc(name.upper())}</text>'
        )

    # ---- section cells ----
    for key, sec_title, band, col, row, colspan in SECTIONS:
        accent, head_text = BANDS[band]
        x, y, w, h = cell_rect(col, row, colspan)
        items = content.get(key, [])
        if isinstance(items, str):
            items = [items]

        # white chassis box with ink border + hard shadow
        brutal_box(out, x, y, w, h, PAPER)
        # accent header bar (flush inside the border)
        bi = BORDER_BOX
        out.append(
            f'<rect x="{x + bi:.1f}" y="{y + bi:.1f}" width="{w - 2 * bi:.1f}" '
            f'height="{HEAD_BAR_H:.1f}" fill="{accent}"/>'
        )
        # divider rule under the header bar
        out.append(
            f'<rect x="{x:.1f}" y="{y + bi + HEAD_BAR_H:.1f}" width="{w:.1f}" '
            f'height="{bi}" fill="{INK}"/>'
        )
        out.append(
            f'<text x="{x + PAD_X:.1f}" y="{y + 26:.1f}" fill="{head_text}" '
            f'font-family="{HEAD_FONT}" font-size="{TITLE_FS}" font-weight="700" '
            f'letter-spacing="0.6">{esc(sec_title.upper())}</text>'
        )

        # items — Space Mono, square accent bullets
        ty = y + HEAD_BAR_H + 30
        body_bottom = y + h - 14
        max_text_w = w - 2 * PAD_X - 14
        overflow = False
        for item in items:
            lines = wrap(item, ITEM_FS, max_text_w, mono_w)
            block_h = len(lines) * LINE_H
            if ty + block_h - LINE_H > body_bottom:
                overflow = True
                break
            out.append(
                f'<rect x="{x + PAD_X:.1f}" y="{ty - 9:.1f}" width="7" height="7" '
                f'fill="{accent}" stroke="{INK}" stroke-width="1.5"/>'
            )
            for line in lines:
                out.append(
                    f'<text x="{x + PAD_X + 16:.1f}" y="{ty:.1f}" fill="{INK}" '
                    f'font-family="{MONO_FONT}" font-size="{ITEM_FS}">{esc(line)}</text>'
                )
                ty += LINE_H
            ty += 5
        if overflow:
            out.append(
                f'<text x="{x + PAD_X:.1f}" y="{body_bottom:.1f}" fill="{MUTED}" '
                f'font-family="{MONO_FONT}" font-size="11">…more (trim to fit)</text>'
            )
        if not items:
            out.append(
                f'<text x="{x + PAD_X:.1f}" y="{y + HEAD_BAR_H + 32:.1f}" fill="{MUTED}" '
                f'font-family="{MONO_FONT}" font-size="12">—</text>'
            )

    out.append("</svg>")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("spec")
    ap.add_argument("-o", "--out", default="architecture-canvas-v2.svg")
    ap.add_argument("--fonts-dir", help="Dir with sg-700.woff2 / sm-400.woff2 to embed")
    args = ap.parse_args()
    with open(args.spec, "r", encoding="utf-8") as f:
        spec = json.load(f)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(render(spec, fonts_dir=args.fonts_dir))
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
