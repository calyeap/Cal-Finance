import Decimal from "decimal.js";
import { POLICY } from "../policy";
import type { AnalysisResult } from "../types";

// CF-AR3-REPRODUCIBLE-RUNS-01 — test support. Methodology v2.1 D2's timing
// (mid-year cash flows, terminal at 9.5 years, valued at the price date)
// multiplies a scenario's whole M15 enterprise value by exactly
// (1 + r)^(0.5 + stub): every explicit year and the terminal value move by
// the same factor. So removing that factor from the scenario EV recovers the
// end-of-year value the approved figures were computed under — and a test can
// keep asserting those figures exactly, as proof that timing is the ONLY thing
// that moved them.
//
// Per-share scenario value = (scenario EV − net-debt bridge) ÷ that scenario's
// share count (assemble.ts dynamicScenarioValue); this inverts it.
export function endOfYearScenarioPerShare(result: AnalysisResult, scenario: "bear" | "base" | "bull"): Decimal {
  const bridge = result.diagnostics.enterpriseValue;
  if (bridge.suppressed) throw new Error("enterprise value is suppressed — no bridge to invert");
  const timing = result.runIdentity?.valuationTiming;
  if (timing === undefined) throw new Error("result carries no valuation timing");
  const netDebtBridge = bridge.value.enterpriseValue.minus(bridge.value.marketCap);
  const shareCount = result.scenarios[scenario].shareCount;
  const scenarioEv = result.scenarioOutputs.values[scenario].mul(shareCount).plus(netDebtBridge);
  const factor = new Decimal(1).plus(POLICY.rateGrid[1]).pow(new Decimal("0.5").plus(timing.stubYears));
  return scenarioEv.dividedBy(factor).minus(netDebtBridge).dividedBy(shareCount);
}

/** An M15 enterprise value from `result`'s run with the D2 timing factor removed. */
export function endOfYearEnterpriseValue(result: AnalysisResult, value: Decimal): Decimal {
  const timing = result.runIdentity?.valuationTiming;
  if (timing === undefined) throw new Error("result carries no valuation timing");
  return value.dividedBy(new Decimal(1).plus(POLICY.rateGrid[1]).pow(new Decimal("0.5").plus(timing.stubYears)));
}

/**
 * Whether `actual` equals the pinned `expected` to 1e-15 relative: the
 * fractional power in the timing factor rounds at decimal.js's 20th
 * significant digit, so a value passed through it and back cannot match a
 * 20-digit pin character for character.
 */
export function sameToPrecision(actual: Decimal, expected: string): boolean {
  return actual.minus(expected).abs().dividedBy(expected).lessThan("1e-15");
}
