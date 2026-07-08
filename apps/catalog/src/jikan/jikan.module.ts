import { Module } from "@nestjs/common";
import { JikanService } from "./jikan.service";

/**
 * Provides the Jikan-backed {@link JikanService} (search + circuit breaker) to
 * the catalog. Its own module so the breaker is a single shared instance across
 * the service (ADR-0009).
 */
@Module({
  providers: [JikanService],
  exports: [JikanService],
})
export class JikanModule {}
