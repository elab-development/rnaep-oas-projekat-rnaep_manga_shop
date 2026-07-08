#!/usr/bin/env python3
"""
Software Architecture Canvas generator.

Reads a JSON spec (content only) and renders a clean, fixed-layout SVG canvas.
Optionally exports PNG if `cairosvg` is installed.

Usage:
    python generate_canvas.py spec.json -o canvas.svg
    python generate_canvas.py spec.json -o canvas.svg --png canvas.png

The spec defines *content*; this script owns the *layout*, so every canvas
comes out consistent. See references/canvas-sections.md for the spec schema
and the meaning of each section.
"""

import argparse
import html
import json
import sys

# ---------------------------------------------------------------------------
# Canvas layout (the script owns this; the spec only supplies content)
# ---------------------------------------------------------------------------

SVG_W, SVG_H = 1680, 1160
MARGIN = 40
HEADER_H = 100
GAP = 16

GRID_LEFT = MARGIN
GRID_TOP = MARGIN + HEADER_H + GAP
GRID_W = SVG_W - 2 * MARGIN
COL_W = (GRID_W - 2 * GAP) / 3
ROW_H = (SVG_H - MARGIN - GRID_TOP - 3 * GAP) / 4

# Band palette: (header fill, body tint, header text)
BANDS = {
    "context":     ("#5B6BB5", "#EEF0FA", "#FFFFFF"),
    "system":      ("#3B8A99", "#E9F4F6", "#FFFFFF"),
    "foundations": ("#4E9B6B", "#ECF6F0", "#FFFFFF"),
    "operations":  ("#C08046", "#FBF3EA", "#FFFFFF"),
}

INK = "#1F2A37"
MUTED = "#6B7280"
BORDER = "#D7DCE3"
HEADER_BG = "#1F2A37"

# Section definitions: key -> (title, band, col, row, colspan)
SECTIONS = [
    ("stakeholders",  "Stakeholders & Users",          "context",     0, 0, 1),
    ("goals",         "Business Goals & Value",         "context",     1, 0, 1),
    ("constraints",   "Constraints & Assumptions",      "context",     2, 0, 1),
    ("external",      "External Systems & Integrations","system",      0, 1, 1),
    ("components",    "Core Components & Modules",       "system",      1, 1, 1),
    ("data",          "Data & Storage",                 "system",      2, 1, 1),
    ("techstack",     "Technology Stack",               "foundations", 0, 2, 1),
    ("quality",       "Quality Attributes (NFRs)",      "foundations", 1, 2, 1),
    ("crosscutting",  "Cross-cutting Concerns",         "foundations", 2, 2, 1),
    ("decisions",     "Architecture Decisions & Risks", "operations",  0, 3, 2),
    ("deployment",    "Deployment & Infrastructure",    "operations",  2, 3, 1),
]

TITLE_FS = 15
ITEM_FS = 13
LINE_H = 19
PAD_X = 16
HEAD_BAR_H = 34


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def esc(s):
    return html.escape(str(s), quote=True)


def char_w(ch, fs):
    """Rough per-character width for a humanist sans at size fs."""
    if ch in "iIl.,:;'|!":
        return 0.28 * fs
    if ch in "fjtr()[]-":
        return 0.36 * fs
    if ch in "mwMW":
        return 0.86 * fs
    if ch in "ABCDEFGHKNOPQRSUVXYZ0123456789":
        return 0.62 * fs
    if ch == " ":
        return 0.30 * fs
    return 0.52 * fs


def wrap(text, fs, max_w):
    """Greedy word wrap using estimated widths. Returns list of lines."""
    words = str(text).split()
    lines, cur = [], ""
    for word in words:
        trial = word if not cur else cur + " " + word
        if sum(char_w(c, fs) for c in trial) <= max_w or not cur:
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


# ---------------------------------------------------------------------------
# SVG rendering
# ---------------------------------------------------------------------------

