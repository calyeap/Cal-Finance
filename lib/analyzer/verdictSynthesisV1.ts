import Decimal from "decimal.js";
import { POLICY } from "./policy";

// ---------------------------------------------------------------------------
// CF-AR5-VERDICT-CONSOLIDATION-01 — the V1 verdict rule and the D3 check.
//
// Cal Finance Methodology "Verdict synthesis policy v1" (APPROVED 22 Sep
// 2026), unchanged by v2.1: `price / Base` is the valuation anchor; BUY at or
// below 0.90× / 0.80× / 0.70× Base and SELL at or above 1.20× / 1.30× / 1.45×
// Base for Low / Medium / High uncertainty; HOLD between. The bands live in
// policy.ts and are read, never restated here.
//
// Methodology v2.1 D3 (17 Oct 2026; product-decisions item 28; frozen spec
// §14.9 AR0-4): the verdict is computed at three rates (the D1 rate and
// ±0.5pp) × three uncertainty levels.
//   - all nine agree → issued automatically;
//   - only the uncertainty level matters → one question to Calvin;
//   - the rate-band ends disagree → a close call for Calvin.
// "Only the uncertainty level matters" is read literally: at every level the
// three rates agree. If the rate changes the answer at any level, the rate
// matters, so it is a close call. The three cases are exhaustive and
// exclusive. There is no mechanical uncertainty checklist: nothing here, or
// anywhere, scores the level.
//
// A zone of BUY is a valuation result only. Whether a BUY issues is D4's
// quality bar (qualityBar.ts), applied by verdict.ts.
// ---------------------------------------------------------------------------

export type UncertaintyLevel = "Low" | "Medium" | "High";
export const UNCERTAINTY_LEVELS: readonly UncertaintyLevel[] = ["Low", "Medium", "High"];

export type CheckRate = "lower" | "rate" | "upper";
export const CHECK_RATES: readonly CheckRate[] = ["lower", "rate", "upper"];

export type V1Zone = "BUY" | "HOLD" | "SELL";

const LEVEL_KEY: Record<UncertaintyLevel, "low" | "medium" | "high"> = { Low: "low", Medium: "medium", High: "high" };

/** The V1 band one price / Base ratio falls in at one uncertainty level. */
export function v1Zone(ratio: Decimal, level: UncertaintyLevel): V1Zone {
  const key = LEVEL_KEY[level];
  if (ratio.lessThanOrEqualTo(POLICY.verdictSynthesisV1Buy[key])) return "BUY";
  if (ratio.greaterThanOrEqualTo(POLICY.verdictSynthesisV1Sell[key])) return "SELL";
  return "HOLD";
}

export type VerdictGrid = Record<CheckRate, Record<UncertaintyLevel, V1Zone>>;

export interface VerdictCheckInput {
  price: Decimal;
  /** Base fair value per share valued at the D1 rate − 0.5pp, the rate, and + 0.5pp. */
  baseAt: Record<CheckRate, Decimal>;
}

export type VerdictRouting =
  | { kind: "AUTOMATIC"; zone: V1Zone }
  // The zone each level gives; the three rates agree at every level.
  | { kind: "UNCERTAINTY QUESTION"; byLevel: Record<UncertaintyLevel, V1Zone> }
  // The distinct zones the nine points produce, in BUY → HOLD → SELL order.
  | { kind: "CLOSE CALL"; zones: V1Zone[] };

export interface VerdictCheck {
  ratios: Record<CheckRate, Decimal>;
  grid: VerdictGrid;
  routing: VerdictRouting;
}

const ZONE_ORDER: V1Zone[] = ["BUY", "HOLD", "SELL"];

/** The nine-point D3 check. Every `baseAt` value must be positive and finite (the caller's prerequisite). */
export function evaluateVerdictCheck(input: VerdictCheckInput): VerdictCheck {
  const ratios = {} as Record<CheckRate, Decimal>;
  const grid = {} as VerdictGrid;
  for (const r of CHECK_RATES) {
    const base = input.baseAt[r];
    if (!base.isFinite() || base.lessThanOrEqualTo(0)) {
      throw new Error(`evaluateVerdictCheck: Base at the ${r} check rate is not a positive, finite figure`);
    }
    ratios[r] = input.price.dividedBy(base);
    grid[r] = { Low: v1Zone(ratios[r], "Low"), Medium: v1Zone(ratios[r], "Medium"), High: v1Zone(ratios[r], "High") };
  }

  const all = CHECK_RATES.flatMap((r) => UNCERTAINTY_LEVELS.map((u) => grid[r][u]));
  const zones = ZONE_ORDER.filter((z) => all.includes(z));
  if (zones.length === 1) return { ratios, grid, routing: { kind: "AUTOMATIC", zone: zones[0] } };

  const ratesAgreeAtEveryLevel = UNCERTAINTY_LEVELS.every((u) => CHECK_RATES.every((r) => grid[r][u] === grid.rate[u]));
  if (ratesAgreeAtEveryLevel) {
    return {
      ratios,
      grid,
      routing: { kind: "UNCERTAINTY QUESTION", byLevel: { Low: grid.rate.Low, Medium: grid.rate.Medium, High: grid.rate.High } },
    };
  }
  return { ratios, grid, routing: { kind: "CLOSE CALL", zones } };
}
