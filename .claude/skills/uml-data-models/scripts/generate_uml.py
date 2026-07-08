#!/usr/bin/env python3
"""
UML class / conceptual data-model diagram generator (pure Python, no draw.io).

Renders UML class diagrams from a JSON spec to SVG (optional PNG via cairosvg).
Intended for conceptual/relational data models: classes (entities) with typed
attributes and key markers (PK/FK/UK), connected by UML relationships
(association, aggregation, composition, generalization, dependency) with
multiplicities and role labels.

Layout is deterministic and tier-based (assign each class a `tier`, 0 = top),
with variable box sizes and UML-correct relationship decorations.

Usage:
    python generate_uml.py spec.json -o out_dir
    python generate_uml.py spec.json -o out_dir --png

One SVG per diagram in the spec's `diagrams` list. Schema: references/uml-class-spec.md
"""

import argparse
import html
import json
import math
import os
import sys

# ---------------------------------------------------------------------------
# Style
# ---------------------------------------------------------------------------

HEADER_FILL = "#DCE6F5"
BODY_FILL = "#FFFFFF"
BORDER = "#5B6B85"
INK = "#1F2A37"
MUTED = "#6B7280"
KEYTAG = "#3E6DB5"
REL = "#4A4F58"

NAME_FS = 15
STEREO_FS = 11
ATTR_FS = 12.5
LINE_H = 18
PAD_X = 12
MIN_W = 148
MAX_W = 300
H_GAP = 74
V_GAP = 92
MARGIN = 52
TITLE_H = 62


def esc(s):
    return html.escape(str(s), quote=True)


def char_w(ch, fs):
    if ch in "iIl.,:;'|!":
        return 0.30 * fs
    if ch in "fjtr()[]-":
        return 0.38 * fs
    if ch in "mwMW":
        return 0.90 * fs
    if ch in "ABCDEFGHKNOPQRSUVXYZ":
        return 0.66 * fs
    if ch == " ":
        return 0.30 * fs
    return 0.55 * fs


def tw(s, fs):
    return sum(char_w(c, fs) for c in str(s))


# ---------------------------------------------------------------------------
# Class sizing
# ---------------------------------------------------------------------------

def attr_text(a):
    vis = {"public": "+", "private": "-", "protected": "#", "package": "~"}.get(a.get("visibility", ""), "")
    t = a["name"]
    if a.get("type"):
        t += f" : {a['type']}"
    return vis, t


def class_size(c):
    stereo = c.get("stereotype")
    header_h = 30 + (16 if stereo else 0)
    attrs = c.get("attributes", [])
    ops = c.get("operations", [])

    widths = [tw(c["name"], NAME_FS) + 24]
    if stereo:
        widths.append(tw(stereo, STEREO_FS) + 20)
    for a in attrs:
        _, t = attr_text(a)
        keytag = a.get("key", "")
        widths.append(tw(t, ATTR_FS) + (tw(keytag, ATTR_FS - 1) + 10 if keytag else 0) + 24)
    for o in ops:
        widths.append(tw(o, ATTR_FS) + 24)
    w = max(MIN_W, min(MAX_W, max(widths)))

    attrs_h = (len(attrs) * LINE_H + 10) if attrs else 12
    ops_h = (len(ops) * LINE_H + 10) if ops else 0
    h = header_h + attrs_h + ops_h
    return w, h, header_h, attrs_h, ops_h


# ---------------------------------------------------------------------------
# Layout (tiered, variable width)
# ---------------------------------------------------------------------------

