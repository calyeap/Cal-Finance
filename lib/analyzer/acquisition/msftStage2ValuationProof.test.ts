import Decimal from "decimal.js";
import { describe, it, expect, beforeEach, afterAll, afterEach } from "vitest";
import { getPool } from "../../db";
import { createRun, recordFactDecision, recordProfileDecision, recordJudgment } from "../runStore";
import { computeAnalysisForRun, loadGateState } from "../gate";
import { recordAnalystBundle, hasRecordedAnalystBundle, type RecordedAnalystBundleInput } from "./recordedBundles";
import { computeScenarioEnterpriseValue } from "../modules/scenarioOutputs";
import type { TwoWayTableResult } from "../modules/sensitivity";
import { buildFixedShapeGrowthPath } from "../growthPath";
import { POLICY } from "../policy";

// ---------------------------------------------------------------------------
// CF-MSFT-STAGE2-REAL-VALUATION-PROOF-01 (issue #439).
//
// What this proves: a SPECIFIC, named, fully-sourced-and-argued MSFT Stage-2
// candidate — net-of-D&A reinvestment basis (Stage 1's own §2.1 7/20/26%
// proposal, issue #439 authority item (a)), `positive_volatile` fcfCharacter
// (item (b)), and a per-scenario terminal ROIC that fades toward the 10%
// cost of capital instead of the runtime's old universal r+3pp=13% rule OR
// the bull scenario's own unfaded 20% ask (item (c)) — computes a genuine,
// internally-consistent fair-value range through the REAL production
// pathway (recordAnalystBundle -> analystInputsFor -> assembleAnalysisResult
// -> computeScenarioEnterpriseValue, the exact function
// assemble.ts:656/dynamicScenarioValue calls), on real MSFT SEC facts
// (ANALYZER_OFFLINE capture), never a hand-authored shortcut.
//
// This is NOT a finance-policy approval and NOT a durable MSFT bundle:
// EPHEMERAL ONLY. The recorded row is written to THIS TEST'S OWN throwaway
// database (TEST_DATABASE_URL, a *_test database — vitest.setup.ts refuses
// to run otherwise) and deleted in afterEach/afterAll, exactly as
// msftRealValuationUnblock.test.ts's own MSFT test rows already are. No
// production DB is touched, no `recordAnalystBundle("MSFT", ...)` call
// reaches any database this repo's real Analyzer reads from, and nothing
// here is claimed as an approved or live MSFT valuation — see
// docs/proof/msft-stage2-valuation-proof.md for the full write-up and the
// one consolidated question this run leaves for Calvin.
//
// Independent cross-check: scripts/evidence/msft-stage2-valuation-proof/
// independent_oracle.py re-derives the SAME per-scenario figures from the
// SAME raw SEC capture via a second, from-scratch Python implementation
// (no import of any TypeScript module) — run separately, documented in the
// proof doc, not re-run inside this suite (no Python dependency in CI).
// ---------------------------------------------------------------------------

