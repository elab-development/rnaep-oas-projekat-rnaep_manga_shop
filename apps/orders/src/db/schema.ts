import {
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * A single line of a Customer's Cart (CONTEXT.md: Cart, CartItem). The Orders
 * service owns this table (ADR-0001: database-per-service).
 *
 * `customerId` and `mangaId` are **cross-service ids stored as plain logical
 * fields** — no foreign keys reach into Auth or Catalog (ADR-0010). The cart is
 * keyed by `customerId`, which always comes from the verified token, never the
 * request body (ADR-0007, ADR-0012 IDOR protection).
 *
 * `(customerId, mangaId)` is unique so a Manga appears at most once per cart:
 * adding a Manga already in the cart bumps its `quantity` rather than creating a
 * duplicate line. There is no separate `carts` row — a Customer's cart simply
 * *is* the set of rows sharing their `customerId`; an empty cart is zero rows.
 */
export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id").notNull(),
    mangaId: text("manga_id").notNull(),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique().on(table.customerId, table.mangaId)],
);

export type CartItem = typeof cartItems.$inferSelect;
export type NewCartItem = typeof cartItems.$inferInsert;

/**
 * A placed Order (CONTEXT.md: Order; ADR-0010). Created from a Cart at checkout
 * (issue 08). The Order is **self-describing for fulfillment** (ADR-0010): the
 * shipping fields are snapshotted here so shipping needs no other service; the
 * account email is deliberately absent (resolved on demand from Auth).
 *
 * `customerId` is a cross-service id stored as a plain field (ADR-0010), always
 * taken from the verified token (ADR-0007). `status` starts `pending_payment`
 * and advances via the payment saga (issues 09/10). `total` is EUR integer cents
 * (ADR-0006): Σ of each item's snapshotted `price × quantity`.
 */
export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").notNull(),
  status: text("status").notNull(),
  recipientName: text("recipient_name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  postalCode: text("postal_code").notNull(),
  phone: text("phone").notNull(),
  total: integer("total").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * One line of an Order. `title` and `price` (per-unit EUR cents) are **snapshots**
 * taken from Catalog at checkout (ADR-0010), never the client's — so later
 * catalog edits can't rewrite a placed order and a client can't forge a price.
 * `mangaId` is a cross-service reference (ADR-0010); the only real foreign key is
 * `orderId` into this service's own `orders` table.
 */
export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  mangaId: text("manga_id").notNull(),
  title: text("title").notNull(),
  price: integer("price").notNull(),
  quantity: integer("quantity").notNull(),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
