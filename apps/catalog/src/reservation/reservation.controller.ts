import { Body, Controller, Post } from "@nestjs/common";
import type { ReservationResult } from "@workspace/contracts";
import { ReserveOrderDto } from "./dto";
import { ReservationService } from "./reservation.service";

/**
 * Internal stock-operations boundary (ADR-0002, ADR-0003). Mounted at `/internal`
 * — a path the thin gateway deliberately does **not** route (ADR-0011) — so it is
 * reachable only service-to-service inside the cluster, never from a browser. In
 * the sync phase Orders calls `POST /internal/reservations` to reserve an order;
 * the Kafka phase (issue 11) replaces this transport with an `order-created`
 * consumer, the domain logic unchanged.
 *
 * The reserve is all-or-nothing and idempotent on `orderId`, so it is safe to
 * retry — the property the future at-least-once broker relies on (ADR-0013).
 */
@Controller("internal")
export class ReservationController {
  constructor(private readonly reservations: ReservationService) {}

  @Post("reservations")
  reserve(@Body() dto: ReserveOrderDto): Promise<ReservationResult> {
    return this.reservations.reserve(dto);
  }
}
