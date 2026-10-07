import { describe, it, expect, afterEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// gate.fundamentals — CF-ANALYZER-LEAN-MSFT-PROOF-01's EPS fetcher, mirroring
// priceCapture.test.ts/fiftyTwoWeekCapture.test.ts's shape for the same
// reason: the provider is stubbed so these tests never touch the network,
// ANALYZER_OFFLINE stays the single switch (no capture file exists for
// fundamentals, so an offline run keeps P/E INCOMPLETE exactly as it already
// keeps M3 INCOMPLETE), and a provider failure — including a provider with no
// fundamentals surface at all — returns null rather than throwing.
// ---------------------------------------------------------------------------

vi.mock("../marketdata", () => ({
  activeProvider: () => ({
    sourceName: "STUB",
    resolveInstrument: async () => ({ outcome: "unknown" as const }),
    fetchLatestEod: async () => ({ date: "2026-09-04", close: 500, adjustedClose: 500 }),
    fetchHistoricalEod: async () => [],
    fetchFundamentals: async () => ({ epsTrailing: 13.11, epsForward: 15.42 }),
  }),
}));

const { fundamentals } = await import("./gate");

const OFFLINE = process.env.ANALYZER_OFFLINE;

afterEach(() => {
  // vitest.setup.ts turns offline mode on for the whole suite; restore it so
  // nothing downstream inherits an online analyzer.
  if (OFFLINE === undefined) delete process.env.ANALYZER_OFFLINE;
  else process.env.ANALYZER_OFFLINE = OFFLINE;
  vi.restoreAllMocks();
});

describe("a real run reads the live provider's EPS, never a capture (there is none)", () => {
  it("returns trailing/forward EPS as Decimal from the stubbed provider", async () => {
    delete process.env.ANALYZER_OFFLINE;

    const result = await fundamentals("MSFT");

    expect(result).not.toBeNull();
    expect(result?.epsTrailing?.toString()).toBe("13.11");
    expect(result?.epsForward?.toString()).toBe("15.42");
  });

  it("returns null rather than throwing when the provider fails", async () => {
    delete process.env.ANALYZER_OFFLINE;

    const marketdata = await import("../marketdata");
    vi.spyOn(marketdata, "activeProvider").mockReturnValue({
      sourceName: "STUB",
      resolveInstrument: async () => ({ outcome: "unavailable" as const }),
      fetchLatestEod: async () => {
        throw new Error("provider unreachable");
      },
      fetchHistoricalEod: async () => [],
      fetchFundamentals: async () => {
        throw new Error("provider unreachable");
      },
    });

    await expect(fundamentals("MSFT")).resolves.toBeNull();
  });

  it("returns null, without throwing, for a provider with no fundamentals surface (e.g. EODHD)", async () => {
    delete process.env.ANALYZER_OFFLINE;

    const marketdata = await import("../marketdata");
    vi.spyOn(marketdata, "activeProvider").mockReturnValue({
      sourceName: "STUB",
      resolveInstrument: async () => ({ outcome: "unknown" as const }),
      fetchLatestEod: async () => ({ date: "2026-09-04", close: 500, adjustedClose: 500 }),
      fetchHistoricalEod: async () => [],
      // fetchFundamentals omitted entirely — the optional-method case.
    });

    await expect(fundamentals("MSFT")).resolves.toBeNull();
  });

  it("carries a missing half through as null rather than inventing a value", async () => {
    delete process.env.ANALYZER_OFFLINE;

    const marketdata = await import("../marketdata");
    vi.spyOn(marketdata, "activeProvider").mockReturnValue({
      sourceName: "STUB",
      resolveInstrument: async () => ({ outcome: "unknown" as const }),
      fetchLatestEod: async () => ({ date: "2026-09-04", close: 500, adjustedClose: 500 }),
      fetchHistoricalEod: async () => [],
      fetchFundamentals: async () => ({ epsTrailing: 13.11, epsForward: null }),
    });

    const result = await fundamentals("MSFT");
    expect(result?.epsTrailing?.toString()).toBe("13.11");
    expect(result?.epsForward).toBeNull();
  });
});

describe("an offline run never calls the provider for EPS", () => {
  it("returns null without a network call — there is no committed EPS capture to fall back to", async () => {
    process.env.ANALYZER_OFFLINE = "1";

    const marketdata = await import("../marketdata");
    const spy = vi.spyOn(marketdata, "activeProvider");

    await expect(fundamentals("MSFT")).resolves.toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});
