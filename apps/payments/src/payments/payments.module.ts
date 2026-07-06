import { Module } from "@nestjs/common";
import { AuthGuardModule } from "@workspace/auth-guard";
import { CatalogClient } from "./catalog.client";
import { OrdersClient } from "./orders.client";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { StripeService } from "./stripe.service";

/**
 * Stripe hosted-checkout payment + webhook saga (issue 09, ADR-0008/0002).
 * Imports the shared auth guard (verify the JWT, derive the owning customer for
 * the checkout-session endpoint — ADR-0007). The clients drive the saga's
 * commit/release step synchronously over REST (ADR-0003): Catalog settles stock,
 * Orders advances the order status.
 */
@Module({
  imports: [AuthGuardModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeService, CatalogClient, OrdersClient],
})
export class PaymentsModule {}
