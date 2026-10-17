import { describe, it, expect, beforeEach, afterAll } from "vitest";
import Decimal from "decimal.js";
import { buildAcquiredRun } from "./acquiredRun";
import { assembleAnalysisResult } from "./assemble";
import { withStatedD2Inputs } from "./fixtures/statedD2Inputs";
import { __resetAcquisitionCache } from "./acquisition/provider";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision } from "./runStore";
import { computeAnalysisForRun, loadGateState } from "./gate";

// ---------------------------------------------------------------------------
// CF-M8-VERDICT-ENGINEERING-UNBLOCK-01 — real-company coverage for
// growthLicence.ts (§10.6.2 Step 2), on the exact three captures
// docs/verdict-methodology-reconciliation.md §12 already observes:
//
//   MSFT — RONIC CLEAN at ~17.7164% (CF-MSFT-STAGE2-DURABLE-SEED-01, issue
//          #442: the recorded bundle's own 19% nopatTaxRate vs. the retired
//          validation fixture's 20%, the ~17.4977% docs/verdict-methodology-
//          reconciliation.md §12 originally observed), above every grid
//          rate → YES.
//   NVDA — RONIC CLEAN at ~75.2385%, above every grid rate → YES, even
//          though the rest of the run is UNUSABLE for unrelated missing-EV
//          reasons (the growth licence is independent of Step 1's gates).
//   OKLO — the RONIC ladder's own REQUIRED inputs are unacquired on this
//          capture → UNKNOWN, fail-closed, never defaulted to NO.
//
// Growth licence is read straight off `diagnostics.reinvestmentRonic.ronic`
// (already assembled on every run), so no new acquisition and no second
// harness: MSFT reuses reverseDcfOnRealRun.test.ts's own
// buildAcquiredRun-based pattern (no DB); NVDA and OKLO reuse
// nonOperatingJudgmentRecordedOnRealRun.test.ts's own
// createRun/computeAnalysisForRun pattern (DB-backed gated path).
// ---------------------------------------------------------------------------

const MSFT_CAPTURE_CLOSE = new Decimal("499.70");

