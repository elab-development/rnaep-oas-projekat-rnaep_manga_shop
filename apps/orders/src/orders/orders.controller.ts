import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentUser,
  JwtAuthGuard,
  Roles as RolesDecorator,
  RolesGuard,
  type AuthUser,
} from "@workspace/auth-guard";
import {
  Roles,
  type AdminOrderView,
  type OrderStatusResult,
  type OrderView,
} from "@workspace/contracts";
import { CreateOrderDto } from "./dto";
import { OrdersService } from "./orders.service";

/**
 * Orders HTTP boundary. Mounted at `/orders` so the thin gateway can route
 * `/orders/*` straight through without rewriting paths (ADR-0011).
 *
 * Every route is login-required (`JwtAuthGuard`), and the owning `customerId`
 * always comes from the verified token (`@CurrentUser`), never the body — that
 * token-derived scoping is the IDOR guard (ADR-0007, ADR-0012). Item prices and
 * titles are never accepted from the client; they are sourced from Catalog at
 * reserve time (ADR-0010). Admin oversight routes add the exact `@Roles('admin')`
 * check on top of the class-level `JwtAuthGuard` (ADR-0005).
 *
 * Route order matters: `GET /orders/all` is declared before `GET /orders/:id` so
 * the literal admin path is matched first and never captured as an order id.
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

  /**
   * The caller's own order history (issue 10), newest first. Scoped to the token
   * (ADR-0007), so a Customer only ever sees their own orders (IDOR, ADR-0012).
   */
  @Get()
  listMine(@CurrentUser() user: AuthUser): Promise<OrderView[]> {
    return this.orders.listForCustomer(user.userId);
  }

  /**
   * Every order in the system for the Admin's oversight view (issue 10). Gated
   * with the **exact** `@Roles('admin')` (ADR-0005) — business oversight is an
   * Admin-only ability. Declared before `:id` so `all` is never read as an id.
   */
  @Get("all")
  @UseGuards(RolesGuard)
  @RolesDecorator(Roles.Admin)
  listAll(): Promise<AdminOrderView[]> {
    return this.orders.listAll();
  }

  /**
   * Reads one of the caller's own orders (issue 09). The owning customer comes
   * from the token, never the path, so another Customer's id 404s (ADR-0007,
   * ADR-0012). Backs the payment success page and Payments' session creation
   * (which forwards the customer's token).
   */
  @Get(":id")
  getOrder(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ): Promise<OrderView> {
    return this.orders.getOrder(user.userId, id);
  }

  /**
   * Marks a `paid` order `shipped` (issue 10, ADR-0010). Admin-only via the exact
   * `@Roles('admin')`; a non-`paid` order is a 409 and a missing order a 404. This
   * is the only manual order transition — `paid`/`cancelled` are driven by the
   * payment saga (issue 09), and there is no customer-facing cancel/refund.
   */
  @Patch(":id/ship")
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @RolesDecorator(Roles.Admin)
  ship(@Param("id") id: string): Promise<OrderStatusResult> {
    return this.orders.markShipped(id);
  }
}
