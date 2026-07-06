import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Compile the workspace packages from source so Fast Refresh reflects edits to
  // shared contracts/UI live in dev, instead of bundling a stale prebuilt dist.
  transpilePackages: ["@workspace/ui", "@workspace/contracts"],
}

export default nextConfig
