#!/usr/bin/env python3
"""
C4 model diagram generator (pure Python, no external layout engine).

Renders C4 diagrams (Context / Container / Component) from a JSON spec to SVG,
with optional PNG export via cairosvg. Layout is deterministic and tier-based:
you assign each box a `tier` (0 = top) and the script places tiers top-to-bottom,
groups boundaries, and routes labeled arrows between box edges.

This trades a little manual placement for zero dependencies and clean, consistent
output — well suited to the small graphs typical of C4 levels 1-3.

Usage:
    python generate_c4.py spec.json -o out_dir
    python generate_c4.py spec.json -o out_dir --png

See references/c4-spec.md for the schema. One SVG is written per diagram in the
spec's `diagrams` list, named `<NN>-<id>.svg`.
"""

import argparse
import html
import json
import math
import os
import sys

# ---------------------------------------------------------------------------
# Style — official C4 palette (matches C4-PlantUML defaults)
# ---------------------------------------------------------------------------

STYLES = {
    "person":        {"fill": "#08427B", "stroke": "#052E56", "text": "#FFFFFF", "kind": "person"},
    "person_ext":    {"fill": "#686868", "stroke": "#4D4D4D", "text": "#FFFFFF", "kind": "person"},
    "system":        {"fill": "#1168BD", "stroke": "#0B4884", "text": "#FFFFFF", "kind": "box"},
    "system_ext":    {"fill": "#999999", "stroke": "#6B6B6B", "text": "#FFFFFF", "kind": "box"},
    "container":     {"fill": "#438DD5", "stroke": "#2E6295", "text": "#FFFFFF", "kind": "box"},
    "container_db":  {"fill": "#438DD5", "stroke": "#2E6295", "text": "#FFFFFF", "kind": "db"},
    "container_queue": {"fill": "#438DD5", "stroke": "#2E6295", "text": "#FFFFFF", "kind": "box"},
    "component":     {"fill": "#85BBF0", "stroke": "#5A9BD4", "text": "#0A2540", "kind": "box"},
    "component_db":  {"fill": "#85BBF0", "stroke": "#5A9BD4", "text": "#0A2540", "kind": "db"},
}
TYPE_TAG = {
    "person": "Person", "person_ext": "External Person",
    "system": "Software System", "system_ext": "External System",
    "container": "Container", "container_db": "Container", "container_queue": "Container",
    "component": "Component", "component_db": "Component",
}

INK = "#333333"
BOUNDARY_STROKE = "#7A7F87"
BOUNDARY_LABEL = "#5A6068"
REL_COLOR = "#707680"

BOX_W = 210
BOX_MIN_H = 92
H_GAP = 56          # gap between boxes in a tier
V_GAP = 118         # gap between tiers (row pitch is box_h + V_GAP)
MARGIN = 56
TITLE_H = 66
BOUNDARY_PAD = 26
BOUNDARY_TOP = 30   # extra top room inside a boundary for its label

NAME_FS = 15
META_FS = 11
DESC_FS = 12
REL_FS = 11
LINE_H = 16


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------

def esc(s):
    return html.escape(str(s), quote=True)


def char_w(ch, fs):
    if ch in "iIl.,:;'|!":
        return 0.28 * fs
    if ch in "fjtr()[]-":
        return 0.36 * fs
    if ch in "mwMW":
        return 0.88 * fs
    if ch in "ABCDEFGHKNOPQRSUVXYZ":
        return 0.66 * fs
    if ch == " ":
        return 0.30 * fs
    return 0.53 * fs


def wrap(text, fs, max_w, max_lines=None):
    words = str(text).split()
    lines, cur = [], ""
    for w in words:
        trial = w if not cur else cur + " " + w
        if sum(char_w(c, fs) for c in trial) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    if max_lines and len(lines) > max_lines:
        lines = lines[:max_lines]
        last = lines[-1]
        while last and sum(char_w(c, fs) for c in last + "…") > max_w:
            last = last[:-1]
        lines[-1] = last + "…"
    return lines or [""]


def text_w(s, fs):
    return sum(char_w(c, fs) for c in str(s))


# ---------------------------------------------------------------------------
# Layout
# ---------------------------------------------------------------------------

def box_height(node):
    """Compute a box's height from its wrapped content."""
    inner_w = BOX_W - 24
    name_lines = wrap(node["name"], NAME_FS, inner_w, 2)
    desc_lines = wrap(node.get("desc", ""), DESC_FS, inner_w, 3) if node.get("desc") else []
    h = 14 + len(name_lines) * (LINE_H + 2) + 16  # name + meta tag
    if desc_lines:
        h += len(desc_lines) * LINE_H + 4
    return max(BOX_MIN_H, h)


