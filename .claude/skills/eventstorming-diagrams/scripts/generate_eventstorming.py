#!/usr/bin/env python3
"""
EventStorming diagram generator (pure Python, no external tools — no draw.io).

Renders EventStorming boards from a JSON spec to SVG (optional PNG via cairosvg).
Follows Alberto Brandolini's colour grammar and a left-to-right timeline:

    Actor (yellow) -> Command (blue) -> Aggregate (pale yellow)
        -> Domain Event (orange, the chronological backbone)
        -> Policy (purple) -> triggers the next Command
    Read Models (green) and External Systems (pink) attach where relevant;
    Hotspots (red) flag open questions.

Consecutive steps that share an aggregate are merged into one spanning
aggregate sticky — that IS the "grouping into aggregates".

Usage:
    python generate_eventstorming.py spec.json -o out_dir
    python generate_eventstorming.py spec.json -o out_dir --png

One SVG is written per diagram in the spec's `diagrams` list. See
references/eventstorming-spec.md for the schema.
"""

import argparse
import html
import json
import os
import sys

# ---------------------------------------------------------------------------
# EventStorming colour grammar
# ---------------------------------------------------------------------------

ROLE = {
    "actor":      {"fill": "#FFD54A", "stroke": "#E0AF17", "text": "#3A2F00", "label": "Actor / User"},
    "command":    {"fill": "#6FB1EC", "stroke": "#3E86C9", "text": "#08243F", "label": "Command"},
    "aggregate":  {"fill": "#FFF0B3", "stroke": "#E0C05B", "text": "#4A3B00", "label": "Aggregate"},
    "event":      {"fill": "#FF9E42", "stroke": "#E07A16", "text": "#3A1D00", "label": "Domain Event"},
    "policy":     {"fill": "#C9A9E9", "stroke": "#9C6FCB", "text": "#2E1A47", "label": "Policy"},
    "read_model": {"fill": "#A8D98A", "stroke": "#6FB04C", "text": "#173A08", "label": "Read Model"},
    "external":   {"fill": "#F6A9C4", "stroke": "#DB6E96", "text": "#4A0A26", "label": "External System"},
    "hotspot":    {"fill": "#FF6B6B", "stroke": "#D63B3B", "text": "#FFFFFF", "label": "Hotspot"},
}
# top-to-bottom band order
ORDER = ["actor", "command", "aggregate", "event", "policy", "read_model", "external", "hotspot"]

INK = "#2B2F36"
MUTED = "#6B7280"
CHAIN = "#B4B9C1"          # vertical grammar connectors
BACKBONE = "#D07C1E"       # chronological event->event arrows
POLICY_LINK = "#9C6FCB"    # policy -> next command (dashed)

STICKY_W = 160
COL_GAP = 34
MIN_H = 62
ROW_GAP = 48
MARGIN = 48
HEADER_H = 104
PAD = 12
FS = 13
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
        return 0.64 * fs
    if ch == " ":
        return 0.30 * fs
    return 0.53 * fs


def wrap(text, fs, max_w, max_lines=4):
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
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        last = lines[-1]
        while last and sum(char_w(c, fs) for c in last + "…") > max_w:
            last = last[:-1]
        lines[-1] = last + "…"
    return lines or [""]


def sticky_h(text, w):
    lines = wrap(text, FS, w - 2 * PAD)
    return max(MIN_H, 2 * PAD + len(lines) * LINE_H)


# ---------------------------------------------------------------------------
# Rendering primitives
# ---------------------------------------------------------------------------