def layout(diagram):
    classes = diagram["classes"]
    tiers = {}
    for c in classes:
        tiers.setdefault(c.get("tier", 0), []).append(c)
    keys = sorted(tiers)
    for t in keys:
        orig = {id(c): i for i, c in enumerate(tiers[t])}
        tiers[t].sort(key=lambda c: c.get("order", orig[id(c)]))

    sizes = {c["id"]: class_size(c) for c in classes}
    tier_w = {t: sum(sizes[c["id"]][0] for c in tiers[t]) + H_GAP * (len(tiers[t]) - 1) for t in keys}
    tier_h = {t: max(sizes[c["id"]][1] for c in tiers[t]) for t in keys}
    content_w = max(tier_w.values())

    placed = {}
    y = MARGIN + TITLE_H
    for t in keys:
        x = MARGIN + (content_w - tier_w[t]) / 2
        for c in tiers[t]:
            w, h, hh, ah, oh = sizes[c["id"]]
            ny = y + (tier_h[t] - h) / 2
            placed[c["id"]] = {"c": c, "x": x, "y": ny, "w": w, "h": h,
                               "hh": hh, "ah": ah, "oh": oh,
                               "cx": x + w / 2, "cy": ny + h / 2}
            x += w + H_GAP
        y += tier_h[t] + V_GAP
    total_w = content_w + 2 * MARGIN
    total_h = y - V_GAP + MARGIN
    return placed, total_w, total_h


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------

def edge_point(p, tx, ty):
    cx, cy = p["cx"], p["cy"]
    dx, dy = tx - cx, ty - cy
    if dx == 0 and dy == 0:
        return cx, cy
    hw, hh = p["w"] / 2, p["h"] / 2
    s = min(hw / abs(dx) if dx else math.inf, hh / abs(dy) if dy else math.inf)
    return cx + dx * s, cy + dy * s


# ---------------------------------------------------------------------------
# Class rendering
# ---------------------------------------------------------------------------

def render_class(p):
    c = p["c"]
    x, y, w, h, hh, ah = p["x"], p["y"], p["w"], p["h"], p["hh"], p["ah"]
    cx = x + w / 2
    out = []
    # outer box
    out.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" '
               f'fill="{BODY_FILL}" stroke="{BORDER}" stroke-width="1.4" rx="2"/>')
    # header
    out.append(f'<path d="M{x:.1f},{y + 2:.1f} a2,2 0 0 1 2,-2 h{w - 4:.1f} a2,2 0 0 1 2,2 '
               f'v{hh - 2:.1f} h{-w:.1f} z" fill="{HEADER_FILL}" stroke="{BORDER}" stroke-width="1.4"/>')
    ty = y + 18
    if c.get("stereotype"):
        out.append(f'<text x="{cx:.1f}" y="{ty:.1f}" fill="{MUTED}" font-size="{STEREO_FS}" '
                   f'font-style="italic" text-anchor="middle">{esc("«" + c["stereotype"].strip("«»") + "»")}</text>')
        ty += 16
    out.append(f'<text x="{cx:.1f}" y="{ty:.1f}" fill="{INK}" font-size="{NAME_FS}" '
               f'font-weight="700" text-anchor="middle">{esc(c["name"])}</text>')

    # attributes
    ay = y + hh + 16
    for a in c.get("attributes", []):
        vis, t = attr_text(a)
        key = a.get("key", "")
        deco = ' text-decoration="underline"' if key == "PK" else ''
        label = (vis + " " if vis else "") + t
        out.append(f'<text x="{x + PAD_X:.1f}" y="{ay:.1f}" fill="{INK}" '
                   f'font-size="{ATTR_FS}"{deco}>{esc(label)}</text>')
        if key:
            out.append(f'<text x="{x + w - PAD_X:.1f}" y="{ay:.1f}" fill="{KEYTAG}" '
                       f'font-size="{ATTR_FS - 1.5:.0f}" text-anchor="end">{{{esc(key)}}}</text>')
        ay += LINE_H

    # operations compartment
    if c.get("operations"):
        oy = y + hh + ah
        out.append(f'<line x1="{x:.1f}" y1="{oy:.1f}" x2="{x + w:.1f}" y2="{oy:.1f}" '
                   f'stroke="{BORDER}" stroke-width="1.2"/>')
        ly = oy + 16
        for o in c["operations"]:
            out.append(f'<text x="{x + PAD_X:.1f}" y="{ly:.1f}" fill="{INK}" '
                       f'font-size="{ATTR_FS}">{esc(o)}</text>')
            ly += LINE_H
    # attr/op separator already implied by header line; add line under header→attrs
    sep = y + hh
    out.insert(1, f'<line x1="{x:.1f}" y1="{sep:.1f}" x2="{x + w:.1f}" y2="{sep:.1f}" '
                  f'stroke="{BORDER}" stroke-width="1.2"/>')
    return "".join(out)


