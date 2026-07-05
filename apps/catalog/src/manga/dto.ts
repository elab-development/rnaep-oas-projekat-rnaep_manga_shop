import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
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
