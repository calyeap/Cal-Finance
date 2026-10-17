import Decimal from "decimal.js";

// ---------------------------------------------------------------------------
// CF-AR5-VERDICT-CONSOLIDATION-01 — Methodology v2.1 D4 item 2, the computed
// floor of the BUY quality bar: "5-yr average ROIC including goodwill above
// the rate".
//
// - ROIC for a year is that year's NOPAT over its year-end invested capital.
// - Invested capital is the financing-side composition CALVIN RULING —
//   FINANCING-SIDE INVESTED CAPITAL (issue #298) already fixes for RONIC:
//   total equity + interest-bearing debt + lease liabilities not already in
//   debt − cash − marketable securities. Equity is taken whole, so goodwill
//   is included, as D4 requires.
// - The average is the simple mean of the latest five fiscal years.
// - "The rate" is the run's D1 rate.
//
// PASS or FAIL only on five complete years. A company whose own filed record
// is shorter than five fiscal years cannot show a five-year average above the
// rate, so the floor is not met (FAIL). A missing fact, or a year whose
// invested capital is not positive (ROIC is not meaningful there), leaves the
// floor UNAVAILABLE with its cause: never a pass, and never a fail invented
// from absent data.
// ---------------------------------------------------------------------------

export const ROIC_FLOOR_YEARS = 5;

export interface RoicYearInput {
  fiscalYear: number;
  nopat: Decimal | null;
  investedCapital: Decimal | null;
}

export interface RoicFloorInput {
  /** Any order; the latest five fiscal years are used. */
  years: RoicYearInput[];
  /** How many fiscal years of annual results the company itself has filed. */
  filedHistoryYears: number;
  rate: Decimal;
}

export type RoicFloorResult =
  | {
      status: "PASS" | "FAIL";
      average: Decimal | null;
      years: { fiscalYear: number; roic: Decimal }[];
      rate: Decimal;
      reason: string;
    }
  | { status: "UNAVAILABLE"; average: null; years: []; rate: Decimal; reason: string };

function pct(value: Decimal): string {
  return `${value.mul(100).toFixed(1)}%`;
}

export function evaluateRoicFloor(input: RoicFloorInput): RoicFloorResult {
  const { rate } = input;
  if (input.filedHistoryYears < ROIC_FLOOR_YEARS) {
    return {
      status: "FAIL",
      average: null,
      years: [],
      rate,
      reason:
        `The company has filed ${input.filedHistoryYears} fiscal year${input.filedHistoryYears === 1 ? "" : "s"} of annual results, ` +
        `so it cannot show a five-year average return on invested capital above the ${pct(rate)} rate.`,
    };
  }

  const latest = [...input.years].sort((a, b) => b.fiscalYear - a.fiscalYear).slice(0, ROIC_FLOOR_YEARS);
  const unavailable = (reason: string): RoicFloorResult => ({ status: "UNAVAILABLE", average: null, years: [], rate, reason });
  if (latest.length < ROIC_FLOOR_YEARS) {
    return unavailable(`only ${latest.length} of the latest five fiscal years have return-on-capital inputs on this run`);
  }
  const years: { fiscalYear: number; roic: Decimal }[] = [];
  for (const y of latest) {
    if (y.nopat === null || y.investedCapital === null) {
      return unavailable(`FY${y.fiscalYear} is missing ${y.nopat === null ? "NOPAT" : "invested capital"}`);
    }
    if (y.investedCapital.lessThanOrEqualTo(0)) {
      return unavailable(`FY${y.fiscalYear} invested capital is not positive, so its return on capital is not meaningful`);
    }
    years.push({ fiscalYear: y.fiscalYear, roic: y.nopat.dividedBy(y.investedCapital) });
  }

  const average = years.reduce((sum, y) => sum.plus(y.roic), new Decimal(0)).dividedBy(years.length);
  const first = years[years.length - 1].fiscalYear;
  const last = years[0].fiscalYear;
  const passes = average.greaterThan(rate);
  return {
    status: passes ? "PASS" : "FAIL",
    average,
    years,
    rate,
    reason:
      `Average return on invested capital, goodwill included, over FY${first}–FY${last} is ${pct(average)}, ` +
      `${passes ? "above" : "not above"} the ${pct(rate)} rate.`,
  };
}
