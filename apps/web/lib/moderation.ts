import type {
  CreateMangaInput,
  JikanSuggestion,
  MangaView,
  UpdateMangaInput,
} from "@workspace/contracts";
import { authHeader, gatewayUrl } from "./auth";

/**
 * Browser-side moderation client. Talks ONLY to the API gateway (ADR-0011),
 * carrying the moderator's JWT in the Authorization header (ADR-0007). The
 * gateway's catalog service re-verifies the token and enforces `@MinRole` — this
 * layer only shapes requests and surfaces errors for the panel UI.
 */

/** Thrown when a gateway write responds non-2xx. */
export class ModerationError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ModerationError";
  }
}

async function send<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${gatewayUrl()}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...authHeader(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new ModerationError(await messageFor(res), res.status);
  // 204 No Content (delete) has no body to parse.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function messageFor(res: Response): Promise<string> {
  if (res.status === 401) return "Please sign in again.";
  if (res.status === 403) return "You don't have permission for that.";
  if (res.status === 409)
    return "Can't set stock below the reserved quantity.";
  try {
    const data = (await res.json()) as { message?: string | string[] };
    const m = data.message;
    if (Array.isArray(m)) return m.join(" ");
    if (m) return m;
  } catch {
    // fall through
  }
  return "Something went wrong. Please try again.";
}

/** Searches Jikan for add-time prefill; empty when Jikan is down (ADR-0009). */
export async function searchJikan(query: string): Promise<JikanSuggestion[]> {
  const res = await fetch(
    `${gatewayUrl()}/catalog/jikan/search?q=${encodeURIComponent(query)}`,
    { headers: authHeader() },
  );
  if (!res.ok) throw new ModerationError(await messageFor(res), res.status);
  return (await res.json()) as JikanSuggestion[];
}

/** Adds a manga (Jikan-prefilled or manual). */
export function createManga(input: CreateMangaInput): Promise<MangaView> {
  return send<MangaView>("/catalog/manga", "POST", input);
}

/** Edits a manga's data/price. */
export function updateManga(
  id: string,
  input: UpdateMangaInput,
): Promise<MangaView> {
  return send<MangaView>(`/catalog/manga/${id}`, "PATCH", input);
}

/** Sets a manga's physical stock quantity. */
export function updateStock(
  id: string,
  quantity: number,
): Promise<MangaView> {
  return send<MangaView>(`/catalog/manga/${id}/stock`, "PATCH", { quantity });
}

/** Deletes a manga (admin-gated). */
export function deleteManga(id: string): Promise<void> {
  return send<void>(`/catalog/manga/${id}`, "DELETE");
}
