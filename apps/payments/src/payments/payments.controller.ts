import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
  type RawBodyRequest,
} from "@nestjs/common";
import {
  CurrentUser,
  JwtAuthGuard,
  type AuthUser,
} from "@workspace/auth-guard";
import type { CheckoutSessionView } from "@workspace/contracts";
import type { Request } from "express";
import { CreateCheckoutSessionDto } from "./dto";
import { PaymentsService } from "./payments.service";

/**
 * Payments HTTP boundary (ADR-0008, ADR-0011). Two very different endpoints:
 *
 * - `POST /payments/checkout-session` is a Customer action: login-required, the
 *   owning customer taken from the verified token (@CurrentUser), never the body
 *   (ADR-0007, ADR-0012). The Customer's token is forwarded to Orders so the
 *   amount read is ownership-scoped.
 * - `POST /payments/webhook` is Stripe calling us. It carries no JWT — its
 *   authenticity is the `stripe-signature` HMAC verified against
 *   `STRIPE_WEBHOOK_SECRET` (ADR-0008), so it is deliberately **not** behind the
 *   auth guard. It reads the raw request body (signature covers the exact bytes).
 */
@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("checkout-session")
  @UseGuards(JwtAuthGuard)
  createCheckoutSession(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCheckoutSessionDto,
    @Req() req: Request,
  ): Promise<CheckoutSessionView> {
    return this.payments.createCheckoutSession(
      user.userId,
      dto.orderId,
      bearerTokenOf(req),
    );
  }

  @Post("webhook")
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string | undefined,
  ): Promise<{ received: true }> {
    if (!req.rawBody) {
      throw new BadRequestException("Missing webhook payload");
    }
    if (!signature) {
      throw new BadRequestException("Missing stripe-signature header");
    }
    await this.payments.handleWebhook(req.rawBody, signature);
    return { received: true };
  }
}

/** Extracts the raw Bearer token so Payments can forward it to Orders (ADR-0007). */
function bearerTokenOf(req: Request): string {
  const [scheme, token] = (req.headers.authorization ?? "").split(" ");
  return scheme === "Bearer" && token ? token : "";
}
