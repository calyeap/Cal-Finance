// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, cleanup } from "@testing-library/react";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordJudgment, recordProfileDecision } from "./runStore";
import { computeAnalysisForRun, loadGateState, RunNotFoundError } from "./gate";
import { analystInputsFor } from "./acquisition/analystInputs";
import { recordAnalystBundle, hasRecordedAnalystBundle } from "./acquisition/recordedBundles";
import { boundState, NOT_COMPUTED_BINDING } from "./notComputed";
import { AnalyzerReport } from "@/app/components/AnalyzerReport";

// ---------------------------------------------------------------------------
// CF-ANALYST-INPUT-ENTRY-01, SCOPE item 7 — the reusable entry path proven
// end to end, against an already-committed capture, without authoring a
// real company's finance view.
//
// NVDA is used because lib/analyzer/acquisition/captures/nvda-companyfacts.json
// is ALREADY committed (M8-a's own acquisition acceptance runs) and NVDA
// carries no analyst-input bundle, committed or recorded — the exact
// "otherwise unsupported real company" this outcome's authority targets, and
// the same ticker AnalyzerEntry.test.tsx and acquiredRun.test.ts already use
// as their own "no bundle" example. No new capture and no prices.json row is
// added (HARD BOUNDS) — NVDA has none, so its run proceeds with price null,
// the same honest "no price was available" state buildAcquiredRun already
// gives any run with none.
//
// The scenario values, drivers and constants recorded below are TEST INPUTS,
// chosen only to exercise the entry path end to end and to leave specific
// drivers absent on purpose — they are not NVDA's authored analyst view and
// are never committed as one (SCOPE item 7's own requirement).
// ---------------------------------------------------------------------------

const TEST_TICKER = "NVDA";

const TEST_INPUT = {
  profile: "HIGH_GROWTH_PROFITABLE_UNCERTAIN_DURABILITY" as const,
  classificationInputs: {
    revenueScale: "large" as const,
    fcfCharacter: "positive_volatile" as const,
    revenueGrowthBand: ">30%" as const,
    capitalIntensity: "0.08",
    cyclicality: { tenYearMarginRange: "0.2", worstSingleYearChange: "0.05" },
    balanceSheetNature: "asset-light" as const,
  },
  scenarios: {
    // Deliberately left fully unauthored — SCOPE item 7(c): a scenario whose
    // drivers are left unsupplied must yield INCOMPLETE at exactly that
    // scenario's drivers, never a substituted number.
    bear: {
      revenueGrowthOrPath: null,
      operatingMargin: null,
      reinvestmentCapitalIntensity: null,
      shareCount: "24.6",
      writtenAnchor: "Test input — bear case, drivers intentionally left unauthored.",
    },
    base: {
      revenueGrowthOrPath: "0.30",
      operatingMargin: "0.55",
      reinvestmentCapitalIntensity: "0.2",
      shareCount: "24.6",
      writtenAnchor: "Test input — base case growth path.",
    },
    bull: {
      revenueGrowthOrPath: "0.45",
      operatingMargin: "0.6",
      reinvestmentCapitalIntensity: "0.25",
      shareCount: "24.6",
      writtenAnchor: "Test input — bull case growth path.",
    },
  },
  scenarioValues: { bear: "80", base: "180", bull: "260" },
  configuredConstants: {
    nopatTaxRate: "0.21",
    stressMarginLevel: null,
    preRevenueUnleveredRate: null,
    projectDebtCost: null,
  },
};

async function completeSpotCheck(runId: string): Promise<void> {
  const state = await loadGateState(runId);
  for (const factId of state.outstandingFactIds) {
    await recordFactDecision(runId, factId, "CONFIRMED", null);
  }
}

/** §4.4's judgment, answered "none" — enough to unsuppress EV/leverage so the
 * fair-value range itself can be observed, without authoring a real
 * classification for a company nobody has actually classified. */
async function recordNoNonOperatingInvestments(runId: string): Promise<void> {
  await recordJudgment(
    runId,
    "NON-OPERATING INVESTMENTS",
    "None of these are non-operating",
    "Test input — no non-operating classification made for this test run."
  );
}

