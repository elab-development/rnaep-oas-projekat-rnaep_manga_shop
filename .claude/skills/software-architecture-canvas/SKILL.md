---
name: software-architecture-canvas
description: Generate a Software Architecture Canvas diagram (a Business-Model-Canvas-style one-page overview of a software system) as an SVG and/or PNG. Use this skill whenever the user wants an "architecture canvas", "software architecture canvas", "architecture overview diagram", "one-page architecture", or asks to visualize/summarize their app's architecture, components, tech stack, integrations, quality attributes, or key decisions on a single page. Trigger it even if the user just says "make an architecture diagram/overview of this app" — this canvas is a strong default. This skill inspects the current codebase to fill the canvas with real details, then renders it with a bundled script.
---

# Software Architecture Canvas

Produce a one-page **Software Architecture Canvas**: a grid of labeled sections
(Business-Model-Canvas style) that summarizes a system's stakeholders, goals,
constraints, components, data, tech stack, quality attributes, cross-cutting
concerns, key decisions, and deployment — on a single sheet.

The layout is fixed and owned by the render script, so every canvas comes out
consistent and professional. **Your job is to gather accurate content from the
repo and fill in a small JSON spec.** Do not hand-write SVG.

## Workflow

### 1. Gather architecture facts from the codebase
Spend real effort here — the value of the canvas is in the accuracy of the
content. Inspect (as available):
- **README / docs / ADRs** — stated goals, decisions, constraints, diagrams.
- **Dependency manifests** — `package.json`, `pyproject.toml`/`requirements.txt`,
  `go.mod`, `pom.xml`, `Cargo.toml`, `Gemfile`, etc. → languages, frameworks, libs.
- **Folder structure & entry points** — top-level dirs, services, packages,
  `main`/`app` files → core components and modules.
- **Infra & deploy** — `Dockerfile`, `docker-compose*`, `*.tf`, `k8s/`, `helm/`,
  `serverless.yml`, `.github/workflows/`, cloud config → deployment & infra, CI/CD.
- **Config & env** — `.env.example`, config files → external services, data stores,
  secrets/integrations (Stripe, Auth0, S3, Postgres, Redis, Kafka, OpenAI, etc.).
- **Schema / migrations / ORM models** → data stores and key entities.
- **Middleware / gateway / auth code** → cross-cutting concerns (auth, logging,
  rate limiting, tracing, encryption).

If the repo doesn't reveal something (e.g. business goals, SLAs, target users),
either infer conservatively from context or ask the user one concise question
rather than inventing specifics. Mark genuine unknowns as `"— (confirm)"` items.

### 2. Fill in the JSON spec
Create a spec file (see the schema and full section-by-section meaning in
`references/canvas-sections.md`). Shape:

```json
{
  "title": "<App Name> — Software Architecture Canvas",
  "subtitle": "v1.0 · <date> · <team/owner>",
  "sections": {
    "stakeholders":  ["...", "..."],
    "goals":         ["...", "..."],
    "constraints":   ["...", "..."],
    "external":      ["...", "..."],
    "components":    ["...", "..."],
    "data":          ["...", "..."],
    "techstack":     ["...", "..."],
    "quality":       ["...", "..."],
    "crosscutting":  ["...", "..."],
    "decisions":     ["...", "..."],
    "deployment":    ["...", "..."]
  }
}
```

**Content rules that keep the canvas readable:**
- 3–6 items per section. This is a summary, not an inventory.
- Keep each item short — a phrase, not a sentence (ideally ≤ 8 words).
- Lead with the concrete thing (`"PostgreSQL 16 (primary store)"`, not
  `"We use a relational database, specifically PostgreSQL"`).
- Every section key is optional; omit or leave `[]` and it renders as `—`.
- Overflowing a box shows a `…more` hint — that's your cue to trim.

### 3. Render
```bash
python scripts/generate_canvas.py spec.json -o architecture-canvas.svg
# add PNG (needs cairosvg): pip install cairosvg
python scripts/generate_canvas.py spec.json -o architecture-canvas.svg --png architecture-canvas.png
```

The SVG needs no dependencies. PNG export needs `cairosvg`; if it isn't
installed and the user wants a PNG, install it or deliver the SVG (which any
browser or design tool opens and exports).

### 4. Present
Give the user the file path(s). Briefly note which sections you inferred vs. read
directly from the repo, and invite corrections — the spec is easy to tweak and
re-render.

## Notes
- The 11 sections and their grid positions are fixed in the script; don't try to
  add or rename sections via the spec. If the user wants a different section set,
  edit `SECTIONS` and `BANDS` in `scripts/generate_canvas.py`.
- Canvas is 1680×1160. For a title-slide-friendly PNG, the script already renders
  PNG at 2× scale.
- For deeper, multi-view diagrams (context/container/component), this canvas
  pairs well with a C4 model but does not replace it — mention that if the user
  needs drill-down detail.