// ANALYST JUDGEMENT PROPOSAL — pending Calvin's exact-number ruling.
// Growth/margin are UNCHANGED from PR #436's reviewed, SEC-anchored draft
// (issue #439 scopes this correction to reinvestment basis / fcfCharacter /
// terminal ROIC, not growth/margin). Reinvestment intensity is restated
// net-of-D&A per Stage 1's §2.1 proposal (a *starting point*, not final —
// issue #439 authority item (a)). Terminal ROIC is this run's own candidate:
// bear fades fully to the 10% cost of capital (no durable-moat claim
// independently substantiated under a pessimistic case); base and bull
// carry a modest, written-anchor-argued excess-return credit (Azure/M365
// switching costs and subscription economics), deliberately NOT the old
// universal r+3pp=13% number and NOT bull's own unfaded 20% ask.
const CANDIDATE_INPUT: Omit<RecordedAnalystBundleInput, "scenarios"> & {
  scenarios: {
    bear: RecordedAnalystBundleInput["scenarios"]["bear"];
    base: RecordedAnalystBundleInput["scenarios"]["base"];
    bull: RecordedAnalystBundleInput["scenarios"]["bull"];
  };
} = {
  profile: "MATURE_PROFITABLE_STABLE_FCF",
  classificationInputs: {
    revenueScale: "large",
    // Stage 1 §1(b): real FCF-after-cash-capex-and-lease-funded-capacity
    // fell double digits in each of the last two fiscal years
    // (-18.16%/-17.07%) and its margin compressed from a ten-year high of
    // 31.43% to a ten-year low of 12.77% of revenue, even as OCF grew every
    // year — issue #439 authority item (b)'s working recommendation.
    fcfCharacter: "positive_volatile",
    revenueGrowthBand: "10-30%",
    // Lease-inclusive gross basis (capex + finance-lease ROU additions) /
    // revenue, FY2026 — PR #436's REVIEW-38703686322-1 correction, the
    // methodology's own §1 definition, named a lower bound since
    // acquisitions has no tag mapping. Unchanged by this outcome.
    capitalIntensity: "0.4236",
    cyclicality: { tenYearMarginRange: "0.1673", worstSingleYearChange: "0.0028" },
    // PR #436's corrected call: lease-inclusive capital intensity (42.36%)
    // is far above the 10% asset-light/asset-heavy precedent threshold.
    balanceSheetNature: "asset-heavy",
  },
  scenarios: {
    bear: {
      revenueGrowthOrPath: "0.08",
      operatingMargin: "0.4168",
      reinvestmentCapitalIntensity: "0.07",
      shareCount: "", // filled in per-run below with this run's own diluted share count
      writtenAnchor:
        "Stage-2 candidate, net-of-D&A basis (issue #439 authority item (a); Stage 1 §2.1). Bear: growth/margin unchanged " +
        "from PR #436's reviewed draft. Reinvestment 7% net-of-D&A, just below the pre-AI-buildout (FY2017-23) net-of-D&A " +
        "top of 8.37%. Terminal ROIC fades fully to the 10% cost of capital (POLICY.rateGrid[1]) — no durable excess-return " +
        "claim is independently substantiated under this scenario's assumed competitive/macro deterioration (item (c)).",
    },
    base: {
      revenueGrowthOrPath: "0.14",
      operatingMargin: "0.45",
      reinvestmentCapitalIntensity: "0.20",
      shareCount: "",
      writtenAnchor:
        "Stage-2 candidate, net-of-D&A basis. Base: growth/margin unchanged from PR #436. Reinvestment 20% net-of-D&A, at " +
        "the FY2025 observed net-of-D&A ratio. Terminal ROIC 11% (r+1pp) — a modest, explicitly-argued durable-moat credit " +
        "(Azure/M365 enterprise switching costs, recurring-subscription economics), deliberately HALF the diagnostic " +
        "reverse-DCF's own r+3pp convention (item (c)), not a universal default and not this scenario's own much higher " +
        "25.5% explicit-period RONIC.",
    },
    bull: {
      revenueGrowthOrPath: "0.20",
      operatingMargin: "0.4678",
      reinvestmentCapitalIntensity: "0.26",
      shareCount: "",
      writtenAnchor:
        "Stage-2 candidate, net-of-D&A basis. Bull: growth/margin unchanged from PR #436. Reinvestment 26% net-of-D&A, " +
        "~14% relatively below the FY2026 net-of-D&A peak (30.60%), mirroring the same relative discount the original " +
        "cash-capex driver (30%) takes off its own FY2026 peak (34.94%). Terminal ROIC 12.5% (r+2.5pp) — a deliberately " +
        "DIFFERENT number from both the diagnostic r+3pp convention and bull's own unfaded 20% ask (item (c)): continuing " +
        "AI-driven Azure capacity monetization could sustain some excess return, but 20% unfaded is not independently " +
        "substantiated as a durable moat, and this candidate's own terminal share (78.7%, see proof doc) is already a " +
        "§3.5 >75% caution at this lower figure — a materially higher terminal ROIC would push it further from normal.",
    },
  },
  // REQUIRED by recordAnalystBundle but IGNORED by computation whenever
  // every driver is authored (recordedScenarioValuesComputeFromDrivers):
  // this run proves the dynamic recomputation path runs, never these
  // placeholders. Never a real human-approved dollar figure.
  scenarioValues: { bear: "0.01", base: "0.01", bull: "0.01" },
  configuredConstants: {
    // FACT — MSFT's own disclosed FY2026 effective tax rate (10-K text),
    // cross-checked in the already-reviewed Phase B proof and Stage 1 §1.
    nopatTaxRate: "0.19",
    // FACT — Stage 1's independently re-verified ten-year real margin low
    // (FY2017), re-derived in this outcome's own oracle.
    stressMarginLevel: "0.3006",
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

describe("CF-MSFT-STAGE2-REAL-VALUATION-PROOF-01 — bounded net-of-D&A / positive_volatile / faded-terminal-ROIC MSFT candidate, proved on the real production pathway", () => {
  beforeEach(async () => {
    await getPool().query("TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE");
    await deleteMsftRecordedBundle();
  });

  afterEach(deleteMsftRecordedBundle);

  afterAll(async () => {
    await deleteMsftRecordedBundle();
    await getPool().end();
  });

  it("the candidate's per-scenario terminalRoic round-trips through recordAnalystBundle and is forwarded to the real scenario computation — never silently dropped, never the old default", async () => {
    const runId = await createRun("MSFT", "Microsoft Corporation");
    await recordJudgment(
      runId,
      "NON-OPERATING INVESTMENTS",
      "us-gaap:LongTermInvestments",
      "Calvin's §4.4 ruling, 2026-09-21T08:19:14Z, issue #188."
    );
    await completeSpotCheck(runId);
    const state = await loadGateState(runId);

    const sharesOutstanding = state.fixture.enterpriseValue.sharesOutstanding;
    const treasuryMethodDilution = state.fixture.enterpriseValue.treasuryMethodDilution;
    expect(sharesOutstanding).not.toBeNull();
    expect(treasuryMethodDilution).not.toBeNull();
    if (sharesOutstanding === null || treasuryMethodDilution === null) return;
    const dilutedShares = sharesOutstanding.value.plus(treasuryMethodDilution.value).toString();

    await recordAnalystBundle("MSFT", {
      ...CANDIDATE_INPUT,
      scenarios: {
        bear: { ...CANDIDATE_INPUT.scenarios.bear, shareCount: dilutedShares, terminalRoic: "0.10" },
        base: { ...CANDIDATE_INPUT.scenarios.base, shareCount: dilutedShares, terminalRoic: "0.11" },
        bull: { ...CANDIDATE_INPUT.scenarios.bull, shareCount: dilutedShares, terminalRoic: "0.125" },
      },
    });

    const postRecordState = await loadGateState(runId);
    // The round trip itself: the typed API carries terminalRoic back out
    // exactly, independent of whether a real run ever computes with it.
    expect(postRecordState.fixture.scenarios.bear.terminalRoic?.toString()).toBe("0.1");
    expect(postRecordState.fixture.scenarios.base.terminalRoic?.toString()).toBe("0.11");
    expect(postRecordState.fixture.scenarios.bull.terminalRoic?.toString()).toBe("0.125");

    await recordProfileDecision(runId, "CONFIRMED", postRecordState.fixture.profile.recommended, null);
    const result = await computeAnalysisForRun(runId);

    expect(result.fairValueRange.kind).toBe("range");
    if (result.fairValueRange.kind !== "range") return;
    expect(result.diagnostics.enterpriseValue.suppressed).toBe(false);
    if (result.diagnostics.enterpriseValue.suppressed) return;

    const baseRevenue = postRecordState.fixture.reverseDcf.baseYearRevenue;
    const nopatTaxRate = postRecordState.fixture.configuredConstants.nopatTaxRate;
    expect(baseRevenue).not.toBeNull();
    expect(nopatTaxRate).not.toBeNull();
    if (baseRevenue === null || nopatTaxRate === null) return;

    // FACT cross-check — this run's own acquired base-year revenue must
    // match the independent oracle's own re-extraction from the SAME raw
    // capture (scripts/evidence/msft-stage2-valuation-proof/
    // independent_oracle.py), confirming the real pathway, not a stand-in,
    // produced this fact.
    expect(baseRevenue.value.toString()).toBe("331839000000");

    // This run's own real EV bridge — NOT the oracle's simpler net-debt-only
    // figure, since the production bridge also nets out the §4.4
    // non-operating-investments term (Calvin's 2026-09-21 ruling,
    // `us-gaap:LongTermInvestments`, recorded above) the oracle's standalone
    // net-debt check never includes; see the proof doc for the reconciled
    // figure.
    const bridge = result.diagnostics.enterpriseValue.value;
    const netDebtBridge = bridge.enterpriseValue.minus(bridge.marketCap);

    // Independent recomputation through the SAME production function
    // (computeScenarioEnterpriseValue, unmodified except for the new
    // optional terminalRoic parameter this outcome adds), never read back
    // from assemble.ts's own output — proves the pipeline computed the
    // range using each scenario's own candidate terminalRoic, not the old
    // r+3pp default.
    const expectedPerShare = (growth: string, margin: string, reinvestment: string, terminalRoic: string): string =>
      computeScenarioEnterpriseValue(
        baseRevenue.value,
        buildFixedShapeGrowthPath(new Decimal(growth)),
        new Decimal(margin),
        new Decimal(reinvestment),
        POLICY.rateGrid[1],
        nopatTaxRate,
        undefined,
        new Decimal(terminalRoic)
      )
        .minus(netDebtBridge)
        .dividedBy(new Decimal(dilutedShares))
        .toString();

    const expectedBear = expectedPerShare("0.08", "0.4168", "0.07", "0.10");
    const expectedBase = expectedPerShare("0.14", "0.45", "0.20", "0.11");
    const expectedBull = expectedPerShare("0.20", "0.4678", "0.26", "0.125");

    expect(result.fairValueRange.bear.toString()).toBe(expectedBear);
    expect(result.scenarioOutputs.values.base.toString()).toBe(expectedBase);
    expect(result.fairValueRange.bull.toString()).toBe(expectedBull);

    // The old r+3pp-for-every-scenario default must NOT reproduce these
    // figures — the candidate's own terminalRoic genuinely changed the
    // result, it was not silently ignored.
    const oldDefaultBear = computeScenarioEnterpriseValue(
      baseRevenue.value,
      buildFixedShapeGrowthPath(new Decimal("0.08")),
      new Decimal("0.4168"),
      new Decimal("0.07"),
      POLICY.rateGrid[1],
      nopatTaxRate
    )
      .minus(netDebtBridge)
      .dividedBy(new Decimal(dilutedShares))
      .toString();
    expect(result.fairValueRange.bear.toString()).not.toBe(oldDefaultBear);

    // Plausible per-share scale (tens to low hundreds of dollars), never an
    // absurd scale from a unit mismatch, and never the throwaway $0.01
    // typed placeholders standing in uncomputed.
    expect(result.fairValueRange.bear.greaterThan(1)).toBe(true);
    expect(result.fairValueRange.bull.lessThan(10000)).toBe(true);
    expect(result.fairValueRange.bear.toString()).not.toBe("0.01");
    expect(result.scenarioOutputs.values.base.toString()).not.toBe("0.01");
    expect(result.fairValueRange.bull.toString()).not.toBe("0.01");

    // §10 F display: the recorded terminalRoic is carried through to the
    // result's own scenario display, never dropped on the way to the
    // report (assemble.ts's scenarioAsCarried spreads it through).
    expect(result.scenarios.bear.terminalRoic?.toString()).toBe("0.1");
    expect(result.scenarios.base.terminalRoic?.toString()).toBe("0.11");
    expect(result.scenarios.bull.terminalRoic?.toString()).toBe("0.125");

    // REVIEW-38749099399-1, CORRECT — M14's sensitivity tornado/two-way
    // machinery (assemble.ts's own `scenarioValueAt` closure, ~L564-573) is
    // the OTHER real production call site of computeScenarioEnterpriseValue
    // besides M15's dynamicScenarioValue (assemble.ts:656-665) proved above.
    // `sensitivityRangesFor` is non-null only for MSFT, so MSFT is the one
    // ticker where a mismatch between the two call sites would silently
    // compute the tornado/growth-margin table on the stale r+3pp=13% default
    // while the headline base scenario uses this candidate's own 11%. Proves
    // the forward: every cell of the growth x margin table equals the SAME
    // production function, called with the base scenario's own terminalRoic,
    // never read back from assemble.ts's own output.
    const twoWayGrowthMargin = result.diagnostics.sensitivity.twoWayGrowthMargin as TwoWayTableResult;
    expect(twoWayGrowthMargin.available).toBe(true);
    if (!twoWayGrowthMargin.available) return;
    const { rowValues: m14Growth, columnValues: m14Margin, cells: m14Cells } = twoWayGrowthMargin;
    for (let i = 0; i < m14Growth.length; i++) {
      for (let j = 0; j < m14Margin.length; j++) {
        const expectedCell = computeScenarioEnterpriseValue(
          baseRevenue.value,
          buildFixedShapeGrowthPath(m14Growth[i]),
          m14Margin[j],
          new Decimal("0.20"), // the candidate's own base reinvestmentCapitalIntensity
          POLICY.rateGrid[1],
          nopatTaxRate,
          undefined,
          new Decimal("0.11") // the candidate's own base terminalRoic
        ).toString();
        expect(m14Cells[i][j].toString()).toBe(expectedCell);
      }
    }
  });

  it("regression — a bundle recorded with no terminalRoic on any scenario (every other existing recorded/fixture bundle in this codebase, MSFT's own committed fixture and NVDA's migration-008 seed included) computes IDENTICALLY to before this outcome's plumbing change", async () => {
    const runId = await createRun("MSFT", "Microsoft Corporation");
    await recordJudgment(
      runId,
      "NON-OPERATING INVESTMENTS",
      "us-gaap:LongTermInvestments",
      "Calvin's §4.4 ruling, 2026-09-21T08:19:14Z, issue #188."
    );
    await completeSpotCheck(runId);
    const state = await loadGateState(runId);
    const sharesOutstanding = state.fixture.enterpriseValue.sharesOutstanding;
    const treasuryMethodDilution = state.fixture.enterpriseValue.treasuryMethodDilution;
    if (sharesOutstanding === null || treasuryMethodDilution === null) throw new Error("unreachable");
    const dilutedShares = sharesOutstanding.value.plus(treasuryMethodDilution.value).toString();

    await recordAnalystBundle("MSFT", {
      ...CANDIDATE_INPUT,
      scenarios: {
        bear: { ...CANDIDATE_INPUT.scenarios.bear, shareCount: dilutedShares },
        base: { ...CANDIDATE_INPUT.scenarios.base, shareCount: dilutedShares },
        bull: { ...CANDIDATE_INPUT.scenarios.bull, shareCount: dilutedShares },
      },
    });

    const postRecordState = await loadGateState(runId);
    expect(postRecordState.fixture.scenarios.bear.terminalRoic).toBeNull();
    await recordProfileDecision(runId, "CONFIRMED", postRecordState.fixture.profile.recommended, null);
    const result = await computeAnalysisForRun(runId);
    if (result.fairValueRange.kind !== "range") throw new Error("unreachable");

    const baseRevenue = postRecordState.fixture.reverseDcf.baseYearRevenue;
    const nopatTaxRate = postRecordState.fixture.configuredConstants.nopatTaxRate;
    if (baseRevenue === null || nopatTaxRate === null) throw new Error("unreachable");
    if (result.diagnostics.enterpriseValue.suppressed) throw new Error("unreachable");
    const bridge = result.diagnostics.enterpriseValue.value;
    const netDebtBridge = bridge.enterpriseValue.minus(bridge.marketCap);

    const expectedBear = computeScenarioEnterpriseValue(
      baseRevenue.value,
      buildFixedShapeGrowthPath(new Decimal("0.08")),
      new Decimal("0.4168"),
      new Decimal("0.07"),
      POLICY.rateGrid[1],
      nopatTaxRate
    )
      .minus(netDebtBridge)
      .dividedBy(new Decimal(dilutedShares))
      .toString();
    expect(result.fairValueRange.bear.toString()).toBe(expectedBear);

    // REVIEW-38749099399-1, CORRECT — the negative half, for M14: with no
    // terminalRoic authored anywhere (this test's own bundle), the growth x
    // margin table's cells must stay EXACTLY the old r+3pp=13% default —
    // unchanged from before this outcome's plumbing change, on the SAME
    // production call site the positive-case test above just proved forwards
    // a candidate's terminalRoic when one IS authored.
    const twoWayGrowthMargin = result.diagnostics.sensitivity.twoWayGrowthMargin as TwoWayTableResult;
    expect(twoWayGrowthMargin.available).toBe(true);
    if (!twoWayGrowthMargin.available) return;
    const { rowValues: m14Growth, columnValues: m14Margin, cells: m14Cells } = twoWayGrowthMargin;
    for (let i = 0; i < m14Growth.length; i++) {
      for (let j = 0; j < m14Margin.length; j++) {
        const expectedCell = computeScenarioEnterpriseValue(
          baseRevenue.value,
          buildFixedShapeGrowthPath(m14Growth[i]),
          m14Margin[j],
          new Decimal("0.20"), // the candidate's own base reinvestmentCapitalIntensity
          POLICY.rateGrid[1],
          nopatTaxRate
          // terminalGrowth/terminalRoic omitted — EXACTLY the prior r+3pp behaviour.
        ).toString();
        expect(m14Cells[i][j].toString()).toBe(expectedCell);
      }
    }
  });
});
