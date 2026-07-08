import { IsInt, IsString, Length, Max, Min } from "class-validator";
import {
  CART_ITEM_MAX_QUANTITY,
  CART_ITEM_MIN_QUANTITY,
} from "@workspace/contracts";

/**
 * Cart-write inputs. `class-validator` runs on every DTO (ADR-0012) so malformed
 * input is rejected with a 400 before it reaches the service. Note the actor
 * (`customerId`) is never a DTO field — it is derived from the verified token
 * (ADR-0007), so it can't be forged in the body.
 */

/** Add a Manga to the cart, increasing an existing line's quantity if present. */
export class AddCartItemDto {
  // A Catalog Manga id (a Mongo ObjectId hex string); we only require a non-empty
  // string here — the id is a cross-service reference, not an Orders foreign key.
  @IsString()
  @Length(1, 64)
  mangaId!: string;

  @IsInt()
  @Min(CART_ITEM_MIN_QUANTITY)
  @Max(CART_ITEM_MAX_QUANTITY)
  quantity!: number;
}

/** Set a cart line's absolute quantity (not a delta). */
export class UpdateCartItemDto {
  @IsInt()
  @Min(CART_ITEM_MIN_QUANTITY)
  @Max(CART_ITEM_MAX_QUANTITY)
  quantity!: number;
}
