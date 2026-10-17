import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision, recordJudgment } from "./runStore";
import { computeAnalysisForRun, loadGateState } from "./gate";
import { recordAnalystBundle, type RecordedAnalystBundleInput } from "./acquisition/recordedBundles";
import { boundState, NOT_COMPUTED_BINDING } from "./notComputed";
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

// CF-ANALYZER-V1-SETTLE-01 (issue #392) — migration 008 now durably seeds
// this exact bundle for NVDA. A bare DELETE would erase that durable seed
// for any other test file expecting it, for the whole rest of the test
// run; re-recording the same approved content (recordAnalystBundle's own
// ON CONFLICT upsert) leaves NVDA exactly where migration 008 puts it,
// both between this file's own tests and after the whole file finishes.
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
    await seedApprovedNvdaBundle();
    // CF-ANALYZER-STAGE3-VERDICT-FINISH-01 — this file's own header scopes
    // it to issue #318's "bounded, no-new-capture observation": MSFT with
    // only the §4.4 judgment recorded, no scenario-driver bundle, exactly
    // the committed-fixture-carry-over state this file's assertions encode.
    // CF-MSFT-STAGE2-DURABLE-SEED-01 (issue #442, migration 010) landed a
    // durable MSFT scenario-driver bundle afterward, which this file
    // predates and never adopted, so this suite's own MSFT row is deleted
    // here rather than left to whatever another file's cleanup order
    // happens to leave behind — deterministic either way, not an
    // accident of execution order.
    await getPool().query("DELETE FROM analyzer_recorded_analyst_bundles WHERE ticker = $1", ["MSFT"]);
  });

  afterAll(async () => {
    await seedApprovedNvdaBundle();
    // Leave MSFT as migration 010 itself wants it to end up, for any later
    // file in this same run that exercises a real MSFT run.
    const migrationSql = readFileSync(join(process.cwd(), "migrations", "010_msft_recorded_bundle_seed.sql"), "utf-8");
    await getPool().query(migrationSql);
    await getPool().end();
  });

  it("MSFT (§4.4 ruled) — option A renders a real range; option B carries no SECONDARY/UNVERIFIED/AI-EXTRACTED flag", async () => {
    const result = await openMsftRunWithRuling();

    // A4 (CF-ANALYZER-INTEGRITY-PHASE-A-01) — the fair-value range no
    // longer presents MSFT_FIXTURE's own $265/$510/$650 as this real run's
    // computed scenario values; it is honestly suppressed, and trust (§9.6
    // rule 1) and Section G's scenario-values row follow that exactly as
    // they already do for any other suppressed range.
    expect(result.trust.status).toBe("UNUSABLE");
    expect(result.gates.gate1.state).toBeNull();
    expect(result.gates.gate1.filedYearsCount).toBe(13);
    expect(result.fairValueRange.kind).toBe("suppressed");
    if (result.fairValueRange.kind === "suppressed") {
      expect(result.fairValueRange.cause).toContain("scenario dollar values");
    }
    expect(result.scenarioOutputs.values.bear.isNaN()).toBe(true);
    expect(result.scenarioOutputs.values.base.isNaN()).toBe(true);
    expect(result.scenarioOutputs.values.bull.isNaN()).toBe(true);
    expect(result.states.qualifying.map((q) => q.flag)).toEqual(["MARGIN AT HISTORICAL HIGH"]);
    expect(provenanceQualifierFlagsPresent(result.states.qualifying)).toEqual([]);
    expect(result.facts).toHaveLength(20);
    expect(result.facts.filter((f) => f.sourceClass === "SECONDARY")).toHaveLength(0);
    expect(result.facts.filter((f) => f.extractionType === "AI-EXTRACTED")).toHaveLength(0);
    expect(result.facts.filter((f) => f.verificationState === "NOT CONFIRMED")).toHaveLength(0);
  });

  it("OKLO (unchanged) — option A's rendered range is suppressed and the raw scenario dispersion is honestly NOT COMPUTED (A4); SHORT HISTORY is the only carried flag, and trust is already UNUSABLE before it is ever read", async () => {
    const result = await openOkloRunUnchanged();

    expect(result.gates.gate1.state).toBe("SHORT HISTORY");
    expect(result.gates.gate1.filedYearsCount).toBe(5);
    expect(result.fairValueRange.kind).toBe("suppressed");
    if (result.fairValueRange.kind === "suppressed") {
      expect(result.fairValueRange.state).toBe("LEVERAGE UNSUPPORTED IN v1");
    }
    // A4 (CF-ANALYZER-INTEGRITY-PHASE-A-01, REVIEW-38537849376-1 CORRECT) —
    // option A's raw dispersion reading is no longer available: those
    // $3.10/$31/$48 values are OKLO_FIXTURE's own validation constants, not
    // a computation over this real run, so they are honestly NOT COMPUTED
    // the same way MSFT's are, rather than surfacing as a real dispersion
    // reading the leverage suppression merely hides from the headline range.
    expect(result.scenarioOutputs.values.bear.isNaN()).toBe(true);
    expect(result.scenarioOutputs.values.base.isNaN()).toBe(true);
    expect(result.scenarioOutputs.values.bull.isNaN()).toBe(true);
    expect(result.scenarioOutputs.weightedDistribution.isNaN()).toBe(true);
    const bound = boundState(result.states, NOT_COMPUTED_BINDING.scenarioValues);
    expect(bound?.state).toBe("INCOMPLETE");
    expect(bound?.cause).toMatch(/M5\/M7 validation fixture/);

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

  it("NVDA (§4.4 unmade) — option A's raw scenario dispersion is not surfaced while the sheet is pending adoption; option B carries CAPITAL-LIGHT, not SHORT HISTORY, and not one of the three ProvenanceQualifier flags", async () => {
    const result = await openNvdaObservationRun();

    expect(result.gates.gate1.state).toBeNull();
    expect(result.gates.gate1.filedYearsCount).toBe(13);
    expect(result.fairValueRange.kind).toBe("suppressed");
    if (result.fairValueRange.kind === "suppressed") {
      expect(result.fairValueRange.state).toBe("LEVERAGE UNSUPPORTED IN v1");
    }
    // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — reviewed evaluator change: the
    // transcribed bundle's typed $28.08/$102.38/$296.44 were entered under the
    // superseded rate and reinvestment conventions; NVDA's recorded sheet has
    // no D2 input, so it is pending adoption and they are no longer surfaced
    // as option A's raw dispersion — NaN, with the reason bound.
    expect(result.scenarioOutputs.values.bear.isNaN()).toBe(true);
    expect(result.scenarioOutputs.values.base.isNaN()).toBe(true);
    expect(result.scenarioOutputs.values.bull.isNaN()).toBe(true);
    expect(result.valuationBasis?.d2.status).toBe("PENDING ADOPTION");

    expect(result.states.qualifying.map((q) => q.flag)).toEqual(["CAPITAL-LIGHT"]);
    expect(provenanceQualifierFlagsPresent(result.states.qualifying)).toEqual([]);
    expect(result.trust.status).toBe("UNUSABLE");
    expect(result.facts).toHaveLength(15);
    expect(result.facts.filter((f) => f.sourceClass === "SECONDARY")).toHaveLength(0);
    expect(result.facts.filter((f) => f.extractionType === "AI-EXTRACTED")).toHaveLength(0);
    expect(result.facts.filter((f) => f.verificationState === "NOT CONFIRMED")).toHaveLength(0);
  });
});