describe("growthLicence on a real acquired MSFT run (no DB)", () => {
  beforeEach(() => {
    __resetAcquisitionCache();
  });

  // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — the ladder is evaluated at the
  // D1 rate (AR0-2): MSFT is a stable business (SIC 7372), 9.0%.
  it("YES — RONIC ~17.7% clears the D1 rate in use (9.0%)", async () => {
    const run = await buildAcquiredRun({
      ticker: "MSFT",
      price: { value: MSFT_CAPTURE_CLOSE, timestamp: "2026-09-04", source: "recorded capture" },
      source: "CAPTURE",
      nonOperatingInvestments: { tags: [], value: new Decimal(0), errorDirection: null },
      profileHumanConfirmed: true,
    });

    const result = assembleAnalysisResult(run.fixture);

    expect(result.growthLicence.status).toBe("YES");
    expect(result.growthLicence.reason).toContain("17.7164");
    expect(result.growthLicence.reason).toContain("9.0%");

    // The licence reads directly off the already-approved ladder — confirm
    // it agrees with the ladder's own CLEAN state asserted elsewhere
    // (reverseDcfOnRealRun.test.ts), rather than re-deriving it independently.
    const ronic = result.diagnostics.reinvestmentRonic.ronic;
    expect(ronic.suppressed).toBe(false);
    if (!ronic.suppressed) {
      expect(ronic.value.cells.every((c) => c.state === "CLEAN")).toBe(true);
    }
  });

  it("independent of Step 1/EV: the licence still reads YES even when the §4.4 judgment is unmade and EV is INCOMPLETE", async () => {
    // Mirrors reverseDcfOnRealRun.test.ts's second case — EV/the grid fail
    // closed on the missing §4.4 judgment, but the RONIC ladder itself
    // (fiveYearDeltaNopat/fiveYearDeltaInvestedCapital) does not depend on
    // enterprise value at all, so growthLicence must not inherit a blocker
    // that is not its own.
    const run = await buildAcquiredRun({
      ticker: "MSFT",
      price: { value: MSFT_CAPTURE_CLOSE, timestamp: "2026-09-04", source: "recorded capture" },
      source: "CAPTURE",
      nonOperatingInvestments: null,
      profileHumanConfirmed: true,
    });

    const result = assembleAnalysisResult(run.fixture);

    expect(result.diagnostics.enterpriseValue.suppressed).toBe(true);
    expect(result.growthLicence.status).toBe("YES");
  });

  // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — reviewed evaluator change: MSFT's
  // recorded Stage-2 sheet is superseded by D2 (product-decisions item 27)
  // and carries no D2 input, so the committed run is pending adoption and
  // DOES carry a Step 1 block for it. The claim this test makes — that an
  // adopted, driver-authored sheet carries no Step 1 block, only the
  // open-policy gap every company shares — runs on STATED D2 test inputs.
  it("verdictBlockers: an adopted D2 sheet carries no Step 1 scenario-values block — only the open-policy gap every company shares; a pending sheet carries one", async () => {
    const pendingRun = await buildAcquiredRun({
      ticker: "MSFT",
      price: { value: MSFT_CAPTURE_CLOSE, timestamp: "2026-09-04", source: "recorded capture" },
      source: "CAPTURE",
      nonOperatingInvestments: { tags: [], value: new Decimal(0), errorDirection: null },
      profileHumanConfirmed: true,
    });
    const pending = assembleAnalysisResult(pendingRun.fixture);
    expect(pending.trust.status).toBe("UNUSABLE");
    expect(pending.verdictBlockers.some((b) => b.step === "Step 1")).toBe(true);

    // Before CF-MSFT-STAGE2-DURABLE-SEED-01 (migration 010), this run's
    // scenario dollar values were fixture-carried (A4,
    // CF-ANALYZER-INTEGRITY-PHASE-A-01), which suppressed the fair-value
    // range, dropped trust to UNUSABLE and added a Step 1 DATA block. The
    // recorded bundle is a real, driver-authored analyst bundle — never
    // fixture-carried — so that Step 1 block is gone; what remains is the
    // Step 3/4-5 open-policy gap every company shares, plus MSFT's own
    // still-unconfigured pre-revenue/project-debt constants (neither of
    // which this ticker needs — reported honestly, not defaulted away).
    const run = await buildAcquiredRun({
      ticker: "MSFT",
      price: { value: MSFT_CAPTURE_CLOSE, timestamp: "2026-09-04", source: "recorded capture" },
      source: "CAPTURE",
      nonOperatingInvestments: { tags: [], value: new Decimal(0), errorDirection: null },
      profileHumanConfirmed: true,
    });

    const result = assembleAnalysisResult({
      ...withStatedD2Inputs(run.fixture),
      scenarioValues: null,
      scenarioValuesAreFixtureCarried: false,
    });

    expect(result.trust.status).toBe("PARTIAL");
    expect(result.fairValueRange.kind).toBe("range");

    expect(result.verdictBlockers.some((b) => b.step === "Step 1")).toBe(false);

    const step3 = result.verdictBlockers.find((b) => b.step === "Step 3");
    expect(step3).toBeDefined();
    expect(step3?.kind).toBe("OPEN POLICY");
    expect(step3?.cause).not.toContain("scenario dollar values");

    const step45 = result.verdictBlockers.find((b) => b.step === "Step 4/5");
    expect(step45).toBeDefined();
    expect(step45?.kind).toBe("OPEN POLICY");
    expect(step45?.cause).toContain("waiting for policy");
    expect(step45?.cause).not.toContain("HOLD");

    const policyConstants = result.verdictBlockers.find((b) => b.step === "policy constants");
    expect(policyConstants).toBeDefined();
    expect(policyConstants?.kind).toBe("DATA");
    expect(policyConstants?.cause).toContain("preRevenueUnleveredRate");
    expect(policyConstants?.cause).toContain("projectDebtCost");
  });
});

