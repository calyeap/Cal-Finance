import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision, recordJudgment } from "./runStore";
import { computeAnalysisForRun, loadGateState } from "./gate";
import { recordAnalystBundle, type RecordedAnalystBundleInput } from "./acquisition/recordedBundles";
import type { AnalysisResult } from "./types";
import type { Step4ForecastDispersionReading } from "./modules/sensitivity";

// ---------------------------------------------------------------------------
// CF-STEP4-READING-IMPL-01 (issue #326) / CF-STEP4-TIER-BOUNDARY-DEFAULT-01
// (issue #329) — pins the ruled Step 4 forecast-dispersion reading
// (`CALVIN RULING — OPTION 1 APPROVED`, PR #325 comment 5830997078:
// A2-in-principle / A1-fallback, rendered as a B2 categorical tier) on
// MSFT's real acquired run, through the same gated real-run path
// `msftSensitivityCaptureOnRealRun.test.ts` and
// `step4SignalObservationOnRealRun.test.ts` already use. Run-opening logic
// for all three companies copied verbatim from
// `step4SignalObservationOnRealRun.test.ts`'s `openMsftRunWithRuling` /
// `openOkloRunUnchanged` / `openNvdaObservationRun`, not invented.
//
// The tier boundaries themselves are `PROVISIONAL`, labelled, non-governing
// `AI DEFAULT` policy constants (`policy.ts`) — this file adopts no
// fair-value-zone width and marks no acceptance-matrix row satisfied; it
// only makes the ruled reading's own real-run output reproducible and
// quotable.
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

async function openOkloRunUnchanged(): Promise<AnalysisResult> {
  const runId = await createRun("OKLO", "Oklo Inc.");
  await completeSpotCheck(runId);
  const state = await loadGateState(runId);
  await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
  return computeAnalysisForRun(runId);
}

// NVDA has no supported ticker without a recorded analyst bundle at all
// (gate.ts's `isSupportedTicker` fail-closed check) — a run "unchanged" for
// NVDA still requires the same approved Step-7 bundle
// `step4SignalObservationOnRealRun.test.ts` transcribes byte-faithful, not
// an omission this outcome introduces. Copied verbatim from that file.
function approvedNvdaBundle(): RecordedAnalystBundleInput {
  return {
    profile: "HIGH_GROWTH_PROFITABLE_UNCERTAIN_DURABILITY",
    classificationInputs: {
      revenueScale: "large",
      fcfCharacter: "positive_volatile",
      revenueGrowthBand: ">30%",
      capitalIntensity: "0.028",
      cyclicality: { tenYearMarginRange: "0.4751", worstSingleYearChange: "0.2165" },
      balanceSheetNature: "asset-light",
    },
    scenarios: {
      bear: {
        revenueGrowthOrPath: "0.05",
        operatingMargin: "0.30",
        reinvestmentCapitalIntensity: "0.02",
        shareCount: "24.1",
        writtenAnchor: "AI/datacenter capex cycle corrects; growth slows sharply but stays positive.",
      },
      base: {
        revenueGrowthOrPath: "0.20",
        operatingMargin: "0.50",
        reinvestmentCapitalIntensity: "0.04",
        shareCount: "24.1",
        writtenAnchor: "AI-driven datacenter demand continues but decelerates off the FY2026 base.",
      },
      bull: {
        revenueGrowthOrPath: "0.35",
        operatingMargin: "0.60",
        reinvestmentCapitalIntensity: "0.05",
        shareCount: "24.1",
        writtenAnchor: "AI/accelerated-computing demand sustains at a high level.",
      },
    },
    scenarioValues: { bear: "28.08", base: "102.38", bull: "296.44" },
    configuredConstants: {
      nopatTaxRate: "0.21",
      stressMarginLevel: "0.15",
      preRevenueUnleveredRate: null,
      projectDebtCost: null,
    },
  };
}

async function deleteRecordedNvdaBundle(): Promise<void> {
  await getPool().query("DELETE FROM analyzer_recorded_analyst_bundles WHERE ticker = 'NVDA'");
}

async function openNvdaRunUnchanged(): Promise<AnalysisResult> {
  await recordAnalystBundle("NVDA", approvedNvdaBundle());
  const runId = await createRun("NVDA", "NVIDIA Corporation");
  await completeSpotCheck(runId);
  const state = await loadGateState(runId);
  await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
  return computeAnalysisForRun(runId);
}

describe("CF-STEP4-READING-IMPL-01 / CF-STEP4-TIER-BOUNDARY-DEFAULT-01 — the ruled Step 4 reading on the three real runs", () => {
  beforeEach(async () => {
    await getPool().query("TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE");
    await deleteRecordedNvdaBundle();
  });

  afterAll(async () => {
    await deleteRecordedNvdaBundle();
    await getPool().end();
  });

  it("MSFT produces the A2 (max-across-available) reading, which coincides with A1 (growth alone) at 48.60% because growth's swing already exceeds margin's — asserted explicitly, not assumed — and resolves to HIGH under the AI DEFAULT boundaries", async () => {
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

    // B2 tier — 0.48598... is at or above the 0.25 MEDIUM/HIGH AI DEFAULT
    // boundary, so this reads HIGH (it would read MEDIUM under a 0.50
    // boundary — see policy.ts's provenance entry for that alternative).
    expect(reading.tier).toBe("HIGH");
  });

  it("OKLO stays unchanged: forecastDispersion is still available: false with a non-empty cause, and carries no tier — no new capture, this outcome touches no scenario/tornado inputs", async () => {
    const result = await openOkloRunUnchanged();
    const reading = result.diagnostics.sensitivity.forecastDispersion as Step4ForecastDispersionReading;

    expect(reading.available).toBe(false);
    if (reading.available) return;
    expect(reading.cause.length).toBeGreaterThan(0);
    expect("tier" in reading).toBe(false);
  });

  it("NVDA stays unchanged: forecastDispersion is still available: false with a non-empty cause, and carries no tier — the recorded Step-7 bundle supplies DCF scenarios, not the M14 growth/margin AnalystSuppliedRange this outcome's tornado reads", async () => {
    const result = await openNvdaRunUnchanged();
    const reading = result.diagnostics.sensitivity.forecastDispersion as Step4ForecastDispersionReading;

    expect(reading.available).toBe(false);
    if (reading.available) return;
    expect(reading.cause.length).toBeGreaterThan(0);
    expect("tier" in reading).toBe(false);
  });
});
