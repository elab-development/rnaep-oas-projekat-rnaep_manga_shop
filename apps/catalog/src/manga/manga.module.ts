import {
  Inject,
  Injectable,
  Logger,
  Module,
  type OnModuleInit,
} from "@nestjs/common";
import { CurrencyModule } from "../currency/currency.module";
import { MangaController } from "./manga.controller";
import { MangaService } from "./manga.service";
import { MANGA_MODEL, mangaModelProvider, type MangaModel } from "./manga.schema";
import { SEED_MANGA } from "./seed";

/**
 * Seeds a handful of demo manga on first boot so the list renders immediately
 * (issue 03). Idempotent — only seeds an empty collection — and skipped under
 * tests, which insert their own fixtures against an ephemeral Mongo.
 */
@Injectable()
export class MangaSeeder implements OnModuleInit {
  private readonly logger = new Logger(MangaSeeder.name);

  constructor(@Inject(MANGA_MODEL) private readonly model: MangaModel) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === "test") return;
    try {
      const count = await this.model.estimatedDocumentCount().exec();
      if (count > 0) return;
      await this.model.insertMany(SEED_MANGA);
      this.logger.log(`Seeded ${SEED_MANGA.length} manga`);
    } catch (err) {
      // Non-fatal: a missing DB at boot must not crash the service (the health
      // endpoint still answers). Seeding retries on the next start.
      this.logger.warn(`Skipped seeding: ${(err as Error).message}`);
    }
  }
}

@Module({
  imports: [CurrencyModule],
  controllers: [MangaController],
  providers: [mangaModelProvider, MangaService, MangaSeeder],
  exports: [MangaService],
})
export class MangaModule {}
