import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import {
  CurrentUser,
  JwtAuthGuard,
  type AuthUser,
} from "@workspace/auth-guard";
import type { OrderView } from "@workspace/contracts";
import { CreateOrderDto } from "./dto";
import { OrdersService } from "./orders.service";

/**
 * Orders HTTP boundary. Mounted at `/orders` so the thin gateway can route
 * `/orders/*` straight through without rewriting paths (ADR-0011).
 *
 * Checkout is login-required (`JwtAuthGuard`), and the owning `customerId` always
 * comes from the verified token (`@CurrentUser`), never the body — that
 * token-derived scoping is the IDOR guard (ADR-0007, ADR-0012). Item prices and
 * titles are never accepted from the client; they are sourced from Catalog at
 * reserve time (ADR-0010).
 */
@Controller("orders")
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  checkout(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrderDto,
  ): Promise<OrderView> {
    return this.orders.checkout(user.userId, dto);
  }
}
