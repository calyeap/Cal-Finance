import Decimal from "decimal.js";

// CF-AR3-REPRODUCIBLE-RUNS-01 — Methodology v2.1 D2 timing (frozen spec
// §14.9 AR0-3): mid-year cash flows, terminal value at 9.5 years, valued at
// the price date, on a TTM base. One implementation, shared by M7
// (reverseDcf.ts) and M15 (scenarioOutputs.ts), so the two engines cannot
// drift onto different conventions.
//
// Year t of the explicit period is the twelve months ending t years after
// the base period ends (the TTM base's own end date). Its cash flow arrives,
// on average, half-way through that year — t − 0.5 years after the base
// period end. The terminal value is the value of the year-11-onward flows,
// and the first of those also arrives mid-year, so the Gordon value is
// discounted from 9.5 years, not 10.
//
// "Valued at the price date": the base period ends `stubYears` before the
// price date, so every flow is that much closer to today than to the base
// period end — its discount time is (t − 0.5) − stubYears. This rolls the
// base-date value forward to the price date at the discount rate. It does
// not remove cash already received between the base period end and the
// price date; with a TTM base that window is under a quarter for a current
// filer, and is reported (AnalysisResult.runIdentity.valuationTiming) so a
// reader can see it.

export const MID_YEAR_OFFSET = new Decimal("0.5");
export const TERMINAL_DISCOUNT_YEARS = new Decimal("9.5");

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_PER_YEAR = new Decimal("365.25");

/** Discount time, in years from the price date, of explicit year t's cash flow. */
export function explicitYearDiscountTime(t: number, stubYears: Decimal): Decimal {
  return new Decimal(t).minus(MID_YEAR_OFFSET).minus(stubYears);
}

/** Discount time, in years from the price date, of the terminal value. */
export function terminalDiscountTime(stubYears: Decimal): Decimal {
  return TERMINAL_DISCOUNT_YEARS.minus(stubYears);
}

/**
 * Years from the base period end to the price date, rounded to whole days
 * (a timestamp's time of day is not a valuation input).
 *
 * Zero when either date is missing or the price date is not after the base
 * period end: with no price date there is nothing to roll forward to, and a
 * price dated before the period it is valued on has no defensible stub, so
 * the value stays at the base period end and the run's timing record says
 * which case applied.
 */
export function stubYearsBetween(basePeriodEnd: string | null, priceDate: string | null): Decimal {
  if (basePeriodEnd === null || priceDate === null) return new Decimal(0);
  const base = Date.parse(basePeriodEnd.slice(0, 10));
  const price = Date.parse(priceDate.slice(0, 10));
  if (Number.isNaN(base) || Number.isNaN(price) || price <= base) return new Decimal(0);
  return new Decimal(Math.round((price - base) / DAY_MS)).dividedBy(DAYS_PER_YEAR);
}
