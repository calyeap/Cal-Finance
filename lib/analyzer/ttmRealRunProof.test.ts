import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision, recordJudgment } from "./runStore";
import { computeAnalysisForRun, loadGateState } from "./gate";
import { recordAnalystBundle, type RecordedAnalystBundleInput } from "./acquisition/recordedBundles";
import type { AnalysisResult } from "./types";

// ---------------------------------------------------------------------------
// A1 (CF-ANALYZER-INTEGRITY-PHASE-A-01) — the TTM-revenue fix, proved on the
// full real-run pipeline (gate.ts -> companyInputs.ts -> ttmFrom), not only
// on `quarterlySeriesWithDerivedQ4` in isolation (history.test.ts already
// covers that). Run-opening helpers copied verbatim from
// step4FinalRealRunProof.test.ts, which copied them from
// step4SignalObservationOnRealRun.test.ts in turn — not invented here.
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

async function seedApprovedNvdaBundle(): Promise<void> {
  await recordAnalystBundle("NVDA", approvedNvdaBundle());
}

async function openNvdaObservationRun(): Promise<AnalysisResult> {
  await recordAnalystBundle("NVDA", approvedNvdaBundle());
  const runId = await createRun("NVDA", "NVIDIA Corporation");
  await completeSpotCheck(runId);
  const state = await loadGateState(runId);
  await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
  return computeAnalysisForRun(runId);
}

describe("A1 (CF-ANALYZER-INTEGRITY-PHASE-A-01) — trailing-twelve-month revenue on the real-run pipeline", () => {
  beforeEach(async () => {
    await getPool().query("TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE");
    await seedApprovedNvdaBundle();
  });

  afterAll(async () => {
    await seedApprovedNvdaBundle();
    await getPool().end();
  });

  it("MSFT: diagnostics.runRate.ttm is FY2026's own filed total, never the bogus ~311.9B blend", async () => {
    const result = await openMsftRunWithRuling();
    const ttm = result.diagnostics.runRate.ttm;
    expect(ttm).not.toBeNull();
    expect(ttm!.toString()).toBe("331839000000");
  });

  it("NVDA: diagnostics.runRate.ttm is the independently-derivable ~302.9B, never the bogus ~281.6B blend", async () => {
    const result = await openNvdaObservationRun();
    const ttm = result.diagnostics.runRate.ttm;
    expect(ttm).not.toBeNull();
    expect(ttm!.toString()).toBe("302969000000");
  });

  it("OKLO regression: too few quarters for any TTM — reads unavailable, not a number", async () => {
    const result = await openOkloRunUnchanged();
    expect(result.diagnostics.runRate.ttm).toBeNull();
  });
});
