# syntax=docker/dockerfile:1
# Built from the repo root so the pnpm workspace (apps + packages) is available.
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
# Shared workspace packages first, then this service.
RUN pnpm --filter @workspace/contracts --filter @workspace/auth-guard build
RUN pnpm --filter orders build

FROM node:20-alpine AS runner
RUN corepack enable
WORKDIR /repo
COPY --from=builder /repo .
ENV NODE_ENV=production
WORKDIR /repo/apps/orders
EXPOSE 3003
CMD ["node", "dist/main.js"]
