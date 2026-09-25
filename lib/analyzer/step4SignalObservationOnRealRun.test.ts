import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision, recordJudgment } from "./runStore";
import { computeAnalysisForRun, loadGateState } from "./gate";
import { recordAnalystBundle, type RecordedAnalystBundleInput } from "./acquisition/recordedBundles";
import type { AnalysisResult, QualifyingFlag } from "./types";

// ---------------------------------------------------------------------------
// CF-STEP4-SIGNAL-OBSERVE-01 (issue #318) — the bounded, no-new-capture
// observation `docs/step4-signal-observation.md` reports.
//
// Drives the same three already-committed real runs (MSFT, OKLO, NVDA)
// through the same gated product path the precedent real-run tests already
// use (nonOperatingJudgmentRecordedOnRealRun.test.ts, leverageOnRealRun.test.ts,
// nvdaRealRunObservation.test.ts), and asserts exactly the figures the
// observation document quotes for §11 item 1's option A (the bear/base/bull
// scenario range) and option B (the SECONDARY / UNVERIFIED / AI-EXTRACTED /
// SHORT HISTORY evidence-quality flags). This file rules nothing, answers no
// §11 item, and marks no acceptance-matrix row satisfied — it only makes the
// document's own figures reproducible.
//
// Each run's own recording/cleanup discipline is copied verbatim from its
// precedent file rather than invented: MSFT records Calvin's §4.4 ruling
// (issue #188) via recordJudgment, OKLO is opened unchanged, NVDA transcribes
// the approved Step-7 bundle via recordAnalystBundle and deletes it before and
// after itself.
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

/** The same approved NVDA Step-7 bundle `nvdaRealRunObservation.test.ts`
 * already transcribes byte-faithful (its own source file names the
 * approved draft this was taken from; not repeated here — see that file's
 * docstring). Written anchors are trimmed here since only the scenario
 * dispersion and evidence-quality flags are under observation in this pass. */
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

async function openNvdaObservationRun(): Promise<AnalysisResult> {
  await recordAnalystBundle("NVDA", approvedNvdaBundle());
  const runId = await createRun("NVDA", "NVIDIA Corporation");
  await completeSpotCheck(runId);
  const state = await loadGateState(runId);
  await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
  return computeAnalysisForRun(runId);
}

/** The three ProvenanceQualifier values §11 item 1's option B names alongside
 * SHORT HISTORY. Never constructed anywhere in `lib/` outside this type
 * declaration (`git grep -n '"SECONDARY"\|"UNVERIFIED"\|"AI-EXTRACTED"' lib/analyzer/assemble.ts`
 * returns nothing) — this helper asserts that absence holds on each run's own
 * output, not only by static grep. */
function provenanceQualifierFlagsPresent(qualifying: { flag: QualifyingFlag }[]): QualifyingFlag[] {
  return qualifying.map((q) => q.flag).filter((f) => f === "SECONDARY" || f === "UNVERIFIED" || f === "AI-EXTRACTED");
}

