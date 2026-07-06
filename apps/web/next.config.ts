import type { NextConfig } from "next"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const here = dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
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