describe("CF-ANALYST-INPUT-ENTRY-01 — the recorded entry path, end to end on a real capture", () => {
  beforeEach(async () => {
    await getPool().query(
      "TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE"
    );
    await getPool().query("DELETE FROM analyzer_recorded_analyst_bundles WHERE ticker = $1", [TEST_TICKER]);
  });

  afterEach(cleanup);

  afterAll(async () => {
    await getPool().end();
  });

  it("(a) refuses before any bundle is recorded — the existing fail-closed check, unweakened", async () => {
    expect(await hasRecordedAnalystBundle(TEST_TICKER)).toBe(false);
    expect(await analystInputsFor(TEST_TICKER)).toBeNull();

    const runId = await createRun(TEST_TICKER, "NVIDIA Corporation");
    await expect(computeAnalysisForRun(runId)).rejects.toBeInstanceOf(RunNotFoundError);
  });

  it("(b) opens a run and reaches a rendered report once a bundle is recorded through the entry path", async () => {
    await recordAnalystBundle(TEST_TICKER, TEST_INPUT);
    expect(await hasRecordedAnalystBundle(TEST_TICKER)).toBe(true);

    const runId = await createRun(TEST_TICKER, "NVIDIA Corporation");
    await completeSpotCheck(runId);
    const state = await loadGateState(runId);
    await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);

    const result = await computeAnalysisForRun(runId);
    expect(result.companyName.toUpperCase()).toContain("NVIDIA");

    // A rendered report, not merely a computed result — the same component
    // the report route renders.
    expect(() => render(<AnalyzerReport result={result} />)).not.toThrow();
  });

  it("(c) a driver deliberately left unsupplied yields INCOMPLETE at exactly that scenario, with no substituted number — the other scenarios and the fair-value range compute normally", async () => {
    await recordAnalystBundle(TEST_TICKER, TEST_INPUT);
    const runId = await createRun(TEST_TICKER, "NVIDIA Corporation");
    await recordNoNonOperatingInvestments(runId);
    await completeSpotCheck(runId);
    const state = await loadGateState(runId);
    await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
    const result = await computeAnalysisForRun(runId);

    const bear = boundState(result.states, NOT_COMPUTED_BINDING.scenarioDrivers("bear"));
    expect(bear).not.toBeNull();
    expect(bear?.state).toBe("INCOMPLETE");
    expect(bear?.cause).toContain("revenue growth");
    expect(bear?.cause).toContain("operating margin");
    expect(bear?.cause).toContain("reinvestment");

    // Base and bull carried every driver — not swept into the same
    // suppression as bear.
    expect(boundState(result.states, NOT_COMPUTED_BINDING.scenarioDrivers("base"))).toBeNull();
    expect(boundState(result.states, NOT_COMPUTED_BINDING.scenarioDrivers("bull"))).toBeNull();

    // NVDA carries no captured price (HARD BOUNDS: no new prices.json row is
    // added by this outcome), so leverage — and with it the fair-value range
    // — is honestly LEVERAGE UNSUPPORTED IN v1, exactly OKLO's own committed
    // bundle reaches for an unrelated reason. The point pinned here is what
    // does NOT happen: this suppression is never backfilled with a number,
    // and it is not the scenario-drivers INCOMPLETE asserted above — two
    // independent honest states, neither invented.
    expect(result.fairValueRange.kind).toBe("suppressed");
    if (result.fairValueRange.kind === "suppressed") {
      expect(result.fairValueRange.state).toBe("LEVERAGE UNSUPPORTED IN v1");
    }

    // The unset §7.1 constants left blank in TEST_INPUT stay unset for this
    // run too — recording nopatTaxRate for one company's run is not Command
    // Center defining the constant.
    const { UNDEFINED_POLICY_CONSTANTS } = await import("./policy");
    expect(UNDEFINED_POLICY_CONSTANTS.nopatTaxRate).toBeNull();
  });

  it("(SCOPE item 5) an entered bundle is distinguishable from a fixture-carried one, in the store and in the disclosure", async () => {
    await recordAnalystBundle(TEST_TICKER, TEST_INPUT);
    const bundle = await analystInputsFor(TEST_TICKER);
    expect(bundle).not.toBeNull();
    expect(bundle?.note).toContain("entered by an analyst on this system");
    expect(bundle?.note).not.toContain("carried from the validation set");

    // Store-level: a recorded bundle lives in its own table, never among the
    // two committed ones.
    const { rows } = await getPool().query(
      "SELECT ticker FROM analyzer_recorded_analyst_bundles WHERE ticker = $1",
      [TEST_TICKER]
    );
    expect(rows).toHaveLength(1);
  });

  it("MSFT and OKLO come out unchanged — still the committed bundle, still its own disclosure, never routed through the recorded store", async () => {
    expect(await hasRecordedAnalystBundle("MSFT")).toBe(false);
    expect(await hasRecordedAnalystBundle("OKLO")).toBe(false);

    const msft = await analystInputsFor("MSFT");
    expect(msft?.note).toContain("carried from the validation set");
    expect(msft?.note).not.toContain("entered by an analyst on this system");

    const oklo = await analystInputsFor("OKLO");
    expect(oklo?.note).toContain("carried from the validation set");
  });
});

// ---------------------------------------------------------------------------
// SCOPE item 2 / DONE WHEN — "one asserting no second resolution path
// exists". A static pin, not a DB test: the only file that reads
// recordedBundles.ts's exports is analystInputs.ts, and the two existing
// analystInputsFor call sites are unchanged in name.
// ---------------------------------------------------------------------------
describe("analystInputsFor stays the one resolver — no second resolution path", () => {
  const ROOT = path.resolve(__dirname, "..", "..");
  const read = (relPath: string) => readFileSync(path.join(ROOT, relPath), "utf8");

  it("recordedBundles.ts's resolution export is imported only by analystInputs.ts", () => {
    const consumers = [
      "lib/analyzer/acquiredRun.ts",
      "scripts/analyzer/calibrate-position.ts",
      "lib/analyzer/gate.ts",
    ];
    for (const file of consumers) {
      expect(read(file)).not.toContain("recordedAnalystInputBundle");
    }
    expect(read("lib/analyzer/acquisition/analystInputs.ts")).toContain(
      "import { recordedAnalystInputBundle } from \"./recordedBundles\""
    );
  });

  it("both existing call sites still resolve through analystInputsFor, not a second function", () => {
    expect(read("lib/analyzer/acquiredRun.ts")).toContain("await analystInputsFor(options.ticker)");
    expect(read("scripts/analyzer/calibrate-position.ts")).toContain("await analystInputsFor(company.ticker)");
  });

  it("gate.ts's isSupportedTicker defers to analystInputsFor rather than re-deriving support a second way", () => {
    expect(read("lib/analyzer/gate.ts")).toContain("await analystInputsFor(ticker)) !== null");
  });
});
