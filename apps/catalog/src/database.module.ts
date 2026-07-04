import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
} from "@nestjs/common";
import mongoose, { type Connection } from "mongoose";

/** DI token for the Catalog service's MongoDB connection. */
export const MONGO_CONNECTION = Symbol("MONGO_CONNECTION");

function mongoUri(): string {
  // Falls back to the docker-compose Mongo published on the host so `pnpm dev`
  // works without a `.env` file (see docker-compose.yml).
  return process.env.MONGODB_URI ?? "mongodb://localhost:27017/catalog";
}

/**
 * Provides the Catalog service's own MongoDB (ADR-0001: Catalog owns Mongo).
 * `createConnection` returns immediately and connects in the background,
 * buffering commands — so a missing DB never fails boot (the scaffold health
 * e2e runs with no Mongo). Endpoints that touch the DB surface the real error
 * on first use.
 */
@Global()
@Module({
  providers: [
    {
      provide: MONGO_CONNECTION,
      useFactory: (): Connection => {
        const logger = new Logger("DatabaseModule");
        const connection = mongoose.createConnection(mongoUri(), {
          serverSelectionTimeoutMS: 5000,
        });
        connection.on("connected", () => logger.log("Mongo connected"));
        connection.on("error", (err: Error) =>
          logger.warn(`Mongo connection error: ${err.message}`),
        );
        return connection;
      },
    },
  ],
  exports: [MONGO_CONNECTION],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(
    @Inject(MONGO_CONNECTION) private readonly connection: Connection,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    // Close the connection so tests and graceful shutdown don't leak sockets.
    await this.connection.close().catch(() => undefined);
  }
}
