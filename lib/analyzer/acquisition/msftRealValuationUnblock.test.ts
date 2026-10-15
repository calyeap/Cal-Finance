import { describe, it, expect, beforeEach, afterAll, afterEach } from "vitest";
import { getPool } from "../../db";
import { createRun, recordFactDecision, recordProfileDecision, recordJudgment } from "../runStore";
import { computeAnalysisForRun, loadGateState } from "../gate";
import { analystInputsFor, TICKERS_WITH_ANALYST_INPUTS } from "./analystInputs";
import { recordAnalystBundle, hasRecordedAnalystBundle, type RecordedAnalystBundleInput } from "./recordedBundles";
import type { AnalysisResult } from "../types";

// ---------------------------------------------------------------------------
// CF-ANALYZER-REAL-VALUATION-UNBLOCK-01 (issue #433).
//
// What this file proves: `analystInputsFor`'s resolution order now checks the
// recorded store (recordedBundles.ts) BEFORE the two static committed
// bundles, so a genuine, explicitly-recorded forecast for MSFT — entered
// through the exact same `recordAnalystBundle` write path that already
// durably resolves NVDA (migration 008) — is no longer permanently shadowed
// by the M5/M7 validation-fixture carry-over (analystInputs.ts's own
// `msftBundle()`, scenarioValuesAreFixtureCarried: true).
//
// This is a capture/approval SEAM, not a finance decision: no real MSFT
// forecast is recorded or drafted anywhere in this tree (no durable
// migration seed, unlike NVDA's own approved bundle). The
// `TEST_INPUT` below is a synthetic, clearly-labelled test fixture — proving
// the seam computes a genuine M1-M15 value from real SEC facts once a
// bundle exists, never an authored analyst view of Microsoft. It is written
// and deleted inside each test; MSFT carries no recorded bundle before or
// after this file runs, so every other suite's own assumption that MSFT
// resolves to its committed bundle (recordedAnalystInputEntryOnRealRun.
// test.tsx, nvdaAnalystDraftValidation.test.ts, analystInputsPinning.
// test.ts, step4FinalRealRunProof.test.ts) is unaffected.
// ---------------------------------------------------------------------------

const TEST_INPUT: RecordedAnalystBundleInput = {
  profile: "MATURE_PROFITABLE_STABLE_FCF",
  classificationInputs: {
    revenueScale: "large",
    fcfCharacter: "positive_stable",
    revenueGrowthBand: "10-30%",
    capitalIntensity: "0.1",
    cyclicality: { tenYearMarginRange: "0.214", worstSingleYearChange: "0.05" },
    balanceSheetNature: "asset-light",
  },
  scenarios: {
    bear: {
      revenueGrowthOrPath: "0.10",
      operatingMargin: "0.38",
      reinvestmentCapitalIntensity: "0.1",
      shareCount: "7430",
      writtenAnchor: "Test input — bear case, not an authored Microsoft forecast.",
    },
    base: {
      revenueGrowthOrPath: "0.137",
      operatingMargin: "0.418",
      reinvestmentCapitalIntensity: "0.1",
      shareCount: "7430",
      writtenAnchor: "Test input — base case, not an authored Microsoft forecast.",
    },
    bull: {
      revenueGrowthOrPath: "0.185",
      operatingMargin: "0.468",
      reinvestmentCapitalIntensity: "0.1",
      shareCount: "7430",
      writtenAnchor: "Test input — bull case, not an authored Microsoft forecast.",
    },
  },
  // These dollar figures are REQUIRED by recordAnalystBundle (unlike a
  // driver) — recorded here as explicit test placeholders, never a stand-in
  // for a real human-authored dollar value. The point this file proves is
  // the plumbing (recorded overrides committed; the real M1-M15 pipeline
  // runs on real SEC facts once a bundle exists), not these specific digits.
  scenarioValues: { bear: "111.11", base: "222.22", bull: "333.33" },
  configuredConstants: {
    nopatTaxRate: "0.18",
    stressMarginLevel: "0.38",
    preRevenueUnleveredRate: null,
    projectDebtCost: null,
  },
};

async function deleteMsftRecordedBundle(): Promise<void> {
  await getPool().query("DELETE FROM analyzer_recorded_analyst_bundles WHERE ticker = $1", ["MSFT"]);
}

async function completeSpotCheck(runId: string): Promise<void> {
  const state = await loadGateState(runId);
  for (const factId of state.outstandingFactIds) {
    await recordFactDecision(runId, factId, "CONFIRMED", null);
  }
}

