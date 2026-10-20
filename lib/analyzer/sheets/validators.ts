import Decimal from "decimal.js";
import { POLICY } from "../policy";
import { terminalReturnOnNewCapital } from "../discountRate";
import type { MoatClass } from "../types";
import type { HistoryMeasures } from "./research";
import { DRIVER_KEYS, DRIVER_LABELS, SCENARIO_KEYS, type DriverKey, type ScenarioKey, type SheetContent } from "./sheet";

// ---------------------------------------------------------------------------
// CF-AR6-ANY-TICKER-DRAFTS-01 — the sheet validators (issue #454 DO 3).
//
// Pure functions over a sheet, the company's own filed history and the D1
// rate. Every finding names its check, its scenario/driver and the numbers
// it compared. Two severities:
//
//   ERROR   — the sheet cannot stand: an AI draft carrying one is refused
//             whole and regenerated once (analystCall.ts), and a sheet
//             carrying one cannot be adopted.
//   WARNING — shown beside the sheet for Calvin; never blocks adoption.
//
// The history-range bands below are technical choices inside the approved
// rules (AI DEFAULT, recorded in the PR): they keep a draft inside what the
// company has itself achieved, widened by a margin, so a driver outside them
// must come from a cited reason rather than the model's prior. A human
// adjustment outside them is Calvin's call, so on an adoption they are
// warnings only (`forAdoption`).
//
// None of these checks reads a price: the draft is price-blind and its
// checks are too.
// ---------------------------------------------------------------------------

export type Severity = "ERROR" | "WARNING";

export type ValidatorCheck =
  | "COMPLETE"
  | "ANCHORED"
  | "ORDERED"
  | "HISTORY RANGE"
  | "RONIC PATH"
  | "TERMINAL CONSISTENCY"
  | "NOT FROM REVERSE DCF"
  | "STALE"
  | "SHARE COUNT";

export interface ValidatorFinding {
  check: ValidatorCheck;
  severity: Severity;
  message: string;
  scenario?: ScenarioKey;
  driver?: DriverKey | "moatClass" | "nopatTaxRate";
}

export interface ValidationContext {
  /** The company's own filed history, as the research pack measured it. Null: no history to check against. */
  measures: HistoryMeasures | null;
  /** The D1 rate the sheet would be valued at. */
  rate: Decimal;
  /** Require every driver to cite its anchor (an AI draft); an adoption keeps the draft's anchors. */
  requireAnchors: boolean;
  /** Range checks become warnings: the adjustment is Calvin's authorship. */
  forAdoption?: boolean;
}

/** Widening of the history bands — a technical tolerance, not a finance value. */
export const BANDS = {
  growthAboveHistory: new Decimal("0.10"),
  growthBelowHistory: new Decimal("0.10"),
  marginAboveHistory: new Decimal("0.05"),
  marginBelowHistory: new Decimal("0.10"),
  ronicMultipleOfHistoryHigh: new Decimal("1.5"),
  shareCountMultiple: { lo: new Decimal("0.5"), hi: new Decimal("3.0") },
  /** The latest quarter's year-on-year growth may sit this far outside bear…bull before the sheet reads stale. */
  latestQuarterTolerance: new Decimal("0.10"),
} as const;