def render(spec):
    title = spec.get("title", "Software Architecture Canvas")
    subtitle = spec.get("subtitle", "")
    content = spec.get("sections", {})

    out = []
    out.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{SVG_W}" height="{SVG_H}" '
        f'viewBox="0 0 {SVG_W} {SVG_H}" font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif">'
    )
    # page background
    out.append(f'<rect width="{SVG_W}" height="{SVG_H}" fill="#FFFFFF"/>')

    # header band
    out.append(
        f'<rect x="{MARGIN}" y="{MARGIN}" width="{GRID_W}" height="{HEADER_H}" '
        f'rx="10" fill="{HEADER_BG}"/>'
    )
    out.append(
        f'<text x="{MARGIN + 28}" y="{MARGIN + 46}" fill="#FFFFFF" '
        f'font-size="27" font-weight="700">{esc(title)}</text>'
    )
    if subtitle:
        out.append(
            f'<text x="{MARGIN + 28}" y="{MARGIN + 74}" fill="#AEB6C2" '
            f'font-size="14">{esc(subtitle)}</text>'
        )

    # legend (band key) on the right of the header
    legend = [("Context", "#5B6BB5"), ("System", "#3B8A99"),
              ("Foundations", "#4E9B6B"), ("Operations", "#C08046")]
    lx = SVG_W - MARGIN - 24
    ly = MARGIN + 62
    # measure and place from right to left
    placed = []
    for name, color in reversed(legend):
        label_w = sum(char_w(c, 12) for c in name)
        block_w = 14 + 6 + label_w + 22
        lx -= block_w
        placed.append((lx, name, color, label_w))
    for x, name, color, _ in reversed(placed):
        out.append(f'<rect x="{x:.0f}" y="{ly - 11:.0f}" width="14" height="14" rx="3" fill="{color}"/>')
        out.append(f'<text x="{x + 20:.0f}" y="{ly:.0f}" fill="#CBD2DB" font-size="12">{esc(name)}</text>')

    # section cells
    for key, sec_title, band, col, row, colspan in SECTIONS:
        head_fill, body_tint, head_text = BANDS[band]
        x, y, w, h = cell_rect(col, row, colspan)
        items = content.get(key, [])
        if isinstance(items, str):
            items = [items]

        # body
        out.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" '
            f'rx="9" fill="{body_tint}" stroke="{BORDER}" stroke-width="1"/>'
        )
        # header bar (rounded top only via a rect + a masking rect)
        out.append(
            f'<path d="M{x + 9:.1f},{y:.1f} h{w - 18:.1f} a9,9 0 0 1 9,9 '
            f'v{HEAD_BAR_H - 9} h{-w:.1f} v{-(HEAD_BAR_H - 9)} a9,9 0 0 1 9,-9 z" '
            f'fill="{head_fill}"/>'
        )
        out.append(
            f'<text x="{x + PAD_X:.1f}" y="{y + 22:.1f}" fill="{head_text}" '
            f'font-size="{TITLE_FS}" font-weight="650">{esc(sec_title)}</text>'
        )

        # items
        ty = y + HEAD_BAR_H + 22
        body_bottom = y + h - 12
        max_text_w = w - 2 * PAD_X - 12
        overflow = False
        for item in items:
            lines = wrap(item, ITEM_FS, max_text_w)
            block_h = len(lines) * LINE_H
            if ty + block_h - LINE_H > body_bottom:
                overflow = True
                break
            # bullet
            out.append(
                f'<circle cx="{x + PAD_X + 3:.1f}" cy="{ty - 4:.1f}" r="2.4" fill="{head_fill}"/>'
            )
            for i, line in enumerate(lines):
                out.append(
                    f'<text x="{x + PAD_X + 14:.1f}" y="{ty:.1f}" fill="{INK}" '
                    f'font-size="{ITEM_FS}">{esc(line)}</text>'
                )
                ty += LINE_H
            ty += 4
        if overflow:
            out.append(
                f'<text x="{x + PAD_X:.1f}" y="{body_bottom:.1f}" fill="{MUTED}" '
                f'font-size="12" font-style="italic">…more (trim items to fit)</text>'
            )
        if not items:
            out.append(
                f'<text x="{x + PAD_X:.1f}" y="{y + HEAD_BAR_H + 24:.1f}" fill="{MUTED}" '
                f'font-size="12" font-style="italic">—</text>'
            )

    out.append("</svg>")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser(description="Generate a Software Architecture Canvas SVG.")
    ap.add_argument("spec", help="Path to JSON spec file")
    ap.add_argument("-o", "--out", default="architecture-canvas.svg", help="Output SVG path")
    ap.add_argument("--png", help="Also write a PNG to this path (needs cairosvg)")
    args = ap.parse_args()

    with open(args.spec, "r", encoding="utf-8") as f:
        spec = json.load(f)

    svg = render(spec)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(svg)
    print(f"Wrote {args.out}")

    if args.png:
        try:
            import cairosvg
            cairosvg.svg2png(bytestring=svg.encode("utf-8"), write_to=args.png, scale=2)
            print(f"Wrote {args.png}")
        except ImportError:
            print("PNG skipped: install cairosvg (`pip install cairosvg`) to enable PNG export.",
                  file=sys.stderr)


if __name__ == "__main__":
    main()
