import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Decimal from "decimal.js";
import { buildAcquiredRun } from "./acquiredRun";
import { assembleAnalysisResult } from "./assemble";
import { __resetAcquisitionCache } from "./acquisition/provider";

// ---------------------------------------------------------------------------
// M9-FIFTYTWOWEEK-01 on a real MSFT run.
//
// THE DEFECT this closes: gate.ts called buildAcquiredRun at both its call
// sites without a `fiftyTwoWeek` option, so acquisition/companyInputs.ts
// always recorded fiftyTwoWeekLow/High absent, and modules/marginHistory.ts
// treats both REQUIRED — so a real run's M3 (margin and history diagnostics)
// suppressed itself as INCOMPLETE on every real run, losing the operating-
// margin range/median/worst-year change too. The fixtures (msft.ts, oklo.ts)
// hand-supply the fields, which is why the fixture-backed suite stayed green
// throughout.
//
// The market-data provider is stubbed, never called for real — the claim
// under test is that a real acquired-run pipeline WIRES a provider series
// through to a computed M3 result, not that any particular vendor is up.
// ---------------------------------------------------------------------------

const MSFT_CAPTURE_CLOSE = new Decimal("499.70");
const AS_OF = "2026-09-04";

// A synthetic but well-formed trailing series: unordered, spanning the full
// window, with the low and high away from either endpoint so a boundary bug
// could not accidentally produce the right answer.
const SERIES = [
  { date: "2026-06-01", close: 480.11, adjustedClose: 480.11 },
  { date: "2025-09-08", close: 410.0, adjustedClose: 410.0 },
  { date: AS_OF, close: 499.7, adjustedClose: 499.7 },
  { date: "2026-01-15", close: 555.449973, adjustedClose: 555.449973 }, // rounds to 555.45
  { date: "2025-12-01", close: 420.5, adjustedClose: 420.5 },
];

vi.mock("../marketdata", () => ({
  activeProvider: () => ({
    sourceName: "STUB",
    resolveInstrument: async () => ({ outcome: "unknown" as const }),
    fetchLatestEod: async () => ({ date: AS_OF, close: 499.7, adjustedClose: 499.7 }),
    fetchHistoricalEod: async () => SERIES,
  }),
}));

const { fiftyTwoWeekRange } = await import("./gate");

const OFFLINE = process.env.ANALYZER_OFFLINE;

beforeEach(() => {
  __resetAcquisitionCache();
  // gate.fiftyTwoWeekRange is offline-gated exactly like latestPrice; these
  // tests exercise the live-provider branch, so ANALYZER_OFFLINE (on for the
  // whole suite per vitest.setup.ts) is lifted here and restored after.
  delete process.env.ANALYZER_OFFLINE;
});

afterEach(() => {
  if (OFFLINE === undefined) delete process.env.ANALYZER_OFFLINE;
  else process.env.ANALYZER_OFFLINE = OFFLINE;
  vi.restoreAllMocks();
});

async function msftRun(fiftyTwoWeek: { low: Decimal; high: Decimal } | null) {
  return buildAcquiredRun({
    ticker: "MSFT",
    price: { value: MSFT_CAPTURE_CLOSE, timestamp: AS_OF, source: "recorded capture" },
    source: "CAPTURE",
    nonOperatingInvestments: { tags: [], value: new Decimal(0), errorDirection: null },
    profileHumanConfirmed: true,
    fiftyTwoWeek,
  });
}

describe("M3 given a real provider series", () => {
  it("computes rather than suppressing, carrying the fetched range cent-rounded", async () => {
    const range = await fiftyTwoWeekRange("MSFT", AS_OF);
    expect(range).not.toBeNull();
    expect(range!.low.toString()).toBe("410");
    expect(range!.high.toString()).toBe("555.45");

    const run = await msftRun(range);
    const result = assembleAnalysisResult(run.fixture);
    const mh = result.diagnostics.marginHistory;

    expect(mh.suppressed).toBe(false);
    if (!mh.suppressed) {
      expect(mh.value.fiftyTwoWeekRange.map((d) => d.toString())).toEqual(["410", "555.45"]);
      // The window length is still the real filed-years count, honestly
      // reported — this fix does not touch how many years are filed.
      expect(mh.value.windowYears).toBeGreaterThan(0);
      expect(mh.value.currentMargin).not.toBeUndefined();
    }
  });

  it("never labels the fetched range as CLEAN_PROVENANCE — the acquisition path's own market-data token, not the fixture path's", async () => {
    const range = await fiftyTwoWeekRange("MSFT", AS_OF);
    const run = await msftRun(range);
    const result = assembleAnalysisResult(run.fixture);
    const mh = result.diagnostics.marginHistory;

    expect(mh.suppressed).toBe(false);
    if (!mh.suppressed) {
      // CONFIRMED is CLEAN_PROVENANCE's verificationState — a real market-data
      // figure that nobody has reviewed must not read as though a human
      // checked it.
      expect(mh.qualification.provenanceTokens.verificationState).not.toBe("CONFIRMED");
      expect(mh.qualification.provenanceTokens.sourceClass).toBe("PRIMARY");
    }
  });

  it("discloses the closing-price basis, and never calls the range an intraday high/low", async () => {
    const range = await fiftyTwoWeekRange("MSFT", AS_OF);
    const run = await msftRun(range);
    const joined = run.disclosures.join(" ");

    expect(joined.toLowerCase()).toContain("closing");
    // The disclosure may reference "intraday" only to disclaim it (as it
    // does here) — it must never assert the range IS one.
    expect(joined.toLowerCase()).not.toMatch(/is (an? )?intraday/);
  });
});

