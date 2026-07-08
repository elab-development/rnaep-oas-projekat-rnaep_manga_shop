import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
} from "@nestjs/common";
import type {
  CreateMangaInput,
  MangaView,
  Paginated,
  UpdateMangaInput,
} from "@workspace/contracts";
import {
  isValidObjectId,
  Types,
  type FilterQuery,
  type HydratedDocument,
} from "mongoose";
import { convert, CurrencyService, type Rates } from "../currency/currency.service";
import { MANGA_MODEL, type MangaDoc, type MangaModel } from "./manga.schema";

interface ListParams {
  page: number;
  limit: number;
  q?: string;
  genres?: string[];
  /** Narrow to curated Featured manga (CONTEXT.md) when set. */
  featured?: boolean;
}

@Injectable()
export class MangaService implements OnModuleInit {
  private readonly logger = new Logger(MangaService.name);

  constructor(
    @Inject(MANGA_MODEL) private readonly model: MangaModel,
    private readonly currency: CurrencyService,
  ) {}

  /**
   * Defensive backfill (PRD story 29): give any legacy document missing
   * `createdAt` one derived from its `ObjectId` generation time, so New Arrivals
   * ordering is correct from day one even for pre-timestamps rows. Expected to
   * be a no-op — Mongoose `timestamps` has been on since the schema's creation.
   */
  async onModuleInit(): Promise<void> {
    // Skipped under tests — fixtures already carry `createdAt`, and the scaffold
    // health e2e boots with no Mongo, so awaiting a DB write here would stall
    // startup past the test's boot timeout. Like the seeder it is also non-fatal:
    // a missing/slow DB at boot must not crash the service (the health endpoint
    // still answers); the backfill retries on the next start.
    if (process.env.NODE_ENV === "test") return;
    try {
      await this.model
        .updateMany({ createdAt: { $exists: false } }, [
          { $set: { createdAt: { $toDate: "$_id" } } },
        ])
        .exec();
    } catch (err) {
      this.logger.warn(`Skipped createdAt backfill: ${(err as Error).message}`);
    }
  }

  /**
   * A page of the catalog, optionally filtered by title and/or genres. Title
   * search is token-based: every whitespace-separated term must appear somewhere
   * in the title (case-insensitive, any order) — so "special naruto" matches
   * "Naruto Special". Genres filter is case-insensitive OR — a manga matching any
   * selected genre is included. An optional `featured` filter narrows to the
   * curated Featured rail (CONTEXT.md). Sorted newest-first by creation time —
   * the New Arrivals ordering and the catalog's default sort (CONTEXT.md).
   */
  async list(params: ListParams): Promise<Paginated<MangaView>> {
    const clauses: FilterQuery<MangaDoc>[] = [];
    for (const term of tokenize(params.q)) {
      clauses.push({ title: { $regex: escapeRegex(term), $options: "i" } });
    }
    if (params.genres && params.genres.length > 0) {
      clauses.push({
        genres: {
          $in: params.genres.map(
            (g) => new RegExp(`^${escapeRegex(g)}$`, "i"),
          ),
        },
      });
    }
    if (params.featured !== undefined) {
      clauses.push({ featured: params.featured });
    }
    const filter: FilterQuery<MangaDoc> =
      clauses.length > 0 ? { $and: clauses } : {};

    const total = await this.model.countDocuments(filter).exec();
    const docs = await this.model
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .exec();

    const rates = await this.currency.rates();
    return {
      items: docs.map((doc) => toView(doc, rates)),
      page: params.page,
      limit: params.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / params.limit),
    };
  }

  /**
   * The distinct genres present across the catalog, sorted — powers the genre
   * filter chips so the UI never hardcodes a genre list (ADR-0009: the catalog
   * is the source of truth for its own facets).
   */
  async genres(): Promise<string[]> {
    const values = await this.model.distinct("genres").exec();
    return values.sort((a, b) => a.localeCompare(b));
  }

  /** A single manga with computed availability, or null if it does not exist. */
  async findById(id: string): Promise<MangaView | null> {
    // A malformed id is a miss, not a cast error (500).
    if (!isValidObjectId(id)) return null;
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    const rates = await this.currency.rates();
    return toView(doc, rates);
  }

  /**
   * Creates a Manga from moderator-supplied data (ADR-0009). `reserved` starts
   * at 0; any `jikanId` is the add-time snapshot reference, never resynced.
   */
  async create(input: CreateMangaInput): Promise<MangaView> {
    const doc = await this.model.create({
      title: input.title,
      author: input.author,
      genres: input.genres,
      cover: input.cover,
      description: input.description,
      price: input.price,
      stock: { quantity: input.quantity, reserved: 0 },
      jikanId: input.jikanId,
    });
    const rates = await this.currency.rates();
    return toView(doc, rates);
  }

  /**
   * Applies a partial edit to a Manga's data/price (ADR-0009: never touches
   * `jikanId` or stock, so moderator edits stick). Returns null if it does not
   * exist so the controller can 404.
   */
  async update(
    id: string,
    input: UpdateMangaInput,
  ): Promise<MangaView | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await this.model
      .findByIdAndUpdate(
        id,
        { $set: input },
        { new: true, runValidators: true },
      )
      .exec();
    if (!doc) return null;
    const rates = await this.currency.rates();
    return toView(doc, rates);
  }

  /**
   * Sets a Manga's physical stock `quantity` (ADR-0009). Refuses to drop below
   * the currently `reserved` count — those copies are held for unpaid orders,
   * and going below would make `available` negative (overselling; ADR-0002).
   * Returns null if the manga does not exist.
   */
  async updateStock(
    id: string,
    quantity: number,
  ): Promise<MangaView | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await this.model.findById(id).exec();
    if (!doc) return null;
    if (quantity < doc.stock.reserved) {
      throw new ConflictException(
        `Cannot set quantity (${quantity}) below reserved (${doc.stock.reserved})`,
      );
    }
    doc.stock.quantity = quantity;
    await doc.save();
    const rates = await this.currency.rates();
    return toView(doc, rates);
  }

  /** Deletes a Manga. Returns false if no such manga existed (admin-gated). */
  async remove(id: string): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    const deleted = await this.model.findByIdAndDelete(id).exec();
    return deleted !== null;
  }
}

/**
 * Maps a Mongo document to the public view, deriving `available` (CONTEXT.md)
 * and, when rates are available, the display-only currency labels (ADR-0006).
 */
function toView(doc: HydratedDocument<MangaDoc>, rates?: Rates): MangaView {
  return {
    id: doc.id as string,
    title: doc.title,
    author: doc.author,
    genres: doc.genres,
    cover: doc.cover,
    description: doc.description,
    price: doc.price,
    display: rates ? convert(doc.price, rates) : undefined,
    stock: { quantity: doc.stock.quantity, reserved: doc.stock.reserved },
    available: doc.stock.quantity - doc.stock.reserved,
    featured: doc.featured ?? false,
    // Prefer the persisted timestamp; fall back to the ObjectId's generation
    // time so New Arrivals ordering holds even for a legacy row (defensive).
    createdAt: (
      doc.createdAt ?? (doc._id as Types.ObjectId).getTimestamp()
    ).toISOString(),
  };
}

/** Splits a search string into non-empty, whitespace-separated terms. */
function tokenize(q?: string): string[] {
  if (!q) return [];
  return q.trim().split(/\s+/).filter(Boolean);
}

/** Escapes regex metacharacters so a search term is matched literally. */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
