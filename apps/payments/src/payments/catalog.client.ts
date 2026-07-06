import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { SettlementResult } from "@workspace/contracts";

/** Where the Catalog service lives; defaults to its docker-compose host port. */
function catalogUrl(): string {
  return process.env.CATALOG_URL ?? "http://localhost:3002";
}

/**
 * Payments' client for Catalog's internal commit/release (ADR-0002, ADR-0003).
 * This is the synchronous-first transport for the saga's settle step: a plain
 * REST call to Catalog's `/internal/reservations/:orderId/{commit,release}` — a
 * path the gateway does not expose (ADR-0011), reachable only service-to-service.
 * In the Kafka phase (issue 11) this is replaced by a `payment-succeeded` /
 * `payment-failed` producer, the payloads unchanged.
 *
 * Both operations are idempotent on `orderId`, so a webhook retry (at-least-once,
 * ADR-0013) is safe. A non-2xx is a 503 — a payment outcome must fail loudly
 * (ADR-0009), never be silently dropped.
 */
@Injectable()
export class CatalogClient {
  /** Commit the hold on payment success: `quantity −= qty; reserved −= qty`. */
  commit(orderId: string): Promise<SettlementResult> {
    return this.settle(orderId, "commit");
  }

  /** Release the hold on payment failure/timeout: `reserved −= qty`. */
  release(orderId: string): Promise<SettlementResult> {
    return this.settle(orderId, "release");
  }

  private async settle(
    orderId: string,
    op: "commit" | "release",
  ): Promise<SettlementResult> {
    const url = `${catalogUrl()}/internal/reservations/${orderId}/${op}`;
    let res: Response;
    try {
      res = await fetch(url, { method: "POST" });
    } catch {
      throw new ServiceUnavailableException("Catalog unavailable");
    }
    if (!res.ok) {
      throw new ServiceUnavailableException(`Catalog ${op} failed`);
    }
    return (await res.json()) as SettlementResult;
  }
}
