import {
  Global,
  Injectable,
  Logger,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import mongoose from "mongoose";

/**
 * Verifies the Catalog service's MongoDB is reachable at boot (ADR-0001:
 * Catalog owns Mongo). Manga schemas and repositories land in later slices; the
 * scaffold only proves the connection. Skipped under tests (no live DB).
 */
@Injectable()
export class MongoHealthcheck implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MongoHealthcheck.name);

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === "test") return;
    const uri =
      process.env.MONGODB_URI ?? "mongodb://localhost:27017/catalog";
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
      this.logger.log("Mongo connection verified");
    } catch (err) {
      this.logger.warn(
        `Mongo not reachable at boot: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await mongoose.disconnect().catch(() => undefined);
  }
}

@Global()
@Module({
  providers: [MongoHealthcheck],
  exports: [MongoHealthcheck],
})
export class DatabaseModule {}
