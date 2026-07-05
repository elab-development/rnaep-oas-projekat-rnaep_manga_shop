import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type {
  ReservationResult,
  ReserveOrderInput,
} from "@workspace/contracts";

/** Where the Catalog service lives; defaults to its docker-compose host port. */
function catalogUrl(): string {
  return process.env.CATALOG_URL ?? "http://localhost:3002";
}

/**
 * Orders' client for Catalog's internal stock operations (ADR-0002, ADR-0003).
 * This is the synchronous-first transport for the saga's reserve step: a plain
 * REST call to Catalog's `/internal/reservations` (a path the gateway does not
 * expose — ADR-0011). In the Kafka phase (issue 11) this client is replaced by an
 * `order-created` producer, with the {@link ReserveOrderInput} payload unchanged.
 */
@Injectable()
export class CatalogClient {
  /**
   * Asks Catalog to reserve the whole order all-or-nothing and to return the
   * current EUR price + title per line. A non-2xx (Catalog down or erroring) is a
   * 503 — checkout must fail loudly rather than place an unbacked order. A clean
   * `rejected` result (out of stock) is a normal 2xx and returned to the caller.
   */
  async reserve(input: ReserveOrderInput): Promise<ReservationResult> {
    let res: Response;
    try {
      res = await fetch(`${catalogUrl()}/internal/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    } catch {
      throw new ServiceUnavailableException("Catalog unavailable");
    }
    if (!res.ok) {
      throw new ServiceUnavailableException("Catalog reserve failed");
    }
    return (await res.json()) as ReservationResult;
  }
}
