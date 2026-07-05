import { Module } from "@nestjs/common";
import { AuthGuardModule } from "@workspace/auth-guard";
import { CartModule } from "../cart/cart.module";
import { CatalogClient } from "./catalog.client";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

/**
 * Checkout → order + synchronous reservation (issue 08, ADR-0002/0010). Imports
 * the shared auth guard (verify the JWT, derive the owning customer — ADR-0007)
 * and {@link CartModule} to read and clear the Customer's cart at checkout.
 */
@Module({
  imports: [AuthGuardModule, CartModule],
  controllers: [OrdersController],
  providers: [OrdersService, CatalogClient],
})
export class OrdersModule {}
