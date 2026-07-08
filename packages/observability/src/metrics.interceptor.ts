import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { type Observable, throwError } from "rxjs";
import { catchError, tap } from "rxjs/operators";
import {
  HTTP_METRICS,
  type HttpMetrics,
  normalizeRoute,
  recordRequest,
} from "./http-metrics";

/** Structural view of the Nest/Express request the interceptor reads. */
interface HttpRequest {
  method?: string;
  url?: string;
  originalUrl?: string;
}

/** An HttpException-shaped error carries a numeric status we prefer over 500. */
function errorStatus(err: unknown): number {
  const status = (err as { status?: unknown }).status;
  return typeof status === "number" && Number.isInteger(status) ? status : 500;
}

/**
 * Global interceptor that records every HTTP request handled by a Nest service
 * into the shared {@link HttpMetrics}. Registered as an `APP_INTERCEPTOR` by
 * {@link MetricsModule.forRoot}, so it lives in the module graph and is present
 * in tests that boot the AppModule — no bootstrap wiring required.
 *
 * The gateway proxies raw traffic that never reaches a Nest handler, so it uses
 * the Express middleware form instead (`installGatewayMetrics`).
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    @Inject(HTTP_METRICS) private readonly metrics: HttpMetrics,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<HttpRequest>();
    const res = http.getResponse<{ statusCode: number }>();
    const start = process.hrtime.bigint();
    const method = req.method ?? "GET";
    const route = normalizeRoute(req.originalUrl ?? req.url ?? "/");

    const record = (statusCode: number): void => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      recordRequest(this.metrics, method, route, statusCode, durationSeconds);
    };

    return next.handle().pipe(
      tap(() => record(res.statusCode)),
      catchError((err: unknown) => {
        record(errorStatus(err));
        return throwError(() => err);
      }),
    );
  }
}
