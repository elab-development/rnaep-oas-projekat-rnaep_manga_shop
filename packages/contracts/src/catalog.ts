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

/**
 * A Jikan search result normalized to the fields a Moderator prefills when
 * adding a Manga (ADR-0009: enrichment is a snapshot at add-time). `jikanId`
 * is kept for reference and never used to auto-resync. Jikan supplies neither
 * price nor stock — the Moderator sets those.
 */
export interface JikanSuggestion {
  jikanId: number;
  title: string;
  author: string;
  genres: string[];
  cover: string;
  description: string;
}

/**
 * The fields a Moderator supplies to create a Manga. Data may be prefilled from
 * a {@link JikanSuggestion} or entered manually; either way price (EUR cents,
 * ADR-0006) and `quantity` are the Moderator's own (ADR-0009). `jikanId` is the
 * add-time snapshot reference, absent for a fully manual entry.
 */
export interface CreateMangaInput {
  title: string;
  author: string;
  genres: string[];
  cover: string;
  description: string;
  /** Price in EUR integer cents (ADR-0006). */
  price: Cents;
  /** Physical copies on hand at creation; `reserved` starts at 0. */
  quantity: number;
  jikanId?: number;
}

/**
 * A partial edit to a Manga's data and price. Stock is updated through its own
 * endpoint, and `jikanId` is immutable once set (ADR-0009: edits are never
 * clobbered by Jikan, and Jikan never re-clobbers them either).
 */
export type UpdateMangaInput = Partial<
  Omit<CreateMangaInput, "quantity" | "jikanId">
>;

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

/**
 * One line Orders asks Catalog to reserve for an Order (ADR-0002). The client
 * never appears here — `quantity` comes from the server-side cart, and the price
 * is Catalog's to decide (returned in {@link ReservedLine}), never supplied.
 */
export interface ReserveOrderLine {
  /** The Manga to hold stock for (Catalog-owned id; ADR-0010 cross-service ref). */
  mangaId: string;
  quantity: number;
}

/**
 * Orders → Catalog "reserve for order" request (ADR-0002, ADR-0003). Keyed by
 * `orderId`, the idempotency key everywhere in the saga: re-sending the same
 * `orderId` must not double-reserve. Today a REST DTO; tomorrow the
 * `order-created` Kafka message (ADR-0003), shape unchanged.
 */
export interface ReserveOrderInput {
  orderId: string;
  lines: ReserveOrderLine[];
}

/**
 * A successfully reserved line echoed back with Catalog's **authoritative** title
 * and EUR price (ADR-0002, ADR-0010) — Orders snapshots these into the Order so
 * later catalog edits never alter a placed order, and so the client can't forge a
 * price.
 */
export interface ReservedLine {
  mangaId: string;
  title: string;
  /** Current per-unit EUR price in integer cents (ADR-0006). */
  price: Cents;
  quantity: number;
}

/**
 * Result of a reserve-for-order: **all-or-nothing** (ADR-0002). Either every line
 * is held (`reserved`, carrying the priced lines) or none is and the whole order
 * is `rejected` (partial holds are rolled back first). Maps 1:1 to the future
 * `stock-reserved` / `stock-rejected` events (ADR-0003).
 */
export type ReservationResult =
  | { status: "reserved"; orderId: string; lines: ReservedLine[] }
  | { status: "rejected"; orderId: string; reason: string };
