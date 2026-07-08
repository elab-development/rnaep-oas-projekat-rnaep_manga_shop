import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  ReservationResult,
  ReserveOrderInput,
  ReservedLine,
  SettlementResult,
} from "@workspace/contracts";
import { isValidObjectId } from "mongoose";
import { MANGA_MODEL, type MangaModel } from "../manga/manga.schema";
import {
  RESERVATION_MODEL,
  type ReservationLineDoc,
  type ReservationModel,
} from "./reservation.schema";

/** A line already held this pass, tracked so it can be rolled back on failure. */
interface HeldLine {
  mangaId: string;
  quantity: number;
}

/**
 * Reserves stock for an Order, all-or-nothing (ADR-0002). This is the
 * synchronous-first build of the saga's reserve step (ADR-0003): today Orders
 * calls it over REST; tomorrow it is the `order-created` consumer, unchanged.
 *
 * Catalog is the authority for the current EUR price + title, which it returns
 * per line so Orders can snapshot them (ADR-0010) — the client never supplies a
 * price. A per-order Reservation record is kept so a later commit/release is
 * exact and idempotent (issue 09).
 */
@Injectable()
export class ReservationService {
  constructor(
    @Inject(MANGA_MODEL) private readonly manga: MangaModel,
    @Inject(RESERVATION_MODEL)
    private readonly reservations: ReservationModel,
  ) {}

  /**
   * Holds every line of the order or none. For each line a **guarded atomic**
   * `$inc reserved` runs — it only matches when `available = quantity − reserved`
   * still covers the requested quantity, so two concurrent orders can't both take
   * the last copy (the strong-consistency requirement for stock, ADR-0002). If
   * any line is short (or the manga is gone), the holds already taken this pass
   * are rolled back and the whole order is rejected (`stock-rejected` semantics).
   *
   * Idempotent on `orderId` (ADR-0002, ADR-0013): a repeat reserve for an order
   * already held returns the existing hold without incrementing anything.
   */
  async reserve(input: ReserveOrderInput): Promise<ReservationResult> {
    const { orderId } = input;

    const existing = await this.reservations.findOne({ orderId }).exec();
    if (existing) {
      if (existing.status === "reserved") {
        return { status: "reserved", orderId, lines: toReservedLines(existing.lines) };
      }
      // A commit/release already ran for this order — the hold is gone, so a
      // re-reserve is a no-op that must not silently take fresh stock.
      return {
        status: "rejected",
        orderId,
        reason: `order already ${existing.status}`,
      };
    }

    const held: HeldLine[] = [];
    const lines: ReservedLine[] = [];

    for (const line of input.lines) {
      // A malformed id can't reference a real manga — treat as unavailable, and
      // roll back anything already held so we never leave a partial reservation.
      if (!isValidObjectId(line.mangaId)) {
        await this.rollback(held);
        return { status: "rejected", orderId, reason: "insufficient_stock" };
      }

      const doc = await this.manga
        .findOneAndUpdate(
          {
            _id: line.mangaId,
            $expr: {
              $gte: [
                { $subtract: ["$stock.quantity", "$stock.reserved"] },
                line.quantity,
              ],
            },
          },
          { $inc: { "stock.reserved": line.quantity } },
          { new: true },
        )
        .exec();

      if (!doc) {
        await this.rollback(held);
        return { status: "rejected", orderId, reason: "insufficient_stock" };
      }

      held.push({ mangaId: line.mangaId, quantity: line.quantity });
      lines.push({
        mangaId: line.mangaId,
        title: doc.title,
        price: doc.price,
        quantity: line.quantity,
      });
    }

    await this.reservations.create({ orderId, lines, status: "reserved" });
    return { status: "reserved", orderId, lines };
  }

  /**
   * Commits a reservation on payment success (ADR-0002): the held copies leave
   * physical stock for good — `quantity −= qty` **and** `reserved −= qty` per
   * line. Idempotent on `orderId` (ADR-0013): the reserved → committed flip is a
   * single guarded atomic update, so only the first commit moves stock; a
   * duplicate finds the reservation already `committed` and echoes it without
   * touching stock again.
   */
  async commit(orderId: string): Promise<SettlementResult> {
    return this.settle(orderId, "committed", (line) => ({
      "stock.quantity": -line.quantity,
      "stock.reserved": -line.quantity,
    }));
  }

  /**
   * Releases a reservation on payment failure or 30-min timeout (ADR-0002, the
   * compensation path): the hold is freed — `reserved −= qty` per line — while
   * `quantity` (physical stock) is untouched, so the copies simply become
   * available again. Idempotent on `orderId` exactly like {@link commit}.
   */
  async release(orderId: string): Promise<SettlementResult> {
    return this.settle(orderId, "released", (line) => ({
      "stock.reserved": -line.quantity,
    }));
  }

  /**
   * Shared commit/release core. Atomically flips the reservation from `reserved`
   * to the target status and, only if that flip won (so it runs exactly once),
   * applies `inc` to each held manga. A reservation that is already settled — or
   * settled concurrently — yields no flip, so the stock move is skipped and the
   * existing status is returned (idempotency, ADR-0013). No such reservation is a
   * 404: there is nothing to settle.
   */
  private async settle(
    orderId: string,
    target: "committed" | "released",
    inc: (line: HeldLine) => Record<string, number>,
  ): Promise<SettlementResult> {
    const held = await this.reservations
      .findOneAndUpdate(
        { orderId, status: "reserved" },
        { $set: { status: target } },
        { new: false },
      )
      .exec();

    if (!held) {
      const existing = await this.reservations.findOne({ orderId }).exec();
      if (!existing) {
        throw new NotFoundException(`No reservation for order ${orderId}`);
      }
      return { orderId, status: existing.status };
    }

    for (const line of held.lines) {
      await this.manga
        .updateOne({ _id: line.mangaId }, { $inc: inc(line) })
        .exec();
    }
    return { orderId, status: target };
  }

  /** Releases holds taken earlier this pass so a rejected order leaves none. */
  private async rollback(held: HeldLine[]): Promise<void> {
    for (const line of held) {
      await this.manga
        .updateOne(
          { _id: line.mangaId },
          { $inc: { "stock.reserved": -line.quantity } },
        )
        .exec();
    }
  }
}

/** Strips the stored line down to the shared `ReservedLine` shape. */
function toReservedLines(lines: ReservationLineDoc[]): ReservedLine[] {
  return lines.map((l) => ({
    mangaId: l.mangaId,
    title: l.title,
    price: l.price,
    quantity: l.quantity,
  }));
}
