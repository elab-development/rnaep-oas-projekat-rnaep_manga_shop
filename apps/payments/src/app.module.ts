import { Module } from "@nestjs/common";
import { AuthGuardModule } from "@workspace/auth-guard";
import { MetricsModule } from "@workspace/observability";
import { AppController } from "./app.controller";
import { DrizzleModule } from "./db/drizzle.module";
import { PaymentsModule } from "./payments/payments.module";

@Module({
  imports: [
    MetricsModule.forRoot("payments"),
    DrizzleModule,
    AuthGuardModule,
    PaymentsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
