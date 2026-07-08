import { Module } from "@nestjs/common";
import { AuthGuardModule } from "@workspace/auth-guard";
import { KafkaProducer } from "@workspace/messaging";
import { CartModule } from "../cart/cart.module";
import { OrdersConsumer } from "./orders.consumer";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

/**
 * Checkout → order + saga (issue 08, migrated to Kafka in issue 11,
 * ADR-0002/0003/0010). Imports the shared auth guard (verify the JWT, derive the
 * owning customer — ADR-0007) and {@link CartModule} to read and clear the
 * Customer's cart at checkout. In the Kafka phase checkout emits `order-created`
 * via the {@link KafkaProducer} and the {@link OrdersConsumer} reacts to
 * `stock-reserved`/`stock-rejected`/`payment-succeeded`/`payment-failed` — the
 * sync-phase Catalog HTTP client and internal REST controller are gone.
 */
@Module({
  imports: [AuthGuardModule, CartModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersConsumer, KafkaProducer],
})
export class OrdersModule {}