def layout(diagram):
    nodes = diagram["nodes"]
    # group by tier
    tiers = {}
    for n in nodes:
        tiers.setdefault(n.get("tier", 0), []).append(n)
    tier_keys = sorted(tiers.keys())
    # preserve given order within a tier, allow optional "order"
    for t in tier_keys:
        orig = {id(n): i for i, n in enumerate(tiers[t])}
        tiers[t].sort(key=lambda n: n.get("order", orig[id(n)]))

    # heights per tier
    tier_h = {t: max(box_height(n) for n in tiers[t]) for t in tier_keys}

    # y positions
    y = MARGIN + TITLE_H
    # reserve top boundary padding if any node in tier has a boundary
    tier_y = {}
    for t in tier_keys:
        tier_y[t] = y
        y += tier_h[t] + V_GAP
    total_h = y - V_GAP + MARGIN

    # widths per tier and x positions (centered)
    tier_width = {t: len(tiers[t]) * BOX_W + (len(tiers[t]) - 1) * H_GAP for t in tier_keys}
    content_w = max(tier_width.values())
    total_w = content_w + 2 * MARGIN

    placed = {}
    for t in tier_keys:
        row = tiers[t]
        start_x = MARGIN + (content_w - tier_width[t]) / 2
        x = start_x
        for n in row:
            h = box_height(n)
            # vertically center within the tier's tallest box
            ny = tier_y[t] + (tier_h[t] - h) / 2
            placed[n["id"]] = {
                "node": n, "x": x, "y": ny, "w": BOX_W, "h": h,
                "cx": x + BOX_W / 2, "cy": ny + h / 2,
            }
            x += BOX_W + H_GAP

    return placed, total_w, total_h, tier_y, tier_h, tier_keys


