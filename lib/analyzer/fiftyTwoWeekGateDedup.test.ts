import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { getPool } from "../db";
import { createRun, recordJudgment } from "./runStore";

// ---------------------------------------------------------------------------
// M9-FIFTYTWOWEEK-01, DONE WHEN 2 — "a test pins that the second
// buildAcquiredRun call still costs no additional provider/EDGAR request."
//
// loadGateState calls buildAcquiredRun twice whenever a NON-OPERATING
// INVESTMENTS judgment is on record (once to learn the candidates, once more
// to apply the judgment). The EDGAR half of that guarantee already has no
// test pinning it directly (it rests on acquisition/provider.ts's own TTL
// cache); this file adds the market-data half this outcome introduces —
// fiftyTwoWeek is fetched ONCE, before either buildAcquiredRun call, and
// passed to both, rather than each call fetching its own.
//
// The EDGAR acquisition itself is redirected to the committed capture
// transparently (never network) so this can run with ANALYZER_OFFLINE
// UNSET — the state that makes gate.ts's own price/fiftyTwoWeek fetches take
// their live branch, which is the one being counted here.
// ---------------------------------------------------------------------------

vi.mock("./acquisition/provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./acquisition/provider")>();
  return {
    ...actual,
    acquireCompany: (ticker: string, options: Parameters<typeof actual.acquireCompany>[1]) =>
      actual.acquireCompany(ticker, { ...options, source: "CAPTURE" }),
  };
});

const fetchHistoricalEod = vi.fn(async () => [
  { date: "2025-09-08", close: 410.0, adjustedClose: 410.0 },
  { date: "2026-09-04", close: 499.7, adjustedClose: 499.7 },
  { date: "2026-01-15", close: 555.45, adjustedClose: 555.45 },
]);

vi.mock("../marketdata", () => ({
  activeProvider: () => ({
    sourceName: "STUB",
    resolveInstrument: async () => ({ outcome: "unknown" as const }),
    fetchLatestEod: async () => ({ date: "2026-09-04", close: 499.7, adjustedClose: 499.7 }),
    fetchHistoricalEod,
  }),
}));

const { loadGateState } = await import("./gate");
const { __resetAcquisitionCache } = await import("./acquisition/provider");

const OFFLINE = process.env.ANALYZER_OFFLINE;

describe("loadGateState fetches the 52-week range once, for both buildAcquiredRun calls", () => {
  beforeEach(async () => {
    await getPool().query(
      "TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE"
    );
    __resetAcquisitionCache();
    fetchHistoricalEod.mockClear();
    delete process.env.ANALYZER_OFFLINE;
  });

  afterEach(() => {
    if (OFFLINE === undefined) delete process.env.ANALYZER_OFFLINE;
    else process.env.ANALYZER_OFFLINE = OFFLINE;
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("calls fetchHistoricalEod exactly once even though the judgment forces a second buildAcquiredRun call", async () => {
    const runId = await createRun("MSFT", "Microsoft Corporation");
    // Forces loadGateState's second buildAcquiredRun call (selectionToNonOperatingInvestments
    // resolves non-null once a judgment is on record).
    await recordJudgment(runId, "NON-OPERATING INVESTMENTS", "None of these are non-operating", null);

    const state = await loadGateState(runId);

    expect(fetchHistoricalEod).toHaveBeenCalledTimes(1);
    // And both call sites actually received it: the acquired fixture (built
    // by the SECOND call, since a judgment is on record) carries the fetched
    // range rather than the absent-input state.
    expect(state.fixture.marginHistory.fiftyTwoWeekLow).not.toBeNull();
    expect(state.fixture.marginHistory.fiftyTwoWeekHigh).not.toBeNull();
  });

  it("still calls it exactly once when no judgment is on record (single buildAcquiredRun call)", async () => {
    const runId = await createRun("MSFT", "Microsoft Corporation");

    await loadGateState(runId);

    expect(fetchHistoricalEod).toHaveBeenCalledTimes(1);
  });
});
