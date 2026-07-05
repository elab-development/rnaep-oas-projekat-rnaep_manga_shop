import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from "@nestjs/common";
import type {
  OrderView,
  ReservedLine,
  ShippingDetails,
} from "@workspace/contracts";
import { eq } from "drizzle-orm";
import { CartService } from "../cart/cart.service";
import { DRIZZLE, type Database } from "../db/drizzle.module";
import {
  cartItems,
  orderItems,
  orders,
  type Order,
} from "../db/schema";
import { CatalogClient } from "./catalog.client";

/**
 * Turns a Customer's Cart into an Order at checkout (issue 08, ADR-0002/0010).
 * Every method is scoped to a `customerId` taken from the verified token by the
 * controller (ADR-0007), so a Customer only ever checks out their own cart (IDOR,
 * ADR-0012).
 */
@Injectable()
export class OrdersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly cart: CartService,
    private readonly catalog: CatalogClient,
  ) {}

  /**
   * Checkout: read the cart, ask Catalog to reserve the whole order
   * all-or-nothing, then snapshot the returned price + title into OrderItems,
   * store the shipping fields, set status `pending_payment`, and clear the cart —
   * the order-persist and cart-clear run in one DB transaction so a failure can't
   * leave a half-order or a stale cart.
   *
   * - An empty cart is a 400 — there is nothing to buy.
   * - A `rejected` reservation (any line out of stock) is a 409, and Catalog has
   *   already rolled back every partial hold (ADR-0002), so the Customer is never
   *   charged and no stock is left held.
   *
   * The `orderId` is generated up front so it keys both the reservation (the saga
   * idempotency key, ADR-0002) and the Order row.
   */
  async checkout(
    customerId: string,
    shipping: ShippingDetails,
  ): Promise<OrderView> {
    const cart = await this.cart.getCart(customerId);
    if (cart.items.length === 0) {
      throw new BadRequestException("Cart is empty");
    }

    const orderId = randomUUID();
    const result = await this.catalog.reserve({
      orderId,
      lines: cart.items.map((i) => ({
        mangaId: i.mangaId,
        quantity: i.quantity,
      })),
    });

    if (result.status !== "reserved") {
      // All-or-nothing: Catalog left no hold behind, so nothing to compensate.
      throw new ConflictException("One or more items are out of stock");
    }

    const total = result.lines.reduce(
      (sum, l) => sum + l.price * l.quantity,
      0,
    );

    const order = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(orders)
        .values({
          id: orderId,
          customerId,
          status: "pending_payment",
          recipientName: shipping.recipientName,
          address: shipping.address,
          city: shipping.city,
          postalCode: shipping.postalCode,
          phone: shipping.phone,
          total,
        })
        .returning();
      await tx.insert(orderItems).values(
        result.lines.map((l) => ({
          orderId,
          mangaId: l.mangaId,
          title: l.title,
          price: l.price,
          quantity: l.quantity,
        })),
      );
      // Clearing the cart is part of a successful checkout (ADR-0010).
      await tx.delete(cartItems).where(eq(cartItems.customerId, customerId));
      return row;
    });

    return toView(order, result.lines);
  }
}

/** Composes the stored Order row and its reserved lines into the public view. */
function toView(order: Order, lines: ReservedLine[]): OrderView {
  return {
    id: order.id,
    status: order.status as OrderView["status"],
    shipping: {
      recipientName: order.recipientName,
      address: order.address,
      city: order.city,
      postalCode: order.postalCode,
      phone: order.phone,
    },
    items: lines.map((l) => ({
      mangaId: l.mangaId,
      title: l.title,
      price: l.price,
      quantity: l.quantity,
    })),
    total: order.total,
    createdAt: order.createdAt.toISOString(),
  };
}
