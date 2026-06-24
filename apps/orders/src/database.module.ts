import {
  Global,
  Injectable,
  Logger,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Pool } from "pg";

/**
 * Verifies this service's own Postgres is reachable at boot (ADR-0001:
 * database-per-service). Drizzle schema and repositories land in later slices;
 * the scaffold only proves the connection. Skipped under tests (no live DB).
 */
@Injectable()
export class PostgresHealthcheck implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PostgresHealthcheck.name);
  private readonly pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  constructor() {
    // A failing idle client must not crash the process during the scaffold.
    this.pool.on("error", (err) =>
      this.logger.warn(`Postgres pool error: ${err.message}`),
    );
  }

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === "test") return;
    try {
      await this.pool.query("SELECT 1");
      this.logger.log("Postgres connection verified");
    } catch (err) {
      this.logger.warn(
        `Postgres not reachable at boot: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end().catch(() => undefined);
  }
}

@Global()
@Module({
  providers: [PostgresHealthcheck],
  exports: [PostgresHealthcheck],
})
export class DatabaseModule {}
