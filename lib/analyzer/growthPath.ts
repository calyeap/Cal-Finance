import Decimal from "decimal.js";
import { POLICY } from "./policy";

// §7.1's fixed path shape: constant growth for years 1-5, linear fade to
// terminal growth over years 6-10, terminal growth thereafter. Shared by
// M7 (reverseDcf.ts, solving for the constant rate) and M15 (scenario
// valuation, where the analyst supplies the constant rate directly) so
// there is exactly one implementation of "the fixed shape."
export function growthAt(t: number, constantGrowth: Decimal, terminalGrowth: Decimal = POLICY.terminalGrowth): Decimal {
  if (t <= 5) return constantGrowth;
  if (t <= 10) return constantGrowth.minus(constantGrowth.minus(terminalGrowth).mul(t - 5).dividedBy(5));
  return terminalGrowth;
}

// Expands a single constant rate into the ten explicit yearly growth
// figures the fixed shape produces — for a scenario whose analyst-authored
// driver is a single rate rather than an explicit year-by-year path
// (§5.4's RevenuePathEditor covers the explicit-path case directly; it
// does not go through this function).
export function buildFixedShapeGrowthPath(constantGrowth: Decimal, terminalGrowth: Decimal = POLICY.terminalGrowth): Decimal[] {
  const path: Decimal[] = [];
  for (let t = 1; t <= 10; t++) {
    path.push(growthAt(t, constantGrowth, terminalGrowth));
  }
  return path;
}

/** Linear from the year-5 value to `target`, reached in year `byYear`; constant in years 1–5. */
export function fadeAt(t: number, yearFiveValue: Decimal, target: Decimal, byYear: number): Decimal {
  if (t <= 5) return yearFiveValue;
  if (t <= byYear) return yearFiveValue.minus(yearFiveValue.minus(target).mul(t - 5).dividedBy(byYear - 5));
  return target;
}

// Methodology v3 D2′ (amends v2.1 D2): the return on new investment fades
// linearly from its year-5 value to the terminal return by `runwayYears` —
// 10 / 15 / 20 for none / narrow / wide moat, the rate itself being the
// terminal return for every class. Entry t is the return earned on the
// investment made in year t, which funds year t + 1's growth. The path is
// `max(10, runwayYears)` long: the explicit period runs to the last fade
// year.
export function buildRonicPath(explicitRonic: Decimal, terminalRonic: Decimal, runwayYears: number = 10): Decimal[] {
  const horizon = Math.max(10, runwayYears);
  const path: Decimal[] = [];
  for (let t = 1; t <= horizon; t++) {
    path.push(fadeAt(t, explicitRonic, terminalRonic, runwayYears));
  }
  return path;
}

/**
 * Methodology v3 D5 — Base revenue growth: year 1 at `yearOne`, linear to the
 * drafted year-5 rate, then the fixed fade to terminal growth by year 10.
 * With `yearOne` equal to the drafted rate this is `buildFixedShapeGrowthPath`.
 */
export function buildRampedGrowthPath(yearOne: Decimal, yearFive: Decimal, terminalGrowth: Decimal = POLICY.terminalGrowth): Decimal[] {
  const ramp = POLICY.driverRampYears;
  const path = buildFixedShapeGrowthPath(yearFive, terminalGrowth);
  for (let t = 1; t < ramp; t++) {
    path[t - 1] = yearOne.plus(yearFive.minus(yearOne).mul(t - 1).dividedBy(ramp - 1));
  }
  return path;
}

/**
 * Methodology v3 D5 — Base operating margin: year 1 at the TTM margin, linear
 * to the drafted year-5 margin, then held. Ten entries; the engine holds the
 * last beyond year 10.
 */
export function buildMarginRampPath(ttmMargin: Decimal, yearFive: Decimal): Decimal[] {
  const ramp = POLICY.driverRampYears;
  return Array.from({ length: 10 }, (_, i) =>
    i + 1 >= ramp ? yearFive : ttmMargin.plus(yearFive.minus(ttmMargin).mul(i).dividedBy(ramp - 1))
  );
}
