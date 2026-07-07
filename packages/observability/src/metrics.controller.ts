import { Controller, Get, Header, Inject } from "@nestjs/common";
import { HTTP_METRICS, PROM_CONTENT_TYPE, type HttpMetrics } from "./http-metrics";

/**
 * Exposes the Prometheus scrape endpoint (`GET /metrics`) for a Nest service.
 * The metrics handle is provided by {@link MetricsModule.forRoot}.
 */
@Controller()
export class MetricsController {
  constructor(
    @Inject(HTTP_METRICS) private readonly metrics: HttpMetrics,
  ) {}

  @Get("metrics")
  @Header("Content-Type", PROM_CONTENT_TYPE)
  scrape(): Promise<string> {
    return this.metrics.registry.metrics();
  }
}
