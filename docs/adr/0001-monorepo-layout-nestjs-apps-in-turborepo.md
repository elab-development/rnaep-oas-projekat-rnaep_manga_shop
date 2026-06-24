# Monorepo layout: NestJS services as `apps/*` in the existing Turborepo

The backend is NestJS (4 services — auth, catalog, orders, payments — plus an API gateway). Rather than the flat `gateway/` + `services/*` layout proposed in the project spec (DODATAK A), or NestJS's native monorepo mode, we host every service as a separate app under `apps/*` in the existing pnpm + Turborepo workspace, alongside `apps/web` (Next.js). Shared code (Kafka event contracts, common DTOs/types) lives in `packages/*`.

**Why:** Reuses the already-configured pnpm/turbo/eslint/tsconfig setup and the `packages/ui` dependency that `apps/web` relies on; one `pnpm install`, one `turbo dev` to run everything locally; shared types without publishing. Each app still gets its own Dockerfile and its own database, so the spec's hard requirements (separate container per service, database-per-service, distinct ports) are fully met — only the directory layout differs from DODATAK A, which is a *proposed* structure, not a graded requirement.

**Considered and rejected:**
- **NestJS monorepo mode** (`nest g app` + `libs/`): cleaner Nest ergonomics but throws away the existing Turborepo scaffold and `packages/ui`.
- **Spec's flat `gateway/` + `services/*` layout**: matches the document literally but breaks the workspace and forces per-service tooling duplication.
