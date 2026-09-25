import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision, recordJudgment } from "./runStore";
import { computeAnalysisForRun, loadGateState } from "./gate";
import type { AnalysisResult } from "./types";
import type { Step4ForecastDispersionReading } from "./modules/sensitivity";

// ---------------------------------------------------------------------------
// CF-STEP4-READING-IMPL-01 (issue #326) — pins the ruled Step 4
// forecast-dispersion reading (`CALVIN RULING — OPTION 1 APPROVED`, PR #325
// comment 5830997078: A2-in-principle / A1-fallback, rendered as a B2
// categorical tier) on MSFT's real acquired run, through the same gated
// real-run path `msftSensitivityCaptureOnRealRun.test.ts` and
// `step4SignalObservationOnRealRun.test.ts` already use. Run-opening logic
// copied verbatim from those files' `openMsftRunWithRuling`, not invented.
//
// This file adopts no tier boundary, no fair-value-zone width, and marks no
// acceptance-matrix row satisfied — it only makes the ruled reading's own
// real-run output reproducible and quotable.
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

describe("CF-STEP4-READING-IMPL-01 — MSFT's ruled Step 4 reading on the real run", () => {
  beforeEach(async () => {
    await getPool().query("TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE");
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("produces the A2 (max-across-available) reading, which coincides with A1 (growth alone) at 48.60% because growth's swing already exceeds margin's — asserted explicitly, not assumed", async () => {
    const result = await openMsftRunWithRuling();
    const reading = result.diagnostics.sensitivity.forecastDispersion as Step4ForecastDispersionReading;
    const tornado = result.diagnostics.sensitivity.tornado as { driver: string; available: boolean; fullRangeValueImpact?: unknown }[];

    const growthRow = tornado.find((r) => r.driver === "growth") as { available: true; fullRangeValueImpact: import("decimal.js").default };
    const marginRow = tornado.find((r) => r.driver === "operatingMargin") as { available: true; fullRangeValueImpact: import("decimal.js").default };
    expect(growthRow.available).toBe(true);
    expect(marginRow.available).toBe(true);

    // A1: the growth row's own fullRangeValueImpact, read directly.
    const a1 = growthRow.fullRangeValueImpact.toString();
    expect(a1).toBe("0.48598121081564411663");

    // A2: this outcome's own selector — the max across available: true rows.
    expect(reading.available).toBe(true);
    if (!reading.available) return;
    expect(reading.fullRangeValueImpact.toString()).toBe("0.48598121081564411663");
    expect(reading.selectedDriver).toBe("growth");

    // The coincidence, asserted rather than assumed: A1 and A2 agree exactly
    // because growth's swing (48.60%) already exceeds margin's (23.38%) —
    // the only other available row today.
    expect(reading.fullRangeValueImpact.toString()).toBe(a1);
    expect(marginRow.fullRangeValueImpact.lessThan(growthRow.fullRangeValueImpact)).toBe(true);

    // B2 tier shape is representable, honestly unset — no boundary adopted.
    expect(reading.tier).toBeNull();
  });
});
