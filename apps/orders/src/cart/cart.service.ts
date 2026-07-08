import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CartView } from "@workspace/contracts";
import { and, asc, eq, sql } from "drizzle-orm";
import { DRIZZLE, type Database } from "../db/drizzle.module";
import { cartItems } from "../db/schema";

/**
 * The Cart is a Customer's working set of CartItems before checkout (CONTEXT.md),
 * persisted server-side so it survives across devices and sessions. Every method
 * is scoped to a `customerId` taken from the verified token by the controller
 * (ADR-0007) — a Customer can only ever see or mutate their own cart, which is
 * how IDOR is prevented (ADR-0012). There is no guest cart (ADR-0010).
 */
@Injectable()
export class CartService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** The Customer's whole cart, oldest line first. An empty cart is `[]`. */
  async getCart(customerId: string): Promise<CartView> {
    const rows = await this.db
      .select()
      .from(cartItems)
      .where(eq(cartItems.customerId, customerId))
      .orderBy(asc(cartItems.createdAt));
    return { items: rows.map((r) => ({ mangaId: r.mangaId, quantity: r.quantity })) };
  }

  /**
   * Adds a Manga to the cart. If the Manga is already in the cart the quantities
   * are summed on the existing line (upsert on the `(customerId, mangaId)`
   * unique key); otherwise a new line is created. Returns the whole updated cart.
   */
  async addItem(
    customerId: string,
    mangaId: string,
    quantity: number,
  ): Promise<CartView> {
    await this.db
      .insert(cartItems)
      .values({ customerId, mangaId, quantity })
      .onConflictDoUpdate({
        target: [cartItems.customerId, cartItems.mangaId],
        set: {
          quantity: sql`${cartItems.quantity} + ${quantity}`,
          updatedAt: sql`now()`,
        },
      });
    return this.getCart(customerId);
  }

  /**
   * Sets a cart line's absolute quantity. A 404 if the Manga isn't in the cart —
   * setting the quantity of something you haven't added is a client error, not a
   * silent create. Returns the whole updated cart.
   */
  async setQuantity(
    customerId: string,
    mangaId: string,
    quantity: number,
  ): Promise<CartView> {
    const updated = await this.db
      .update(cartItems)
      .set({ quantity, updatedAt: sql`now()` })
      .where(
        and(
          eq(cartItems.customerId, customerId),
          eq(cartItems.mangaId, mangaId),
        ),
      )
      .returning();
    if (updated.length === 0) {
      throw new NotFoundException("Item not in cart");
    }
    return this.getCart(customerId);
  }

  /**
   * Removes a Manga from the cart. Idempotent: removing a line that isn't there
   * is a no-op, so a double-click or a stale UI can't 404. Returns the whole
   * updated cart.
   */
  async removeItem(customerId: string, mangaId: string): Promise<CartView> {
    await this.db
      .delete(cartItems)
      .where(
        and(
          eq(cartItems.customerId, customerId),
          eq(cartItems.mangaId, mangaId),
        ),
      );
    return this.getCart(customerId);
  }
}