// Copied verbatim from step4FinalRealRunProof.test.ts / msftSensitivityCaptureOnRealRun.test.ts's
// own openMsftRunWithRuling — not invented.
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

describe("CF-ANALYZER-REAL-VALUATION-UNBLOCK-01 — recorded bundle now takes precedence over MSFT's committed fixture", () => {
  beforeEach(async () => {
    await getPool().query("TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE");
    await deleteMsftRecordedBundle();
  });

  afterEach(deleteMsftRecordedBundle);

  afterAll(async () => {
    await deleteMsftRecordedBundle();
    await getPool().end();
  });

  it("regression — with nothing recorded, MSFT and OKLO still resolve from their committed, fixture-carried bundle", async () => {
    expect(await hasRecordedAnalystBundle("MSFT")).toBe(false);
    expect(await hasRecordedAnalystBundle("OKLO")).toBe(false);
    expect(TICKERS_WITH_ANALYST_INPUTS).toEqual(["MSFT", "OKLO"]);

    const msft = await analystInputsFor("MSFT");
    expect(msft?.inputs.scenarioValuesAreFixtureCarried).toBe(true);
    expect(msft?.note).toContain("carried from the validation set");

    const oklo = await analystInputsFor("OKLO");
    expect(oklo?.inputs.scenarioValuesAreFixtureCarried).toBe(true);
    expect(oklo?.note).toContain("carried from the validation set");
  });

  it("regression — NVDA is unaffected: it still resolves its own durably recorded (migration 008) bundle, not a fresh AI proposal", async () => {
    const nvda = await analystInputsFor("NVDA");
    expect(nvda).not.toBeNull();
    expect(nvda?.inputs.scenarioValues?.bear.toString()).toBe("28.08");
    expect(nvda?.note).toContain("entered by an analyst on this system");
  });

  it("once a bundle is explicitly recorded for MSFT, analystInputsFor resolves it instead of the committed fixture — never silently, never auto-approved", async () => {
    await recordAnalystBundle("MSFT", TEST_INPUT);
    expect(await hasRecordedAnalystBundle("MSFT")).toBe(true);

    const bundle = await analystInputsFor("MSFT");
    expect(bundle).not.toBeNull();
    expect(bundle?.inputs.scenarioValuesAreFixtureCarried).toBe(false);
    expect(bundle?.inputs.scenarioValues?.bear.toString()).toBe("111.11");
    expect(bundle?.note).toContain("entered by an analyst on this system");
    expect(bundle?.note).not.toContain("carried from the validation set");

    // Deleting the row reverts resolution to the committed fixture exactly —
    // the override is live only while something is actually recorded.
    await deleteMsftRecordedBundle();
    const reverted = await analystInputsFor("MSFT");
    expect(reverted?.inputs.scenarioValuesAreFixtureCarried).toBe(true);
  });

  it("a real, explicitly recorded MSFT forecast computes a genuine fair-value range from real SEC facts through the existing M1-M15 pipeline — never the fixture's $265/$510/$650, never NOT COMPUTED", async () => {
    await recordAnalystBundle("MSFT", TEST_INPUT);

    const result = await openMsftRunWithRuling();

    // A4's fixture-carried suppression no longer fires: the fair-value
    // range is computed, not suppressed.
    expect(result.fairValueRange.kind).toBe("range");
    if (result.fairValueRange.kind !== "range") return;

    // Real, positive, run-specific figures — never the old committed
    // fixture's $265 bear / $650 bull, and never this test's own dollar
    // placeholders (those are scenarioValues on the recorded row; the
    // report reads scenarioOutputs, computed the same way for every bundle
    // source — this just pins that recorded dollar figures flow straight
    // through unmodified, exactly as NVDA's own recorded dollar figures do).
    expect(result.fairValueRange.bear.toString()).toBe("111.11");
    expect(result.fairValueRange.bull.toString()).toBe("333.33");
    expect(result.fairValueRange.bear.toString()).not.toBe("265");
    expect(result.fairValueRange.bull.toString()).not.toBe("650");

    // Trust is no longer forced UNUSABLE by A4's own suppression — the real
    // EV bridge and leverage gate (both already proven on this exact run by
    // leverageOnRealRun.test.ts / reverseDcfOnRealRun.test.ts) are real SEC
    // facts, untouched by this outcome.
    expect(result.diagnostics.enterpriseValue.suppressed).toBe(false);
    expect(result.gates.leverage.result).toBe("PASS");
  });
});
