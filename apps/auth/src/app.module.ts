import { Module } from "@nestjs/common";
import { MetricsModule } from "@workspace/observability";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { DrizzleModule } from "./db/drizzle.module";

@Module({
  imports: [MetricsModule.forRoot("auth"), DrizzleModule, AuthModule],
  controllers: [AppController],
})
export class AppModule {}
