import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision } from "./runStore";
import { computeAnalysisForRun, loadGateState } from "./gate";
import { deriveVerdict } from "./verdict";
import { recordAnalystBundle, type RecordedAnalystBundleInput } from "./acquisition/recordedBundles";
import { revenueSeries, comparatorRecency, achievedRevenueCagr } from "./calibration/inputs";

// ---------------------------------------------------------------------------
// CF-NVDA-RUN-OBSERVE-01 (issue #296) — the §12 observation
// (docs/verdict-methodology-reconciliation.md §12) that
// `docs/nvda-realrun-observation.md` reports.
//
// Transcribes the now-complete, Calvin-approved NVDA Step-7 / §6.3 bundle
// (docs/analyst-drafts/nvda-step7-draft.md, merged at 0753051) BYTE-FAITHFUL
// into the recorded analyst-input store via `recordAnalystBundle` — the same
// path `/analyzer/inputs/NVDA` writes — then opens one real run through the
// same gated product path MSFT and OKLO already run through
// (createRun -> clear the spot-check queue -> record the profile decision ->
// computeAnalysisForRun), reusing the existing real-run harness
// (nonOperatingJudgmentRecordedOnRealRun.test.ts,
// recordedAnalystInputEntryOnRealRun.test.tsx) rather than inventing a
// second one.
//
// Per SCOPE item 3, the §4.4 non-operating-investments judgment is left
// UNMADE on this run (no recordJudgment call) — the same state OKLO's own
// real-run path already reaches — and what that costs the output is part of
// the observation, not a gate to raise.
//
// The recorded row is inserted and deleted around every test (the same
// discipline nvdaAnalystDraftValidation.test.ts's own throwaway ticker
// already uses), so this file leaves no residue for any other file's own
// "NVDA has nothing recorded" pins to trip over regardless of run order.
// ---------------------------------------------------------------------------

const NVDA_TICKER = "NVDA";

/**
 * The approved NVDA bundle, transcribed byte-faithful from
 * docs/analyst-drafts/nvda-step7-draft.md as it stands at 0753051 (PR #295,
 * "CALVIN RULING — APPROVE AS DRAFTED"). Every value below is copied
 * verbatim from the draft's own tables — profile, the seven classification
 * inputs, the three scenarios' drivers, share count and written anchors, the
 * three now-computed scenario values, and the two supplied §7.1 constants
 * (the other two stay blank, per the draft). Nothing here is re-derived,
 * rounded or corrected (HARD BOUNDS: transcription only).
 */
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
        writtenAnchor:
          "AI/datacenter capex cycle corrects and operating margin reverts toward its ten-year median, " +
          "echoing the FY2023 correction (margin fell to 15.7% that year on inventory and export-control " +
          "effects); growth slows sharply but stays positive, not a revenue contraction.",
      },
      base: {
        revenueGrowthOrPath: "0.20",
        operatingMargin: "0.50",
        reinvestmentCapitalIntensity: "0.04",
        shareCount: "24.1",
        writtenAnchor:
          "AI-driven datacenter demand continues but decelerates materially off the FY2026 base as the " +
          "hyperscaler capex cycle normalizes; margin gives back some of its recent expansion but stays " +
          "well above the historical median.",
      },
      bull: {
        revenueGrowthOrPath: "0.35",
        operatingMargin: "0.60",
        reinvestmentCapitalIntensity: "0.05",
        shareCount: "24.1",
        writtenAnchor:
          "AI/accelerated-computing demand sustains at a high level, operating margin holds near its " +
          "current elevated level, and NVIDIA continues investing aggressively in capacity.",
      },
    },
    // Bear $28.08, Base $102.38, Bull $296.44 — the three scenario values
    // CALVIN RULING — APPROVE AS DRAFTED unlocked (PR #295, 0753051).
    scenarioValues: { bear: "28.08", base: "102.38", bull: "296.44" },
    configuredConstants: {
      nopatTaxRate: "0.21",
      stressMarginLevel: "0.15",
      preRevenueUnleveredRate: null,
      projectDebtCost: null,
    },
  };
}

async function completeSpotCheck(runId: string): Promise<void> {
  const state = await loadGateState(runId);
  for (const factId of state.outstandingFactIds) {
    await recordFactDecision(runId, factId, "CONFIRMED", null);
  }
}

async function deleteRecordedNvdaBundle(): Promise<void> {
  await getPool().query("DELETE FROM analyzer_recorded_analyst_bundles WHERE ticker = $1", [NVDA_TICKER]);
}

/** Opens NVDA's real run, exactly per SCOPE items 1-3: bundle recorded,
 * run opened through gate.ts, §4.4 left unmade. */
