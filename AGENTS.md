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
