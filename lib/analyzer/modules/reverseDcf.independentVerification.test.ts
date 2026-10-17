import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { solveReverseDcf } from "./reverseDcf";

// INDEPENDENT VERIFICATION — deliberately does not import
// projectReverseDcfValue, computeScenarioValuation, growthAt,
// buildFixedShapeGrowthPath or buildRonicPath. Every equation below is
// re-typed from Methodology v2.1 D2 (frozen spec §14.9 AR0-3) into fresh
// code, and solved by a separate bisection, so agreement with the
// production solve is evidence the PRODUCTION CODE realises those
// equations — not a tautology from calling the same function twice.
//
// CF-AR4-RATE-REINVESTMENT-TERMINAL-01 rewrote this file for M7's one solve
// (AR0-2). The question is unchanged: does `solveReverseDcf` correctly
// realise the stated formulas for the stated inputs? Whether those inputs
// describe a real company is the golden harness's (ar4Engine.test.ts).

const PROVENANCE = {
  sourceClass: "PRIMARY" as const,
  extractionType: "DETERMINISTIC/STRUCTURED" as const,
  verificationState: "CONFIRMED" as const,
};

const TERMINAL_GROWTH = 0.03; // §7.1

// Revenue_t = Revenue_(t-1) × (1 + g_t), g: constant 1–5, linear to 3% by 10
// NOPAT_t = Revenue_t × margin × (1 − tax)
// RONIC_t: constant 1–5, linear to the terminal return by year 10
// Reinvestment_t = NOPAT_t × g_(t+1) ÷ RONIC_t      [g_11 = terminal growth]
// Terminal FCF = NOPAT_10 × (1 + g_T) × (1 − g_T ÷ terminal return)
// Discounting: FCF_t from t − 0.5 years, TV from 9.5 years (D2 timing)
interface Case {
  revenue: number;
  margin: number;
  tax: number;
  ronic: number;
  terminal: number;
  rate: number;
}

function independentEv(c: Case, g: number): number {
  const fade = (t: number, start: number, end: number) => (t <= 5 ? start : t <= 10 ? start - ((start - end) * (t - 5)) / 5 : end);
  let revenue = c.revenue;
  let ev = 0;
  let nopat10 = 0;
  for (let t = 1; t <= 10; t++) {
    revenue *= 1 + fade(t, g, TERMINAL_GROWTH);
    const nopat = revenue * c.margin * (1 - c.tax);
    const reinvestment = (nopat * fade(t + 1, g, TERMINAL_GROWTH)) / fade(t, c.ronic, c.terminal);
    ev += (nopat - reinvestment) / Math.pow(1 + c.rate, t - 0.5);
    nopat10 = nopat;
  }
  const tv = (nopat10 * (1 + TERMINAL_GROWTH) * (1 - TERMINAL_GROWTH / c.terminal)) / (c.rate - TERMINAL_GROWTH);
  return ev + tv / Math.pow(1 + c.rate, 9.5);
}

function independentSolve(c: Case, target: number): number {
  let lo = -0.5;
  let hi = 1;
  const increasing = independentEv(c, hi) > independentEv(c, lo);
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (independentEv(c, mid) < target === increasing) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const CASES: (Case & { name: string; target: number })[] = [
  { name: "stable, narrow moat", revenue: 1000, margin: 0.4, tax: 0.2, ronic: 0.3, terminal: 0.1, rate: 0.09, target: 6000 },
  { name: "cyclical, no moat", revenue: 500, margin: 0.15, tax: 0.21, ronic: 0.12, terminal: 0.11, rate: 0.11, target: 600 },
  { name: "high return, wide moat", revenue: 2000, margin: 0.55, tax: 0.15, ronic: 0.74, terminal: 0.14, rate: 0.11, target: 40000 },
  { name: "MSFT-shaped (Part 4.4 inputs, $B)", revenue: 331.839, margin: 0.45, tax: 0.19, ronic: 0.215, terminal: 0.1, rate: 0.09, target: 3934 },
];

describe("M7 independent implementation-correctness check — one solve on the main engine", () => {
  it.each(CASES)("$name: production growth = independent growth", (c) => {
    const solve = solveReverseDcf({
      baseYearRevenue: { value: new Decimal(c.revenue), provenance: PROVENANCE },
      targetEnterpriseValue: { value: new Decimal(c.target), provenance: PROVENANCE },
      rate: new Decimal(c.rate),
      nopatTaxRate: new Decimal(c.tax),
      heldDrivers: {
        operatingMargin: new Decimal(c.margin),
        returnOnNewInvestment: new Decimal(c.ronic),
        terminalReturnOnNewCapital: new Decimal(c.terminal),
      },
      heldDriversMissing: null,
    });
    expect(solve.fiveYearGrowth.suppressed).toBe(false);
    if (solve.fiveYearGrowth.suppressed) return;
    expect(solve.fiveYearGrowth.value.toNumber()).toBeCloseTo(independentSolve(c, c.target), 9);
  });
});
