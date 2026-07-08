# syntax=docker/dockerfile:1
# Next.js frontend image — the official standalone-output recipe
# (https://nextjs.org/docs/app/getting-started/deploying#docker), adapted for
# this pnpm + Turborepo monorepo. Built from the repo root so the whole
# workspace (apps + packages) is available, like the other service Dockerfiles.
#
# `output: "standalone"` (next.config.ts) traces the exact runtime files into
# .next/standalone; with outputFileTracingRoot pinned to the repo root the
# emitted layout is standalone/apps/web/server.js, so the runner runs
# `node apps/web/server.js`. static assets and public/ are copied in separately
# (Next does not trace them into standalone).

FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
# NEXT_PUBLIC_* is inlined into the client bundle at build time, so the gateway
# URL the *browser* uses is fixed here. Default is the host-published gateway
# (localhost:3000); override with --build-arg for another deployment. The
# server-side URL is a runtime env var (GATEWAY_INTERNAL_URL), set at run time.
ARG NEXT_PUBLIC_GATEWAY_URL=http://localhost:3000
ENV NEXT_PUBLIC_GATEWAY_URL=$NEXT_PUBLIC_GATEWAY_URL
# Public base URL for SEO (canonical / sitemap / robots / OG), inlined at build
# time. Default is the host-published web origin (localhost:3010); override with
# --build-arg for a real deployment domain.
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3010
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
# @workspace/contracts resolves to its compiled dist/, so build it first (like
# the service Dockerfiles). @workspace/ui is consumed from source via
# transpilePackages and needs no build step.
RUN pnpm --filter @workspace/contracts build
RUN pnpm --filter web build

FROM node:20-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production
# Next's standalone server honours PORT/HOSTNAME; 3010 keeps parity with
# `pnpm dev` and the payments WEB_URL. Bind 0.0.0.0 so the port is reachable
# from outside the container.
ENV PORT=3010
ENV HOSTNAME=0.0.0.0

# Run as a non-root user (Next.js official guidance).
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Standalone bundle first (brings apps/web/server.js + traced node_modules),
# then the static assets Next leaves outside it. No public/ dir in this app.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3010
CMD ["node", "apps/web/server.js"]
