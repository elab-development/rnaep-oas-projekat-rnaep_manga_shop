import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  AdminOrderView,
  OrderStatus,
  OrderStatusResult,
  OrderView,
  ReservedLine,
  ShippingDetails,
} from "@workspace/contracts";
import { and, desc, eq, inArray } from "drizzle-orm";
import { CartService } from "../cart/cart.service";
import { DRIZZLE, type Database } from "../db/drizzle.module";
import {
  cartItems,
  orderItems,
  orders,
  type Order,
  type OrderItem,
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

  /**
   * Reads a single Order the caller owns (issue 09). Scoped to `customerId` from
   * the verified token (ADR-0007), so a Customer can only ever read their own
   * order — a foreign or unknown id is an indistinguishable 404 (IDOR, ADR-0012).
   * Backs the payment success page ("confirming…") and Payments' Checkout Session
   * creation, which forwards the customer's token so this same scoping applies.
   */
  async getOrder(customerId: string, orderId: string): Promise<OrderView> {
    const [order] = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)));
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    const items = await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
    return toView(order, items);
  }

  /**
   * The signed-in Customer's own order history (issue 10), newest first, each
   * with its current status. Scoped to `customerId` from the verified token
   * (ADR-0007), so a Customer only ever sees their own orders — never another's
   * (IDOR, ADR-0012).
   */
  async listForCustomer(customerId: string): Promise<OrderView[]> {
    const rows = await this.db
      .select()
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt));
    return this.attachItems(rows, (order, items) => toView(order, items));
  }

  /**
   * Every Order in the system (issue 10), newest first — the Admin's oversight
   * view. Admin-only, enforced by the controller's `@Roles('admin')` guard, not
   * here. Each row carries the owning `customerId` so the Next.js layer can
   * resolve the customer's email on demand from Auth (ADR-0010/0011); the email
   * is never stored on the order.
   */
  async listAll(): Promise<AdminOrderView[]> {
    const rows = await this.db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt));
    return this.attachItems(rows, (order, items) => ({
      ...toView(order, items),
      customerId: order.customerId,
    }));
  }

  /**
   * Loads the OrderItems for a batch of orders in one query and composes each
   * order with its lines via `build`. Shared by the history and admin-oversight
   * reads so neither issues an N+1 of per-order item queries.
   */
  private async attachItems<T>(
    rows: Order[],
    build: (order: Order, items: OrderItem[]) => T,
  ): Promise<T[]> {
    if (rows.length === 0) {
      return [];
    }
    const items = await this.db
      .select()
      .from(orderItems)
      .where(
        inArray(
          orderItems.orderId,
          rows.map((o) => o.id),
        ),
      );
    const byOrder = new Map<string, OrderItem[]>();
    for (const item of items) {
      const bucket = byOrder.get(item.orderId);
      if (bucket) {
        bucket.push(item);
      } else {
        byOrder.set(item.orderId, [item]);
      }
    }
    return rows.map((order) => build(order, byOrder.get(order.id) ?? []));
  }

  /**
   * Advances a `paid` Order to `shipped` — the Admin fulfillment step (issue 10,
   * ADR-0010). Admin-only, enforced by the controller guard. The update matches
   * only while the order is still `paid`, so a non-`paid` order (still awaiting
   * payment, already shipped, or cancelled) is a 409 and a missing order is a 404
   * — shipping is a deliberate one-way transition, not an idempotent saga event.
   */
  async markShipped(orderId: string): Promise<OrderStatusResult> {
    const [row] = await this.db
      .update(orders)
      .set({ status: "shipped", updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.status, "paid")))
      .returning();
    if (row) {
      return { orderId, status: "shipped" };
    }

    const [existing] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId));
    if (!existing) {
      throw new NotFoundException("Order not found");
    }
    throw new ConflictException(
      `Cannot ship an order that is ${existing.status}; only a paid order can ship`,
    );
  }

  /**
   * Advances an Order to `paid` on a verified `payment-succeeded` (ADR-0002,
   * ADR-0010). Internal, service-to-service (Payments calls it from the Stripe
   * webhook); the transition is guarded on `pending_payment` so it fires once, and
   * a duplicate delivery (at-least-once, ADR-0013) is an idempotent no-op that
   * echoes the current status.
   */
  markPaid(orderId: string): Promise<OrderStatusResult> {
    return this.transition(orderId, "paid");
  }

  /**
   * Advances an Order to `cancelled` on a `payment-failed` (declined or 30-min
   * timeout) — the saga's compensation path (ADR-0002, ADR-0010). Guarded and
   * idempotent exactly like {@link markPaid}.
   */
  markCancelled(orderId: string): Promise<OrderStatusResult> {
    return this.transition(orderId, "cancelled");
  }

  /**
   * Guarded, idempotent status transition out of `pending_payment`. The update
   * matches only while the order is still `pending_payment`, so the terminal
   * status is set exactly once; if nothing matched, an existing order echoes its
   * current status (idempotent) and a missing order is a 404.
   */
  private async transition(
    orderId: string,
    to: Extract<OrderStatus, "paid" | "cancelled">,
  ): Promise<OrderStatusResult> {
    const [row] = await this.db
      .update(orders)
      .set({ status: to, updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.status, "pending_payment")))
      .returning();
    if (row) {
      return { orderId, status: to };
    }

    const [existing] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId));
    if (!existing) {
      throw new NotFoundException("Order not found");
    }
    return { orderId, status: existing.status as OrderStatus };
  }
}

/**
 * Composes the stored Order row and its line items into the public view. Accepts
 * either the freshly reserved lines (at checkout) or the persisted OrderItems (on
 * a later read) — both carry the snapshotted title + price (ADR-0010).
 */
function toView(order: Order, lines: (ReservedLine | OrderItem)[]): OrderView {
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
