import { IsString, IsUUID } from "class-validator";
import type { CreateCheckoutSessionInput } from "@workspace/contracts";

/**
 * Start-payment body (issue 09). The Customer supplies **only** the `orderId`;
 * the amount is Orders/Catalog's authority and the owning customer comes from the
 * verified token (ADR-0007, ADR-0010). `class-validator` runs on every DTO
 * (ADR-0012), so a malformed id is a 400 before Stripe is ever called. Orders
 * ids are UUIDs, so a non-UUID can never reference a real order.
 */
export class CreateCheckoutSessionDto implements CreateCheckoutSessionInput {
  @IsString()
  @IsUUID()
  orderId!: string;
}
