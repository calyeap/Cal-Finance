import { describe, it, expect, afterEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// gate.fiftyTwoWeekRange — the impure fetcher around fiftyTwoWeekRangeFrom
// (fiftyTwoWeekRange.test.ts pins the pure math; this pins the wiring: which
// SOURCE a run reads, and that a failure never throws).
//
// Mirrors priceCapture.test.ts's shape for exactly the same reason: the
// provider is stubbed so these tests never touch the network, and
// ANALYZER_OFFLINE is the one switch this outcome may not add a second of.
// ---------------------------------------------------------------------------

const HISTORY: { date: string; close: number; adjustedClose: number }[] = [
  { date: "2025-09-08", close: 400, adjustedClose: 400 },
  { date: "2026-03-04", close: 300, adjustedClose: 300 },
  { date: "2026-09-04", close: 500, adjustedClose: 500 },
];

vi.mock("../marketdata", () => ({
  activeProvider: () => ({
    sourceName: "STUB",
    resolveInstrument: async () => ({ outcome: "unknown" as const }),
    fetchLatestEod: async () => ({ date: "2026-09-04", close: 500, adjustedClose: 500 }),
    fetchHistoricalEod: async () => HISTORY,
  }),
}));

const { fiftyTwoWeekRange } = await import("./gate");

const OFFLINE = process.env.ANALYZER_OFFLINE;

afterEach(() => {
  // vitest.setup.ts turns offline mode on for the whole suite; restore it so
  // nothing downstream inherits an online analyzer.
  if (OFFLINE === undefined) delete process.env.ANALYZER_OFFLINE;
  else process.env.ANALYZER_OFFLINE = OFFLINE;
  vi.restoreAllMocks();
});

describe("a real run reads the live provider's historical series, never a capture", () => {
  it("computes the range from the stubbed provider's series", async () => {
    delete process.env.ANALYZER_OFFLINE;

    const range = await fiftyTwoWeekRange("MSFT", "2026-09-04");

    expect(range).not.toBeNull();
    expect(range?.low.toString()).toBe("300");
    expect(range?.high.toString()).toBe("500");
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
      fetchHistoricalEod: async () => {
        throw new Error("provider unreachable");
      },
    });

    await expect(fiftyTwoWeekRange("MSFT", "2026-09-04")).resolves.toBeNull();
  });

  it("returns null, without calling the provider, for an empty series", async () => {
    delete process.env.ANALYZER_OFFLINE;

    const marketdata = await import("../marketdata");
    vi.spyOn(marketdata, "activeProvider").mockReturnValue({
      sourceName: "STUB",
      resolveInstrument: async () => ({ outcome: "unknown" as const }),
      fetchLatestEod: async () => ({ date: "2026-09-04", close: 500, adjustedClose: 500 }),
      fetchHistoricalEod: async () => [],
    });

    await expect(fiftyTwoWeekRange("MSFT", "2026-09-04")).resolves.toBeNull();
  });
});

describe("an offline run never calls the provider for the range", () => {
  it("returns null without a network call — ANALYZER_OFFLINE stays a single switch, no capture fallback added", async () => {
    process.env.ANALYZER_OFFLINE = "1";

    const marketdata = await import("../marketdata");
    const spy = vi.spyOn(marketdata, "activeProvider");

    await expect(fiftyTwoWeekRange("MSFT", "2026-09-04")).resolves.toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});
