import { IsString, Length } from "class-validator";
import type { CreateOrderInput } from "@workspace/contracts";
import { SHIPPING_FIELD_MAX_LENGTH } from "@workspace/contracts";

/**
 * Checkout body (issue 08). The Customer supplies **only** shipping — items,
 * quantities, titles, and prices all come from the server (the cart and Catalog),
 * never the client (ADR-0010). `class-validator` runs on every DTO (ADR-0012), so
 * a blank or over-long field is a 400 before an order is created. The owning
 * `customerId` is never a field here — it is derived from the token (ADR-0007).
 */
export class CreateOrderDto implements CreateOrderInput {
  @IsString()
  @Length(1, SHIPPING_FIELD_MAX_LENGTH)
  recipientName!: string;

  @IsString()
  @Length(1, SHIPPING_FIELD_MAX_LENGTH)
  address!: string;

  @IsString()
  @Length(1, SHIPPING_FIELD_MAX_LENGTH)
  city!: string;

  @IsString()
  @Length(1, SHIPPING_FIELD_MAX_LENGTH)
  postalCode!: string;

  @IsString()
  @Length(1, SHIPPING_FIELD_MAX_LENGTH)
  phone!: string;
}
