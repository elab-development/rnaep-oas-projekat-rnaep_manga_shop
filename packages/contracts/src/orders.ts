/**
 * Orders read/write models shared between the Orders service and the Next.js
 * frontend (ADR-0003: payload shapes live in `@workspace/contracts`). Fields are
 * English (ADR-0004). A Cart is a Customer's working set of CartItems before
 * checkout (CONTEXT.md); it is keyed by `customerId`, which always comes from the
 * verified token, never the request body (ADR-0007, ADR-0012 IDOR protection).
 */

import type { Cents } from "./money";

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

/**
 * An Order's lifecycle status (CONTEXT.md, ADR-0010). `pending_payment` → `paid`
 * (verified Stripe webhook) → `shipped` (an admin). `cancelled` only ever happens
 * automatically (payment failure / 30-min expiry). Checkout (issue 08) creates an
 * order in `pending_payment`; the later statuses land with Payments (issue 09).
 */
export type OrderStatus = "pending_payment" | "paid" | "shipped" | "cancelled";

/**
 * Where an Order ships to, entered by the Customer at checkout and snapshotted
 * onto the Order so fulfillment needs no other service (ADR-0010: orders are
 * self-describing). The account email is deliberately not here — it is resolved
 * on demand from Auth (ADR-0010).
 */
export interface ShippingDetails {
  recipientName: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
}

/**
 * Checkout body (issue 08). The Customer supplies **only** shipping — the items,
 * quantities, titles, and prices all come from the server (the cart and Catalog),
 * never the client (ADR-0010). The owning `customerId` comes from the token
 * (ADR-0007), so it is not a field here either.
 */
export type CreateOrderInput = ShippingDetails;

/**
 * One line of a placed Order. `title` and `price` are **snapshots** taken from
 * Catalog at checkout (ADR-0010), so later catalog changes never alter the order.
 */
export interface OrderItemView {
  mangaId: string;
  title: string;
  /** Per-unit EUR price in integer cents, snapshotted at order time (ADR-0006). */
  price: Cents;
  quantity: number;
}

/** A placed Order as exposed by the Orders service. */
export interface OrderView {
  id: string;
  status: OrderStatus;
  shipping: ShippingDetails;
  items: OrderItemView[];
  /** Order total in EUR integer cents: Σ line `price × quantity` (ADR-0006). */
  total: Cents;
  createdAt: string;
}

/**
 * An Order as exposed to an Admin overseeing the business (issue 10). Extends the
 * customer-facing {@link OrderView} with the owning `customerId` so the Next.js
 * layer can resolve the customer's email on demand from Auth (a batch lookup —
 * the email is never duplicated onto the order, ADR-0010/0011). Returned only by
 * the admin-gated all-orders endpoint, never to a Customer.
 */
export interface AdminOrderView extends OrderView {
  /** The owning Customer's id (Auth-owned; ADR-0010 cross-service ref). */
  customerId: string;
}

/** Max length of any single shipping free-text field, to bound stored input. */
export const SHIPPING_FIELD_MAX_LENGTH = 200;

/**
 * Internal (service-to-service) view of an Order, returned by Orders to Payments
 * when it advances an order's status from a verified Stripe webhook (issue 09).
 * Mounted behind `/internal/*`, a path the thin gateway never routes (ADR-0011),
 * so it is reachable only inside the cluster, never from a browser.
 */
export interface OrderStatusResult {
  orderId: string;
  status: OrderStatus;
}
