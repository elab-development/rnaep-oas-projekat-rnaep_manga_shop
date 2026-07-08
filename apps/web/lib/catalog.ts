import {
  CATALOG_MAX_PAGE_SIZE,
  type MangaView,
  type Paginated,
} from "@workspace/contracts";
import { gatewayUrl } from "./auth";

/**
 * Server-side catalog client. The frontend talks ONLY to the API gateway
 * (ADR-0011); browse is Guest-accessible so these calls carry no token. The
 * catalog / detail fetches render fresh per request (`no-store`); the homepage
 * rail helpers below are cacheable, because the homepage is served under ISR
 * (ADR-0016) and a `no-store` fetch would force it dynamic.
 */

export interface CatalogQuery {
  page?: number;
  limit?: number;
  q?: string;
  genres?: string[];
  /** Narrow to the curated Featured rail (CONTEXT.md: Featured). */
  featured?: boolean;
}

/** Builds the `?…` query string for the catalog list endpoint. */
function catalogQuery(query: CatalogQuery): string {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.q) params.set("q", query.q);
  if (query.featured) params.set("featured", "true");
  for (const genre of query.genres ?? []) params.append("genre", genre);
  return params.toString();
}

/** Fetches a page of the catalog through the gateway (fresh per request). */
export async function fetchCatalog(
  query: CatalogQuery = {},
): Promise<Paginated<MangaView>> {
  const qs = catalogQuery(query);
  const res = await fetch(
    `${gatewayUrl()}/catalog/manga${qs ? `?${qs}` : ""}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`Catalog request failed (${res.status})`);
  }
  return (await res.json()) as Paginated<MangaView>;
}

/**
 * Fetches the distinct genres in the catalog, for the filter chips. The catalog
 * page wants this fresh (`no-store`, the default); the homepage genre quick-nav
 * passes `{ revalidate }` so the fetch is cacheable under ISR (ADR-0016).
 */
export async function fetchGenres(opts?: { revalidate?: number }): Promise<string[]> {
  const res = await fetch(`${gatewayUrl()}/catalog/genres`, {
    ...(opts?.revalidate
      ? { next: { revalidate: opts.revalidate } }
      : { cache: "no-store" }),
  });
  if (!res.ok) {
    throw new Error(`Genres request failed (${res.status})`);
  }
  return (await res.json()) as string[];
}

/** Fetches a single manga's detail, or null on a 404. */
export async function fetchManga(id: string): Promise<MangaView | null> {
  const res = await fetch(
    `${gatewayUrl()}/catalog/manga/${encodeURIComponent(id)}`,
    { cache: "no-store" },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Manga request failed (${res.status})`);
  }
  return (await res.json()) as MangaView;
}

/** How many tiles each homepage rail shows. */
export const HOME_RAIL_LIMIT = 4;
/** ISR window shared by every homepage fetch (ADR-0016: 1 hour). */
export const HOME_REVALIDATE = 3600;

/** One cacheable rail fetch: newest-first, capped at the rail size. */
async function fetchRail(query: CatalogQuery): Promise<MangaView[]> {
  const qs = catalogQuery({ ...query, limit: HOME_RAIL_LIMIT });
  const res = await fetch(`${gatewayUrl()}/catalog/manga?${qs}`, {
    next: { revalidate: HOME_REVALIDATE },
  });
  if (!res.ok) {
    throw new Error(`Catalog request failed (${res.status})`);
  }
  return ((await res.json()) as Paginated<MangaView>).items;
}

/**
 * Homepage Featured rail: up to {@link HOME_RAIL_LIMIT} staff-curated manga
 * (`featured=true`), newest-first. Empty when nothing is curated yet — the page
 * renders an intentional empty state rather than a bare heading.
 */
export function fetchFeatured(): Promise<MangaView[]> {
  return fetchRail({ featured: true });
}

/**
 * Homepage New Arrivals rail: the {@link HOME_RAIL_LIMIT} most-recently-created
 * manga (default newest-first sort from slice 01). Purely time-ordered, never
 * curated (CONTEXT.md: New Arrivals).
 */
export function fetchNewArrivals(): Promise<MangaView[]> {
  return fetchRail({});
}

/**
 * Enumerates every manga in the catalog by walking the paginated list at the
 * largest page size the service allows ({@link CATALOG_MAX_PAGE_SIZE}). Used by
 * the sitemap (issue 04) to emit one `<url>` per product.
 *
 * Cacheable under the homepage ISR window (the sitemap is a static-ish route,
 * not per-request), so a `no-store` fetch would not be right here. `total` from
 * the first page fixes the page count, so the loop is bounded even as the
 * catalog grows.
 */
export async function fetchAllManga(): Promise<MangaView[]> {
  const first = await fetchPage(1);
  const all = [...first.items];
  for (let page = 2; page <= first.totalPages; page++) {
    const next = await fetchPage(page);
    all.push(...next.items);
  }
  return all;
}

/** One cacheable page of the full catalog walk (see {@link fetchAllManga}). */
async function fetchPage(page: number): Promise<Paginated<MangaView>> {
  const qs = catalogQuery({ page, limit: CATALOG_MAX_PAGE_SIZE });
  const res = await fetch(`${gatewayUrl()}/catalog/manga?${qs}`, {
    next: { revalidate: HOME_REVALIDATE },
  });
  if (!res.ok) {
    throw new Error(`Catalog request failed (${res.status})`);
  }
  return (await res.json()) as Paginated<MangaView>;
}
