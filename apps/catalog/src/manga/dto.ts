import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
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

  /** Case-insensitive title substring. */
  @IsString()
  @MaxLength(120)
  @IsOptional()
  q?: string;

  /** Exact genre to filter by. */
  @IsString()
  @MaxLength(60)
  @IsOptional()
  genre?: string;
}
