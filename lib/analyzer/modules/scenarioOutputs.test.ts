import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import {
  computeScenarioEnterpriseValue,
  computeScenarioValuation,
  computeScenarioOutputs,
  solveRateForTargetValue,
} from "./scenarioOutputs";
import { buildFixedShapeGrowthPath } from "../growthPath";

// M15 — the main valuation engine, on Methodology v2.1 D2 since
// CF-AR4-RATE-REINVESTMENT-TERMINAL-01: reinvestment = NOPAT × next-year
// growth ÷ return on new investment (fading to the terminal return by year
// 10); terminal FCF = terminal NOPAT × (1 − g ÷ terminal return), the
// terminal return supplied by the caller (rate + moat credit) — there is no
// r + 3pp default and no capital-intensity driver any more. The tests that
// pinned the old optional `terminalRoic` override and the capital-intensity
// fade path are deleted with them.

const D = (n: string | number) => new Decimal(n);

describe("computeScenarioEnterpriseValue", () => {
  it("throws when the growth path is not exactly ten years", () => {
    expect(() => computeScenarioEnterpriseValue(D(100), [D(0)], D("0.3"), D("0.2"), D("0.1"), D("0.1"), D(0))).toThrow();
  });

  it("throws on a non-positive return on new investment or terminal return — it is a divisor", () => {
    const path = buildFixedShapeGrowthPath(D("0.1"));
    expect(() => computeScenarioEnterpriseValue(D(100), path, D("0.3"), D(0), D("0.1"), D("0.1"), D(0))).toThrow();
    expect(() => computeScenarioEnterpriseValue(D(100), path, D("0.3"), D("0.2"), D("-0.1"), D("0.1"), D(0))).toThrow();
  });

  it("computes a flat-revenue scenario by hand: the explicit years reinvest nothing until year 10 funds terminal growth", () => {
    const flatPath = Array(10).fill(D(0));
    const margin = D("0.3");
    const rate = D("0.1");
    const terminal = D("0.11");

    const v = computeScenarioValuation(D(100), flatPath, margin, D("0.2"), terminal, rate, D(0));

    // Hand-computed: NOPAT 30 every year. Years 1-9 fund zero growth; year
    // 10 funds terminal growth at the terminal return (the fade reaches it
    // by year 10): FCF_10 = 30 × (1 − 0.03 ÷ 0.11). Terminal FCF = 30 × 1.03
    // × (1 − 0.03 ÷ 0.11); TV at 9.5 years, flows at t − 0.5 (D2 timing).
    let explicit = D(0);
    for (let t = 1; t <= 9; t++) explicit = explicit.plus(D(30).dividedBy(D("1.1").pow(t - 0.5)));
    const fcf10 = D(30).mul(D(1).minus(D("0.03").dividedBy(terminal)));
    explicit = explicit.plus(fcf10.dividedBy(D("1.1").pow("9.5")));
    const tv = D(30).mul("1.03").mul(D(1).minus(D("0.03").dividedBy(terminal))).dividedBy(rate.minus("0.03"));
    const expected = explicit.plus(tv.dividedBy(D("1.1").pow("9.5")));

    expect(v.enterpriseValue.toDecimalPlaces(8).toString()).toBe(expected.toDecimalPlaces(8).toString());
    expect(v.year10Fcf.toDecimalPlaces(10).toString()).toBe(fcf10.toDecimalPlaces(10).toString());
  });

  it("accepts a broadcast constant or an explicit per-year path for margin equivalently", () => {
    const path = buildFixedShapeGrowthPath(D("0.15"));
    const constantEv = computeScenarioEnterpriseValue(D(100), path, D("0.3"), D("0.25"), D("0.1"), D("0.1"), D(0));
    const arrayEv = computeScenarioEnterpriseValue(D(100), path, Array(10).fill(D("0.3")), D("0.25"), D("0.1"), D("0.1"), D(0));
    expect(constantEv.toString()).toBe(arrayEv.toString());
  });

  it("the terminal return is used exactly as given: higher terminal return, higher value", () => {
    const path = buildFixedShapeGrowthPath(D("0.1"));
    const at = (terminal: string) => computeScenarioEnterpriseValue(D(100), path, D("0.3"), D("0.2"), D(terminal), D("0.1"), D(0));
    expect(at("0.1").lessThan(at("0.11"))).toBe(true);
    expect(at("0.11").lessThan(at("0.13"))).toBe(true);
  });
});

describe("solveRateForTargetValue", () => {
  it("solves for the rate at which a decreasing revaluation function hits the target", () => {
    // Simple synthetic decreasing function: value(rate) = 1000 - rate*5000
    const revalue = (rate: Decimal) => new Decimal(1000).minus(rate.mul(5000));
    const solved = solveRateForTargetValue(revalue, new Decimal(500));
    // 1000 - rate*5000 = 500 -> rate = 0.1
    expect(solved?.toDecimalPlaces(3).toString()).toBe("0.1");
  });

  it("returns null when the target is unreachable within the search range", () => {
    const revalue = (rate: Decimal) => new Decimal(1000).minus(rate.mul(100));
    const solved = solveRateForTargetValue(revalue, new Decimal(-5000));
    expect(solved).toBeNull();
  });
});

