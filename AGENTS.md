<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Hard constraints (read first)

### NEVER start the observability stack

**Do not start Prometheus or Grafana — ever.** They are on a dedicated
`observability` docker-compose profile precisely so they stay off by default.
On this machine they consume all available resources and wedge the Docker
daemon, which breaks every other `docker compose` command (builds, DB/Kafka
infra, the app itself). The user runs them manually, never as part of agent work.

Concretely, agents and tests **must not**:

- run `docker compose --profile observability …` (or any command that includes
  the `observability` profile, e.g. `--profile full --profile observability`);
- add Prometheus/Grafana to the `full` profile, to a test's `docker compose up`,
  or to a testcontainers setup;
- start `prom/prometheus` or `grafana/grafana` images by any other means.

`docker compose --profile full up` (services + web only) and the default
`docker compose up` (DB + Kafka infra) are fine. The metrics **endpoints** and
dashboard **config** are validated by the normal test suite and static config
checks — you never need a live Prometheus/Grafana to verify observability work.

## Agent skills

### Issue tracker

Issues and PRDs live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default triage vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Diagrams & visual artifacts

Any diagram, chart, canvas, or slide generated for this project — whatever skill
produces it — **must** use the project's neo-brutalist house style (ADR-0014) and
be rendered with the shared toolkit. Do not invent per-diagram styling and do not
rasterize with `sharp`/`librsvg` (it ignores embedded `@font-face`, so brand fonts
are lost).

- **Style:** apply `tools/diagram-brand/brand.md` (tokens in `brand.json`) — white
  chassis + dot field, ink borders, hard zero-blur offset shadows, sharp corners,
  the closed accent set, Space Grotesk (heavy, UPPERCASE) headings + Space Mono body.
- **Render:** emit an SVG whose text uses those font families, then finalize with
  `node tools/diagram-brand/render.mjs <in.svg> -o .ignore/diagrams` — it embeds the
  fonts (self-contained SVG) and rasterizes a font-correct PNG via `@resvg/resvg-js`.
  Always deliver **both** the SVG and PNG.
- **Architecture Canvas:** use the branded generator at
  `tools/diagram-brand/generators/architecture-canvas.py`, then the render step above.

Diagram outputs go to `.ignore/diagrams/` (git-ignored) unless asked otherwise.
