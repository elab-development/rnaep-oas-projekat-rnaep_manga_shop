import type { Cents, DisplayPrices } from "./money";

/**
 * Catalog read models shared between the Catalog service and the Next.js
 * frontend (ADR-0003: payload shapes live in `@workspace/contracts`). Money is
 * EUR integer cents (ADR-0006); fields are English (ADR-0004).
 */

/** Embedded inventory numbers of a Manga (CONTEXT.md: Stock). */
export interface StockView {
  /** Physical copies on hand. */
  quantity: number;
  /** Copies held for unpaid orders. */
  reserved: number;
}

/**
 * A Manga as exposed by the Catalog service. `available` is the derived
 * `quantity − reserved` (CONTEXT.md) so clients never recompute it.
 */
export interface MangaView {
  id: string;
  title: string;
  author: string;
  genres: string[];
  cover: string;
  description: string;
  /** Price in EUR integer cents (ADR-0006). */
  price: Cents;
  /**
   * Display-only conversions of `price` into USD/GBP/JPY (ADR-0006), from cached
   * Frankfurter rates. Absent when no rates are available yet (e.g. the breaker
   * is open before any successful fetch); never affects the charge.
   */
  display?: DisplayPrices;
  stock: StockView;
  /** Derived: `stock.quantity − stock.reserved`. */
  available: number;
}

/** A single page of results plus the counters a pager needs. */
export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Default catalog page size when a client does not specify one. */
export const CATALOG_PAGE_SIZE = 12;
/** Upper bound on a client-requested page size, to cap query cost. */
export const CATALOG_MAX_PAGE_SIZE = 60;