describe("M3 fails closed when the range cannot be honestly derived", () => {
  it("stays INCOMPLETE with its existing cause on a provider failure — and does not take the rest of the run down with it", async () => {
    const marketdata = await import("../marketdata");
    vi.spyOn(marketdata, "activeProvider").mockReturnValue({
      sourceName: "STUB",
      resolveInstrument: async () => ({ outcome: "unavailable" as const }),
      fetchLatestEod: async () => ({ date: AS_OF, close: 499.7, adjustedClose: 499.7 }),
      fetchHistoricalEod: async () => {
        throw new Error("provider unreachable");
      },
    });

    const range = await fiftyTwoWeekRange("MSFT", AS_OF);
    expect(range).toBeNull();

    const run = await msftRun(range);
    const result = assembleAnalysisResult(run.fixture);
    const mh = result.diagnostics.marginHistory;

    expect(mh.suppressed).toBe(true);
    if (mh.suppressed) {
      expect(mh.state).toBe("INCOMPLETE");
      expect(mh.cause).toContain("fiftyTwoWeekLow");
      expect(mh.cause).toContain("fiftyTwoWeekHigh");
    }

    // A price failure elsewhere in this run must not follow from this one —
    // the leverage gate, which needs price and filing facts but not the
    // 52-week range, still computes normally.
    expect(result.gates.leverage.netDebtRatio).not.toBeNull();
    expect(result.gates.leverage.result).toBe("PASS");
  });

  it("stays INCOMPLETE, without inventing a partial range, on a too-short series", async () => {
    const marketdata = await import("../marketdata");
    vi.spyOn(marketdata, "activeProvider").mockReturnValue({
      sourceName: "STUB",
      resolveInstrument: async () => ({ outcome: "unknown" as const }),
      fetchLatestEod: async () => ({ date: AS_OF, close: 499.7, adjustedClose: 499.7 }),
      // A company with only a few months of trading history behind the as-of
      // date — real closes, nowhere near 52 weeks of them.
      fetchHistoricalEod: async () => [
        { date: "2026-07-01", close: 490, adjustedClose: 490 },
        { date: AS_OF, close: 499.7, adjustedClose: 499.7 },
      ],
    });

    const range = await fiftyTwoWeekRange("MSFT", AS_OF);
    expect(range).toBeNull();

    const run = await msftRun(range);
    const result = assembleAnalysisResult(run.fixture);
    expect(result.diagnostics.marginHistory.suppressed).toBe(true);
  });

  it("stays INCOMPLETE, reporting the corrupt range as unusable rather than a false 52-week high, when the unadjusted series spans a split", async () => {
    const marketdata = await import("../marketdata");
    vi.spyOn(marketdata, "activeProvider").mockReturnValue({
      sourceName: "STUB",
      resolveInstrument: async () => ({ outcome: "unknown" as const }),
      fetchLatestEod: async () => ({ date: AS_OF, close: 499.7, adjustedClose: 499.7 }),
      // A 10:1 forward split between two literally adjacent trading days
      // partway through the window — real unadjusted closes, but not a
      // series a raw min/max can honestly summarize.
      fetchHistoricalEod: async () => [
        { date: "2025-09-08", close: 480, adjustedClose: 480 },
        { date: "2026-01-14", close: 4820, adjustedClose: 482 },
        { date: "2026-01-15", close: 480.11, adjustedClose: 480.11 },
        { date: AS_OF, close: 499.7, adjustedClose: 499.7 },
      ],
    });

    const range = await fiftyTwoWeekRange("MSFT", AS_OF);
    expect(range).toBeNull();

    const run = await msftRun(range);
    const result = assembleAnalysisResult(run.fixture);
    const mh = result.diagnostics.marginHistory;

    expect(mh.suppressed).toBe(true);
    if (mh.suppressed) {
      expect(mh.state).toBe("INCOMPLETE");
      expect(mh.cause).toContain("fiftyTwoWeekLow");
      expect(mh.cause).toContain("fiftyTwoWeekHigh");
    }
  });
});