def sticky(x, y, w, h, role, text):
    st = ROLE[role]
    out = []
    # drop shadow
    out.append(f'<rect x="{x + 2.5:.1f}" y="{y + 3:.1f}" width="{w:.1f}" height="{h:.1f}" '
               f'rx="4" fill="#000000" opacity="0.10"/>')
    out.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="4" '
               f'fill="{st["fill"]}" stroke="{st["stroke"]}" stroke-width="1.2"/>')
    lines = wrap(text, FS, w - 2 * PAD)
    ty = y + h / 2 - (len(lines) - 1) * LINE_H / 2 + FS / 2 - 1
    cx = x + w / 2
    for ln in lines:
        out.append(f'<text x="{cx:.1f}" y="{ty:.1f}" fill="{st["text"]}" font-size="{FS}" '
                   f'text-anchor="middle">{esc(ln)}</text>')
        ty += LINE_H
    return "".join(out)


def vline(x, y1, y2, color=CHAIN, dash=False):
    d = ' stroke-dasharray="4 4"' if dash else ''
    return f'<line x1="{x:.1f}" y1="{y1:.1f}" x2="{x:.1f}" y2="{y2:.1f}" stroke="{color}" stroke-width="1.4"{d}/>'


def arrow(x1, y1, x2, y2, color, dash=False):
    import math
    ang = math.atan2(y2 - y1, x2 - x1)
    s = 8
    a1 = (x2 - s * math.cos(ang - 0.45), y2 - s * math.sin(ang - 0.45))
    a2 = (x2 - s * math.cos(ang + 0.45), y2 - s * math.sin(ang + 0.45))
    d = ' stroke-dasharray="5 4"' if dash else ''
    return (f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
            f'stroke="{color}" stroke-width="1.8"{d}/>'
            f'<polygon points="{x2:.1f},{y2:.1f} {a1[0]:.1f},{a1[1]:.1f} '
            f'{a2[0]:.1f},{a2[1]:.1f}" fill="{color}"/>')


# ---------------------------------------------------------------------------
# Layout + diagram render
# ---------------------------------------------------------------------------

def aggregate_runs(steps):
    """Contiguous runs of steps sharing a non-empty aggregate -> spanning stickies."""
    runs = []
    i = 0
    while i < len(steps):
        agg = steps[i].get("aggregate")
        if not agg:
            i += 1
            continue
        j = i
        while j + 1 < len(steps) and steps[j + 1].get("aggregate") == agg:
            j += 1
        runs.append((i, j, agg))
        i = j + 1
    return runs


