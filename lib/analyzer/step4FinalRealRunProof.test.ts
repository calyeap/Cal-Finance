import { describe, it, expect, beforeEach, afterAll } from "vitest";
import Decimal from "decimal.js";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision, recordJudgment } from "./runStore";
import { computeAnalysisForRun, loadGateState } from "./gate";
import { recordAnalystBundle, type RecordedAnalystBundleInput } from "./acquisition/recordedBundles";
import { deriveVerdict } from "./verdict";
import type { AnalysisResult } from "./types";
import type { TornadoRowResult } from "./modules/sensitivity";

// ---------------------------------------------------------------------------
// CF-ANALYZER-V2-FINAL-REALRUN-PROOF-01 (issue #331) — the consolidated
// final real-run proof at head (`origin/master` = `235dc0b`) across MSFT,
// OKLO, NVDA. This file pins, from the runs themselves, every figure
// `docs/analyzer-v2-final-realrun-proof.md` quotes: trust status and its
// determinants, enterprise-value/bridge completeness with each named gate,
// leverage state, scenario-range `kind`, the price value or its honest `$0`
// sentinel, the tornado row set, and the verdict and its cause. (The Step 4
// forecast-dispersion reading it also pinned is retired —
// CF-AR4-RATE-REINVESTMENT-TERMINAL-01, product-decisions items 23–24.)
//
// Documentation and tests only. This file rules nothing, adopts no number,
// band, cut-point or policy constant, marks no acceptance-matrix row
// satisfied, and does not touch `lib/analyzer/verdict.ts` or
// `lib/analyzer/policy.ts` (both are only imported/read here).
//
// Run-opening logic for all three companies is copied verbatim from
// `step4SignalObservationOnRealRun.test.ts` / the since-deleted `step4ForecastDispersionReadingOnRealRun.test.ts`'s
// `openMsftRunWithRuling` / `openOkloRunUnchanged` / `openNvdaObservationRun`
// (or `openNvdaRunUnchanged`) — not invented — per this outcome's own SCOPE
// 1 instruction to reuse the existing gated offline path rather than build a
// new one. Committed captures only: `ANALYZER_OFFLINE=1` (`vitest.setup.ts`).
// No network, no AI/model call, no new pipeline step.
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

// The approved NVDA Step-7 bundle, transcribed byte-faithful from
// `step4SignalObservationOnRealRun.test.ts` / `step4ForecastDispersionReadingOnRealRun.test.ts`
// (both copied it verbatim from `nvdaRealRunObservation.test.ts` in turn).
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

const NO_MSFT_VALUATION = /scenario dollar values|Pending adoption/;

function tornadoOf(result: AnalysisResult): TornadoRowResult[] {
  return result.diagnostics.sensitivity.tornado as unknown as TornadoRowResult[];
}


