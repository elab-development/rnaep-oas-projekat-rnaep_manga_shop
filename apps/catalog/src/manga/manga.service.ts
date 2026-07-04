import { Inject, Injectable } from "@nestjs/common";
import type { MangaView, Paginated } from "@workspace/contracts";
import {
  isValidObjectId,
  type FilterQuery,
  type HydratedDocument,
} from "mongoose";
import { MANGA_MODEL, type MangaDoc, type MangaModel } from "./manga.schema";

interface ListParams {
  page: number;
  limit: number;
  q?: string;
  genre?: string;
}

@Injectable()
export class MangaService {
  constructor(@Inject(MANGA_MODEL) private readonly model: MangaModel) {}

  /**
   * A page of the catalog, optionally filtered by title substring and/or genre.
   * Sorted by title for a stable order across pages.
   */
  async list(params: ListParams): Promise<Paginated<MangaView>> {
    const filter: FilterQuery<MangaDoc> = {};
    if (params.q) {
      filter.title = { $regex: escapeRegex(params.q), $options: "i" };
    }
    if (params.genre) {
      filter.genres = params.genre;
    }

    const total = await this.model.countDocuments(filter).exec();
    const docs = await this.model
      .find(filter)
      .sort({ title: 1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit)
      .exec();

    return {
      items: docs.map(toView),
      page: params.page,
      limit: params.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / params.limit),
    };
  }

  /** A single manga with computed availability, or null if it does not exist. */
  async findById(id: string): Promise<MangaView | null> {
    // A malformed id is a miss, not a cast error (500).
    if (!isValidObjectId(id)) return null;
    const doc = await this.model.findById(id).exec();
    return doc ? toView(doc) : null;
  }
}

/** Maps a Mongo document to the public view, deriving `available` (CONTEXT.md). */
function toView(doc: HydratedDocument<MangaDoc>): MangaView {
  return {
    id: doc.id as string,
    title: doc.title,
    author: doc.author,
    genres: doc.genres,
    cover: doc.cover,
    description: doc.description,
    price: doc.price,
    stock: { quantity: doc.stock.quantity, reserved: doc.stock.reserved },
    available: doc.stock.quantity - doc.stock.reserved,
  };
}

/** Escapes regex metacharacters so a search term is matched literally. */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