async function completeSpotCheck(runId: string): Promise<void> {
  const state = await loadGateState(runId);
  for (const factId of state.outstandingFactIds) {
    await recordFactDecision(runId, factId, "CONFIRMED", null);
  }
}

describe("growthLicence on real acquired NVDA and OKLO runs (DB-backed gated path)", () => {
  beforeEach(async () => {
    await getPool().query("TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE");
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("NVDA — YES, even though the rest of the run is UNUSABLE for unrelated missing-EV reasons", async () => {
    const runId = await createRun("NVDA", "NVIDIA Corporation");
    await completeSpotCheck(runId);
    const state = await loadGateState(runId);
    await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
    const result = await computeAnalysisForRun(runId);

    expect(result.trust.status).toBe("UNUSABLE");
    expect(result.growthLicence.status).toBe("YES");
    expect(result.growthLicence.reason).toContain("75.2385");
  });

  it("NVDA — verdictBlockers names the same real Step 1 block (LEVERAGE UNSUPPORTED IN v1) as its own entry", async () => {
    const runId = await createRun("NVDA", "NVIDIA Corporation");
    await completeSpotCheck(runId);
    const state = await loadGateState(runId);
    await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
    const result = await computeAnalysisForRun(runId);

    expect(result.trust.status).toBe("UNUSABLE");
    const step1 = result.verdictBlockers.find((b) => b.step === "Step 1");
    expect(step1).toBeDefined();
    expect(step1?.kind).toBe("DATA");
    expect(step1?.cause).toContain("LEVERAGE UNSUPPORTED IN v1");

    expect(result.verdictBlockers.some((b) => b.step === "Step 3")).toBe(true);
    expect(result.verdictBlockers.some((b) => b.step === "Step 4/5")).toBe(true);

    // NVDA's own configured register still leaves preRevenueUnleveredRate/
    // projectDebtCost null (it is not a pre-revenue company) — reported, not
    // defaulted away.
    const policyConstants = result.verdictBlockers.find((b) => b.step === "policy constants");
    expect(policyConstants).toBeDefined();
    expect(policyConstants?.kind).toBe("DATA");
    expect(policyConstants?.cause).toContain("preRevenueUnleveredRate");
    expect(policyConstants?.cause).toContain("projectDebtCost");
    expect(policyConstants?.cause).not.toContain("nopatTaxRate");
  });

  it("OKLO — UNKNOWN, fail-closed on the unacquired RONIC ladder, never defaulted to NO", async () => {
    const runId = await createRun("OKLO", "Oklo Inc.");
    await completeSpotCheck(runId);
    const state = await loadGateState(runId);
    await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
    const result = await computeAnalysisForRun(runId);

    expect(result.gates.leverage.result).toBe("LEVERAGE UNSUPPORTED IN v1");
    expect(result.growthLicence.status).toBe("UNKNOWN");
    expect(result.growthLicence.reason).toContain("RONIC ladder itself is unavailable");
  });

  it("OKLO — verdictBlockers names its own Step 1 block and its own still-undefined policy constant", async () => {
    const runId = await createRun("OKLO", "Oklo Inc.");
    await completeSpotCheck(runId);
    const state = await loadGateState(runId);
    await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
    const result = await computeAnalysisForRun(runId);

    expect(result.trust.status).toBe("UNUSABLE");
    const step1 = result.verdictBlockers.find((b) => b.step === "Step 1");
    expect(step1).toBeDefined();
    expect(step1?.kind).toBe("DATA");
    expect(step1?.cause).toContain("LEVERAGE UNSUPPORTED IN v1");

    // OKLO's own configured register leaves only stressMarginLevel null.
    const policyConstants = result.verdictBlockers.find((b) => b.step === "policy constants");
    expect(policyConstants).toBeDefined();
    expect(policyConstants?.cause).toContain("stressMarginLevel");
    expect(policyConstants?.cause).not.toContain("nopatTaxRate");
    expect(policyConstants?.cause).not.toContain("preRevenueUnleveredRate");
    expect(policyConstants?.cause).not.toContain("projectDebtCost");
  });
});
