/**
 * The shop's public base URL, for SEO plumbing (issue 04): `metadataBase`,
 * canonical URLs, the sitemap, robots, and Open Graph / Twitter URLs.
 *
 * There is no production domain yet, so the base URL is configuration, not a
 * hardcoded constant: it comes from `NEXT_PUBLIC_SITE_URL` and defaults to the
 * local dev origin (`http://localhost:3010`, the web container's published
 * port). This keeps canonical/sitemap/OG URLs correct on a laptop and lets a
 * real deployment point them at its own domain without a code change (story 28).
 *
 * `NEXT_PUBLIC_*` is inlined at build time, so a deployment must set it as a
 * build arg (mirrors `NEXT_PUBLIC_GATEWAY_URL`; see docker-compose.yml).
 */

/** Local dev fallback: the web container's published origin. */
export const DEFAULT_SITE_URL = "http://localhost:3010";

/** The shop's base origin, from `NEXT_PUBLIC_SITE_URL` or the dev default. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;
  try {
    return new URL(raw).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}
