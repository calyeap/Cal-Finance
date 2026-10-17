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

// CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — Methodology v2.1 D2: the return on
// new investment fades to its terminal level by year 10, on the same fixed
// shape as growth (constant years 1-5, linear fade over 6-10). Reproduces the
// master plan Part 4.4 MSFT table from its stated inputs; a straight-line
// fade from year 1 does not (it is $16 lower at 9%). Entry t is the return
// earned on the investment made in year t, which funds year t + 1's growth.
export function buildRonicPath(explicitRonic: Decimal, terminalRonic: Decimal): Decimal[] {
  const path: Decimal[] = [];
  for (let t = 1; t <= 10; t++) {
    path.push(growthAt(t, explicitRonic, terminalRonic));
  }
  return path;
}
