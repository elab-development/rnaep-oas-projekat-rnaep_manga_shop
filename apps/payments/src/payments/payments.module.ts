import { Module } from "@nestjs/common";
import { AuthGuardModule } from "@workspace/auth-guard";
import { KafkaProducer } from "@workspace/messaging";
import { OrdersClient } from "./orders.client";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { StripeService } from "./stripe.service";

/**
 * Stripe hosted-checkout payment + webhook saga (issue 09, migrated to Kafka in
 * issue 11, ADR-0008/0002). Imports the shared auth guard (verify the JWT, derive
 * the owning customer for the checkout-session endpoint — ADR-0007). The webhook
 * now announces the outcome by emitting `payment-succeeded` / `payment-failed` via
 * the {@link KafkaProducer}; Orders and Catalog settle from those events. Orders is
 * still read over REST ({@link OrdersClient}) for the authoritative amount — a
 * query, not a saga step.
 */
@Module({
  imports: [AuthGuardModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeService, OrdersClient, KafkaProducer],
})
export class PaymentsModule {}
