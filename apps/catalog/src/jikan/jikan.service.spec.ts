import { JikanService } from "./jikan.service";

/**
 * Jikan enrichment is mocked at the HTTP boundary (the injected fetch), so these
 * tests assert observable behavior — the suggestions served and the
 * fill-manually fallback when Jikan is down — never opossum's internals.
 * ADR-0009: the breaker never blocks catalog work; on failure it yields no
 * suggestions so the moderator falls back to manual entry.
 */
describe("JikanService", () => {
  /** A Jikan `/manga?q=` success body carrying one result, in Jikan's shape. */
  function jikanOk(): Response {
    return {
      ok: true,
      json: async () => ({
        data: [
          {
            mal_id: 2,
            title: "Berserk",
            authors: [{ name: "Miura, Kentarou" }],
            genres: [{ name: "Action" }, { name: "Fantasy" }],
            synopsis: "Guts, a former mercenary...",
            images: { jpg: { image_url: "https://cdn.test/berserk.jpg" } },
          },
        ],
      }),
    } as unknown as Response;
  }

  it("queries getMangaSearch with the term, first page, capped at 5", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jikanOk());
    const service = new JikanService({ fetchImpl });

    await service.search("berserk");

    const url = new URL(fetchImpl.mock.calls[0][0] as string);
    expect(url.pathname.endsWith("/manga")).toBe(true);
    expect(url.searchParams.get("q")).toBe("berserk");
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("limit")).toBe("5");
  });

  it("maps Jikan results to prefill suggestions", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jikanOk());
    const service = new JikanService({ fetchImpl });

    const suggestions = await service.search("berserk");

    expect(suggestions).toEqual([
      {
        jikanId: 2,
        title: "Berserk",
        author: "Miura, Kentarou",
        genres: ["Action", "Fantasy"],
        cover: "https://cdn.test/berserk.jpg",
        description: "Guts, a former mercenary...",
      },
    ]);
  });

  it("returns no suggestions for a blank query without calling Jikan", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jikanOk());
    const service = new JikanService({ fetchImpl });

    expect(await service.search("   ")).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("falls back to no suggestions when Jikan fails (fill manually)", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("network down"));
    const service = new JikanService({ fetchImpl });

    // Never throws — creation must never be blocked (ADR-0009).
    expect(await service.search("berserk")).toEqual([]);
  });

  it("opens the breaker after repeated failures", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("network down"));
    const service = new JikanService({
      fetchImpl,
      breaker: { volumeThreshold: 1, errorThresholdPercentage: 1 },
    });

    for (let i = 0; i < 5; i++) await service.search("berserk");

    expect(service.breakerOpen).toBe(true);
  });
});
