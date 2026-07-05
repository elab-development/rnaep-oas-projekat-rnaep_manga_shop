import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import type {
  ReserveOrderInput,
  ReserveOrderLine,
} from "@workspace/contracts";
import {
  CART_ITEM_MAX_QUANTITY,
  CART_ITEM_MIN_QUANTITY,
} from "@workspace/contracts";

/**
 * Reserve-for-order inputs (ADR-0002). `class-validator` runs on every DTO
 * (ADR-0012) so a malformed reserve request is a 400 before it touches stock.
 * The bounds mirror the cart's per-line quantity limits — a reservation can only
 * ever be as large as the cart that produced it.
 */

/** One line to hold: a Manga id (cross-service ref) and a quantity. */
export class ReserveOrderLineDto implements ReserveOrderLine {
  @IsString()
  @Length(1, 64)
  mangaId!: string;

  @IsInt()
  @Min(CART_ITEM_MIN_QUANTITY)
  @Max(CART_ITEM_MAX_QUANTITY)
  quantity!: number;
}

// A single order can hold at most one line per distinct manga; this cap keeps a
// stray request from asking Catalog to walk an unbounded list.
const MAX_ORDER_LINES = 200;

/** Orders → Catalog reserve request, keyed by `orderId` (ADR-0002, ADR-0003). */
export class ReserveOrderDto implements ReserveOrderInput {
  @IsString()
  @Length(1, 64)
  orderId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ORDER_LINES)
  @ValidateNested({ each: true })
  @Type(() => ReserveOrderLineDto)
  lines!: ReserveOrderLineDto[];
}
