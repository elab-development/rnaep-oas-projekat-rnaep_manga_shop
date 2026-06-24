# 14. CI/CD (GitHub Actions)

Status: ready-for-agent

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
