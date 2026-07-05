import { join } from "node:path";
import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "./schema";

/** DI token for the Drizzle database handle. */
export const DRIZZLE = Symbol("DRIZZLE");
/** DI token for the underlying pg Pool (owned here so shutdown can close it). */
export const PG_POOL = Symbol("PG_POOL");

export type Database = NodePgDatabase<typeof schema>;

/** Migrations live two levels up from this module: `<service>/drizzle`, which
 * resolves the same from `src/db` (tests) and `dist/db` (runtime). */
const MIGRATIONS_FOLDER = join(__dirname, "..", "..", "drizzle");

function connectionString(): string {
  // Falls back to the docker-compose Postgres published on the host so
  // `pnpm dev` works without a `.env` file (see docker-compose.yml).
  return (
    process.env.DATABASE_URL ?? "postgres://orders:orders@localhost:55433/orders"
  );
}

/**
 * Provides the Orders service's own Postgres via Drizzle (ADR-0001) and applies
 * pending migrations at startup. SQL injection is prevented by Drizzle's
 * parameterized queries (ADR-0012).
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (): Pool => {
        const logger = new Logger("DrizzleModule");
        const pool = new Pool({ connectionString: connectionString() });
        pool.on("error", (err) =>
          logger.warn(`Postgres pool error: ${err.message}`),
        );
        return pool;
      },
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: async (pool: Pool): Promise<Database> => {
        const logger = new Logger("DrizzleModule");
        const db = drizzle(pool, { schema });
        try {
          await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
          logger.log("Postgres connected; migrations applied");
        } catch (err) {
          // Non-fatal at boot so the health endpoint still answers when the DB
          // is absent (e.g. the scaffold health e2e). Endpoints that touch the
          // DB surface the real error on first use.
          logger.warn(
            `Migrations not applied at boot: ${(err as Error).message}`,
          );
        }
        return db;
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    // Close the pool so tests and graceful shutdown don't leak connections.
    await this.pool.end().catch(() => undefined);
  }
}
