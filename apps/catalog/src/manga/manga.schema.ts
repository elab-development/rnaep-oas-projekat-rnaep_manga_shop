import type { Provider } from "@nestjs/common";
import { Schema, type Connection, type Model } from "mongoose";
import { MONGO_CONNECTION } from "../database.module";

/** DI token for the Mongoose Manga model. */
export const MANGA_MODEL = Symbol("MANGA_MODEL");

/** Embedded stock numbers (CONTEXT.md: Stock). */
export interface StockDoc {
  /** Physical copies on hand. */
  quantity: number;
  /** Copies held for unpaid orders. */
  reserved: number;
}

/**
 * A Manga document (ADR-0001: Catalog owns Mongo). Price is EUR integer cents
 * (ADR-0006); fields are English (ADR-0004). `jikanId` is kept for the add-time
 * snapshot but never auto-resynced (ADR-0009); enrichment lands in slice 05.
 */
export interface MangaDoc {
  title: string;
  author: string;
  genres: string[];
  cover: string;
  description: string;
  /** EUR integer cents (ADR-0006). */
  price: number;
  stock: StockDoc;
  jikanId?: number;
  /**
   * Editorial Featured flag (CONTEXT.md: Featured) — a human curation choice for
   * the homepage rail. Optional on the type because the schema default (`false`)
   * fills it in on write, so callers (seed data, create) never set it; never
   * derived from sales/stock.
   */
  featured?: boolean;
  /**
   * Creation time, maintained by Mongoose `timestamps`. Surfaced here so the
   * catalog can order New Arrivals newest-first and expose it on `MangaView`.
   * Optional on the type because legacy documents may predate it (backfilled
   * from the `ObjectId` — a defensive no-op in practice).
   */
  createdAt?: Date;
}

const StockSchema = new Schema<StockDoc>(
  {
    quantity: { type: Number, required: true, min: 0, default: 0 },
    reserved: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false },
);

export const MangaSchema = new Schema<MangaDoc>(
  {
    title: { type: String, required: true },
    author: { type: String, required: true, default: "" },
    genres: { type: [String], required: true, default: [] },
    cover: { type: String, required: true, default: "" },
    description: { type: String, required: true, default: "" },
    price: { type: Number, required: true, min: 0 },
    stock: {
      type: StockSchema,
      required: true,
      default: (): StockDoc => ({ quantity: 0, reserved: 0 }),
    },
    jikanId: { type: Number, required: false },
    featured: { type: Boolean, required: true, default: false },
  },
  { timestamps: true, collection: "manga" },
);

// Title search is case-insensitive substring; genre filter matches array
// membership. A compound index keeps both cheap as the catalog grows.
MangaSchema.index({ title: 1 });
MangaSchema.index({ genres: 1 });
// New Arrivals / default sort is newest-first by creation time (CONTEXT.md).
MangaSchema.index({ createdAt: -1 });

export type MangaModel = Model<MangaDoc>;

/** Binds the Manga model to the Catalog service's connection. */
export const mangaModelProvider: Provider = {
  provide: MANGA_MODEL,
  inject: [MONGO_CONNECTION],
  useFactory: (connection: Connection): MangaModel =>
    connection.model<MangaDoc>("Manga", MangaSchema),
};
