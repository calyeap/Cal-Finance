import Decimal from "decimal.js";
import { POLICY } from "../policy";
import { buildSensitivityResult } from "./sensitivity";
import { buildRonicPath } from "../growthPath";
import { explicitYearDiscountTime, terminalDiscountTime } from "../valuationTiming";
import type { ScenarioOutputs } from "../types";

// M15 — scenario valuation and outputs (§7.2, §10 F/G) — the main valuation
// engine. CF-AR4-RATE-REINVESTMENT-TERMINAL-01 put it on Methodology v2.1
// D2 (frozen spec §14.9 AR0-3), and M7's reverse DCF now solves on this
// same function (reverseDcf.ts), so the two engines are one:
//
// - Reinvestment_t = NOPAT_t × g_(t+1) ÷ RONIC_t — this year's investment
//   funds next year's growth; g_11 is terminal growth.
// - RONIC_t is the scenario's return on new investment, fading to the
//   terminal return on new capital by year 10 (growthPath.ts
//   buildRonicPath), so year 10 already reinvests at terminal economics.
// - Terminal FCF = terminal NOPAT × (1 − g ÷ terminal return on new
//   capital) (§7.2 M8, unchanged), where the terminal return is the rate
//   plus the D2 moat credit — chosen by the caller from the sheet's moat
//   class (assemble.ts), never defaulted here.
// - Timing is D2's (valuationTiming.ts): mid-year flows, the terminal value
//   from 9.5 years, valued at the price date.
//
// With a constant margin the terminal FCF is exactly (1 + g) × year-10 FCF,
// and RONIC equal to the rate makes value independent of growth — the two
// coherence invariants the golden harness checks.
//
// margin may be a single constant (broadcast across all ten years) or an
// explicit ten-entry path (§5.4).

export interface ScenarioValuation {
  enterpriseValue: Decimal;
  explicitPeriodPv: Decimal;
  terminalValuePv: Decimal;
  // Undiscounted, at the end of year 10 — M9's numerator.
  terminalValue: Decimal;
  year10Revenue: Decimal;
  year10OperatingIncome: Decimal;
  year10Fcf: Decimal;
  terminalFcf: Decimal;
}

export function computeScenarioValuation(
  baseRevenue: Decimal,
  growthPath: Decimal[],
  margin: Decimal | Decimal[],
  returnOnNewInvestment: Decimal,
  terminalReturnOnNewCapital: Decimal,
  rate: Decimal,
  nopatTaxRate: Decimal,
  terminalGrowth: Decimal = POLICY.terminalGrowth,
  // CF-AR3-REPRODUCIBLE-RUNS-01 — years from the TTM base period end to the
  // price date (valuationTiming.ts). Zero values the flows at the base
  // period end.
  stubYears: Decimal = new Decimal(0)
): ScenarioValuation {
  if (growthPath.length !== 10) {
    throw new Error("growthPath must have exactly ten entries (years 1-10)");
  }
  if (!returnOnNewInvestment.greaterThan(0) || !terminalReturnOnNewCapital.greaterThan(0)) {
    throw new Error("return on new investment and the terminal return on new capital must be positive");
  }

  const afterTax = new Decimal(1).minus(nopatTaxRate);
  const marginAt = (t: number): Decimal => (Array.isArray(margin) ? margin[t - 1] : margin);
  const growthAfter = (t: number): Decimal => (t < 10 ? growthPath[t] : terminalGrowth);
  const ronicPath = buildRonicPath(returnOnNewInvestment, terminalReturnOnNewCapital);
  const discountFactorBase = new Decimal(1).plus(rate);

  let revenue = baseRevenue;
  let pvSum = new Decimal(0);
  let year10Fcf = new Decimal(0);
  for (let t = 1; t <= 10; t++) {
    revenue = revenue.mul(new Decimal(1).plus(growthPath[t - 1]));
    const nopat = revenue.mul(marginAt(t)).mul(afterTax);
    const reinvestment = nopat.mul(growthAfter(t)).dividedBy(ronicPath[t - 1]);
    const fcff = nopat.minus(reinvestment);
    if (t === 10) year10Fcf = fcff;
    pvSum = pvSum.plus(fcff.dividedBy(discountFactorBase.pow(explicitYearDiscountTime(t, stubYears))));
  }

  const year10Revenue = revenue;
  const year10OperatingIncome = year10Revenue.mul(marginAt(10));
  const terminalNopat = year10OperatingIncome.mul(afterTax).mul(new Decimal(1).plus(terminalGrowth));
  const terminalFcf = terminalNopat.mul(new Decimal(1).minus(terminalGrowth.dividedBy(terminalReturnOnNewCapital)));
  const terminalValue = terminalFcf.dividedBy(rate.minus(terminalGrowth));
  const terminalValuePv = terminalValue.dividedBy(discountFactorBase.pow(terminalDiscountTime(stubYears)));

  return {
    enterpriseValue: pvSum.plus(terminalValuePv),
    explicitPeriodPv: pvSum,
    terminalValuePv,
    terminalValue,
    year10Revenue,
    year10OperatingIncome,
    year10Fcf,
    terminalFcf,
  };
}