def render_diagram(d):
    steps = d["steps"]
    n = len(steps)

    present = [r for r in ORDER if any(s.get(r) for s in steps)]

    # column geometry
    def col_x(i):
        return MARGIN + i * (STICKY_W + COL_GAP)
    def col_cx(i):
        return col_x(i) + STICKY_W / 2

    total_w = MARGIN * 2 + n * STICKY_W + (n - 1) * COL_GAP
    total_w = max(total_w, 760)

    runs = aggregate_runs(steps)

    # per-role row height
    row_h = {}
    for r in present:
        if r == "aggregate":
            hh = MIN_H
            for (a, b, agg) in runs:
                w = (col_x(b) + STICKY_W) - col_x(a)
                hh = max(hh, sticky_h(agg, w))
            row_h[r] = hh
        else:
            row_h[r] = max([sticky_h(s.get(r, ""), STICKY_W) for s in steps if s.get(r)] + [MIN_H])

    # assign row Y (top of each band)
    row_y = {}
    y = MARGIN + HEADER_H
    for r in present:
        row_y[r] = y
        y += row_h[r] + ROW_GAP
    total_h = y - ROW_GAP + MARGIN

    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{total_w:.0f}" height="{total_h:.0f}" '
        f'viewBox="0 0 {total_w:.0f} {total_h:.0f}" '
        f'font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif">',
        f'<rect width="{total_w:.0f}" height="{total_h:.0f}" fill="#FAFAF7"/>',
    ]

    # header: title, story, legend
    out.append(f'<text x="{MARGIN}" y="{MARGIN + 6}" fill="{INK}" font-size="21" '
               f'font-weight="700">{esc(d.get("title", "EventStorming"))}</text>')
    if d.get("story"):
        for k, ln in enumerate(wrap(d["story"], 13.5, total_w - 2 * MARGIN, 2)):
            out.append(f'<text x="{MARGIN}" y="{MARGIN + 28 + k * 17:.0f}" fill="{MUTED}" '
                       f'font-size="13">{esc(ln)}</text>')

    # legend (only present roles + always show the core four)
    legend_roles = [r for r in ORDER if r in present or r in ("event", "command", "aggregate", "policy")]
    lx = MARGIN
    ly = MARGIN + 74
    for r in legend_roles:
        st = ROLE[r]
        lbl = st["label"]
        out.append(f'<rect x="{lx:.1f}" y="{ly - 11:.0f}" width="15" height="15" rx="3" '
                   f'fill="{st["fill"]}" stroke="{st["stroke"]}"/>')
        out.append(f'<text x="{lx + 21:.1f}" y="{ly + 1:.0f}" fill="{INK}" font-size="12">{esc(lbl)}</text>')
        lx += 21 + sum(char_w(c, 12) for c in lbl) + 26

    # vertical grammar connectors (behind stickies)
    chain = [r for r in ["actor", "command", "aggregate", "event", "policy"] if r in present]
    for i, s in enumerate(steps):
        cx = col_cx(i)
        # link consecutive present chain elements this step actually has
        prev_bottom = None
        for r in chain:
            has = s.get(r) or (r == "aggregate" and any(a <= i <= b for a, b, _ in runs))
            if not has:
                continue
            top = row_y[r]
            bottom = row_y[r] + row_h[r]
            if prev_bottom is not None:
                out.append(vline(cx, prev_bottom, top, CHAIN))
            prev_bottom = bottom

    # chronological backbone: event[i] -> event[i+1]
    if "event" in present:
        ey = row_y["event"] + row_h["event"] / 2
        ev_idx = [i for i, s in enumerate(steps) if s.get("event")]
        for a, b in zip(ev_idx, ev_idx[1:]):
            x1 = col_x(a) + STICKY_W
            x2 = col_x(b)
            out.append(arrow(x1 + 3, ey, x2 - 3, ey, BACKBONE))

    # policy -> next command (reactive trigger), dashed
    if "policy" in present and "command" in present:
        py = row_y["policy"]
        cy = row_y["command"] + row_h["command"]
        for i, s in enumerate(steps[:-1]):
            if s.get("policy") and steps[i + 1].get("command"):
                x1 = col_x(i) + STICKY_W
                x2 = col_cx(i + 1)
                out.append(arrow(x1, py + row_h["policy"] / 2, x2, cy + 6, POLICY_LINK, dash=True))

    # aggregate boundary tint behind spanning stickies (subtle grouping cue)
    if "aggregate" in present:
        ry = row_y["aggregate"]
        for (a, b, agg) in runs:
            x = col_x(a) - 8
            w = (col_x(b) + STICKY_W) - col_x(a) + 16
            out.append(f'<rect x="{x:.1f}" y="{ry - 8:.1f}" width="{w:.1f}" height="{row_h["aggregate"] + 16:.1f}" '
                       f'rx="10" fill="none" stroke="{ROLE["aggregate"]["stroke"]}" '
                       f'stroke-width="1.2" stroke-dasharray="6 5" opacity="0.8"/>')

    # stickies
    for r in present:
        ry = row_y[r]
        if r == "aggregate":
            for (a, b, agg) in runs:
                x = col_x(a)
                w = (col_x(b) + STICKY_W) - col_x(a)
                out.append(sticky(x, ry, w, row_h[r], r, agg))
        else:
            for i, s in enumerate(steps):
                if s.get(r):
                    out.append(sticky(col_x(i), ry, STICKY_W, row_h[r], r, s[r]))

    out.append("</svg>")
    return "\n".join(out)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="Generate EventStorming diagrams (SVG) from a JSON spec.")
    ap.add_argument("spec")
    ap.add_argument("-o", "--out", default="eventstorming")
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
        base = os.path.join(args.out, f"{i:02d}-{d.get('id', 'board')}")
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
