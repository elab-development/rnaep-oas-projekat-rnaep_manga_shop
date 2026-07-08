import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { Roles } from "@workspace/contracts";

/**
 * A single hierarchical role per user (ADR-0005); `customer` is the default at
 * registration. The enum values mirror `@workspace/contracts` Roles so the DB,
 * tokens, and guards all speak the same vocabulary (ADR-0004).
 */
export const roleEnum = pgEnum("role", [
  Roles.Customer,
  Roles.Moderator,
  Roles.Admin,
]);

/** Auth-owned account. Password is stored only as a bcrypt hash (spec §2.3). */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default(Roles.Customer),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
