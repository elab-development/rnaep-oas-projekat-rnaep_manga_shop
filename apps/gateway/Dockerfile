# syntax=docker/dockerfile:1
# Built from the repo root so the pnpm workspace (apps + packages) is available.
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
# Shared workspace packages first, then this service. `.dockerignore` excludes
# every `dist/`, so each workspace dep must be compiled inside the image — its
# `main` (dist/index.js) is what the service requires at runtime.
RUN pnpm --filter @workspace/contracts --filter @workspace/auth-guard --filter @workspace/observability build
RUN pnpm --filter gateway build

FROM node:20-alpine AS runner
RUN corepack enable
WORKDIR /repo
COPY --from=builder /repo .
ENV NODE_ENV=production
WORKDIR /repo/apps/gateway
EXPOSE 3000
CMD ["node", "dist/main.js"]
