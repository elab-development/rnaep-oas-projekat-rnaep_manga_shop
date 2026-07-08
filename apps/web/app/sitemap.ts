import type { MetadataRoute } from "next";
import { fetchAllManga } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";

/**
 * `sitemap.xml` (issue 04): the public static routes plus one entry per product,
 * enumerated from the catalog, so a crawler can find every manga detail page.
 *
 * Only crawlable, Guest-reachable routes are listed — the auth-gated surfaces
 * (cart, checkout, orders, admin, moderator) are deliberately omitted.
 *
 * Absolute URLs are built from the configured base origin (`NEXT_PUBLIC_SITE_URL`,
 * dev-default `http://localhost:3010`); no hardcoded domain. Like the homepage
 * rails, the product enumeration degrades gracefully: if the catalog is
 * unreachable (e.g. the gateway is down at build time) the sitemap still emits
 * the static routes and recovers the product URLs on the next revalidate,
 * rather than failing the build.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/catalog`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/register`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const manga = await fetchAllManga().catch((err: unknown) => {
    console.error("Sitemap product enumeration failed:", err);
    return [];
  });

  const productRoutes: MetadataRoute.Sitemap = manga.map((m) => ({
    url: `${base}/catalog/${m.id}`,
    lastModified: m.createdAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...productRoutes];
}
