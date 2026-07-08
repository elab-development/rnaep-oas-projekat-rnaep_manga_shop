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
# Style — neo-brutalist house style (ADR-0014, tokens in tools/diagram-brand).
# White chassis + screentone dots, thick ink borders, hard zero-blur offset
# shadows, sharp (zero-radius) corners, Space Grotesk (heavy, UPPERCASE)
# headings, Space Mono body, and the closed accent set. Render the emitted SVG
# through tools/diagram-brand/render.mjs so the fonts embed and rasterize right.
# ---------------------------------------------------------------------------

INK = "#18181B"
PAPER = "#FFFFFF"
MUTED = "#6B7280"
DOTS = "#18181B"
KEYTAG = "#18181B"
REL = "#18181B"

# Closed accent set (brand.json). Header bars pick from these; `on` is the text
# colour that stays legible on that fill.
ACCENTS = {
    "yellow": ("#F4C518", "#000000"),
    "green": ("#2FC06E", "#000000"),
    "blue": ("#3457DD", "#FFFFFF"),
    "red": ("#E03127", "#FFFFFF"),
    "grey": ("#D4D4D8", "#000000"),
}
ACCENT_CYCLE = ["yellow", "blue", "green", "grey", "red"]

HEAD_FONT = "'Space Grotesk', 'Arial Narrow', sans-serif"
MONO_FONT = "'Space Mono', 'DejaVu Sans Mono', 'Courier New', monospace"

BORDER = 3          # box border width
SHADOW = 7          # hard offset shadow distance

NAME_FS = 15
STEREO_FS = 10
ATTR_FS = 12.5
LINE_H = 19
PAD_X = 12
MIN_W = 168
MAX_W = 320
H_GAP = 84
V_GAP = 104
MARGIN = 56
TITLE_H = 74


def esc(s):
    return html.escape(str(s), quote=True)


# Space Grotesk (uppercase headings) — narrow; approximate per-glyph advance.
def char_w(ch, fs):
    if ch in "iIl.,:;'|!":
        return 0.32 * fs
    if ch in "fjtr()[]{}-":
        return 0.42 * fs
    if ch in "mwMW":
        return 0.86 * fs
    if ch in "ABCDEFGHKNOPQRSUVXYZ":
        return 0.64 * fs
    if ch == " ":
        return 0.30 * fs
    return 0.56 * fs


def tw(s, fs):
    return sum(char_w(c, fs) for c in str(s))


# Space Mono body — monospaced; every glyph is ~0.60em.
def mtw(s, fs):
    return 0.60 * fs * len(str(s))


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
    header_h = 34 + (15 if stereo else 0)
    attrs = c.get("attributes", [])
    ops = c.get("operations", [])

    widths = [tw(c["name"].upper(), NAME_FS) + 28]
    if stereo:
        widths.append(tw(("«" + stereo.strip("«»") + "»").upper(), STEREO_FS) + 24)
    for a in attrs:
        _, t = attr_text(a)
        keytag = a.get("key", "")
        widths.append(mtw(t, ATTR_FS) + (mtw("{" + keytag + "}", ATTR_FS - 1) + 12 if keytag else 0) + 2 * PAD_X + 8)
    for o in ops:
        widths.append(mtw(o, ATTR_FS) + 2 * PAD_X)
    w = max(MIN_W, min(MAX_W, max(widths)))

    attrs_h = (len(attrs) * LINE_H + 12) if attrs else 14
    ops_h = (len(ops) * LINE_H + 12) if ops else 0
    h = header_h + attrs_h + ops_h
    return w, h, header_h, attrs_h, ops_h


# ---------------------------------------------------------------------------
# Layout (tiered, variable width)
# ---------------------------------------------------------------------------