# ---------------------------------------------------------------------------
# Relationship decorations
# ---------------------------------------------------------------------------

def triangle(px, py, ang):
    L, hw = 14, 8
    bx, by = px - L * math.cos(ang), py - L * math.sin(ang)
    pp = ang + math.pi / 2
    b1 = (bx + hw * math.cos(pp), by + hw * math.sin(pp))
    b2 = (bx - hw * math.cos(pp), by - hw * math.sin(pp))
    return (f'<polygon points="{px:.1f},{py:.1f} {b1[0]:.1f},{b1[1]:.1f} {b2[0]:.1f},{b2[1]:.1f}" '
            f'fill="#FFFFFF" stroke="{REL}" stroke-width="1.4"/>'), (bx, by)


def diamond(px, py, ang, filled):
    d, hw = 9, 6
    c = (px + d * math.cos(ang), py + d * math.sin(ang))
    tin = (px + 2 * d * math.cos(ang), py + 2 * d * math.sin(ang))
    pp = ang + math.pi / 2
    s1 = (c[0] + hw * math.cos(pp), c[1] + hw * math.sin(pp))
    s2 = (c[0] - hw * math.cos(pp), c[1] - hw * math.sin(pp))
    fill = REL if filled else "#FFFFFF"
    return (f'<polygon points="{px:.1f},{py:.1f} {s1[0]:.1f},{s1[1]:.1f} {tin[0]:.1f},{tin[1]:.1f} '
            f'{s2[0]:.1f},{s2[1]:.1f}" fill="{fill}" stroke="{REL}" stroke-width="1.4"/>'), tin


def open_arrow(px, py, ang):
    s = 10
    a1 = (px - s * math.cos(ang - 0.4), py - s * math.sin(ang - 0.4))
    a2 = (px - s * math.cos(ang + 0.4), py - s * math.sin(ang + 0.4))
    return (f'<line x1="{px:.1f}" y1="{py:.1f}" x2="{a1[0]:.1f}" y2="{a1[1]:.1f}" stroke="{REL}" stroke-width="1.4"/>'
            f'<line x1="{px:.1f}" y1="{py:.1f}" x2="{a2[0]:.1f}" y2="{a2[1]:.1f}" stroke="{REL}" stroke-width="1.4"/>')


def mult_label(x, y, ang, text, out):
    if not text:
        return
    pp = ang + math.pi / 2
    ox, oy = x + 12 * math.cos(pp), y + 12 * math.sin(pp)
    out.append(f'<text x="{ox:.1f}" y="{oy + 4:.1f}" fill="{INK}" font-size="11" '
               f'text-anchor="middle">{esc(text)}</text>')


