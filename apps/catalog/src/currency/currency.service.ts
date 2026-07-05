import { Injectable, Logger, Optional } from "@nestjs/common";
import CircuitBreaker from "opossum";
import {
  DISPLAY_CURRENCIES,
  type Cents,
  type DisplayCurrency,
  type DisplayPrices,
} from "@workspace/contracts";

/**
 * EUR→display exchange rates, one factor per display currency (ADR-0006). A
 * rate of `1.08` means €1 shows as $1.08.
 */
export type Rates = Record<DisplayCurrency, number>;

/** Frankfurter's `/latest` response shape (only the fields we read). */
interface FrankfurterLatest {
  base: string;
  rates: Partial<Record<string, number>>;
}

/** Test/wiring seams; every field defaults to production behavior. */
export interface CurrencyOptions {
  /** Frankfurter base URL (no trailing slash). */
  baseUrl?: string;
  /** How long a fetched rate set stays fresh before a refetch (ADR-0009). */
  ttlMs?: number;
  /** Injected for tests — mocks Frankfurter at the HTTP boundary. */
  fetchImpl?: typeof fetch;
  /** opossum tuning; overridden in tests to trip the breaker deterministically. */
  breaker?: CircuitBreaker.Options;
}

/** Frankfurter rates change slowly; a 12h cache is well within ADR-0009's window. */
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Converts the catalog's EUR prices into USD/GBP/JPY display labels using cached
 * Frankfurter rates (ADR-0006: display-only, never charged). The Frankfurter
 * call is wrapped in an opossum circuit breaker; on failure or an open circuit
 * the breaker's fallback serves the last cached rates (ADR-0009). Rates are
 * cached in-memory with a 12h TTL — no Redis, per ADR-0009.
 */
@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);
  private readonly baseUrl: string;
  private readonly ttlMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly breaker: CircuitBreaker<[], Rates | undefined>;

  /** Last successful fetch; the breaker's fallback and the TTL both read this. */
  private cache?: { rates: Rates; at: number };

  // `@Optional()` so Nest injects nothing (the options are a test/wiring seam,
  // not a provider) and the default applies; tests pass options explicitly.
  constructor(@Optional() options: CurrencyOptions = {}) {
    this.baseUrl =
      options.baseUrl ??
      process.env.FRANKFURTER_URL ??
      "https://api.frankfurter.dev/v1";
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    // Resolve global fetch lazily so tests can spy on it after construction.
    this.fetchImpl =
      options.fetchImpl ?? ((...args) => globalThis.fetch(...args));

    this.breaker = new CircuitBreaker(() => this.fetchRates(), {
      timeout: 3000,
      errorThresholdPercentage: 50,
      resetTimeout: 30_000,
      volumeThreshold: 3,
      ...options.breaker,
    });
    // On any failure OR an open circuit, fall back to the last cached rates
    // (ADR-0009). Undefined until the first success — callers treat that as
    // "no labels yet" rather than an error.
    this.breaker.fallback(() => this.cache?.rates);

    this.breaker.on("open", () =>
      this.logger.warn("Frankfurter circuit opened — serving cached rates"),
    );
    this.breaker.on("close", () =>
      this.logger.log("Frankfurter circuit closed — rates refreshed live"),
    );
  }

  /** True once the breaker has tripped open. Exposed for observability/tests. */
  get breakerOpen(): boolean {
    return this.breaker.opened;
  }

  /**
   * Current EUR→display rates: the cached set while fresh, otherwise a
   * breaker-guarded refetch that falls back to the (possibly stale) cache.
   * `undefined` only before the very first successful fetch.
   */
  async rates(): Promise<Rates | undefined> {
    if (this.cache && Date.now() - this.cache.at < this.ttlMs) {
      return this.cache.rates;
    }
    return this.breaker.fire();
  }

  /** Fetches fresh rates from Frankfurter and refreshes the cache on success. */
  private async fetchRates(): Promise<Rates> {
    const url = `${this.baseUrl}/latest?base=EUR&symbols=${DISPLAY_CURRENCIES.join(",")}`;
    const res = await this.fetchImpl(url);
    if (!res.ok) throw new Error(`Frankfurter responded ${res.status}`);
    const body = (await res.json()) as FrankfurterLatest;
    const rates = pickRates(body.rates);
    this.cache = { rates, at: Date.now() };
    return rates;
  }
}

/** Extracts the display-currency rates, rejecting a response missing any of them. */
function pickRates(raw: Partial<Record<string, number>>): Rates {
  const rates = {} as Rates;
  for (const currency of DISPLAY_CURRENCIES) {
    const value = raw[currency];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`Frankfurter response missing rate for ${currency}`);
    }
    rates[currency] = value;
  }
  return rates;
}

/**
 * Converts an EUR amount in integer cents into each display currency's major
 * unit, rounded to two decimals (ADR-0006: display-only, never charged). E.g.
 * `1500` cents at `{ USD: 1.08 }` → `{ USD: 16.2 }`.
 */
export function convert(cents: Cents, rates: Rates): DisplayPrices {
  const eur = cents / 100;
  const prices = {} as DisplayPrices;
  for (const currency of DISPLAY_CURRENCIES) {
    prices[currency] = Math.round(eur * rates[currency] * 100) / 100;
  }
  return prices;
}