def layout(diagram, min_content_w=0):
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
    content_w = max(max(tier_w.values()), min_content_w)

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
    accent, on_accent = ACCENTS.get(c.get("accent", "grey"), ACCENTS["grey"])
    bi = BORDER
    out = []
    # hard offset shadow + white chassis with thick ink border, sharp corners
    out.append(f'<rect x="{x + SHADOW:.1f}" y="{y + SHADOW:.1f}" width="{w:.1f}" '
               f'height="{h:.1f}" fill="{INK}"/>')
    out.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" '
               f'fill="{PAPER}" stroke="{INK}" stroke-width="{bi}"/>')
    # accent header bar, flush inside the border
    out.append(f'<rect x="{x + bi:.1f}" y="{y + bi:.1f}" width="{w - 2 * bi:.1f}" '
               f'height="{hh - bi:.1f}" fill="{accent}"/>')
    # ink divider under the header
    out.append(f'<rect x="{x:.1f}" y="{y + hh:.1f}" width="{w:.1f}" height="{bi}" fill="{INK}"/>')

    ty = y + bi + 16
    if c.get("stereotype"):
        out.append(f'<text x="{cx:.1f}" y="{ty:.1f}" fill="{on_accent}" opacity="0.75" '
                   f'font-family="{HEAD_FONT}" font-size="{STEREO_FS}" font-weight="700" '
                   f'letter-spacing="0.5" text-anchor="middle">'
                   f'{esc(("«" + c["stereotype"].strip("«»") + "»").upper())}</text>')
        ty += 15
    out.append(f'<text x="{cx:.1f}" y="{ty:.1f}" fill="{on_accent}" '
               f'font-family="{HEAD_FONT}" font-size="{NAME_FS}" font-weight="700" '
               f'letter-spacing="0.6" text-anchor="middle">{esc(c["name"].upper())}</text>')

    # attributes (Space Mono); PK underlined; key tags right-aligned in ink
    ay = y + hh + 18
    for a in c.get("attributes", []):
        vis, t = attr_text(a)
        key = a.get("key", "")
        deco = ' text-decoration="underline"' if key == "PK" else ''
        label = (vis + " " if vis else "") + t
        out.append(f'<text x="{x + PAD_X:.1f}" y="{ay:.1f}" fill="{INK}" '
                   f'font-family="{MONO_FONT}" font-size="{ATTR_FS}"{deco}>{esc(label)}</text>')
        if key:
            out.append(f'<text x="{x + w - PAD_X:.1f}" y="{ay:.1f}" fill="{KEYTAG}" '
                       f'font-family="{MONO_FONT}" font-weight="700" '
                       f'font-size="{ATTR_FS - 1.5:.0f}" text-anchor="end">{{{esc(key)}}}</text>')
        ay += LINE_H

    # operations compartment
    if c.get("operations"):
        oy = y + hh + ah
        out.append(f'<rect x="{x:.1f}" y="{oy:.1f}" width="{w:.1f}" height="{bi - 1}" fill="{INK}"/>')
        ly = oy + 18
        for o in c["operations"]:
            out.append(f'<text x="{x + PAD_X:.1f}" y="{ly:.1f}" fill="{INK}" '
                       f'font-family="{MONO_FONT}" font-size="{ATTR_FS}">{esc(o)}</text>')
            ly += LINE_H
    return "".join(out)


# ---------------------------------------------------------------------------
# Relationship decorations
# ---------------------------------------------------------------------------

def triangle(px, py, ang):
    L, hw = 16, 9
    bx, by = px - L * math.cos(ang), py - L * math.sin(ang)
    pp = ang + math.pi / 2
    b1 = (bx + hw * math.cos(pp), by + hw * math.sin(pp))
    b2 = (bx - hw * math.cos(pp), by - hw * math.sin(pp))
    return (f'<polygon points="{px:.1f},{py:.1f} {b1[0]:.1f},{b1[1]:.1f} {b2[0]:.1f},{b2[1]:.1f}" '
            f'fill="{PAPER}" stroke="{INK}" stroke-width="2.4" stroke-linejoin="miter"/>'), (bx, by)


def diamond(px, py, ang, filled):
    d, hw = 10, 6.5
    c = (px + d * math.cos(ang), py + d * math.sin(ang))
    tin = (px + 2 * d * math.cos(ang), py + 2 * d * math.sin(ang))
    pp = ang + math.pi / 2
    s1 = (c[0] + hw * math.cos(pp), c[1] + hw * math.sin(pp))
    s2 = (c[0] - hw * math.cos(pp), c[1] - hw * math.sin(pp))
    fill = INK if filled else PAPER
    return (f'<polygon points="{px:.1f},{py:.1f} {s1[0]:.1f},{s1[1]:.1f} {tin[0]:.1f},{tin[1]:.1f} '
            f'{s2[0]:.1f},{s2[1]:.1f}" fill="{fill}" stroke="{INK}" stroke-width="2.4" '
            f'stroke-linejoin="miter"/>'), tin


def open_arrow(px, py, ang):
    s = 12
    a1 = (px - s * math.cos(ang - 0.4), py - s * math.sin(ang - 0.4))
    a2 = (px - s * math.cos(ang + 0.4), py - s * math.sin(ang + 0.4))
    return (f'<line x1="{px:.1f}" y1="{py:.1f}" x2="{a1[0]:.1f}" y2="{a1[1]:.1f}" stroke="{INK}" stroke-width="2.4"/>'
            f'<line x1="{px:.1f}" y1="{py:.1f}" x2="{a2[0]:.1f}" y2="{a2[1]:.1f}" stroke="{INK}" stroke-width="2.4"/>')


def mult_label(x, y, ang, text, out):
    if not text:
        return
    pp = ang + math.pi / 2
    ox, oy = x + 13 * math.cos(pp), y + 13 * math.sin(pp)
    out.append(f'<text x="{ox:.1f}" y="{oy + 4:.1f}" fill="{INK}" '
               f'font-family="{MONO_FONT}" font-weight="700" font-size="11" '
               f'text-anchor="middle">{esc(text)}</text>')


