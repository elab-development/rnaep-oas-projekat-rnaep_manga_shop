import type { MangaView, Paginated } from "@workspace/contracts";
import { gatewayUrl } from "./auth";

/**
 * Server-side catalog client. The frontend talks ONLY to the API gateway
 * (ADR-0011); browse is Guest-accessible so these calls carry no token. Used
 * from Next.js server components, which fetch fresh on each request.
 */

export interface CatalogQuery {
  page?: number;
  limit?: number;
  q?: string;
  genres?: string[];
}

/** Fetches a page of the catalog through the gateway. */
export async function fetchCatalog(
  query: CatalogQuery = {},
): Promise<Paginated<MangaView>> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.q) params.set("q", query.q);
  for (const genre of query.genres ?? []) params.append("genre", genre);
  const qs = params.toString();

  const res = await fetch(
    `${gatewayUrl()}/catalog/manga${qs ? `?${qs}` : ""}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error(`Catalog request failed (${res.status})`);
  }
  return (await res.json()) as Paginated<MangaView>;
}

/** Fetches the distinct genres in the catalog, for the filter chips. */
export async function fetchGenres(): Promise<string[]> {
  const res = await fetch(`${gatewayUrl()}/catalog/genres`, {
    cache: "no-store",
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