describe("computeScenarioOutputs — H2, no fabricated revaluation solver", () => {
  // CB-AUDIT-01 H2: msft.ts:278 defined revalueBaseCaseAtRate as an
  // illustrative placeholder (price x 0.1 / rate) that solveRateForTargetValue
  // then solved and Section G rendered as a real "discount rate at which the
  // base case equals the price". No real revaluation-at-rate solver exists in
  // this codebase yet (building one is out of scope here), so a fixture that
  // has none must say so — null, not an invented formula — and the module
  // must stop computing an answer from nothing rather than trying to call it.
  it("returns rateAtWhichBaseEqualsPrice: null, without invoking any revaluation function, when the fixture supplies no real solver", () => {
    const result = computeScenarioOutputs({
      bearValue: new Decimal(50),
      baseValue: new Decimal(100),
      bullValue: new Decimal(150),
      weights: { bear: new Decimal("0.25"), base: new Decimal("0.5"), bull: new Decimal("0.25") },
      currentPrice: new Decimal(100),
      revalueBaseCaseAtRate: null,
    });
    expect(result.rateAtWhichBaseEqualsPrice).toBeNull();
  });
});

describe("computeScenarioOutputs", () => {
  it("computes the probability-weighted distribution", () => {
    const result = computeScenarioOutputs({
      bearValue: new Decimal(50),
      baseValue: new Decimal(100),
      bullValue: new Decimal(200),
      weights: { bear: new Decimal("0.25"), base: new Decimal("0.5"), bull: new Decimal("0.25") },
      currentPrice: new Decimal(90),
      revalueBaseCaseAtRate: () => new Decimal(100),
    });
    // 50*0.25 + 100*0.5 + 200*0.25 = 12.5 + 50 + 50 = 112.5
    expect(result.weightedDistribution.toString()).toBe("112.5");
  });

  it("locates the current price within the bear-bull range as a 0-1 fraction", () => {
    const result = computeScenarioOutputs({
      bearValue: new Decimal(50),
      baseValue: new Decimal(100),
      bullValue: new Decimal(150),
      weights: { bear: new Decimal("0.25"), base: new Decimal("0.5"), bull: new Decimal("0.25") },
      currentPrice: new Decimal(100), // exact midpoint
      revalueBaseCaseAtRate: () => new Decimal(100),
    });
    expect(result.priceLocationWithinRange?.toString()).toBe("0.5");
  });

  it("returns priceLocationWithinRange: null AND rateAtWhichBaseEqualsPrice: null when this run has no price — neither solved against a flattened $0 (CF-PRICE-DISPLAY-HONESTY-RECON-01, CONTEXT item 6)", () => {
    // CF-NOPRICE-HONESTY-RECON-01 — defect B — closed priceLocationWithinRange.
    // Until CF-PRICE-DISPLAY-HONESTY-RECON-01, rateAtWhichBaseEqualsPrice was
    // left solving against `currentPrice ?? new Decimal(0)` — the identical
    // $0-flattening class, reported "not fixed" in this same module's own
    // committed comment. This test used to pin that gap as correct
    // ("without changing rateAtWhichBaseEqualsPrice's existing $0-target
    // behaviour"); CF-PRICE-DISPLAY-HONESTY-RECON-01 corrects it, so the
    // pin is updated here, per that outcome's own SCOPE item 7.
    const revalue = (rate: Decimal) => new Decimal(1000).minus(rate.mul(5000));
    const withNoPrice = computeScenarioOutputs({
      bearValue: new Decimal(50),
      baseValue: new Decimal(100),
      bullValue: new Decimal(150),
      weights: { bear: new Decimal("0.25"), base: new Decimal("0.5"), bull: new Decimal("0.25") },
      currentPrice: null,
      revalueBaseCaseAtRate: revalue,
    });

    expect(withNoPrice.priceLocationWithinRange).toBeNull();
    expect(withNoPrice.rateAtWhichBaseEqualsPrice).toBeNull();
  });

  it("REGRESSION — a real $0 price (not the same as no price) still solves rateAtWhichBaseEqualsPrice for real", () => {
    // A literal $0 quote is an unusual but real price, never to be conflated
    // with "no price was available" — null and Decimal(0) take different
    // branches throughout this defect class, and this is the one place both
    // are exercised side by side.
    const revalue = (rate: Decimal) => new Decimal(1000).minus(rate.mul(5000));
    const withZeroPrice = computeScenarioOutputs({
      bearValue: new Decimal(50),
      baseValue: new Decimal(100),
      bullValue: new Decimal(150),
      weights: { bear: new Decimal("0.25"), base: new Decimal("0.5"), bull: new Decimal("0.25") },
      currentPrice: new Decimal(0),
      revalueBaseCaseAtRate: revalue,
    });
    expect(withZeroPrice.rateAtWhichBaseEqualsPrice).not.toBeNull();
    expect(withZeroPrice.rateAtWhichBaseEqualsPrice?.toDecimalPlaces(3).toString()).toBe("0.2");
  });

  it("carries the three scenario values through unchanged", () => {
    const result = computeScenarioOutputs({
      bearValue: new Decimal(50),
      baseValue: new Decimal(100),
      bullValue: new Decimal(150),
      weights: { bear: new Decimal("0.25"), base: new Decimal("0.5"), bull: new Decimal("0.25") },
      currentPrice: new Decimal(100),
      revalueBaseCaseAtRate: () => new Decimal(100),
    });
    expect(result.values).toEqual({ bear: new Decimal(50), base: new Decimal(100), bull: new Decimal(150) });
  });

  it("always removes debt share from the sensitivity table (I10)", () => {
    const result = computeScenarioOutputs({
      bearValue: new Decimal(50),
      baseValue: new Decimal(100),
      bullValue: new Decimal(150),
      weights: { bear: new Decimal("0.25"), base: new Decimal("0.5"), bull: new Decimal("0.25") },
      currentPrice: new Decimal(100),
      revalueBaseCaseAtRate: () => new Decimal(100),
    });
    expect(result.sensitivity.debtShareRemoved).toBe(true);
  });
});
