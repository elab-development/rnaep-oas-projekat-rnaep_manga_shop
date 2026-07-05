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
  genres?: string[];
}

@Injectable()
export class MangaService {
  constructor(@Inject(MANGA_MODEL) private readonly model: MangaModel) {}

  /**
   * A page of the catalog, optionally filtered by title and/or genres. Title
   * search is token-based: every whitespace-separated term must appear somewhere
   * in the title (case-insensitive, any order) — so "special naruto" matches
   * "Naruto Special". Genres filter is case-insensitive OR — a manga matching any
   * selected genre is included. Sorted by title for a stable order across pages.
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
    const filter: FilterQuery<MangaDoc> =
      clauses.length > 0 ? { $and: clauses } : {};

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

/** Splits a search string into non-empty, whitespace-separated terms. */
function tokenize(q?: string): string[] {
  if (!q) return [];
  return q.trim().split(/\s+/).filter(Boolean);
}

/** Escapes regex metacharacters so a search term is matched literally. */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