/** computeScenarioValuation's enterprise value alone. */
export function computeScenarioEnterpriseValue(
  baseRevenue: Decimal,
  growthPath: Decimal[],
  margin: Decimal | Decimal[],
  returnOnNewInvestment: Decimal,
  terminalReturnOnNewCapital: Decimal,
  rate: Decimal,
  nopatTaxRate: Decimal,
  terminalGrowth: Decimal = POLICY.terminalGrowth,
  stubYears: Decimal = new Decimal(0)
): Decimal {
  return computeScenarioValuation(
    baseRevenue,
    growthPath,
    margin,
    returnOnNewInvestment,
    terminalReturnOnNewCapital,
    rate,
    nopatTaxRate,
    terminalGrowth,
    stubYears
  ).enterpriseValue;
}

const RATE_SEARCH_LO = new Decimal("0.01");
const RATE_SEARCH_HI = new Decimal("0.5");
const RATE_BISECTION_ITERATIONS = 60;

// Solves for the discount rate at which a revaluation function (assumed
// monotonically decreasing in rate — a higher discount rate always means
// a lower value, true for any well-behaved DCF) equals the target price.
// Returns null, never a state, if no such rate exists in a plausible range
// (§10 G names no suppressing state for this figure — it is display-only
// context, not a gated output). The report still needs to say WHY there is
// no rate, and null alone cannot — it is also what a run with no revaluation
// function gets — so assembly binds the reason (notComputed.ts).
export function solveRateForTargetValue(
  revalueAtRate: (rate: Decimal) => Decimal,
  targetValue: Decimal,
  // The bracket's lower end. A Gordon terminal value is defined only above
  // terminal growth, so a caller valuing one passes a floor above it.
  searchLo: Decimal = RATE_SEARCH_LO
): Decimal | null {
  const valueAtLo = revalueAtRate(searchLo);
  const valueAtHi = revalueAtRate(RATE_SEARCH_HI);

  // Decreasing in rate: valueAtLo should be >= target >= valueAtHi for a
  // root to exist in range.
  if (valueAtLo.lessThan(targetValue) || valueAtHi.greaterThan(targetValue)) {
    return null;
  }

  let lo = searchLo;
  let hi = RATE_SEARCH_HI;
  for (let i = 0; i < RATE_BISECTION_ITERATIONS; i++) {
    const mid = lo.plus(hi.minus(lo).dividedBy(2));
    const valueAtMid = revalueAtRate(mid);
    if (valueAtMid.greaterThan(targetValue)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo.plus(hi).dividedBy(2);
}

/**
 * The bracket solveRateForTargetValue searches, and the value at each end —
 * design §6's cause line for NO SOLUTION IN RANGE ("the bracket and the value
 * at each end"). Evaluated here, beside the search, so the cause states the
 * same bracket the solver actually used.
 */
export function rateSearchBracket(
  revalueAtRate: (rate: Decimal) => Decimal,
  searchLo: Decimal = RATE_SEARCH_LO
): {
  lo: Decimal;
  hi: Decimal;
  valueAtLo: Decimal;
  valueAtHi: Decimal;
} {
  return {
    lo: searchLo,
    hi: RATE_SEARCH_HI,
    valueAtLo: revalueAtRate(searchLo),
    valueAtHi: revalueAtRate(RATE_SEARCH_HI),
  };
}

export interface ScenarioOutputsInput {
  bearValue: Decimal;
  baseValue: Decimal;
  bullValue: Decimal;
  weights: { bear: Decimal; base: Decimal; bull: Decimal };
  // CF-NOPRICE-HONESTY-RECON-01. Null exactly where this run has no price.
  // Gates priceLocationWithinRange only — rateAtWhichBaseEqualsPrice below
  // keeps solving against the flattened $0 it already used on a priceless
  // run before this outcome (unchanged; naming that a defect too is not
  // this outcome's SCOPE).
  currentPrice: Decimal | null;
  // Recomputes the BASE case's value at a hypothetical discount rate —
  // used only to solve for the rate at which the base case equals price.
  //
  // null where the fixture has no real solver for this (CB-AUDIT-01 H2: a
  // fixture-illustrative formula unrelated to the company's actual scenario
  // inputs was solved and rendered as if it were a real answer — no fixture
  // in this codebase computes a genuine revaluation-at-rate function yet,
  // and building one is out of scope here). null means "not computed",
  // never a placeholder standing in for a real function.
  revalueBaseCaseAtRate: ((rate: Decimal) => Decimal) | null;
  // The lower end of the rate search (solveRateForTargetValue). Absent keeps
  // the default bracket.
  rateSearchLo?: Decimal;
}

export function computeScenarioOutputs(input: ScenarioOutputsInput): ScenarioOutputs {
  const { bearValue, baseValue, bullValue, weights, currentPrice } = input;

  // Display only, never a headline (§10.3, §10.5) — the caller is
  // responsible for never rendering this as the section's largest figure.
  const weightedDistribution = bearValue
    .mul(weights.bear)
    .plus(baseValue.mul(weights.base))
    .plus(bullValue.mul(weights.bull));

  const rangeSpan = bullValue.minus(bearValue);
  // §3.4 / CF-NOPRICE-HONESTY-RECON-01: a position needs a real price
  // behind it. Null price, null position — never an arithmetic answer off
  // the $0 "no price" sentinel this run's other outputs already refuse.
  const priceLocationWithinRange =
    currentPrice === null
      ? null
      : rangeSpan.isZero()
        ? new Decimal(0)
        : currentPrice.minus(bearValue).dividedBy(rangeSpan);

  // CF-PRICE-DISPLAY-HONESTY-RECON-01, CONTEXT item 6. Before this outcome,
  // a supplied revaluation function was solved against `currentPrice ??
  // new Decimal(0)` — the same $0-flattening class this outcome closes
  // everywhere else, latent only because no fixture that reaches this
  // branch with a real revaluation function also carries a null price
  // today (see docs/price-display-honesty-reconciliation.md). Gated on
  // `currentPrice === null` the same way `priceLocationWithinRange` above
  // already is, rather than solving toward a manufactured target.
  const rateAtWhichBaseEqualsPrice =
    input.revalueBaseCaseAtRate === null || currentPrice === null
      ? null
      : solveRateForTargetValue(input.revalueBaseCaseAtRate, currentPrice, input.rateSearchLo);

  return {
    values: { bear: bearValue, base: baseValue, bull: bullValue },
    weightedDistribution,
    priceLocationWithinRange,
    rateAtWhichBaseEqualsPrice,
    sensitivity: buildSensitivityResult(),
  };
}
