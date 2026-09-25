import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision, recordJudgment } from "./runStore";
import { computeAnalysisForRun, loadGateState } from "./gate";
import type { AnalysisResult } from "./types";
import type { TornadoDriver, TornadoRowResult, TwoWayTableResult } from "./modules/sensitivity";

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

const UNCAPTURED_DRIVERS: readonly TornadoDriver[] = ["discountRate", "terminalGrowth", "ronic"];

describe("CF-STEP4-MSFT-RANGE-CAPTURE-01 — MSFT's growth/margin tornado and two-way table on the real run", () => {
  beforeEach(async () => {
    await getPool().query("TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE");
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("produces available growth and operatingMargin tornado rows and an available growth x margin table; discountRate/terminalGrowth/RONIC and the rate x terminal-growth table stay unavailable", async () => {
    const result = await openMsftRunWithRuling();
    const tornado = result.diagnostics.sensitivity.tornado as TornadoRowResult[];
    const twoWayGrowthMargin = result.diagnostics.sensitivity.twoWayGrowthMargin as TwoWayTableResult;
    const twoWayRateTerminalGrowth = result.diagnostics.sensitivity.twoWayRateTerminalGrowth as TwoWayTableResult;

    expect(result.diagnostics.sensitivity.debtShareRemoved).toBe(true);
    expect(tornado.map((r) => r.driver)).toEqual(["growth", "operatingMargin", "discountRate", "terminalGrowth", "ronic"]);

    const growthRow = tornado.find((r) => r.driver === "growth")!;
    const marginRow = tornado.find((r) => r.driver === "operatingMargin")!;
    expect(growthRow.available).toBe(true);
    expect(marginRow.available).toBe(true);
    if (!growthRow.available || !marginRow.available) return;

    // Observed at head SHA 0c90cd4 (this branch's base), via
    // `TEST_DATABASE_URL=... npx vitest run lib/analyzer/msftSensitivityCaptureOnRealRun.test.ts`
    // — see the PR's own EVIDENCE section. Growth's full-range swing
    // (48.60%) already exceeds margin's (23.38%), so A1 (growth alone) and
    // A2 (max across available rows) read IDENTICAL for MSFT today — the
    // combined gate doc states this.
    expect(growthRow.fullRangeValueImpact.toString()).toBe("0.48598121081564411663");
    expect(growthRow.displayed).toBe(true);
    expect(growthRow.values.map((v) => v.toString())).toEqual([
      "1869532555851.2458706",
      "2296844836934.7157855",
      "2985755990760.4397171",
    ]);

    expect(marginRow.fullRangeValueImpact.toString()).toBe("0.23377202026469612084");
    expect(marginRow.displayed).toBe(true);
    expect(marginRow.values.map((v) => v.toString())).toEqual([
      "1759906779169.9507497",
      "1991766395022.9174697",
      "2296844836934.7157855",
    ]);

    for (const driver of UNCAPTURED_DRIVERS) {
      const row = tornado.find((r) => r.driver === driver)!;
      expect(row.available).toBe(false);
      if (!row.available) expect(row.cause).toBe(`missing REQUIRED analyst-supplied range: ${driver}`);
    }

    expect(twoWayGrowthMargin.available).toBe(true);
    if (twoWayGrowthMargin.available) {
      expect(twoWayGrowthMargin.rowValues.map((v) => v.toString())).toEqual(["0.1", "0.137", "0.185"]);
      expect(twoWayGrowthMargin.columnValues.map((v) => v.toString())).toEqual(["0.38", "0.418", "0.468"]);
      // Nine cells, growth (rows: 10.0%/13.7%/18.5%) x operating margin
      // (columns: 38.0%/41.8%/46.8%). The captured margin range's own middle
      // point (41.8%) is the M3 median margin, not the base scenario's own
      // margin (46.8%, the current margin) — so the true base case is cell
      // [1][2] (base growth 13.7%, base margin 46.8%), not [1][1]. Cell
      // [1][2] reproduces growthRow.values[1] and marginRow.values[2]
      // exactly (same growth, margin, rate, terminal growth, capital
      // intensity, tax — one shared model, one base case).
      expect(twoWayGrowthMargin.cells.map((row) => row.map((c) => c.toString()))).toEqual([
        ["1428373872313.0609675", "1618874212931.8226302", "1869532555851.2458706"],
        ["1759906779169.9507497", "1991766395022.9174697", "2296844836934.7157855"],
        ["2295306052132.414951", "2593454889267.2438273", "2985755990760.4397171"],
      ]);
      expect(twoWayGrowthMargin.cells[1][2].toString()).toBe(growthRow.values[1].toString());
      expect(twoWayGrowthMargin.cells[1][2].toString()).toBe(marginRow.values[2].toString());
    }

    expect(twoWayRateTerminalGrowth.available).toBe(false);
    if (!twoWayRateTerminalGrowth.available) {
      expect(twoWayRateTerminalGrowth.cause).toBe("missing REQUIRED analyst-supplied range: discountRate");
    }
  });
});
