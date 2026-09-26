import { describe, it, expect, beforeEach, afterAll } from "vitest";
import Decimal from "decimal.js";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision, recordJudgment } from "./runStore";
import { computeAnalysisForRun, loadGateState } from "./gate";
import { recordAnalystBundle, type RecordedAnalystBundleInput } from "./acquisition/recordedBundles";
import { deriveVerdict } from "./verdict";
import type { AnalysisResult } from "./types";
import type { Step4ForecastDispersionReading, TornadoRowResult } from "./modules/sensitivity";

// ---------------------------------------------------------------------------
// CF-ANALYZER-V2-FINAL-REALRUN-PROOF-01 (issue #331) — the consolidated
// final real-run proof at head (`origin/master` = `235dc0b`) across MSFT,
// OKLO, NVDA. This file pins, from the runs themselves, every figure
// `docs/analyzer-v2-final-realrun-proof.md` quotes: trust status and its
// determinants, enterprise-value/bridge completeness with each named gate,
// leverage state, scenario-range `kind`, the price value or its honest `$0`
// sentinel, the full tornado row set (`available`/`displayed`), the
// now-live Step 4 forecast-dispersion reading (`available`, `selectedDriver`,
// `fullRangeValueImpact`, `tier`, or the honest `cause`), and the verdict and
// its cause.
//
// Documentation and tests only. This file rules nothing, adopts no number,
// band, cut-point or policy constant, marks no acceptance-matrix row
// satisfied, and does not touch `lib/analyzer/verdict.ts` or
// `lib/analyzer/policy.ts` (both are only imported/read here).
//
// Run-opening logic for all three companies is copied verbatim from
// `step4SignalObservationOnRealRun.test.ts` / `step4ForecastDispersionReadingOnRealRun.test.ts`'s
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

function tornadoOf(result: AnalysisResult): TornadoRowResult[] {
  return result.diagnostics.sensitivity.tornado as unknown as TornadoRowResult[];
}

function forecastDispersionOf(result: AnalysisResult): Step4ForecastDispersionReading {
  return result.diagnostics.sensitivity.forecastDispersion as unknown as Step4ForecastDispersionReading;
}

describe("CF-ANALYZER-V2-FINAL-REALRUN-PROOF-01 — the consolidated final real-run proof (MSFT, OKLO, NVDA)", () => {
  beforeEach(async () => {
    await getPool().query("TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE");
    await deleteRecordedNvdaBundle();
  });

  afterAll(async () => {
    await deleteRecordedNvdaBundle();
    await getPool().end();
  });

  it("MSFT — trust, EV bridge, leverage, range, price, full tornado, Step 4 reading, verdict", async () => {
    const result = await openMsftRunWithRuling();

    // Trust.
    expect(result.trust.status).toBe("PARTIAL");
    expect(result.trust.determinedBy.some((d) => d.kind === "qualifying flag" && d.detail.includes("MARGIN AT HISTORICAL HIGH"))).toBe(true);

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

    // Scenario range.
    expect(result.fairValueRange.kind).toBe("range");
    if (result.fairValueRange.kind === "range") {
      expect(result.fairValueRange.bear.toFixed(2)).toBe("265.00");
      expect(result.fairValueRange.bull.toFixed(2)).toBe("650.00");
    }

    // Price — a real recorded capture close, not the $0 sentinel.
    expect(result.price.value.equals(new Decimal("499.70"))).toBe(true);

    // Full five-row tornado.
    const tornado = tornadoOf(result);
    expect(tornado.map((r) => r.driver)).toEqual(["growth", "operatingMargin", "discountRate", "terminalGrowth", "ronic"]);
    const growthRow = tornado.find((r) => r.driver === "growth")!;
    const marginRow = tornado.find((r) => r.driver === "operatingMargin")!;
    expect(growthRow.available).toBe(true);
    expect(marginRow.available).toBe(true);
    if (growthRow.available) {
      expect(growthRow.fullRangeValueImpact.toString()).toBe("0.48598121081564411663");
      expect(growthRow.displayed).toBe(true);
    }
    if (marginRow.available) {
      expect(marginRow.fullRangeValueImpact.toString()).toBe("0.23377202026469612084");
      expect(marginRow.displayed).toBe(true);
    }
    for (const driver of ["discountRate", "terminalGrowth", "ronic"] as const) {
      const row = tornado.find((r) => r.driver === driver)!;
      expect(row.available).toBe(false);
    }

    // The Step 4 reading itself — the now-live figure this outcome proves.
    const reading = forecastDispersionOf(result);
    expect(reading.available).toBe(true);
    if (reading.available) {
      expect(reading.selectedDriver).toBe("growth");
      expect(reading.fullRangeValueImpact.toString()).toBe("0.48598121081564411663");
      expect(reading.tier).toBe("HIGH");
    }

    // Verdict — still INCOMPLETE, for the §10.6.2 comparator-unavailable
    // cause, and the rendered hero state this cause drives
    // (`DominantVerdictSlot.tsx:41-48`, keyed only on `verdict.status` /
    // `verdict.reason`, not on which company — confirmed by direct read).
    const verdict = deriveVerdict(result);
    expect(verdict.status).toBe("INCOMPLETE");
    expect(verdict.reason).toContain("required-versus-achieved growth comparator");
  });

  it("OKLO — trust, EV bridge, leverage, suppressed range, price, tornado unavailable, Step 4 unavailable, verdict", async () => {
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

    // The M14 tornado module is genuinely EMPTY for OKLO — not five rows
    // each `available: false`. `assemble.ts`'s `sensitivityRangesFor` wires
    // a captured `AnalystSuppliedRange` only for MSFT (CF-STEP4-MSFT-RANGE-
    // CAPTURE-01); for every other ticker it returns `null` and the run
    // falls back to `buildSensitivityResult()`'s own empty-array default —
    // the module never runs, rather than running and finding every row
    // unavailable.
    const tornado = tornadoOf(result);
    expect(tornado).toEqual([]);

    const reading = forecastDispersionOf(result);
    expect(reading.available).toBe(false);
    if (!reading.available) {
      expect(reading.cause).toBe("no tornado row is available: true — every analyst-supplied range for this run is missing");
      expect("tier" in reading).toBe(false);
    }

    const verdict = deriveVerdict(result);
    expect(verdict.status).toBe("INCOMPLETE");
    expect(verdict.reason).toContain("LEVERAGE UNSUPPORTED IN v1");
  });

  it("NVDA — trust, EV bridge (four named missing inputs), leverage, suppressed range, honest $0 price sentinel, tornado unavailable, Step 4 unavailable, verdict", async () => {
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

    // Same reason as OKLO: the M14 tornado module never runs for NVDA
    // (no `AnalystSuppliedRange` capture exists for it) — genuinely `[]`,
    // not five unavailable rows.
    const tornado = tornadoOf(result);
    expect(tornado).toEqual([]);

    const reading = forecastDispersionOf(result);
    expect(reading.available).toBe(false);
    if (!reading.available) {
      expect(reading.cause).toBe("no tornado row is available: true — every analyst-supplied range for this run is missing");
      expect("tier" in reading).toBe(false);
    }

    const verdict = deriveVerdict(result);
    expect(verdict.status).toBe("INCOMPLETE");
    expect(verdict.reason).toContain("LEVERAGE UNSUPPORTED IN v1");
  });
});