describe("CF-ANALYZER-V2-FINAL-REALRUN-PROOF-01 — the consolidated final real-run proof (MSFT, OKLO, NVDA)", () => {
  beforeEach(async () => {
    await getPool().query("TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE");
    await seedApprovedNvdaBundle();
  });

  afterAll(async () => {
    await seedApprovedNvdaBundle();
    await getPool().end();
  });

  it("MSFT — trust, EV bridge, leverage, range, price, tornado (pending adoption), verdict", async () => {
    const result = await openMsftRunWithRuling();

    // Trust. A4 (CF-ANALYZER-INTEGRITY-PHASE-A-01) — the fair-value range is
    // now honestly suppressed (its scenario dollar values are the
    // validation fixture's, never a real computation for this real run),
    // so §9.6 rule 1 fires and returns before rule 2 ever adds a qualifying-
    // flag entry; MARGIN AT HISTORICAL HIGH still fires as a states.
    // qualifying entry (asserted below), independent of trust's own
    // determinedBy list.
    expect(result.trust.status).toBe("UNUSABLE");
    // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — which no-valuation cause this is
    // depends on which MSFT sheet the run resolves: the committed fixture
    // carry-over (A4's "scenario dollar values") or migration 010's recorded
    // sheet, now pending adoption (D2). Other files in the suite delete and
    // re-seed that row, so either may be in force here; both are honest.
    expect(result.trust.determinedBy.some((d) => d.kind === "suppressing state" && NO_MSFT_VALUATION.test(d.detail))).toBe(true);
    expect(result.states.qualifying.some((q) => q.flag === "MARGIN AT HISTORICAL HIGH")).toBe(true);

    // Gate 0 — sector/industry classification, named gate ahead of the EV bridge.
    expect(result.gates.gate0.result).toBe("PASS");

    // Enterprise-value bridge — computed, not suppressed, once §4.4 is recorded.
    expect(result.diagnostics.enterpriseValue.suppressed).toBe(false);
    if (!result.diagnostics.enterpriseValue.suppressed) {
      expect(result.diagnostics.enterpriseValue.value.enterpriseValue.isPositive()).toBe(true);
    }

    // Leverage gate.
    expect(result.gates.leverage.result).toBe("PASS");
    expect(result.gates.leverage.netDebtRatio).not.toBeNull();

    // Scenario range — A4: honestly suppressed, never the validation
    // fixture's $265/$650 presented as this real run's computed range.
    expect(result.fairValueRange.kind).toBe("suppressed");
    if (result.fairValueRange.kind === "suppressed") {
      expect(result.fairValueRange.cause).toMatch(NO_MSFT_VALUATION);
    }

    // Price — a real recorded capture close, not the $0 sentinel.
    expect(result.price.value.equals(new Decimal("499.70"))).toBe(true);

    // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — reviewed evaluator change. The
    // tornado now varies the base scenario's own D2 valuation (AR0-2), and
    // MSFT's sheet carries no D2 inputs, so it is pending adoption: there is
    // no base value to vary and the module does not run — `[]`, as for OKLO
    // and NVDA below. The Step 4 forecast-dispersion reading and its tier
    // are retired (product-decisions items 23–24) and no longer asserted.
    expect(tornadoOf(result)).toEqual([]);
    expect(result.valuationBasis?.d2.status).toBe("PENDING ADOPTION");

    // Verdict — still INCOMPLETE, now for A4's scenario-dollar-values cause
    // (trust.status === "UNUSABLE" is deriveVerdict's own first-checked
    // branch), and the rendered hero state this cause drives
    // (`DominantVerdictSlot.tsx:41-48`, keyed only on `verdict.status` /
    // `verdict.reason`, not on which company — confirmed by direct read).
    const verdict = deriveVerdict(result);
    expect(verdict.status).toBe("INCOMPLETE");
    expect(verdict.reason).toMatch(NO_MSFT_VALUATION);
  });

  it("OKLO — trust, EV bridge, leverage, suppressed range, price, tornado unavailable, verdict", async () => {
    const result = await openOkloRunUnchanged();

    expect(result.trust.status).toBe("UNUSABLE");
    expect(result.trust.determinedBy.some((d) => d.kind === "suppressing state" && d.detail.includes("LEVERAGE UNSUPPORTED IN v1"))).toBe(true);

    expect(result.gates.gate0.result).toBe("PASS");

    expect(result.diagnostics.enterpriseValue.suppressed).toBe(true);
    if (result.diagnostics.enterpriseValue.suppressed) {
      expect(result.diagnostics.enterpriseValue.cause).toBe(
        "missing REQUIRED input(s): treasuryMethodDilution, nonOperatingEquityInvestmentsAtBook"
      );
    }

    expect(result.gates.leverage.result).toBe("LEVERAGE UNSUPPORTED IN v1");
    expect(result.gates.leverage.netDebtRatio).toBeNull();

    expect(result.fairValueRange.kind).toBe("suppressed");
    if (result.fairValueRange.kind === "suppressed") {
      expect(result.fairValueRange.state).toBe("LEVERAGE UNSUPPORTED IN v1");
    }

    expect(result.price.value.equals(new Decimal("41.27"))).toBe(true);

    // The M14 tornado module is genuinely EMPTY for OKLO — not six rows
    // each `available: false`: with no adopted D2 base value there is
    // nothing to vary, and the run falls back to `buildSensitivityResult()`'s
    // own empty-array default.
    const tornado = tornadoOf(result);
    expect(tornado).toEqual([]);

    const verdict = deriveVerdict(result);
    expect(verdict.status).toBe("INCOMPLETE");
    expect(verdict.reason).toContain("LEVERAGE UNSUPPORTED IN v1");
  });

  it("NVDA — trust, EV bridge (four named missing inputs), leverage, suppressed range, honest $0 price sentinel, tornado unavailable, verdict", async () => {
    const result = await openNvdaObservationRun();

    expect(result.trust.status).toBe("UNUSABLE");
    expect(result.trust.determinedBy.some((d) => d.kind === "suppressing state" && d.detail.includes("LEVERAGE UNSUPPORTED IN v1"))).toBe(true);

    expect(result.gates.gate0.result).toBe("PASS");

    // `docs/nvda-realrun-observation.md` (§(c)) recorded three missing
    // REQUIRED inputs (`treasuryMethodDilution`, `financeLeaseLiabilities`,
    // `nonOperatingEquityInvestmentsAtBook`) — this run's own current output
    // additionally carries `price`, the observed effect of the intervening
    // `CF-NOPRICE-HONESTY-RECON-01` reconciliation (row 16(a),
    // `docs/acceptance-matrix.md`; `f740941`, #303), which now carries a
    // real, possibly-absent price through this REQUIRED check instead of a
    // flattened `$0` that satisfied it. Recorded as the actual current
    // reading, not the prior document's three-input figure.
    expect(result.diagnostics.enterpriseValue.suppressed).toBe(true);
    if (result.diagnostics.enterpriseValue.suppressed) {
      expect(result.diagnostics.enterpriseValue.cause).toBe(
        "missing REQUIRED input(s): treasuryMethodDilution, price, financeLeaseLiabilities, nonOperatingEquityInvestmentsAtBook"
      );
    }

    expect(result.gates.leverage.result).toBe("LEVERAGE UNSUPPORTED IN v1");

    expect(result.fairValueRange.kind).toBe("suppressed");
    if (result.fairValueRange.kind === "suppressed") {
      expect(result.fairValueRange.state).toBe("LEVERAGE UNSUPPORTED IN v1");
    }

    // The honest $0 sentinel — no NVDA row in the committed prices.json.
    expect(result.price.value.equals(new Decimal(0))).toBe(true);
    expect(result.price.timestamp).toBe("");

    // Same as OKLO: the M14 tornado module never runs for NVDA (its sheet is
    // pending adoption — AR4 — and its range is suppressed) — genuinely `[]`.
    const tornado = tornadoOf(result);
    expect(tornado).toEqual([]);

    const verdict = deriveVerdict(result);
    expect(verdict.status).toBe("INCOMPLETE");
    expect(verdict.reason).toContain("LEVERAGE UNSUPPORTED IN v1");
  });
});
