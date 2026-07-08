import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentUser,
  JwtAuthGuard,
  type AuthUser,
} from "@workspace/auth-guard";
import type { CartView } from "@workspace/contracts";
import { AddCartItemDto, UpdateCartItemDto } from "./dto";
import { CartService } from "./cart.service";

/**
 * Cart HTTP boundary. Mounted at `/cart` so the thin gateway can route `/cart/*`
 * straight through without rewriting paths (ADR-0011).
 *
 * Every route is login-required (ADR-0010: no guest cart) via `JwtAuthGuard`,
 * and the owning `customerId` always comes from the verified token
 * (`@CurrentUser`), never the request body or params (ADR-0007). That token-
 * derived scoping is the IDOR guard: Customer B's token only ever addresses
 * Customer B's cart (ADR-0012).
 */
@Controller("cart")
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  getCart(@CurrentUser() user: AuthUser): Promise<CartView> {
    return this.cart.getCart(user.userId);
  }

  @Post("items")
  add(
    @CurrentUser() user: AuthUser,
    @Body() dto: AddCartItemDto,
  ): Promise<CartView> {
    return this.cart.addItem(user.userId, dto.mangaId, dto.quantity);
  }

  @Patch("items/:mangaId")
  setQuantity(
    @CurrentUser() user: AuthUser,
    @Param("mangaId") mangaId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartView> {
    return this.cart.setQuantity(user.userId, mangaId, dto.quantity);
  }

  @Delete("items/:mangaId")
  remove(
    @CurrentUser() user: AuthUser,
    @Param("mangaId") mangaId: string,
  ): Promise<CartView> {
    return this.cart.removeItem(user.userId, mangaId);
  }
}
