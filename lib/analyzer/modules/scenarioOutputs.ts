import Decimal from "decimal.js";
import { POLICY } from "../policy";
import { buildSensitivityResult } from "./sensitivity";
import { buildRonicPath } from "../growthPath";
import { explicitYearDiscountTime, terminalDiscountTime } from "../valuationTiming";
import type { ScenarioOutputs } from "../types";

// M15 — scenario valuation and outputs (§7.2, §10 F/G) — the main valuation
// engine. CF-AR4-RATE-REINVESTMENT-TERMINAL-01 put it on Methodology v2.1
// D2 (frozen spec §14.9 AR0-3), CF-METHODOLOGY-V3-IMPLEMENT-01 on v3 D2′ and
// D2.1 (§14.10), and M7's reverse DCF solves on this same function
// (reverseDcf.ts), so the two engines are one:
//
// - Reinvestment_t = NOPAT_t × g_(t+1) ÷ RONIC_t — this year's investment
//   funds next year's growth; growth after year 10 is terminal growth.
// - RONIC_t is the scenario's return on new investment, fading linearly
//   from its year-5 value to the terminal return by `runwayYears`
//   (growthPath.ts buildRonicPath). The explicit period runs to
//   max(10, runwayYears), so the last year already reinvests at terminal
//   economics.
// - Terminal FCF = terminal NOPAT × (1 − g ÷ terminal return) (§7.2 M8,
//   unchanged). v3 D2′: the terminal return is the rate (Bull: rate +
//   1.5pp), chosen by the caller — never defaulted here.
// - Timing is D2's (valuationTiming.ts): mid-year flows, the terminal value
//   from (last explicit year − 0.5), valued at the price date.
// - v3 D2.1 — year 1's growth must be funded by last year's actual
//   investment. Where `yearOne` is supplied, the required year-0
//   investment NOPAT_0 × g_1 ÷ RONIC_1 less the filed net reinvestment
//   available (all of it where none can be formed) is charged, if positive,
//   at the valuation date.
//
// With a constant margin the terminal FCF is exactly (1 + g) × final-year
// FCF, and RONIC equal to the rate makes value independent of growth after
// year 1 — the coherence invariants the golden harness checks.
//
// margin may be a single constant (broadcast) or an explicit path of up to
// the horizon's length; its last entry is held after the path ends.

export interface ScenarioValuation {
  /** Present value at the price date, after any D2.1 year-1 funding charge. */
  enterpriseValue: Decimal;
  explicitPeriodPv: Decimal;
  terminalValuePv: Decimal;
  // Undiscounted, at the end of the explicit period — M9's numerator.
  terminalValue: Decimal;
  /** The explicit period's length: max(10, runway years). */
  horizonYears: number;
  year10Revenue: Decimal;
  /** Revenue, operating income and FCF in the explicit period's last year (year 10 on a ten-year horizon). */
  finalYearRevenue: Decimal;
  finalYearOperatingIncome: Decimal;
  finalYearFcf: Decimal;
  terminalFcf: Decimal;
  /** v3 D2.1 — the year-1 funding check; null where the caller supplied no year-0 NOPAT. */
  yearOneFunding: YearOneFunding | null;
}

export interface YearOneFundingInput {
  /** NOPAT over the twelve months the valuation starts from (TTM). */
  nopat0: Decimal;
  /** Last fiscal year's filed net reinvestment; null where it cannot be formed from filings. */
  available: Decimal | null;
}

export interface YearOneFunding {
  required: Decimal;
  available: Decimal | null;
  /** max(0, required − available); the whole requirement where `available` is null. */
  shortfall: Decimal;
}

export interface ScenarioValuationOptions {
  /** v3 D2′ — the year the return on new capital reaches the terminal return. Default 10. */
  runwayYears?: number;
  yearOne?: YearOneFundingInput | null;
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
  stubYears: Decimal = new Decimal(0),
  options: ScenarioValuationOptions = {}
): ScenarioValuation {
  if (growthPath.length !== 10) {
    throw new Error("growthPath must have exactly ten entries (years 1-10)");
  }
  if (!returnOnNewInvestment.greaterThan(0) || !terminalReturnOnNewCapital.greaterThan(0)) {
    throw new Error("return on new investment and the terminal return on new capital must be positive");
  }
  const runwayYears = options.runwayYears ?? 10;
  const horizon = Math.max(10, runwayYears);

  const afterTax = new Decimal(1).minus(nopatTaxRate);
  const marginAt = (t: number): Decimal => (Array.isArray(margin) ? margin[Math.min(t, margin.length) - 1] : margin);
  const growthAt = (t: number): Decimal => (t <= 10 ? growthPath[t - 1] : terminalGrowth);
  const ronicPath = buildRonicPath(returnOnNewInvestment, terminalReturnOnNewCapital, runwayYears);
  const discountFactorBase = new Decimal(1).plus(rate);

  let revenue = baseRevenue;
  let pvSum = new Decimal(0);
  let finalYearFcf = new Decimal(0);
  let year10Revenue = new Decimal(0);
  for (let t = 1; t <= horizon; t++) {
    revenue = revenue.mul(new Decimal(1).plus(growthAt(t)));
    if (t === 10) year10Revenue = revenue;
    const nopat = revenue.mul(marginAt(t)).mul(afterTax);
    const reinvestment = nopat.mul(growthAt(t + 1)).dividedBy(ronicPath[t - 1]);
    const fcff = nopat.minus(reinvestment);
    if (t === horizon) finalYearFcf = fcff;
    pvSum = pvSum.plus(fcff.dividedBy(discountFactorBase.pow(explicitYearDiscountTime(t, stubYears))));
  }

  const finalYearRevenue = revenue;
  const finalYearOperatingIncome = finalYearRevenue.mul(marginAt(horizon));
  const terminalNopat = finalYearOperatingIncome.mul(afterTax).mul(new Decimal(1).plus(terminalGrowth));
  const terminalFcf = terminalNopat.mul(new Decimal(1).minus(terminalGrowth.dividedBy(terminalReturnOnNewCapital)));
  const terminalValue = terminalFcf.dividedBy(rate.minus(terminalGrowth));
  const terminalValuePv = terminalValue.dividedBy(discountFactorBase.pow(terminalDiscountTime(stubYears, horizon)));

  let yearOneFunding: YearOneFunding | null = null;
  if (options.yearOne != null) {
    const required = Decimal.max(0, options.yearOne.nopat0.mul(growthAt(1)).dividedBy(ronicPath[0]));
    const available = options.yearOne.available;
    const shortfall = available === null ? required : Decimal.max(0, required.minus(available));
    yearOneFunding = { required, available, shortfall };
  }

  return {
    enterpriseValue: pvSum.plus(terminalValuePv).minus(yearOneFunding?.shortfall ?? 0),
    explicitPeriodPv: pvSum,
    terminalValuePv,
    terminalValue,
    horizonYears: horizon,
    year10Revenue,
    finalYearRevenue,
    finalYearOperatingIncome,
    finalYearFcf,
    terminalFcf,
    yearOneFunding,
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
  stubYears: Decimal = new Decimal(0),
  options: ScenarioValuationOptions = {}
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
    stubYears,
    options
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
