import type { NextConfig } from "next"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))

const isDev = process.env.NODE_ENV !== "production"

/** Browser-reachable gateway origin the client fetches (ADR-0011), for `connect-src`. */
function gatewayOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:3000"
  try {
    return new URL(raw).origin
  } catch {
    return "http://localhost:3000"
  }
}

// Content-Security-Policy for the frontend (issue 13, ADR-0012). Emitted as a
// static header rather than a per-request nonce: the App Router's own inline
// hydration/RSC scripts have per-response content that can't be statically
// hashed, so a strict `script-src` would force the whole app into per-request
// dynamic rendering. We accept `script-src 'unsafe-inline'` (which also covers
// next-themes' inline anti-flash script) and keep every other directive locked
// down — object/base/frame/form and a same-origin default. React/Next escaping,
// the absence of `dangerouslySetInnerHTML`, and class-validator remain the
// load-bearing XSS defenses (see docs/security-checklist.md). `unsafe-eval` and
// the HMR websocket are dev-only; production evals nothing.
const contentSecurityPolicy = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline'`,
  // Cover art is a snapshot of an external CDN (Jikan/MyAnimeList); images can't
  // execute script, so allowing https here is safe.
  `img-src 'self' data: https:`,
  `font-src 'self'`,
  `connect-src 'self' ${gatewayOrigin()}${isDev ? " ws:" : ""}`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  // Skip in dev: it would upgrade local http subresources to https and break `pnpm dev`.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ")

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ]
  },

  // Compile the workspace packages from source so Fast Refresh reflects edits to
  // shared contracts/UI live in dev, instead of bundling a stale prebuilt dist.
  transpilePackages: ["@workspace/ui", "@workspace/contracts"],

  // Emit a self-contained server bundle (`.next/standalone`) so the Docker image
  // ships only the traced runtime files — no dev deps, no full node_modules
  // (Next.js official Docker guide). `output-file-tracing` must start at the
  // monorepo root, not apps/web, or the traced workspace packages
  // (@workspace/ui, @workspace/contracts) are missing from the standalone
  // output; the resulting layout is standalone/apps/web/server.js.
  output: "standalone",
  outputFileTracingRoot: join(here, "../.."),
}

export default nextConfig
