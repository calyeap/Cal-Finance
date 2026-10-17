import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { stubYearsBetween, explicitYearDiscountTime, terminalDiscountTime } from "./valuationTiming";
import { projectReverseDcfValue } from "./modules/reverseDcf";
import { computeScenarioValuation } from "./modules/scenarioOutputs";
import { buildFixedShapeGrowthPath } from "./growthPath";
import { assembleAnalysisResult } from "./assemble";
import { MSFT_FIXTURE } from "./fixtures/msft";

// CF-AR3-REPRODUCIBLE-RUNS-01 — Methodology v2.1 D2 timing: mid-year cash
// flows, terminal at 9.5 years, valued at the price date on a TTM base. The
// mid-year closed forms are knownReds.test.ts's and valuationInvariants.test.ts's;
// this file proves the price-date half.

const D = (n: string | number) => new Decimal(n);
const RATE = D("0.1");

describe("valuationTiming — discount times", () => {
  it("year t is discounted from t − 0.5 years and the terminal value from 9.5, less the stub", () => {
    expect(explicitYearDiscountTime(1, D(0)).toString()).toBe("0.5");
    expect(explicitYearDiscountTime(10, D("0.25")).toString()).toBe("9.25");
    expect(terminalDiscountTime(D(0)).toString()).toBe("9.5");
    expect(terminalDiscountTime(D("0.25")).toString()).toBe("9.25");
  });

  it("the stub is whole days from the base period end to the price date, over 365.25", () => {
    expect(stubYearsBetween("2026-06-30", "2026-09-04T21:00:00-04:00").toString()).toBe(D(66).dividedBy("365.25").toString());
  });

  it("is zero where either date is missing, or the price predates the base period end — never negative", () => {
    expect(stubYearsBetween(null, "2026-09-04").isZero()).toBe(true);
    expect(stubYearsBetween("2026-06-30", null).isZero()).toBe(true);
    expect(stubYearsBetween("2026-06-30", "2026-06-01").isZero()).toBe(true);
  });
});

describe("INVARIANT — valued at the price date: a stub of s years multiplies every DCF value by (1 + r)^s", () => {
  const stub = D(66).dividedBy("365.25");
  const rollForward = D(1).plus(RATE).pow(stub);

  it("diagnostic reverse DCF (M7)", () => {
    const atBase = projectReverseDcfValue(D("0.08"), D("0.4"), D("0.3"), RATE, D(1000), D("0.2")).ev;
    const atPrice = projectReverseDcfValue(D("0.08"), D("0.4"), D("0.3"), RATE, D(1000), D("0.2"), undefined, stub).ev;
    expect(atPrice.minus(atBase.mul(rollForward)).abs().toNumber()).toBeLessThan(1e-6);
  });

  it("scenario DCF (M15), both parts: explicit-period PV and terminal PV", () => {
    const args = [D(1000), buildFixedShapeGrowthPath(D("0.08")), D("0.4"), D("0.05"), RATE, D("0.2")] as const;
    const atBase = computeScenarioValuation(...args);
    const atPrice = computeScenarioValuation(...args, undefined, null, stub);
    expect(atPrice.explicitPeriodPv.minus(atBase.explicitPeriodPv.mul(rollForward)).abs().toNumber()).toBeLessThan(1e-6);
    expect(atPrice.terminalValuePv.minus(atBase.terminalValuePv.mul(rollForward)).abs().toNumber()).toBeLessThan(1e-6);
  });
});

describe("assembly — the run is dated by its TTM base and its price", () => {
  it("records the valuation date, base period and stub, and terminal share does not move with the stub (both parts roll forward together)", () => {
    const undated = assembleAnalysisResult(MSFT_FIXTURE);
    const dated = assembleAnalysisResult({ ...MSFT_FIXTURE, valuationBase: { periodEnd: "2026-06-30", kind: "TTM" } });

    expect(dated.runIdentity?.valuationTiming).toEqual({
      convention: "MID-YEAR",
      valuationDate: MSFT_FIXTURE.price.timestamp,
      basePeriodEnd: "2026-06-30",
      basePeriodKind: "TTM",
      stubYears: D(66).dividedBy("365.25"),
    });
    expect(undated.runIdentity?.valuationTiming.basePeriodEnd).toBeNull();
    expect(undated.runIdentity?.valuationTiming.stubYears.isZero()).toBe(true);
    expect(
      dated.diagnostics.terminal.terminalShareOfValue.minus(undated.diagnostics.terminal.terminalShareOfValue).abs().toNumber()
    ).toBeLessThan(1e-12);
  });

  it("a priceless run has no valuation date and no stub, whatever its base period", () => {
    const priceless = assembleAnalysisResult({
      ...MSFT_FIXTURE,
      valuationBase: { periodEnd: "2026-06-30", kind: "TTM" },
      enterpriseValue: { ...MSFT_FIXTURE.enterpriseValue, price: null },
    });
    expect(priceless.runIdentity?.valuationTiming.valuationDate).toBeNull();
    expect(priceless.runIdentity?.valuationTiming.stubYears.isZero()).toBe(true);
  });
});
