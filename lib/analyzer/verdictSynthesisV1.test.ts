import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { POLICY } from "./policy";
import { evaluateVerdictCheck, v1Zone, type CheckRate, type UncertaintyLevel, type V1Zone } from "./verdictSynthesisV1";

// ---------------------------------------------------------------------------
// CF-AR5-VERDICT-CONSOLIDATION-01 — the exhaustive truth table for the V1
// band and the D3 nine-point check (zones × uncertainty levels × rate-band
// ends).
//
// The oracle below is written from the Methodology text, not imported from
// policy.ts: Verdict synthesis policy v1 (APPROVED 22 Sep 2026) — BUY at or
// below 0.90× / 0.80× / 0.70× Base and SELL at or above 1.20× / 1.30× /
// 1.45× Base for Low / Medium / High; HOLD between. D3 (Methodology v2.1):
// all nine agree → automatic; only the uncertainty level matters → one
// question; the rate-band ends disagree → close call.
//
// Every price / Base ratio position that can matter is enumerated: each of
// the six thresholds exactly, and a point inside each of the seven intervals
// they cut — 13 positions — at each of the three check rates: 13³ = 2,197
// combinations, every one checked against the oracle.
// ---------------------------------------------------------------------------

const METHODOLOGY_BANDS: Record<UncertaintyLevel, { buyAtOrBelow: string; sellAtOrAbove: string }> = {
  Low: { buyAtOrBelow: "0.90", sellAtOrAbove: "1.20" },
  Medium: { buyAtOrBelow: "0.80", sellAtOrAbove: "1.30" },
  High: { buyAtOrBelow: "0.70", sellAtOrAbove: "1.45" },
};
const LEVELS: UncertaintyLevel[] = ["Low", "Medium", "High"];
const RATES: CheckRate[] = ["lower", "rate", "upper"];

function oracleZone(ratio: Decimal, level: UncertaintyLevel): V1Zone {
  const band = METHODOLOGY_BANDS[level];
  if (ratio.cmp(band.buyAtOrBelow) <= 0) return "BUY";
  if (ratio.cmp(band.sellAtOrAbove) >= 0) return "SELL";
  return "HOLD";
}

// The six thresholds exactly, and one point strictly inside each interval.
const POSITIONS = ["0.50", "0.70", "0.75", "0.80", "0.85", "0.90", "1.00", "1.20", "1.25", "1.30", "1.40", "1.45", "1.60"].map(
  (x) => new Decimal(x)
);

describe("Verdict synthesis policy v1 bands are unchanged (DO NOT: no V1 band or threshold change)", () => {
  it("policy.ts carries exactly the Methodology's approved cut-points", () => {
    expect(POLICY.verdictSynthesisV1Buy.low.toString()).toBe("0.9");
    expect(POLICY.verdictSynthesisV1Buy.medium.toString()).toBe("0.8");
    expect(POLICY.verdictSynthesisV1Buy.high.toString()).toBe("0.7");
    expect(POLICY.verdictSynthesisV1Sell.low.toString()).toBe("1.2");
    expect(POLICY.verdictSynthesisV1Sell.medium.toString()).toBe("1.3");
    expect(POLICY.verdictSynthesisV1Sell.high.toString()).toBe("1.45");
  });

  it("v1Zone matches the oracle at every position and level, thresholds inclusive", () => {
    for (const ratio of POSITIONS) {
      for (const level of LEVELS) {
        expect(v1Zone(ratio, level), `${ratio.toString()}× at ${level}`).toBe(oracleZone(ratio, level));
      }
    }
  });
});

describe("D3 nine-point check — exhaustive truth table", () => {
  // Divisible by every position's numerator (1, 7, 3, 4, 17, 9, 6, 5, 13, 29,
  // 8 as fractions over 20), so each Base = price ÷ ratio is an exact integer
  // and each ratio the check computes back is exact — thresholds land on the
  // threshold, not a rounding step beside it.
  const price = new Decimal(16150680);
  const cases: Decimal[][] = [];
  for (const a of POSITIONS) for (const b of POSITIONS) for (const c of POSITIONS) cases.push([a, b, c]);

  it(`routes all ${cases.length} rate × position combinations exactly as D3 states`, () => {
    let automatic = 0;
    let question = 0;
    let closeCall = 0;
    for (const [lo, mid, hi] of cases) {
      const ratios: Record<CheckRate, Decimal> = { lower: lo, rate: mid, upper: hi };
      const check = evaluateVerdictCheck({
        price,
        baseAt: { lower: price.dividedBy(lo), rate: price.dividedBy(mid), upper: price.dividedBy(hi) },
      });
      const label = `ratios ${lo}/${mid}/${hi}`;

      // The grid: every one of the nine points is the oracle's zone.
      for (const r of RATES) for (const u of LEVELS) {
        expect(check.grid[r][u], `${label} at ${r}/${u}`).toBe(oracleZone(ratios[r], u));
      }

      const all = RATES.flatMap((r) => LEVELS.map((u) => oracleZone(ratios[r], u)));
      const distinct = (["BUY", "HOLD", "SELL"] as V1Zone[]).filter((z) => all.includes(z));
      const rateMattersSomewhere = LEVELS.some((u) => new Set(RATES.map((r) => oracleZone(ratios[r], u))).size > 1);

      if (distinct.length === 1) {
        automatic++;
        expect(check.routing, label).toEqual({ kind: "AUTOMATIC", zone: distinct[0] });
      } else if (!rateMattersSomewhere) {
        question++;
        expect(check.routing, label).toEqual({
          kind: "UNCERTAINTY QUESTION",
          byLevel: { Low: oracleZone(mid, "Low"), Medium: oracleZone(mid, "Medium"), High: oracleZone(mid, "High") },
        });
      } else {
        closeCall++;
        expect(check.routing, label).toEqual({ kind: "CLOSE CALL", zones: distinct });
      }
    }
    // All three routes are reached by the table — none is dead code.
    expect(automatic).toBeGreaterThan(0);
    expect(question).toBeGreaterThan(0);
    expect(closeCall).toBeGreaterThan(0);
  });

  it("an uncertainty question never offers a verdict the levels do not produce, and always differs by level", () => {
    for (const ratio of POSITIONS) {
      const check = evaluateVerdictCheck({ price, baseAt: { lower: price.dividedBy(ratio), rate: price.dividedBy(ratio), upper: price.dividedBy(ratio) } });
      if (check.routing.kind === "UNCERTAINTY QUESTION") {
        expect(new Set(Object.values(check.routing.byLevel)).size).toBeGreaterThan(1);
      } else {
        // One rate everywhere: the rate cannot matter, so never a close call.
        expect(check.routing.kind).toBe("AUTOMATIC");
      }
    }
  });

  it("refuses a Base that is not positive and finite rather than reading a ratio off it", () => {
    for (const bad of [new Decimal(0), new Decimal(-1), new Decimal(NaN)]) {
      expect(() => evaluateVerdictCheck({ price, baseAt: { lower: new Decimal(100), rate: bad, upper: new Decimal(100) } })).toThrow();
    }
  });
});
