import { Injectable, Logger, Optional } from "@nestjs/common";
import CircuitBreaker from "opossum";
import type { JikanSuggestion } from "@workspace/contracts";

/** The slice of Jikan's `/manga` response we read (all fields optional/defensive). */
interface JikanManga {
  mal_id?: number;
  title?: string;
  authors?: { name?: string }[];
  genres?: { name?: string }[];
  synopsis?: string;
  images?: { jpg?: { image_url?: string } };
}

interface JikanSearchResponse {
  data?: JikanManga[];
}

/** Test/wiring seams; every field defaults to production behavior. */
export interface JikanOptions {
  /** Jikan base URL (no trailing slash). */
  baseUrl?: string;
  /** Max results to request per search. */
  limit?: number;
  /** Injected for tests — mocks Jikan at the HTTP boundary. */
  fetchImpl?: typeof fetch;
  /** opossum tuning; overridden in tests to trip the breaker deterministically. */
  breaker?: CircuitBreaker.Options;
}

/** The add form's picker shows at most a few results — cap the fetch to match. */
const DEFAULT_LIMIT = 5;

/**
 * Searches Jikan (MyAnimeList) to prefill a new Manga's data at add-time
 * (ADR-0009: enrichment is a snapshot, never an auto-resync). The call is
 * wrapped in an opossum circuit breaker; on any failure or an open circuit the
 * breaker's fallback yields an empty suggestion list so the moderator falls back
 * to fully manual entry — creation is never blocked. No cache: search queries
 * vary, and the fallback already keeps the catalog independent of Jikan uptime.
 */
@Injectable()
export class JikanService {
  private readonly logger = new Logger(JikanService.name);
  private readonly baseUrl: string;
  private readonly limit: number;
  private readonly fetchImpl: typeof fetch;
  private readonly breaker: CircuitBreaker<[string], JikanSuggestion[]>;

  // `@Optional()` so Nest injects nothing (the options are a test/wiring seam);
  // tests pass options explicitly.
  constructor(@Optional() options: JikanOptions = {}) {
    this.baseUrl =
      options.baseUrl ?? process.env.JIKAN_URL ?? "https://api.jikan.moe/v4";
    this.limit = options.limit ?? DEFAULT_LIMIT;
    // Resolve global fetch lazily so tests can spy on it after construction.
    this.fetchImpl =
      options.fetchImpl ?? ((...args) => globalThis.fetch(...args));

    this.breaker = new CircuitBreaker((q: string) => this.fetchSuggestions(q), {
      timeout: 4000,
      errorThresholdPercentage: 50,
      resetTimeout: 30_000,
      volumeThreshold: 3,
      ...options.breaker,
    });
    // On any failure OR an open circuit, serve no suggestions → the UI falls
    // back to manual entry (ADR-0009). Never throws, so add is never blocked.
    this.breaker.fallback(() => []);

    this.breaker.on("open", () =>
      this.logger.warn("Jikan circuit opened — manual entry only"),
    );
    this.breaker.on("close", () =>
      this.logger.log("Jikan circuit closed — enrichment live"),
    );
  }

  /** True once the breaker has tripped open. Exposed for observability/tests. */
  get breakerOpen(): boolean {
    return this.breaker.opened;
  }

  /**
   * Suggestions for a search term, breaker-guarded. Returns an empty list for a
   * blank query or when Jikan is unavailable (the "fill manually" fallback).
   */
  async search(query: string): Promise<JikanSuggestion[]> {
    const q = query.trim();
    if (!q) return [];
    return this.breaker.fire(q);
  }

  /** Fetches and normalizes suggestions from Jikan. */
  private async fetchSuggestions(query: string): Promise<JikanSuggestion[]> {
    // getMangaSearch query params (Jikan v4 OpenAPI): the search term plus the
    // first page capped at a few results. `order_by`/`sort` are omitted on
    // purpose — with `q` set, Jikan ranks by title relevance, which is what an
    // add-time lookup wants.
    const params = new URLSearchParams({
      q: query,
      page: "1",
      limit: String(this.limit),
    });
    const url = `${this.baseUrl}/manga?${params.toString()}`;
    const res = await this.fetchImpl(url);
    if (!res.ok) throw new Error(`Jikan responded ${res.status}`);
    const body = (await res.json()) as JikanSearchResponse;
    return (body.data ?? [])
      .filter((m): m is JikanManga & { mal_id: number } =>
        typeof m.mal_id === "number",
      )
      .map(toSuggestion);
  }
}

/** Normalizes one Jikan result to the fields the add form prefills. */
function toSuggestion(m: JikanManga & { mal_id: number }): JikanSuggestion {
  return {
    jikanId: m.mal_id,
    title: m.title ?? "",
    author: m.authors?.[0]?.name ?? "",
    genres: (m.genres ?? [])
      .map((g) => g.name)
      .filter((name): name is string => typeof name === "string"),
    cover: m.images?.jpg?.image_url ?? "",
    description: m.synopsis ?? "",
  };
}