function dec(raw: string | null | undefined): Decimal | null {
  if (raw === null || raw === undefined || raw.trim() === "") return null;
  try {
    const d = new Decimal(raw.trim());
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

function pct(v: Decimal): string {
  return `${v.mul(100).toFixed(1)}%`;
}

const REVERSE_DCF_RE = /reverse[\s-]*dcf|market[\s-]*implied|price[\s-]*implied|implied\s+by\s+the\s+(share\s+|stock\s+)?price|the\s+price\s+implies|priced\s+in|current\s+(share\s+|stock\s+)?price|valuation\s+multiple/i;

export function validateSheet(content: SheetContent, ctx: ValidationContext): ValidatorFinding[] {
  const findings: ValidatorFinding[] = [];
  const add = (f: ValidatorFinding) => findings.push(f);
  const range: Severity = ctx.forAdoption ? "WARNING" : "ERROR";

  if (content.cannotConclude) {
    add({ check: "COMPLETE", severity: "ERROR", message: `No sheet can be valued: ${content.cannotConclude}` });
    return findings;
  }

  // --- COMPLETE -------------------------------------------------------------
  const v = {} as Record<ScenarioKey, Record<DriverKey, Decimal | null>>;
  for (const key of SCENARIO_KEYS) {
    const s = content.scenarios[key];
    v[key] = {
      revenueGrowthOrPath: dec(s.revenueGrowthOrPath),
      operatingMargin: dec(s.operatingMargin),
      returnOnNewInvestment: dec(s.returnOnNewInvestment),
      reinvestmentCapitalIntensity: dec(s.reinvestmentCapitalIntensity),
      shareCount: dec(s.shareCount),
    };
    for (const d of DRIVER_KEYS) {
      if (v[key][d] === null) {
        add({ check: "COMPLETE", severity: "ERROR", scenario: key, driver: d, message: `${key} ${DRIVER_LABELS[d]} is not set` });
      }
    }
    const ronic = v[key].returnOnNewInvestment;
    if (ronic !== null && !ronic.greaterThan(0)) {
      add({ check: "COMPLETE", severity: "ERROR", scenario: key, driver: "returnOnNewInvestment", message: `${key} return on new investment must be positive (got ${pct(ronic)})` });
    }
    if (s.writtenAnchor.trim() === "") {
      add({ check: "ANCHORED", severity: "ERROR", scenario: key, message: `${key} has no written scenario anchor` });
    }
  }
  if (content.moatClass === null) add({ check: "COMPLETE", severity: "ERROR", driver: "moatClass", message: "the moat class is not set" });
  const tax = dec(content.configuredConstants.nopatTaxRate);
  if (tax === null) add({ check: "COMPLETE", severity: "ERROR", driver: "nopatTaxRate", message: "the NOPAT tax rate is not set" });

  // --- ANCHORED -------------------------------------------------------------
  if (ctx.requireAnchors) {
    const ids = new Set((content.sources ?? []).map((s) => s.id));
    const checkAnchor = (label: string, anchor: { text: string; cites: string[] } | null | undefined, scenario?: ScenarioKey, driver?: ValidatorFinding["driver"]) => {
      if (anchor === null || anchor === undefined || anchor.text.trim() === "") {
        add({ check: "ANCHORED", severity: "ERROR", scenario, driver, message: `${label} has no anchor` });
        return;
      }
      if (anchor.cites.length === 0) {
        add({ check: "ANCHORED", severity: "ERROR", scenario, driver, message: `${label}'s anchor cites no source` });
        return;
      }
      const unknown = anchor.cites.filter((c) => !ids.has(c));
      if (unknown.length > 0) {
        add({ check: "ANCHORED", severity: "ERROR", scenario, driver, message: `${label}'s anchor cites ${unknown.join(", ")}, which no supplied source carries` });
      }
    };
    for (const key of SCENARIO_KEYS) {
      for (const d of DRIVER_KEYS) checkAnchor(`${key} ${DRIVER_LABELS[d]}`, content.scenarios[key].anchors?.[d], key, d);
    }
    checkAnchor("the moat class", content.moatAnchor, undefined, "moatClass");
    checkAnchor("the policy constants", content.constantsAnchor, undefined, "nopatTaxRate");
  }

  // --- NOT FROM REVERSE DCF ---------------------------------------------------
  // The base growth (and every other driver) is anchored to history and the
  // filings, never to what the price implies — the reverse DCF is a check on
  // the price, not a source of assumptions.
  for (const key of SCENARIO_KEYS) {
    const texts = [content.scenarios[key].writtenAnchor, ...DRIVER_KEYS.map((d) => content.scenarios[key].anchors?.[d]?.text ?? "")];
    if (texts.some((t) => REVERSE_DCF_RE.test(t))) {
      add({
        check: "NOT FROM REVERSE DCF",
        severity: "ERROR",
        scenario: key,
        driver: "revenueGrowthOrPath",
        message: `${key}'s anchors refer to the price, a market-implied figure or a reverse DCF; a driver is never taken from them`,
      });
    }
  }

  // --- ORDERED ----------------------------------------------------------------
  for (const d of ["revenueGrowthOrPath", "operatingMargin", "returnOnNewInvestment"] as const) {
    const [bear, base, bull] = SCENARIO_KEYS.map((k) => v[k][d]);
    if (bear !== null && base !== null && bull !== null && (bear.greaterThan(base) || base.greaterThan(bull))) {
      add({ check: "ORDERED", severity: "ERROR", driver: d, message: `${DRIVER_LABELS[d]} is not ordered bear ≤ base ≤ bull (${pct(bear)}, ${pct(base)}, ${pct(bull)})` });
    }
  }

  // --- RONIC PATH and TERMINAL CONSISTENCY ------------------------------------
  // v3 D2′: each scenario's return on new investment fades to its terminal
  // return — the rate (Bull: rate + 1.5pp) — by the end of its runway. Base
  // and bull fade DOWN to it: a scenario whose return starts below its own
  // terminal would have returns rising toward perpetuity, which no moat class
  // describes.
  const moat: MoatClass | null = content.moatClass;
  if (moat !== null) {
    for (const key of SCENARIO_KEYS) {
      const ronic = v[key].returnOnNewInvestment;
      if (ronic === null) continue;
      const terminal = terminalReturnOnNewCapital(ctx.rate, key);
      if (key !== "bear" && ronic.lessThan(terminal)) {
        add({
          check: "RONIC PATH",
          severity: "ERROR",
          scenario: key,
          driver: "returnOnNewInvestment",
          message: `${key} return on new investment ${pct(ronic)} is below its terminal return ${pct(terminal)} (the rate ${pct(ctx.rate)}${key === "bull" ? " + 1.5pp" : ""}), so returns would rise toward perpetuity`,
        });
      }
      if (key === "bear" && ronic.lessThan(ctx.rate)) {
        add({
          check: "RONIC PATH",
          severity: "WARNING",
          scenario: key,
          driver: "returnOnNewInvestment",
          message: `bear return on new investment ${pct(ronic)} is below the rate ${pct(ctx.rate)}: bear growth destroys value`,
        });
      }
    }
    const roicHigh = ctx.measures?.roicRange?.high ?? null;
    const baseTerminal = terminalReturnOnNewCapital(ctx.rate, "base");
    if (roicHigh !== null && baseTerminal.greaterThan(roicHigh)) {
      add({
        check: "TERMINAL CONSISTENCY",
        severity: range,
        driver: "moatClass",
        message: `new capital earns the rate ${pct(baseTerminal)} in perpetuity, above the highest return on invested capital this company has filed (${pct(roicHigh)})`,
      });
    }
    if (moat !== "none" && roicHigh !== null && roicHigh.lessThan(ctx.rate)) {
      add({
        check: "TERMINAL CONSISTENCY",
        severity: range,
        driver: "moatClass",
        message: `a ${moat} moat is credited, but no filed year's return on invested capital (high ${pct(roicHigh)}) reached the rate ${pct(ctx.rate)}`,
      });
    }
  }
  const g = v.base.revenueGrowthOrPath;
  if (g !== null && g.lessThanOrEqualTo(POLICY.terminalGrowth.minus(new Decimal("0.05")))) {
    // Not a range: a base case shrinking this fast fades UP to terminal growth.
    add({ check: "TERMINAL CONSISTENCY", severity: "WARNING", scenario: "base", driver: "revenueGrowthOrPath", message: `base growth ${pct(g)} is far below terminal growth ${pct(POLICY.terminalGrowth)}; the fade to terminal raises growth` });
  }

  // --- HISTORY RANGE ----------------------------------------------------------
  const m = ctx.measures;
  if (m !== null) {
    const gr = m.revenueGrowthRange;
    if (gr !== null) {
      const lo = gr.low.minus(BANDS.growthBelowHistory);
      const hi = gr.high.plus(BANDS.growthAboveHistory);
      for (const key of SCENARIO_KEYS) {
        const x = v[key].revenueGrowthOrPath;
        if (x !== null && (x.lessThan(lo) || x.greaterThan(hi))) {
          add({ check: "HISTORY RANGE", severity: range, scenario: key, driver: "revenueGrowthOrPath", message: `${key} growth ${pct(x)} is outside the filed single-year range ${pct(gr.low)} to ${pct(gr.high)}, widened to ${pct(lo)} to ${pct(hi)}` });
        }
      }
    }
    const mr = m.operatingMarginRange;
    if (mr !== null) {
      const lo = mr.low.minus(BANDS.marginBelowHistory);
      const hi = mr.high.plus(BANDS.marginAboveHistory);
      for (const key of SCENARIO_KEYS) {
        const x = v[key].operatingMargin;
        if (x !== null && (x.lessThan(lo) || x.greaterThan(hi))) {
          add({ check: "HISTORY RANGE", severity: range, scenario: key, driver: "operatingMargin", message: `${key} operating margin ${pct(x)} is outside the filed range ${pct(mr.low)} to ${pct(mr.high)}, widened to ${pct(lo)} to ${pct(hi)}` });
        }
      }
    }
    const roicHigh = m.roicRange?.high ?? null;
    const reference = [roicHigh, m.incrementalReturn].filter((x): x is Decimal => x !== null && x.greaterThan(0));
    if (reference.length > 0) {
      const ceiling = Decimal.max(...reference).mul(BANDS.ronicMultipleOfHistoryHigh);
      for (const key of SCENARIO_KEYS) {
        const x = v[key].returnOnNewInvestment;
        if (x !== null && x.greaterThan(ceiling)) {
          add({ check: "HISTORY RANGE", severity: range, scenario: key, driver: "returnOnNewInvestment", message: `${key} return on new investment ${pct(x)} exceeds 1.5× the best filed return (${pct(Decimal.max(...reference))})` });
        }
      }
    }
  }

  // --- SHARE COUNT ----------------------------------------------------------
  const diluted = dec(content.basis?.dilutedShares ?? null);
  if (diluted !== null && diluted.greaterThan(0)) {
    for (const key of SCENARIO_KEYS) {
      const x = v[key].shareCount;
      if (x === null) continue;
      const ratio = x.dividedBy(diluted);
      if (ratio.lessThan(BANDS.shareCountMultiple.lo) || ratio.greaterThan(BANDS.shareCountMultiple.hi)) {
        add({ check: "SHARE COUNT", severity: "ERROR", scenario: key, driver: "shareCount", message: `${key} share count is ${ratio.toFixed(2)}× the diluted count the sheet was drafted on — outside 0.5× to 3×; check its unit` });
      }
    }
  }

  return findings;
}

/**
 * The stale-assumption check (issue #454 DO 3): a sheet drafted before the
 * latest filed quarter, or whose year-1 revenue sits below that quarter's
 * run-rate, or whose bear…bull growth no longer brackets that quarter's
 * year-on-year growth. Always warnings — a stale sheet still values; the
 * remedy is a redraft (a new version), which Calvin adopts.
 */
export function staleFindings(content: SheetContent, measures: HistoryMeasures | null): ValidatorFinding[] {
  const findings: ValidatorFinding[] = [];
  const q = measures?.latestQuarter ?? null;
  if (q === null || content.cannotConclude) return findings;
  const drafted = content.basis?.latestQuarterEnd ?? null;
  if (drafted !== null && Date.parse(q.periodEnd) > Date.parse(drafted)) {
    findings.push({ check: "STALE", severity: "WARNING", message: `this sheet was drafted on the quarter ended ${drafted}; a newer quarter (ended ${q.periodEnd}) has been filed since` });
  }
  if (drafted === null) {
    findings.push({ check: "STALE", severity: "WARNING", message: `this sheet records no quarter it was drafted on; the latest filed quarter ended ${q.periodEnd}` });
  }
  const base = dec(content.scenarios.base.revenueGrowthOrPath);
  const ttm = q.ttmRevenue;
  if (base !== null && ttm !== null) {
    const year1 = ttm.mul(new Decimal(1).plus(base));
    const runRate = q.revenue.mul(4);
    if (year1.lessThan(runRate)) {
      findings.push({
        check: "STALE",
        severity: "WARNING",
        scenario: "base",
        driver: "revenueGrowthOrPath",
        message: `base year-1 revenue (trailing twelve months × (1 + ${pct(base)})) is below the latest quarter's annualised run-rate (quarter ended ${q.periodEnd} × 4)`,
      });
    }
  }
  const bear = dec(content.scenarios.bear.revenueGrowthOrPath);
  const bull = dec(content.scenarios.bull.revenueGrowthOrPath);
  if (q.yearOnYearGrowth !== null && bear !== null && bull !== null) {
    const y = q.yearOnYearGrowth;
    if (y.greaterThan(bull.plus(BANDS.latestQuarterTolerance)) || y.lessThan(bear.minus(BANDS.latestQuarterTolerance))) {
      findings.push({
        check: "STALE",
        severity: "WARNING",
        driver: "revenueGrowthOrPath",
        message: `the latest quarter grew ${pct(y)} on its year-ago quarter, outside this sheet's bear…bull growth (${pct(bear)} to ${pct(bull)}) by more than ${pct(BANDS.latestQuarterTolerance)}`,
      });
    }
  }
  return findings;
}

export function errorsIn(findings: ValidatorFinding[]): ValidatorFinding[] {
  return findings.filter((f) => f.severity === "ERROR");
}
