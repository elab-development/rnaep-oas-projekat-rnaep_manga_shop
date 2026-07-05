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
