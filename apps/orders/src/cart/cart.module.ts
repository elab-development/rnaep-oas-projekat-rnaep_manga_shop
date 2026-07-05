import { Module } from "@nestjs/common";
import { AuthGuardModule } from "@workspace/auth-guard";
import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";

/**
 * The server-side, login-required Cart (issue 07, ADR-0010). Imports the shared
 * auth guard so it can verify the JWT itself and derive the owning `customerId`
 * from the token (ADR-0007).
 */
@Module({
  imports: [AuthGuardModule],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
