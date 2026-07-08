import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * `robots.txt` (issue 04). Allows crawling the whole shop and points at the
 * sitemap so a crawler can discover every product URL. The `host`/`sitemap`
 * URLs resolve against the configured base origin (`NEXT_PUBLIC_SITE_URL`,
 * dev-default `http://localhost:3010`) — no hardcoded production domain.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
