import { describe, it, expect, beforeEach } from "vitest";
import Decimal from "decimal.js";
import { buildAcquiredRun } from "../acquiredRun";
import { assembleAnalysisResult } from "../assemble";
import { __resetAcquisitionCache } from "./provider";
import { withStatedD2Inputs, STATED_D2_TEST_INPUTS } from "../fixtures/statedD2Inputs";
import { computeScenarioEnterpriseValue } from "../modules/scenarioOutputs";
import { buildFixedShapeGrowthPath } from "../growthPath";
import { terminalReturnOnNewCapital } from "../discountRate";
import { POLICY } from "../policy";

// ---------------------------------------------------------------------------
// CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — rewritten. This file proved
// CF-MSFT-STAGE2-REAL-VALUATION-PROOF-01's candidate (issue #439): capital-
// intensity reinvestment with a per-scenario faded terminal ROIC at the 10%
// rate. product-decisions item 27 (Methodology v2.1 D2) supersedes that path
// — "Supersedes the 16 Oct 2026 MSFT reinvestment path" — so its pins and
// its terminalRoic plumbing tests are deleted with the path.
//
// What it proves now, on the same real production pathway (real MSFT SEC
// facts, ANALYZER_OFFLINE capture, the §4.4 ruling answered): a sheet carrying
// the D2 inputs computes a genuine fair-value range at the D1 rate, equal to
// an independent recomputation through the engine on this run's own facts
// and EV bridge. The D2 inputs are STATED TEST INPUTS injected at the fixture
// (statedD2Inputs.ts) — never recorded to any sheet, never MSFT's adoption.
// ---------------------------------------------------------------------------

const MSFT_CAPTURE_CLOSE = new Decimal("499.70");

describe("MSFT on the real pathway — an adopted D2 sheet values through the one engine at the D1 rate", () => {
  beforeEach(() => {
    __resetAcquisitionCache();
  });

  it("computes bear / base / bull equal to an independent engine recomputation on this run's own facts and bridge", async () => {
    const run = await buildAcquiredRun({
      ticker: "MSFT",
      price: { value: MSFT_CAPTURE_CLOSE, timestamp: "2026-09-04", source: "recorded capture" },
      source: "CAPTURE",
      nonOperatingInvestments: { tags: ["us-gaap:LongTermInvestments"], value: new Decimal("36348000000"), errorDirection: "understates" },
      profileHumanConfirmed: true,
    });
    // An explicit, driver-only sheet: no typed values, not fixture-carried.
    const fixture = { ...withStatedD2Inputs(run.fixture), scenarioValues: null, scenarioValuesAreFixtureCarried: false };
    const result = assembleAnalysisResult(fixture);

    expect(result.valuationBasis?.d2.status).toBe("ADOPTED");
    expect(result.valuationBasis?.discountRate.rate.toString()).toBe("0.09");
    expect(result.valuationBasis?.discountRate.band).toBe("stable");
    const bridge = result.diagnostics.enterpriseValue;
    expect(bridge.suppressed).toBe(false);
    if (bridge.suppressed) return;

    const rate = result.valuationBasis!.discountRate.rate;
    const netDebt = bridge.value.enterpriseValue.minus(bridge.value.marketCap);
    const stub = result.runIdentity!.valuationTiming.stubYears;
    for (const key of ["bear", "base", "bull"] as const) {
      const driver = fixture.scenarios[key];
      const ev = computeScenarioEnterpriseValue(
        fixture.reverseDcf.baseYearRevenue!.value,
        buildFixedShapeGrowthPath(driver.revenueGrowthOrPath as Decimal),
        driver.operatingMargin!,
        STATED_D2_TEST_INPUTS.returnOnNewInvestment[key],
        terminalReturnOnNewCapital(rate, STATED_D2_TEST_INPUTS.moatClass, key),
        rate,
        fixture.configuredConstants.nopatTaxRate!,
        POLICY.terminalGrowth,
        stub
      );
      const perShare = ev.minus(netDebt).dividedBy(driver.shareCount);
      expect(result.scenarioOutputs.values[key].toString()).toBe(perShare.toString());
    }
    expect(result.scenarioOutputs.values.bear.lessThan(result.scenarioOutputs.values.base)).toBe(true);
    expect(result.scenarioOutputs.values.base.lessThan(result.scenarioOutputs.values.bull)).toBe(true);
  });

  it("the same run with the committed sheet's D2 inputs absent is pending adoption — no value, said plainly", async () => {
    const run = await buildAcquiredRun({
      ticker: "MSFT",
      price: { value: MSFT_CAPTURE_CLOSE, timestamp: "2026-09-04", source: "recorded capture" },
      source: "CAPTURE",
      nonOperatingInvestments: { tags: ["us-gaap:LongTermInvestments"], value: new Decimal("36348000000"), errorDirection: "understates" },
      profileHumanConfirmed: true,
    });
    const result = assembleAnalysisResult({ ...run.fixture, scenarioValues: null, scenarioValuesAreFixtureCarried: false });

    expect(result.valuationBasis?.d2.status).toBe("PENDING ADOPTION");
    expect(result.fairValueRange.kind).toBe("suppressed");
    if (result.fairValueRange.kind === "suppressed") expect(result.fairValueRange.cause).toMatch(/^Pending adoption/);
  });
});
