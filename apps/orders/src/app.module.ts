import { Module } from "@nestjs/common";
import { AuthGuardModule } from "@workspace/auth-guard";
import { AppController } from "./app.controller";
import { CartModule } from "./cart/cart.module";
import { DrizzleModule } from "./db/drizzle.module";

@Module({
  imports: [DrizzleModule, AuthGuardModule, CartModule],
  controllers: [AppController],
})
export class AppModule {}
