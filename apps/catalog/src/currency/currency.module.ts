import { Module } from "@nestjs/common";
import { CurrencyService } from "./currency.service";

/**
 * Provides the Frankfurter-backed {@link CurrencyService} (rate cache + circuit
 * breaker) to the catalog. Its own module so the breaker/cache is a single
 * shared instance across the service.
 */
@Module({
  providers: [CurrencyService],
  exports: [CurrencyService],
})
export class CurrencyModule {}