describe("CF-STEP4-SIGNAL-OBSERVE-01 — option A and option B signals on the three real runs", () => {
  beforeEach(async () => {
    await getPool().query(
      "TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE"
    );
    await deleteRecordedNvdaBundle();
  });

  afterAll(async () => {
    await deleteRecordedNvdaBundle();
    await getPool().end();
  });

  it("MSFT (§4.4 ruled) — option A renders a real range; option B carries no SECONDARY/UNVERIFIED/AI-EXTRACTED flag", async () => {
    const result = await openMsftRunWithRuling();

    expect(result.trust.status).toBe("PARTIAL");
    expect(result.gates.gate1.state).toBeNull();
    expect(result.gates.gate1.filedYearsCount).toBe(13);
    expect(result.fairValueRange.kind).toBe("range");
    if (result.fairValueRange.kind === "range") {
      expect(result.fairValueRange.bear.toFixed(2)).toBe("265.00");
      expect(result.fairValueRange.bull.toFixed(2)).toBe("650.00");
      expect(result.fairValueRange.weightedValueInside.toDecimalPlaces(2).toString()).toBe("475");
      expect(result.fairValueRange.scenarioLabelsWarning).toBe(true);
    }
    expect(result.scenarioOutputs.values.bear.toFixed(2)).toBe("265.00");
    expect(result.scenarioOutputs.values.base.toFixed(2)).toBe("510.00");
    expect(result.scenarioOutputs.values.bull.toFixed(2)).toBe("650.00");
    expect(result.states.qualifying.map((q) => q.flag)).toEqual(["MARGIN AT HISTORICAL HIGH"]);
    expect(provenanceQualifierFlagsPresent(result.states.qualifying)).toEqual([]);
    expect(result.facts).toHaveLength(20);
    expect(result.facts.filter((f) => f.sourceClass === "SECONDARY")).toHaveLength(0);
    expect(result.facts.filter((f) => f.extractionType === "AI-EXTRACTED")).toHaveLength(0);
    expect(result.facts.filter((f) => f.verificationState === "NOT CONFIRMED")).toHaveLength(0);
  });

  it("OKLO (unchanged) — option A's rendered range is suppressed, but the raw scenario dispersion still computes; SHORT HISTORY is the only carried flag, and trust is already UNUSABLE before it is ever read", async () => {
    const result = await openOkloRunUnchanged();

    expect(result.gates.gate1.state).toBe("SHORT HISTORY");
    expect(result.gates.gate1.filedYearsCount).toBe(5);
    expect(result.fairValueRange.kind).toBe("suppressed");
    if (result.fairValueRange.kind === "suppressed") {
      expect(result.fairValueRange.state).toBe("LEVERAGE UNSUPPORTED IN v1");
    }
    // Option A's raw dispersion reading is available even though the
    // rendered FairValueRange is not — the pre-revenue scenario values
    // compute independent of the leverage suppression that removes the
    // range itself.
    expect(result.scenarioOutputs.values.bear.toFixed(2)).toBe("3.10");
    expect(result.scenarioOutputs.values.base.toFixed(2)).toBe("31.00");
    expect(result.scenarioOutputs.values.bull.toFixed(2)).toBe("48.00");
    expect(result.scenarioOutputs.weightedDistribution.toFixed(2)).toBe("27.37");

    expect(result.states.qualifying.map((q) => q.flag)).toEqual(["SHORT HISTORY"]);
    expect(provenanceQualifierFlagsPresent(result.states.qualifying)).toEqual([]);
    // Rule 1 (UNUSABLE, the suppressed range) fires and returns before
    // trust.ts's rule 2 ever inspects states.qualifying — SHORT HISTORY is
    // carried on the run but plays no part in determining this status.
    expect(result.trust.status).toBe("UNUSABLE");
    expect(result.trust.determinedBy.some((d) => d.detail.includes("SHORT HISTORY"))).toBe(false);
    expect(result.facts).toHaveLength(16);
    expect(result.facts.filter((f) => f.sourceClass === "SECONDARY")).toHaveLength(0);
    expect(result.facts.filter((f) => f.extractionType === "AI-EXTRACTED")).toHaveLength(0);
    expect(result.facts.filter((f) => f.verificationState === "NOT CONFIRMED")).toHaveLength(0);
  });

  it("NVDA (§4.4 unmade) — option A's raw scenario dispersion is the transcribed bundle's own values; option B carries CAPITAL-LIGHT, not SHORT HISTORY, and not one of the three ProvenanceQualifier flags", async () => {
    const result = await openNvdaObservationRun();

    expect(result.gates.gate1.state).toBeNull();
    expect(result.gates.gate1.filedYearsCount).toBe(13);
    expect(result.fairValueRange.kind).toBe("suppressed");
    if (result.fairValueRange.kind === "suppressed") {
      expect(result.fairValueRange.state).toBe("LEVERAGE UNSUPPORTED IN v1");
    }
    expect(result.scenarioOutputs.values.bear.toFixed(2)).toBe("28.08");
    expect(result.scenarioOutputs.values.base.toFixed(2)).toBe("102.38");
    expect(result.scenarioOutputs.values.bull.toFixed(2)).toBe("296.44");
    expect(result.scenarioOutputs.weightedDistribution.toFixed(2)).toBe("142.30");

    expect(result.states.qualifying.map((q) => q.flag)).toEqual(["CAPITAL-LIGHT"]);
    expect(provenanceQualifierFlagsPresent(result.states.qualifying)).toEqual([]);
    expect(result.trust.status).toBe("UNUSABLE");
    expect(result.facts).toHaveLength(15);
    expect(result.facts.filter((f) => f.sourceClass === "SECONDARY")).toHaveLength(0);
    expect(result.facts.filter((f) => f.extractionType === "AI-EXTRACTED")).toHaveLength(0);
    expect(result.facts.filter((f) => f.verificationState === "NOT CONFIRMED")).toHaveLength(0);
  });
});
