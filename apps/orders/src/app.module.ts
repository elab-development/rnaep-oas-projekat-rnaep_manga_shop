import { Module } from "@nestjs/common";
import { AuthGuardModule } from "@workspace/auth-guard";
import { MetricsModule } from "@workspace/observability";
import { AppController } from "./app.controller";
import { CartModule } from "./cart/cart.module";
import { DrizzleModule } from "./db/drizzle.module";
import { OrdersModule } from "./orders/orders.module";

@Module({
  imports: [
    MetricsModule.forRoot("orders"),
    DrizzleModule,
    AuthGuardModule,
    CartModule,
    OrdersModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
