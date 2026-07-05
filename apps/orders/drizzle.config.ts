import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config for the Orders service's own Postgres (ADR-0001:
 * database-per-service). `drizzle-kit generate` emits SQL migrations from the
 * schema into ./drizzle; they are applied at boot and in integration tests via
 * the node-postgres migrator.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
});
