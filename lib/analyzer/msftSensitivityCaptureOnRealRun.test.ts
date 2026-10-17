import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision, recordJudgment } from "./runStore";
import { computeAnalysisForRun, loadGateState } from "./gate";
import type { AnalysisResult } from "./types";
import type { TornadoDriver, TornadoRowResult, TwoWayTableResult } from "./modules/sensitivity";
import type Decimal from "decimal.js";
import { endOfYearEnterpriseValue, sameToPrecision } from "./golden/endOfYearEquivalent";

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

    // CF-MSFT-STAGE2-DURABLE-SEED-01 (issue #442, migration
    // 010_msft_recorded_bundle_seed.sql) durably recorded Calvin's approved
    // MSFT Stage-2 candidate, which both changes the base scenario's own
    // operating margin (0.45, was the committed fixture's 0.468) and growth
    // (0.14, was 0.137) AND wires this candidate's terminalRoic/fading
    // reinvestment into M14's own scenarioValueAt (the Stage-2 proof's own
    // "M14 uses each cell's own margin and terminal growth" finding) — so
    // every cell below is this approved candidate's, not the retired
    // validation fixture's. Growth's full-range swing (48.85%) still
    // exceeds margin's (24.47%), so A1 (growth alone) and A2 (max across
    // available rows) still read IDENTICAL for MSFT — the combined gate
    // doc's own point survives this correction unchanged.
    // CF-AR3-REPRODUCIBLE-RUNS-01 — a ratio of two values from the same M15
    // model: Methodology v2.1 D2's timing scales both by one common factor, so
    // it is unchanged; the 1e-15 allowance is decimal.js rounding of the
    // fractional (1 + r)^0.5 power, at the 20th significant digit.
    expect(growthRow.fullRangeValueImpact.minus("0.48846512490800969627").abs().lessThan("1e-15")).toBe(true);
    expect(growthRow.displayed).toBe(true);
    // Absolute M15 values: reproduced with D2's timing factor removed
    // (golden/endOfYearEquivalent.ts), to the pin's own precision.
    const endOfYear = (v: Decimal) => endOfYearEnterpriseValue(result, v);
    const matches = (values: readonly Decimal[], pinned: string[]) =>
      expect(values.map((v, i) => sameToPrecision(endOfYear(v), pinned[i]))).toEqual(pinned.map(() => true));
    matches(growthRow.values, [
      "1676081914421.5470769",
      "2068964793072.3220586",
      "2703937717350.9159262",
    ]);

    expect(marginRow.fullRangeValueImpact.minus("0.24471297471512425894").abs().lessThan("1e-15")).toBe(true);
    expect(marginRow.displayed).toBe(true);
    matches(marginRow.values, [
      "1694645853766.5089845",
      "1917005795302.6690607",
      "2209584665744.9849507",
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
      // (columns: 38.0%/41.8%/46.8%) — this fixed AnalystSuppliedRange
      // capture (CALVIN RULING — A) is a static citation in analystInputs.ts,
      // unchanged by migration 010. What DID change: the approved Stage-2
      // candidate's own base scenario growth (14.0%) and margin (45.0%)
      // no longer land exactly on this range's own middle points (13.7%/
      // 41.8%) the way the retired validation fixture's base scenario
      // (13.7%/46.8%, coinciding with this range's row 1/column 2) used to —
      // so no single cell here reproduces growthRow/marginRow's own held-
      // constant-axis values anymore; each tornado row holds the OTHER
      // axis at the approved candidate's own base driver (growth 0.14,
      // margin 0.45), which this grid's own three fixed points don't pass
      // through.
      const pinnedCells = [
        ["1343989856586.6415681", "1524268402268.4474157", "1761477015007.6656362"],
        ["1665716925164.3986792", "1884622910600.1285138", "2172657101962.9309277"],
        ["2186793711998.3449204", "2467529029189.7406093", "2836917604441.5770421"],
      ];
      twoWayGrowthMargin.cells.forEach((row, i) => matches(row, pinnedCells[i]));
    }

    expect(twoWayRateTerminalGrowth.available).toBe(false);
    if (!twoWayRateTerminalGrowth.available) {
      expect(twoWayRateTerminalGrowth.cause).toBe("missing REQUIRED analyst-supplied range: discountRate");
    }
  });
});
