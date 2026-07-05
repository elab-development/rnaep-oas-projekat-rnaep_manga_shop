import type { Provider } from "@nestjs/common";
import { Schema, type Connection, type Model } from "mongoose";
import { MONGO_CONNECTION } from "../database.module";

/** DI token for the Mongoose Reservation model. */
export const RESERVATION_MODEL = Symbol("RESERVATION_MODEL");

/**
 * A held line within a Reservation: the manga, how many copies are held, and the
 * title + EUR price snapshotted at reserve time so a later commit/release (and
 * the Order's own snapshot) is exact (ADR-0002, ADR-0006).
 */
export interface ReservationLineDoc {
  mangaId: string;
  quantity: number;
  title: string;
  /** EUR integer cents at reserve time (ADR-0006). */
  price: number;
}

/**
 * A per-order Reservation record (CONTEXT.md: Reservation; ADR-0002). Keyed by
 * `orderId` — the saga idempotency key (ADR-0003) — so a hold can be released or
 * committed for exactly the right quantity, idempotently. `reserved` is the only
 * status issue 08 produces; `committed`/`released` land with the payment saga
 * (issue 09) and are modelled now so the schema needn't change then.
 */
export interface ReservationDoc {
  orderId: string;
  lines: ReservationLineDoc[];
  status: "reserved" | "committed" | "released";
}

const ReservationLineSchema = new Schema<ReservationLineDoc>(
  {
    mangaId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    title: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

export const ReservationSchema = new Schema<ReservationDoc>(
  {
    // Unique so a duplicated `order-created` (at-least-once delivery, ADR-0013)
    // can't create a second hold: reserve is idempotent on `orderId`.
    orderId: { type: String, required: true, unique: true },
    lines: { type: [ReservationLineSchema], required: true, default: [] },
    status: {
      type: String,
      required: true,
      enum: ["reserved", "committed", "released"],
      default: "reserved",
    },
  },
  { timestamps: true, collection: "reservations" },
);

export type ReservationModel = Model<ReservationDoc>;

/** Binds the Reservation model to the Catalog service's connection. */
export const reservationModelProvider: Provider = {
  provide: RESERVATION_MODEL,
  inject: [MONGO_CONNECTION],
  useFactory: (connection: Connection): ReservationModel =>
    connection.model<ReservationDoc>("Reservation", ReservationSchema),
};