def render_rel(rel, placed, out):
    if rel["from"] not in placed or rel["to"] not in placed:
        return
    a, b = placed[rel["from"]], placed[rel["to"]]
    pf = edge_point(a, b["cx"], b["cy"])
    pt = edge_point(b, a["cx"], a["cy"])
    rtype = rel.get("type", "association")
    dashed = rtype in ("dependency", "realization")
    dash = ' stroke-dasharray="6 4"' if dashed else ''
    # base line
    out.append(f'<line x1="{pf[0]:.1f}" y1="{pf[1]:.1f}" x2="{pt[0]:.1f}" y2="{pt[1]:.1f}" '
               f'stroke="{REL}" stroke-width="1.4"{dash}/>')
    ang_ft = math.atan2(pt[1] - pf[1], pt[0] - pf[0])   # from -> to
    ang_tf = ang_ft + math.pi                            # to -> from

    if rtype in ("generalization", "realization"):
        tri, _ = triangle(pt[0], pt[1], ang_ft)
        out.append(tri)
    elif rtype == "composition":
        dia, _ = diamond(pf[0], pf[1], ang_ft, filled=True)
        out.append(dia)
    elif rtype == "aggregation":
        dia, _ = diamond(pf[0], pf[1], ang_ft, filled=False)
        out.append(dia)
    elif rtype == "dependency" or rel.get("directed"):
        out.append(open_arrow(pt[0], pt[1], ang_ft))

    # multiplicities near each end
    fx, fy = pf[0] + 20 * math.cos(ang_ft), pf[1] + 20 * math.sin(ang_ft)
    txx, tyy = pt[0] + 20 * math.cos(ang_tf), pt[1] + 20 * math.sin(ang_tf)
    mult_label(fx, fy, ang_ft, rel.get("fromMult", ""), out)
    mult_label(txx, tyy, ang_ft, rel.get("toMult", ""), out)

    # relationship label at midpoint
    if rel.get("label"):
        mx, my = (pf[0] + pt[0]) / 2, (pf[1] + pt[1]) / 2
        lw = tw(rel["label"], 11) + 12
        out.append(f'<rect x="{mx - lw / 2:.1f}" y="{my - 9:.1f}" width="{lw:.1f}" height="17" '
                   f'rx="3" fill="#FFFFFF" stroke="#E3E6EA" opacity="0.95"/>')
        out.append(f'<text x="{mx:.1f}" y="{my + 3:.1f}" fill="{INK}" font-size="11" '
                   f'text-anchor="middle">{esc(rel["label"])}</text>')


# ---------------------------------------------------------------------------
# Diagram render
# ---------------------------------------------------------------------------

def render_diagram(d):
    placed, W, H = layout(d)
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="{H:.0f}" '
        f'viewBox="0 0 {W:.0f} {H:.0f}" font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif">',
        f'<rect width="{W:.0f}" height="{H:.0f}" fill="#FFFFFF"/>',
    ]
    out.append(f'<text x="{MARGIN}" y="{MARGIN + 4}" fill="{INK}" font-size="20" '
               f'font-weight="700">{esc(d.get("title", "Class Diagram"))}</text>')
    if d.get("subtitle"):
        out.append(f'<text x="{MARGIN}" y="{MARGIN + 28}" fill="{MUTED}" font-size="13">'
                   f'{esc(d["subtitle"])}</text>')
    # relationships first (under boxes)
    for rel in d.get("relationships", []):
        render_rel(rel, placed, out)
    # classes on top
    for p in placed.values():
        out.append(render_class(p))
    out.append("</svg>")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser(description="Generate UML class diagrams (SVG) from a JSON spec.")
    ap.add_argument("spec")
    ap.add_argument("-o", "--out", default="uml-diagrams")
    ap.add_argument("--png", action="store_true", help="Also export PNG (needs cairosvg)")
    args = ap.parse_args()

    with open(args.spec, encoding="utf-8") as f:
        spec = json.load(f)
    os.makedirs(args.out, exist_ok=True)
    diagrams = spec.get("diagrams", [])
    if not diagrams:
        print("Spec has no 'diagrams'.", file=sys.stderr)
        sys.exit(1)
    for i, d in enumerate(diagrams, 1):
        svg = render_diagram(d)
        base = os.path.join(args.out, f"{i:02d}-{d.get('id', 'diagram')}")
        with open(base + ".svg", "w", encoding="utf-8") as f:
            f.write(svg)
        print(f"Wrote {base}.svg")
        if args.png:
            try:
                import cairosvg
                cairosvg.svg2png(bytestring=svg.encode("utf-8"), write_to=base + ".png", scale=2)
                print(f"Wrote {base}.png")
            except ImportError:
                print("PNG skipped: pip install cairosvg to enable.", file=sys.stderr)


if __name__ == "__main__":
    main()