def boundary_rects(diagram, placed):
    """Compute bounding rects for each declared boundary from its member nodes."""
    rects = []
    for b in diagram.get("boundaries", []):
        members = [p for p in placed.values() if p["node"].get("boundary") == b["id"]]
        if not members:
            continue
        x0 = min(m["x"] for m in members) - BOUNDARY_PAD
        y0 = min(m["y"] for m in members) - BOUNDARY_PAD - BOUNDARY_TOP
        x1 = max(m["x"] + m["w"] for m in members) + BOUNDARY_PAD
        y1 = max(m["y"] + m["h"] for m in members) + BOUNDARY_PAD
        rects.append({"b": b, "x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0})
    return rects


# ---------------------------------------------------------------------------
# Geometry for arrows
# ---------------------------------------------------------------------------

def edge_point(p, tx, ty):
    """Point where the line from p's center to (tx,ty) meets p's border."""
    cx, cy = p["cx"], p["cy"]
    dx, dy = tx - cx, ty - cy
    if dx == 0 and dy == 0:
        return cx, cy
    hw, hh = p["w"] / 2, p["h"] / 2
    sx = hw / abs(dx) if dx else math.inf
    sy = hh / abs(dy) if dy else math.inf
    s = min(sx, sy)
    return cx + dx * s, cy + dy * s


def arrow_svg(x1, y1, x2, y2, color):
    ang = math.atan2(y2 - y1, x2 - x1)
    size = 9
    a1 = (x2 - size * math.cos(ang - 0.42), y2 - size * math.sin(ang - 0.42))
    a2 = (x2 - size * math.cos(ang + 0.42), y2 - size * math.sin(ang + 0.42))
    line = (f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
            f'stroke="{color}" stroke-width="1.6"/>')
    head = (f'<polygon points="{x2:.1f},{y2:.1f} {a1[0]:.1f},{a1[1]:.1f} '
            f'{a2[0]:.1f},{a2[1]:.1f}" fill="{color}"/>')
    return line + head


# ---------------------------------------------------------------------------
# Node rendering
# ---------------------------------------------------------------------------

def render_person(p, st):
    x, y, w, h = p["x"], p["y"], p["w"], p["h"]
    out = []
    r = 15
    hx, hy = x + w / 2, y + r + 4
    out.append(f'<circle cx="{hx:.1f}" cy="{hy:.1f}" r="{r}" fill="{st["fill"]}" stroke="{st["stroke"]}"/>')
    body_y = hy + r - 2
    out.append(
        f'<rect x="{x:.1f}" y="{body_y:.1f}" width="{w}" height="{y + h - body_y:.1f}" '
        f'rx="14" fill="{st["fill"]}" stroke="{st["stroke"]}"/>'
    )
    out += text_block(p, st, top=body_y + 8, height=(y + h - body_y - 8))
    return "".join(out)


def render_db(p, st):
    x, y, w, h = p["x"], p["y"], p["w"], p["h"]
    ry = 12
    out = [
        f'<path d="M{x:.1f},{y + ry:.1f} '
        f'C{x:.1f},{y - 4:.1f} {x + w:.1f},{y - 4:.1f} {x + w:.1f},{y + ry:.1f} '
        f'V{y + h - ry:.1f} '
        f'C{x + w:.1f},{y + h + 4:.1f} {x:.1f},{y + h + 4:.1f} {x:.1f},{y + h - ry:.1f} Z" '
        f'fill="{st["fill"]}" stroke="{st["stroke"]}"/>',
        f'<path d="M{x:.1f},{y + ry:.1f} '
        f'C{x:.1f},{y + 2 * ry + 4:.1f} {x + w:.1f},{y + 2 * ry + 4:.1f} {x + w:.1f},{y + ry:.1f}" '
        f'fill="none" stroke="{st["stroke"]}" opacity="0.7"/>',
    ]
    out += text_block(p, st, top=y + 2 * ry + 6, height=h - 2 * ry - 10)
    return "".join(out)


def render_box(p, st):
    x, y, w, h = p["x"], p["y"], p["w"], p["h"]
    out = [f'<rect x="{x:.1f}" y="{y:.1f}" width="{w}" height="{h}" rx="6" '
           f'fill="{st["fill"]}" stroke="{st["stroke"]}"/>']
    out += text_block(p, st, top=y + 10, height=h - 10)
    return "".join(out)


def text_block(p, st, top, height):
    n = p["node"]
    x, w = p["x"], p["w"]
    cx = x + w / 2
    inner = w - 24
    color = st["text"]
    out = []
    ty = top + NAME_FS
    for line in wrap(n["name"], NAME_FS, inner, 2):
        out.append(f'<text x="{cx:.1f}" y="{ty:.1f}" fill="{color}" font-size="{NAME_FS}" '
                   f'font-weight="700" text-anchor="middle">{esc(line)}</text>')
        ty += LINE_H + 2
    tag = TYPE_TAG.get(n["type"], "")
    tech = n.get("tech", "")
    meta = f"[{tag}: {tech}]" if tech else f"[{tag}]"
    out.append(f'<text x="{cx:.1f}" y="{ty:.1f}" fill="{color}" font-size="{META_FS}" '
               f'opacity="0.9" font-style="italic" text-anchor="middle">{esc(meta)}</text>')
    ty += LINE_H
    if n.get("desc"):
        for line in wrap(n["desc"], DESC_FS, inner, 3):
            out.append(f'<text x="{cx:.1f}" y="{ty:.1f}" fill="{color}" font-size="{DESC_FS}" '
                       f'opacity="0.95" text-anchor="middle">{esc(line)}</text>')
            ty += LINE_H
    return out


def render_node(p):
    st = STYLES.get(p["node"]["type"], STYLES["container"])
    if st["kind"] == "person":
        return render_person(p, st)
    if st["kind"] == "db":
        return render_db(p, st)
    return render_box(p, st)


# ---------------------------------------------------------------------------
# Diagram rendering
# ---------------------------------------------------------------------------

def render_diagram(diagram):
    placed, W, H, *_ = layout(diagram)
    bounds = boundary_rects(diagram, placed)

    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="{H:.0f}" '
        f'viewBox="0 0 {W:.0f} {H:.0f}" '
        f'font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif">',
        f'<rect width="{W:.0f}" height="{H:.0f}" fill="#FFFFFF"/>',
    ]

    # title + subtitle
    title = diagram.get("title", "C4 Diagram")
    out.append(f'<text x="{MARGIN}" y="{MARGIN + 8}" fill="{INK}" font-size="21" '
               f'font-weight="700">{esc(title)}</text>')
    if diagram.get("subtitle"):
        out.append(f'<text x="{MARGIN}" y="{MARGIN + 32}" fill="#6B7280" font-size="13">'
                   f'{esc(diagram["subtitle"])}</text>')

    # boundaries (behind nodes)
    for b in bounds:
        out.append(
            f'<rect x="{b["x"]:.1f}" y="{b["y"]:.1f}" width="{b["w"]:.1f}" height="{b["h"]:.1f}" '
            f'rx="10" fill="none" stroke="{BOUNDARY_STROKE}" stroke-width="1.4" '
            f'stroke-dasharray="7 5"/>'
        )
        blabel = b["b"].get("label", "")
        btype = b["b"].get("type", "")
        btag = "[System]" if btype == "system" else ("[Container]" if btype == "container" else "")
        out.append(f'<text x="{b["x"] + 14:.1f}" y="{b["y"] + 20:.1f}" fill="{BOUNDARY_LABEL}" '
                   f'font-size="13" font-weight="600">{esc(blabel)} '
                   f'<tspan font-weight="400" font-style="italic">{esc(btag)}</tspan></text>')

    # relationships (behind nodes so arrowheads meet borders cleanly)
    rel_layer, label_layer = [], []
    for rel in diagram.get("rels", []):
        if rel["from"] not in placed or rel["to"] not in placed:
            continue
        a, b = placed[rel["from"]], placed[rel["to"]]
        x1, y1 = edge_point(a, b["cx"], b["cy"])
        x2, y2 = edge_point(b, a["cx"], a["cy"])
        color = REL_COLOR
        dash = ' stroke-dasharray="6 4"' if rel.get("style") == "dashed" else ""
        ang = math.atan2(y2 - y1, x2 - x1)
        size = 9
        a1 = (x2 - size * math.cos(ang - 0.42), y2 - size * math.sin(ang - 0.42))
        a2 = (x2 - size * math.cos(ang + 0.42), y2 - size * math.sin(ang + 0.42))
        rel_layer.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
                         f'stroke="{color}" stroke-width="1.6"{dash}/>')
        rel_layer.append(f'<polygon points="{x2:.1f},{y2:.1f} {a1[0]:.1f},{a1[1]:.1f} '
                         f'{a2[0]:.1f},{a2[1]:.1f}" fill="{color}"/>')
        # label at midpoint with white background
        label = rel.get("label", "")
        if label:
            tech = rel.get("tech", "")
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            lines = wrap(label, REL_FS, 150, 2)
            if tech:
                lines.append(f"[{tech}]")
            lw = max(text_w(l, REL_FS) for l in lines) + 12
            lh = len(lines) * (LINE_H - 2) + 8
            label_layer.append(f'<rect x="{mx - lw / 2:.1f}" y="{my - lh / 2:.1f}" '
                              f'width="{lw:.1f}" height="{lh:.1f}" rx="4" fill="#FFFFFF" '
                              f'stroke="#E3E6EA" opacity="0.95"/>')
            ly = my - lh / 2 + REL_FS + 2
            for i, l in enumerate(lines):
                style = ' font-style="italic" opacity="0.8"' if (tech and i == len(lines) - 1) else ''
                label_layer.append(f'<text x="{mx:.1f}" y="{ly:.1f}" fill="{INK}" '
                                  f'font-size="{REL_FS}" text-anchor="middle"{style}>{esc(l)}</text>')
                ly += LINE_H - 2

    out += rel_layer
    # nodes on top of arrows
    for p in placed.values():
        out.append(render_node(p))
    out += label_layer  # labels above everything for legibility

    out.append("</svg>")
    return "\n".join(out)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="Generate C4 diagrams (SVG) from a JSON spec.")
    ap.add_argument("spec", help="Path to JSON spec")
    ap.add_argument("-o", "--out", default="c4-diagrams", help="Output directory")
    ap.add_argument("--png", action="store_true", help="Also export PNG (needs cairosvg)")
    args = ap.parse_args()

    with open(args.spec, encoding="utf-8") as f:
        spec = json.load(f)

    os.makedirs(args.out, exist_ok=True)
    diagrams = spec.get("diagrams", [])
    if not diagrams:
        print("Spec has no 'diagrams'.", file=sys.stderr)
        sys.exit(1)

    written = []
    for i, d in enumerate(diagrams, 1):
        svg = render_diagram(d)
        base = os.path.join(args.out, f"{i:02d}-{d.get('id', 'diagram')}")
        with open(base + ".svg", "w", encoding="utf-8") as f:
            f.write(svg)
        print(f"Wrote {base}.svg")
        written.append(base + ".svg")
        if args.png:
            try:
                import cairosvg
                cairosvg.svg2png(bytestring=svg.encode("utf-8"),
                                 write_to=base + ".png", scale=2)
                print(f"Wrote {base}.png")
            except ImportError:
                print("PNG skipped: pip install cairosvg to enable.", file=sys.stderr)
    return written


if __name__ == "__main__":
    main()
