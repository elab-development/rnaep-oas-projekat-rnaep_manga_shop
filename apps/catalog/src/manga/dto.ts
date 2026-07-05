import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import type {
  CreateMangaInput,
  UpdateMangaInput,
} from "@workspace/contracts";
import { CATALOG_MAX_PAGE_SIZE, CATALOG_PAGE_SIZE } from "@workspace/contracts";

/**
 * Query parameters for the paginated catalog list. Validated and coerced at the
 * boundary (ADR-0012) — string query params are transformed to numbers, and an
 * out-of-range page size is a 400, not an unbounded scan.
 */
export class ListMangaQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CATALOG_MAX_PAGE_SIZE)
  @IsOptional()
  limit: number = CATALOG_PAGE_SIZE;

  /** Case-insensitive title search; multiple whitespace-separated terms. */
  @IsString()
  @MaxLength(120)
  @IsOptional()
  q?: string;

  /**
   * Zero or more genres to filter by (repeat the param: `?genre=A&genre=B`).
   * Normalized to a string array so a single value and a list are handled alike.
   */
  @IsOptional()
  @Transform(({ value }) =>
    (Array.isArray(value) ? value : [value]).filter(
      (v: unknown): v is string => typeof v === "string" && v.trim().length > 0,
    ),
  )
  @IsArray()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  @ArrayMaxSize(30)
  genre?: string[];
}

/** Query for the Jikan add-time search (`?q=`). Moderator-gated in the controller. */
export class JikanSearchQuery {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  q!: string;
}

// Bounds shared by create/edit so validation limits stay in one place.
const TITLE_MAX = 200;
const AUTHOR_MAX = 200;
const COVER_MAX = 2048;
const DESCRIPTION_MAX = 5000;
const GENRE_MAX = 60;
const GENRES_MAX = 30;
// EUR integer cents (ADR-0006); a generous ceiling that still rejects overflow.
const PRICE_MAX = 100_000_000;
const QUANTITY_MAX = 1_000_000;

/**
 * Body for creating a Manga (moderator-gated). Data may come from a Jikan
 * suggestion or be typed manually; either way the Moderator sets `price` (EUR
 * cents, ADR-0006) and `quantity` (ADR-0009). `jikanId` is the optional
 * add-time snapshot reference. `implements CreateMangaInput` keeps the wire
 * shape locked to the shared contract.
 */
export class CreateMangaDto implements CreateMangaInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(TITLE_MAX)
  title!: string;

  @IsString()
  @MaxLength(AUTHOR_MAX)
  author = "";

  @IsArray()
  @IsString({ each: true })
  @MaxLength(GENRE_MAX, { each: true })
  @ArrayMaxSize(GENRES_MAX)
  genres: string[] = [];

  @IsString()
  @MaxLength(COVER_MAX)
  cover = "";

  @IsString()
  @MaxLength(DESCRIPTION_MAX)
  description = "";

  @IsInt()
  @Min(0)
  @Max(PRICE_MAX)
  price!: number;

  @IsInt()
  @Min(0)
  @Max(QUANTITY_MAX)
  quantity!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  jikanId?: number;
}

/**
 * Body for editing a Manga's data/price (moderator-gated). Every field is
 * optional — a partial patch. Stock is updated through its own endpoint and
 * `jikanId` is immutable, so neither appears here (ADR-0009).
 */
export class UpdateMangaDto implements UpdateMangaInput {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(TITLE_MAX)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(AUTHOR_MAX)
  author?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(GENRE_MAX, { each: true })
  @ArrayMaxSize(GENRES_MAX)
  genres?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(COVER_MAX)
  cover?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DESCRIPTION_MAX)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(PRICE_MAX)
  price?: number;
}

/** Body for updating a Manga's stock `quantity` (moderator-gated). */
export class UpdateStockDto {
  @IsInt()
  @Min(0)
  @Max(QUANTITY_MAX)
  quantity!: number;
}