def render_rel(rel, placed, out):
    """Emit the line + decorations + multiplicities into `out`; return the
    relationship-label geometry (or None) so a declutter pass can place the
    chips on top of everything without overlaps."""
    if rel["from"] not in placed or rel["to"] not in placed:
        return None
    a, b = placed[rel["from"]], placed[rel["to"]]
    pf = edge_point(a, b["cx"], b["cy"])
    pt = edge_point(b, a["cx"], a["cy"])
    rtype = rel.get("type", "association")
    dashed = rtype in ("dependency", "realization")
    dash = ' stroke-dasharray="7 5"' if dashed else ''
    # base line
    out.append(f'<line x1="{pf[0]:.1f}" y1="{pf[1]:.1f}" x2="{pt[0]:.1f}" y2="{pt[1]:.1f}" '
               f'stroke="{INK}" stroke-width="2.4"{dash}/>')
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

    # relationship label at midpoint — returned for decluttering, drawn last
    if rel.get("label"):
        mx, my = (pf[0] + pt[0]) / 2, (pf[1] + pt[1]) / 2
        lw = mtw(rel["label"], 11) + 14
        return {"text": rel["label"], "cx": mx, "cy": my, "w": lw, "h": 20}
    return None


def emit_label(lbl):
    x, y = lbl["cx"] - lbl["w"] / 2, lbl["cy"] - lbl["h"] / 2
    return (f'<rect x="{x:.1f}" y="{y:.1f}" width="{lbl["w"]:.1f}" height="{lbl["h"]:.1f}" '
            f'fill="{PAPER}" stroke="{INK}" stroke-width="2"/>'
            f'<text x="{lbl["cx"]:.1f}" y="{lbl["cy"] + 4:.1f}" fill="{INK}" '
            f'font-family="{MONO_FONT}" font-size="11" text-anchor="middle">{esc(lbl["text"])}</text>')


def declutter(labels, obstacles, W, H):
    """Nudge label chips vertically off each other and off the class boxes.
    `obstacles` (the boxes) are fixed; chips move until they clear everything."""
    def overlaps(a, b, pad):
        return (abs(a["cx"] - b["cx"]) * 2 < a["w"] + b["w"] + pad and
                abs(a["cy"] - b["cy"]) * 2 < a["h"] + b["h"] + pad)

    placed = list(obstacles)
    for lbl in labels:
        for _ in range(60):
            hit = next((p for p in placed
                        if overlaps(lbl, p, 10 if p.get("box") else 6)), None)
            if not hit:
                break
            step = lbl["h"] + 4
            lbl["cy"] += step if lbl["cy"] >= hit["cy"] else -step
        lbl["cy"] = max(lbl["h"], min(H - lbl["h"], lbl["cy"]))
        placed.append(lbl)


# ---------------------------------------------------------------------------
# Diagram render
# ---------------------------------------------------------------------------

def render_diagram(d):
    title = d.get("title", "Class Diagram").upper()
    subtitle = d.get("subtitle", "")
    # canvas must be wide enough for the heading (letter-spacing ~0.8) and subtitle
    min_content_w = max(tw(title, 24) + 0.8 * len(title),
                        mtw(subtitle, 12.5)) if title else 0
    placed, W, H = layout(d, min_content_w)
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W:.0f}" height="{H:.0f}" '
        f'viewBox="0 0 {W:.0f} {H:.0f}">',
        '<defs><pattern id="dots" width="12" height="12" patternUnits="userSpaceOnUse">'
        f'<circle cx="1.1" cy="1.1" r="1.1" fill="{DOTS}" fill-opacity="0.08"/>'
        '</pattern></defs>',
        f'<rect width="{W:.0f}" height="{H:.0f}" fill="{PAPER}"/>',
        f'<rect width="{W:.0f}" height="{H:.0f}" fill="url(#dots)"/>',
    ]
    out.append(f'<text x="{MARGIN}" y="{MARGIN + 4}" fill="{INK}" '
               f'font-family="{HEAD_FONT}" font-size="24" font-weight="700" '
               f'letter-spacing="0.8">{esc(title)}</text>')
    out.append(f'<rect x="{MARGIN}" y="{MARGIN + 12}" width="120" height="6" fill="{ACCENTS["yellow"][0]}"/>')
    if subtitle:
        out.append(f'<text x="{MARGIN}" y="{MARGIN + 38}" fill="{MUTED}" '
                   f'font-family="{MONO_FONT}" font-size="12.5">{esc(subtitle)}</text>')
    # relationship lines + decorations under the boxes; labels collected for declutter
    labels = []
    for rel in d.get("relationships", []):
        lbl = render_rel(rel, placed, out)
        if lbl:
            labels.append(lbl)
    # classes on top
    for p in placed.values():
        out.append(render_class(p))
    # relationship label chips last, decluttered off both peers and boxes
    obstacles = [{"cx": p["cx"], "cy": p["cy"], "w": p["w"], "h": p["h"], "box": True}
                 for p in placed.values()]
    declutter(labels, obstacles, W, H)
    for lbl in labels:
        out.append(emit_label(lbl))
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
