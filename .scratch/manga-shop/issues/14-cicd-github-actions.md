# 14. CI/CD (GitHub Actions)

Status: done

## Parent

[PRD: Manga Web Shop](../PRD.md)

## What to build

A GitHub Actions pipeline that keeps the monorepo green. On push / pull request it installs via pnpm, runs lint and type-check, builds all apps and packages (Turborepo), and runs the per-service integration test suites (with the ephemeral databases / broker they need spun up in the workflow). It also verifies each app's Dockerfile builds. The pipeline should leverage Turborepo caching so unchanged packages are skipped.

Respects ADR-0001 (pnpm + Turborepo monorepo), PRD Further Notes phase 13.

## Acceptance criteria

- [ ] Workflow triggers on push and pull request
- [ ] Pipeline installs with pnpm, runs lint + type-check, and builds all apps/packages via Turborepo
- [ ] Per-service integration tests run in CI with their required databases/broker provisioned
- [ ] Each app's Dockerfile build is verified in CI
- [ ] Turborepo caching is used so unchanged work is skipped
- [ ] A failing lint/test/build fails the workflow (red on regression)

## Blocked by

- [01. Foundation scaffold](01-foundation-scaffold.md)

## Comments

Implemented `.github/workflows/ci.yml` — a single workflow with two parallel
jobs, triggered on push (`develop`/`main`/`master`) and every pull request:

- **`verify`** — `pnpm/action-setup` (pnpm version read from the root
  `packageManager` field) → `setup-node@v4` with `cache: pnpm` →
  `pnpm install --frozen-lockfile` → **Turborepo cache restore** (`actions/cache`
  on `.turbo`, keyed by SHA with a prefix fallback) → `pnpm lint` → `pnpm typecheck`
  → `pnpm build` → `pnpm test`. The per-service integration suites provision their
  own Postgres/Mongo/Kafka via testcontainers on the runner's Docker; the root
  `test` script already pins `turbo test --concurrency=1` so the throwaway Kafka
  brokers don't boot at once (commit 5a86815). Any red step fails the workflow.
- **`docker`** — a `fail-fast: false` matrix over the five containerised services
  (`auth`, `catalog`, `orders`, `payments`, `gateway`; `apps/web` has no
  Dockerfile), each built via `docker/build-push-action@v6` from the repo root
  with `push: false` and GitHub Actions layer cache (`type=gha`, per-app scope).

Decisions: kept it to two jobs (student-scale simplicity) rather than a
per-package matrix — Turborepo already parallelises within `pnpm build/test`.
Used GHA layer cache for images and `.turbo` cache for the JS pipeline to satisfy
the "unchanged work is skipped" criterion. No service containers wired in the
workflow because testcontainers manages ephemeral infra itself.

Verified locally (the exact commands CI runs): `pnpm typecheck` 10/10,
`pnpm lint` 10/10 (1 pre-existing warning, 0 errors), `pnpm build` 9/9,
`pnpm test` all 8 tasks green (auth 24, gateway 8, catalog 45, orders 30,
payments 11 = 118 tests), and `docker build -f apps/gateway/Dockerfile .`
builds successfully with the CI command shape. Workflow YAML parses cleanly.

Follow-ups / notes for next iteration: none blocking. Optional polish — a CI
status badge in the README, and (once a GitHub remote exists) confirm the first
run's testcontainers image pulls fit inside the 45-min `verify` timeout.
