import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision, recordJudgment } from "./runStore";
import { computeAnalysisForRun, loadGateState } from "./gate";
import type { AnalysisResult } from "./types";
import type { TornadoDriver, TornadoRowResult, TwoWayTableResult } from "./modules/sensitivity";
import { assembleAnalysisResult } from "./assemble";
import { withStatedD2Inputs } from "./fixtures/statedD2Inputs";

// ---------------------------------------------------------------------------
// CF-STEP4-MSFT-RANGE-CAPTURE-01 (issue #324) — observes the MSFT-only
// growth/operating-margin AnalystSuppliedRange capture (analystInputs.ts,
// authorised by CALVIN RULING — A) running through the already-built M14
// tornado/two-way machinery (sensitivity.ts) on the same gated real-run path
// the precedent real-run tests already use
// (step4SignalObservationOnRealRun.test.ts, nvdaRealRunObservation.test.ts).
// Run-opening logic copied verbatim from step4SignalObservationOnRealRun.
// test.ts's openMsftRunWithRuling, not invented.
//
// This file adopts no numeric policy, sets no Step 4 quantity, marks no
// acceptance-matrix row satisfied — it only makes the capture's own real-run
// output reproducible and quotable, at the head SHA this branch was cut
// from (see the PR's own EVIDENCE section for that SHA and the `npx vitest
// run` command that produced these figures).
// ---------------------------------------------------------------------------

async function completeSpotCheck(runId: string): Promise<void> {
  const state = await loadGateState(runId);
  for (const factId of state.outstandingFactIds) {
    await recordFactDecision(runId, factId, "CONFIRMED", null);
  }
}

async function openMsftRunWithRuling(): Promise<AnalysisResult> {
  const runId = await createRun("MSFT", "Microsoft Corporation");
  await recordJudgment(
    runId,
    "NON-OPERATING INVESTMENTS",
    "us-gaap:LongTermInvestments",
    "Calvin's §4.4 ruling, 2026-09-21T08:19:14Z, issue #188."
  );
  await completeSpotCheck(runId);
  const state = await loadGateState(runId);
  await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
  return computeAnalysisForRun(runId);
}

async function decidedMsftFixture() {
  const runId = await createRun("MSFT", "Microsoft Corporation");
  await recordJudgment(
    runId,
    "NON-OPERATING INVESTMENTS",
    "us-gaap:LongTermInvestments",
    "Calvin's §4.4 ruling, 2026-09-21T08:19:14Z, issue #188."
  );
  await completeSpotCheck(runId);
  const state = await loadGateState(runId);
  await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
  return (await loadGateState(runId)).fixture;
}

// CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — reviewed evaluator change. This file
// pinned the Stage-2 candidate's tornado digits (capital-intensity engine,
// 10% rate), superseded by product-decisions item 27 (D2), and its "three
// uncaptured rows". Under AR0-2 the tornado varies the base scenario's own
// D2 valuation, adds the rate-band ends (D1's ±0.5pp), the sheet's return
// on new investment and the moat, and runs only on an adopted sheet. The
// pins are replaced by what the table must satisfy: every row at its own
// base input reproduces the one base value, and each moves value the way
// the economics say. The D2 inputs are STATED TEST INPUTS, never recorded.
describe("CF-STEP4-MSFT-RANGE-CAPTURE-01 — MSFT's tornado and two-way tables on the real run (D2 engine)", () => {
  beforeEach(async () => {
    await getPool().query("TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE");
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("on a sheet pending adoption there is no base value to vary — the module does not run", async () => {
    const result = await openMsftRunWithRuling();
    expect(result.valuationBasis?.d2.status).toBe("PENDING ADOPTION");
    expect(result.diagnostics.sensitivity.tornado).toEqual([]);
  });

  it("on an adopted sheet: growth, margin, rate-band ends, return on new investment and moat are available; terminal growth is not", async () => {
    const fixture = withStatedD2Inputs(await decidedMsftFixture());
    const result = assembleAnalysisResult(fixture);
    const tornado = result.diagnostics.sensitivity.tornado as TornadoRowResult[];
    const twoWayGrowthMargin = result.diagnostics.sensitivity.twoWayGrowthMargin as TwoWayTableResult;
    const twoWayRateTerminalGrowth = result.diagnostics.sensitivity.twoWayRateTerminalGrowth as TwoWayTableResult;

    expect(result.diagnostics.sensitivity.debtShareRemoved).toBe(true);
    expect(tornado.map((r) => r.driver)).toEqual(["growth", "operatingMargin", "discountRate", "terminalGrowth", "ronic", "moat"]);
    const row = (d: TornadoDriver) => tornado.find((r) => r.driver === d)!;
    for (const d of ["growth", "operatingMargin", "discountRate", "ronic", "moat"] as const) expect(row(d).available).toBe(true);
    const tg = row("terminalGrowth");
    expect(tg.available).toBe(false);
    if (!tg.available) expect(tg.cause).toBe("missing REQUIRED analyst-supplied range: terminalGrowth");

    // The rate row's three values are D1's own check points.
    const rate = row("discountRate");
    if (rate.available) {
      expect(rate.values[0].greaterThan(rate.values[1])).toBe(true); // lower rate, higher value
      expect(rate.values[1].greaterThan(rate.values[2])).toBe(true);
    }
    // Growth, margin, return on new investment and moat each raise value.
    for (const d of ["growth", "operatingMargin", "ronic", "moat"] as const) {
      const r = row(d);
      if (!r.available) continue;
      expect(r.values[0].lessThan(r.values[2])).toBe(true);
    }

    expect(twoWayGrowthMargin.available).toBe(true);
    if (twoWayGrowthMargin.available) {
      expect(twoWayGrowthMargin.rowValues.map((v) => v.toString())).toEqual(["0.1", "0.137", "0.185"]);
      expect(twoWayGrowthMargin.columnValues.map((v) => v.toString())).toEqual(["0.38", "0.418", "0.468"]);
      expect(twoWayGrowthMargin.cells[2][2].greaterThan(twoWayGrowthMargin.cells[0][0])).toBe(true);
    }
    // Rate × terminal growth needs a terminal-growth range nobody approved.
    expect(twoWayRateTerminalGrowth.available).toBe(false);
  });

  it("every row, at its own base input, reproduces the one base enterprise value", async () => {
    const fixture = withStatedD2Inputs(await decidedMsftFixture());
    const result = assembleAnalysisResult(fixture);
    const tornado = result.diagnostics.sensitivity.tornado as TornadoRowResult[];
    // Each available row's middle value is its base input: the moat row's
    // middle credit is the stated narrow moat, the rate row's the D1 rate,
    // the RONIC row's the base scenario's own.
    const middles = ["discountRate", "ronic", "moat"].map((d) => tornado.find((r) => r.driver === d)!);
    const baseValues = middles.filter((r) => r.available).map((r) => (r.available ? r.values[1].toString() : ""));
    expect(baseValues).toHaveLength(3);
    expect(new Set(baseValues).size).toBe(1);
  });
});
