import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * A Payment for an Order (CONTEXT.md: Payment; ADR-0008). The Payments service
 * owns this table (ADR-0001: database-per-service). Created `pending` when a
 * Stripe hosted Checkout Session is opened and advanced to `succeeded`/`failed`
 * only by the signature-verified webhook (ADR-0008) — never the browser redirect.
 *
 * `orderId` and `customerId` are **cross-service ids stored as plain logical
 * fields** — no foreign keys reach into Orders or Auth (ADR-0010). `orderId` is
 * unique: one Order has at most one Payment, and re-opening checkout for the same
 * order upserts this row rather than creating a second. `amount` is EUR integer
 * cents (ADR-0006), Catalog/Orders' authority, never supplied by the client.
 */
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().unique(),
  customerId: uuid("customer_id").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull(),
  stripeSessionId: text("stripe_session_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

/**
 * A processed Stripe webhook event, recorded to make webhook handling idempotent
 * on the Stripe event id (ADR-0008, ADR-0013). Stripe delivers at-least-once, so
 * before acting on an event we claim its id here; a duplicate delivery finds the
 * id already present and is skipped, so stock is never committed/released twice.
 */
export const processedEvents = pgTable("processed_events", {
  stripeEventId: text("stripe_event_id").primaryKey(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ProcessedEvent = typeof processedEvents.$inferSelect;
