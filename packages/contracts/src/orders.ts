/**
 * Orders read/write models shared between the Orders service and the Next.js
 * frontend (ADR-0003: payload shapes live in `@workspace/contracts`). Fields are
 * English (ADR-0004). A Cart is a Customer's working set of CartItems before
 * checkout (CONTEXT.md); it is keyed by `customerId`, which always comes from the
 * verified token, never the request body (ADR-0007, ADR-0012 IDOR protection).
 */

/**
 * One line of a Cart: a reference to a Manga by id (a cross-service id, stored as
 * a plain logical field — ADR-0010) and the desired `quantity`. The cart carries
 * no price: prices are snapshotted onto the Order at checkout from the current
 * Catalog price (ADR-0010), never supplied by the client.
 */
export interface CartItemView {
  /** The referenced Manga's id (Catalog-owned; ADR-0010 cross-service ref). */
  mangaId: string;
  quantity: number;
}

/** A Customer's whole Cart as exposed by the Orders service. */
export interface CartView {
  items: CartItemView[];
}

/**
 * Adds a Manga to the cart. If the Manga is already in the cart its quantity is
 * increased by `quantity`; otherwise a new line is created. The `customerId` is
 * never part of this input — it is derived from the token (ADR-0007).
 */
export interface AddCartItemInput {
  mangaId: string;
  quantity: number;
}

/** Sets a cart line's absolute `quantity` (not a delta). */
export interface UpdateCartItemInput {
  quantity: number;
}

/** Smallest valid quantity for a cart line; a 0 is a removal, not an update. */
export const CART_ITEM_MIN_QUANTITY = 1;
/** Upper bound on a single line's quantity, to keep a cart sane. */
export const CART_ITEM_MAX_QUANTITY = 99;
