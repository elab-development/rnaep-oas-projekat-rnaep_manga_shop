import { type DynamicModule, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { createHttpMetrics, HTTP_METRICS } from "./http-metrics";
import { MetricsController } from "./metrics.controller";
import { MetricsInterceptor } from "./metrics.interceptor";

/**
 * Drop-in observability module (issue 12). `MetricsModule.forRoot("orders")`
 * gives a service a `GET /metrics` endpoint and a global interceptor that
 * records request rate, latency, and errors — all tagged `service="orders"`.
 * Import it in the service's root module; no bootstrap changes are needed, so
 * the metrics path is exercised by the same tests that boot the AppModule.
 */
@Module({})
export class MetricsModule {
  static forRoot(service: string): DynamicModule {
    return {
      module: MetricsModule,
      controllers: [MetricsController],
      providers: [
        { provide: HTTP_METRICS, useValue: createHttpMetrics(service) },
        { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
      ],
      exports: [HTTP_METRICS],
    };
  }
}
