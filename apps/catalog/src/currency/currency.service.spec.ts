import { convert, CurrencyService, type Rates } from "./currency.service";

/**
 * Frankfurter conversion is mocked at the HTTP boundary (the injected fetch),
 * so these tests assert observable behavior — the rates served and the derived
 * conversions — never opossum's internals.
 */
describe("CurrencyService", () => {
  const RATES: Rates = { USD: 1.08, GBP: 0.85, JPY: 160 };

  /** A Frankfurter `/latest` success response with the given EUR-based rates. */
  function frankfurterOk(rates: Rates): Response {
    return {
      ok: true,
      json: async () => ({ base: "EUR", rates }),
    } as unknown as Response;
  }

  it("serves the rates Frankfurter returns and converts EUR cents by them", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(frankfurterOk(RATES));
    const service = new CurrencyService({ fetchImpl });

    const rates = await service.rates();

    expect(rates).toEqual(RATES);
    // 1500 cents = €15.00 → USD 15×1.08, GBP 15×0.85, JPY 15×160.
    expect(convert(1500, rates!)).toEqual({ USD: 16.2, GBP: 12.75, JPY: 2400 });
  });

  it("reuses cached rates within the TTL instead of refetching", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(frankfurterOk(RATES));
    const service = new CurrencyService({ fetchImpl, ttlMs: 60_000 });

    await service.rates();
    await service.rates();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back to the last cached rates when Frankfurter fails", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(frankfurterOk(RATES)) // primes the cache
      .mockRejectedValue(new Error("network down")); // then Frankfurter is down
    // ttl 0 forces every call past the cache and into the breaker.
    const service = new CurrencyService({ fetchImpl, ttlMs: 0 });

    expect(await service.rates()).toEqual(RATES); // success caches
    expect(await service.rates()).toEqual(RATES); // failure → cached fallback
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("opens the breaker after repeated failures", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("network down"));
    const service = new CurrencyService({
      fetchImpl,
      ttlMs: 0,
      breaker: { volumeThreshold: 1, errorThresholdPercentage: 1 },
    });

    for (let i = 0; i < 5; i++) await service.rates();

    expect(service.breakerOpen).toBe(true);
  });
});