async function openNvdaObservationRun() {
  await recordAnalystBundle(NVDA_TICKER, approvedNvdaBundle());
  const runId = await createRun(NVDA_TICKER, "NVIDIA Corporation");
  await completeSpotCheck(runId);
  const state = await loadGateState(runId);
  await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
  return { runId, state, result: await computeAnalysisForRun(runId) };
}

describe("CF-NVDA-RUN-OBSERVE-01 — NVDA's approved bundle recorded and run through the gated path", () => {
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

  it("transcribes the approved bundle, opens a run and reaches a computed report", async () => {
    const { result } = await openNvdaObservationRun();
    expect(result.companyName.toUpperCase()).toContain("NVIDIA");
    expect(result.ticker).toBe("NVDA");
  });

  it("(a) the reverse-DCF grid: all nine cells and the underlying RONIC ladder, with the code's own cause", async () => {
    const { result } = await openNvdaObservationRun();

    const cells = result.priceImplied.reverseDcfGrid;
    expect(cells).toHaveLength(9);

    const ronic = result.diagnostics.reinvestmentRonic.ronic;
    // The RONIC ladder itself: BOTH REQUIRED inputs are now acquired.
    // CF-RONIC-DELTAS-RECON-01's fourth pass captured `total-equity`
    // (CALVIN RULING — AUTHORISE NARROW TOTAL-EQUITY CAPTURE, issue #298)
    // and applied CALVIN RULING — FINANCING-SIDE INVESTED CAPITAL to both
    // trailing-five-year endpoints on NVDA's own re-captured document
    // (docs/ronic-deltas-composition-reconciliation.md §7). NVDA's ladder is
    // no longer INCOMPLETE: ΔNOPAT $99,425,450,000 ÷ ΔInvestedCapital
    // $132,147,000,000 = 75.2385%, CLEAN at every rate in the grid — well
    // above 8/10/12% and the 200% cap alike. This is §12's first evidence
    // gap closing: NVDA is a real company whose RONIC ladder is NOT
    // uniformly NOT MEANINGFUL.
    expect(ronic.suppressed).toBe(false);
    if (!ronic.suppressed) {
      expect(ronic.value.cells).toHaveLength(3);
      for (const cell of ronic.value.cells) {
        expect(cell.state).toBe("CLEAN");
        expect(cell.value?.toDecimalPlaces(4).toString()).toBe("0.7524");
      }
    }

    // On THIS observation run, §4.4 is deliberately left unmade (SCOPE item
    // 3), so enterprise value is itself INCOMPLETE and computeReverseDcfGrid's
    // own missing-base check (baseYearRevenue, targetEnterpriseValue,
    // currentMargin, nopatTaxRate) fires before any per-cell RONIC check is
    // ever reached — every cell reports the more upstream cause, not the
    // RONIC ladder's own (now CLEAN) state confirmed directly above. §4.4
    // remains out of this outcome's SCOPE (reverseDcfOnRealRun.test.ts
    // answers it for MSFT separately, not here).
    for (const cell of cells) {
      expect(cell.fiveYearGrowth.suppressed).toBe(true);
      if (cell.fiveYearGrowth.suppressed) {
        expect(cell.fiveYearGrowth.cause).toBe("missing REQUIRED input(s): targetEnterpriseValue");
      }
      expect(cell.tenYearCagr.suppressed).toBe(true);
      expect(cell.ronic.suppressed).toBe(true);
    }
  });

  it("(b) the achieved-comparator: ten-year from the run's own output, five-year from the same acquired document and recency evidence", async () => {
    const { state, result } = await openNvdaObservationRun();

    // Ten-year — already wired onto AnalysisResult (companyInputs.ts calls
    // achievedRevenueCagr(revenueAnnualSeries, 10, revenueRecency) and
    // threads the RawInput straight onto the fixture).
    const tenYear = result.achievedRevenueCagr;
    expect(tenYear.value).not.toBeNull();
    if (tenYear.value !== null) {
      expect(tenYear.value.tag).toBe("us-gaap:Revenues");
      expect(tenYear.value.window.fromFiscalYear).toBe(2016);
      expect(tenYear.value.window.toFiscalYear).toBe(2026);
      expect(tenYear.value.window.yearsStale).toBe(0);
      // FY2016 $5,010M -> FY2026 $215,938M, CAGR 45.6965...%.
      expect(tenYear.value.cagr.toDecimalPlaces(4).toString()).toBe("0.457");
    }

    // Five-year — NOT wired onto AnalysisResult for any run (§13's own
    // "achievedRevenueCagr remains unwired" gap, only ever closed for the
    // ten-year horizon). Computed here from the exact same acquired
    // CompanyFactsDocument and the exact same comparatorRecency evidence
    // this run's own acquisition (companyInputs.ts) already used for the
    // ten-year figure — the same pure function
    // (lib/analyzer/calibration/inputs.ts), a different horizon argument,
    // no new capture and no second harness.
    const companyFacts = state.acquired.acquired.companyFacts;
    const series = revenueSeries(companyFacts);
    expect(series).not.toBeNull();
    const recency = comparatorRecency(companyFacts, series!);
    const fiveYear = achievedRevenueCagr(series, 5, recency);

    expect(fiveYear.value).not.toBeNull();
    if (fiveYear.value !== null) {
      expect(fiveYear.value.tag).toBe("us-gaap:Revenues");
      expect(fiveYear.value.window.fromFiscalYear).toBe(2021);
      expect(fiveYear.value.window.toFiscalYear).toBe(2026);
      expect(fiveYear.value.window.yearsStale).toBe(0);
      // FY2021 $16,675M -> FY2026 $215,938M, CAGR 66.8986...%.
      expect(fiveYear.value.cagr.toDecimalPlaces(4).toString()).toBe("0.669");
    }

    // Both constructible on the SAME single-tag series (§12's second
    // evidence-gap bullet) — this run's own facts are the evidence.
    if (tenYear.value !== null && fiveYear.value !== null) {
      expect(tenYear.value.tag).toBe(fiveYear.value.tag);
    }
  });

  it("(c) every suppressed/INCOMPLETE output on this run, with the code's own cause, and what the unmade §4.4 judgment costs", async () => {
    const { state, result } = await openNvdaObservationRun();

    // No price row for NVDA (FINAL OWNER RULING #205) — price-dependent
    // outputs are the honest expected INCOMPLETE, not a defect. A missing
    // price still surfaces as buildAcquiredRun's own $3.4 display sentinel
    // on AnalysisResult.price itself (value 0, blank timestamp — never
    // null, unchanged by CF-NOPRICE-HONESTY-RECON-01), plus the run's own
    // disclosure naming it explicitly. What changed under that outcome is
    // that the SAME absence now also reaches enterpriseValue.price honestly
    // (below), instead of being flattened to the same $0 there too.
    expect(result.price.timestamp).toBe("");
    expect(result.price.value.isZero()).toBe(true);
    expect(state.acquired.disclosures.some((d) => d.includes("No price was available"))).toBe(true);

    // CF-PRICE-DISPLAY-HONESTY-RECON-01 — the presentation layer's own
    // signal for "this run has no price" is now bound directly, the same
    // NOT_COMPUTED_BINDING/states.suppressing mechanism
    // priceLocationWithinRange already used above. A consumer reading this
    // binding (the "Current price" tile, Section A's price row, the price
    // chart panel, the [C] price slot) shows INCOMPLETE, never the $0/blank
    // sentinel asserted directly above — that sentinel itself is unchanged.
    const priceState = result.states.suppressing.find((s) => s.appliesTo.startsWith("the current share price — "));
    expect(priceState).not.toBeUndefined();
    expect(priceState?.state).toBe("INCOMPLETE");

    // CF-NOPRICE-HONESTY-RECON-01, defect A. Enterprise value is INCOMPLETE
    // for FOUR reasons on this capture (previously reported as three,
    // docs/nvda-realrun-observation.md, before this outcome closed the gap
    // that document itself named): `price` now joins the list, because the
    // no-price sentinel no longer reaches computeEnterpriseValue's REQUIRED
    // check as a flattened $0 — only one of the four is the unmade §4.4
    // judgment; `treasuryMethodDilution` and `financeLeaseLiabilities` are
    // pre-existing tag-mapping gaps on this filer's capture (the same class
    // of gap the draft's own text already names for
    // ShortTermInvestments/FinanceLeaseLiability), independent of the §4.4
    // judgment and not something a §4.4 answer alone would clear.
    const ev = result.diagnostics.enterpriseValue;
    expect(ev.suppressed).toBe(true);
    if (ev.suppressed) {
      expect(ev.cause).toBe(
        "missing REQUIRED input(s): treasuryMethodDilution, price, financeLeaseLiabilities, nonOperatingEquityInvestmentsAtBook"
      );
    }

    // That cascades to leverage, the fair-value range, and trust — the same
    // shape OKLO's own real run (unchanged) already reaches. Unchanged by
    // this outcome: NVDA's leverage/range/trust state was already this
    // shape before defect A closed (three other REQUIRED inputs were
    // already missing), so adding `price` as a fourth missing input changes
    // nothing downstream of it.
    expect(result.gates.leverage.result).toBe("LEVERAGE UNSUPPORTED IN v1");
    expect(result.gates.leverage.netDebtRatio).toBeNull();
    expect(result.trust.status).toBe("UNUSABLE");
    expect(result.fairValueRange.kind).toBe("suppressed");

    const verdict = deriveVerdict(result);
    expect(verdict.status).toBe("INCOMPLETE");

    // CF-NOPRICE-HONESTY-RECON-01, defect B. Before this outcome,
    // `scenarioOutputs.priceLocationWithinRange` silently reported `-0.1046`
    // on this exact run — a number with no real price behind it
    // (docs/nvda-realrun-observation.md's "reported, not fixed"
    // observation) — even though the fair-value range above is already
    // suppressed. Now it is null, with INCOMPLETE bound to it by name, the
    // same treatment rateAtWhichBaseEqualsPrice already had.
    expect(result.scenarioOutputs.priceLocationWithinRange).toBeNull();
    const priceLocationState = result.states.suppressing.find((s) =>
      s.appliesTo.startsWith("the current price's location within the scenario range — ")
    );
    expect(priceLocationState).not.toBeUndefined();
    expect(priceLocationState?.state).toBe("INCOMPLETE");

    // CF-MULTIPLES-NOPRICE-RECON-01 (issue #304) — the one remaining named,
    // not-fixed member of this same flattening class (docs/noprice-honesty-
    // reconciliation.md §4), now closed: multiplesInput.price carries the
    // absence through as null, never the flattened $0 sentinel. Latent on
    // THIS run, exactly as multiplesInput.price was before the fix: EPS is
    // not in this mapping version (companyInputs.ts), so epsTrailing,
    // epsForward and bookValue are already null here regardless of price,
    // and each of P/E trailing, P/E forward and P/B was already INCOMPLETE
    // via that other missing operand — confirmed by direct probe below,
    // not assumed.
    expect(state.fixture.multiplesInput.price).toBeNull();
    expect(state.fixture.multiplesInput.epsTrailing).toBeNull();
    expect(state.fixture.multiplesInput.epsForward).toBeNull();
    expect(state.fixture.multiplesInput.bookValue).toBeNull();
    for (const m of [
      result.diagnostics.multiples.peTrailing,
      result.diagnostics.multiples.peForward,
      result.diagnostics.multiples.priceToBook,
    ]) {
      expect(m.suppressed).toBe(true);
      if (m.suppressed) expect(m.cause).toMatch(/missing REQUIRED input\(s\) for/);
    }

    // The §4.4 candidate tags, with whatever the already-committed capture
    // carries for them — evidence for Calvin's later judgment, never a
    // selection made here. Only ONE of the four CANDIDATE_NON_OPERATING_
    // INVESTMENT_TAGS resolves anything on this filer's capture; the other
    // three (EquityMethodInvestments, EquitySecuritiesFvNiCurrentAndNoncurrent,
    // LongTermInvestments) are absent from it.
    const candidates = state.acquired.acquired.acquisition.candidateNonOperatingInvestments;
    expect(candidates).toHaveLength(1);
    expect(candidates[0].tag).toBe("us-gaap:EquitySecuritiesWithoutReadilyDeterminableFairValueAmount");
    expect(candidates[0].value.toString()).toBe("47898000000");

    // The two deliberately-blank §7.1 constants round-trip as null, never a
    // substituted zero (recordedBundles.ts's own contract).
    expect(state.fixture.configuredConstants.preRevenueUnleveredRate).toBeNull();
    expect(state.fixture.configuredConstants.projectDebtCost).toBeNull();
    expect(state.fixture.configuredConstants.nopatTaxRate?.toString()).toBe("0.21");
  });

  it("the two deliberately-blank §7.1 constants and the scenario values round-trip byte-faithful from the recorded store", async () => {
    await recordAnalystBundle(NVDA_TICKER, approvedNvdaBundle());
    const runId = await createRun(NVDA_TICKER, "NVIDIA Corporation");
    await completeSpotCheck(runId);
    const state = await loadGateState(runId);

    expect(state.fixture.scenarioValues.bear.toString()).toBe("28.08");
    expect(state.fixture.scenarioValues.base.toString()).toBe("102.38");
    expect(state.fixture.scenarioValues.bull.toString()).toBe("296.44");
    expect(state.fixture.profile.recommended).toBe("HIGH_GROWTH_PROFITABLE_UNCERTAIN_DURABILITY");
  });
});
