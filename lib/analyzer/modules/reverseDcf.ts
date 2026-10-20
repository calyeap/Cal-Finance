import Decimal from "decimal.js";
import { POLICY } from "../policy";
import { buildFixedShapeGrowthPath } from "../growthPath";
import { combineProvenance } from "../provenance";
import { computedValue, suppressedValue } from "../figures";
import { computeScenarioValuation, type ScenarioValuationOptions, type YearOneFundingInput } from "./scenarioOutputs";
import type { Figure, ReverseDcfSolve, SourcedValue } from "../types";

// M7 — the reverse DCF (§7.2), as amended by AR0-2 (frozen spec §14.9,
// CF-AR4-RATE-REINVESTMENT-TERMINAL-01): ONE solve on the main valuation
// engine. It finds the constant years-1–5 revenue growth (fixed path shape,
// §7.1: constant 1–5, linear fade to terminal growth by year 10) at which
// the base scenario's own M15 valuation — at the D1 rate, on the base
// sheet's margin, return on new investment and moat-credit terminal, with
// D2's timing — equals today's enterprise value. Nothing here is a second
// model: every value is computeScenarioValuation's (scenarioOutputs.ts).
//
// It replaces the 8/10/12% × current/median/stress grid and that grid's own
// `r + 3pp` terminal. Margin levels, rate-band ends, growth, return on new
// investment and moat are M14's sensitivity rows now (assemble.ts).
//
// Solver bracket: five-year growth from −50% to +100% a year. Beyond that,
// growth far above the return on new investment makes reinvestment exceed
// NOPAT and the value function can turn over; the monotonicity check below
// reports that as NOT COMPUTABLE rather than solving on the wrong branch.
const GROWTH_SEARCH_LO = new Decimal("-0.5");
const GROWTH_SEARCH_HI = new Decimal("1");
const MONOTONICITY_SAMPLE_COUNT = 20;
const BISECTION_ITERATIONS = 80;

/** The run's facts M7 reads, as the fixture carries them (assemble.ts). */
export interface ReverseDcfFacts {
  baseYearRevenue: SourcedValue<Decimal> | null;
  targetEnterpriseValue: SourcedValue<Decimal> | null;
  // Read by M6 (steady-state EV), not by this solve.
  currentMargin: SourcedValue<Decimal> | null;
  medianMargin: SourcedValue<Decimal> | null;
  lagBiasDirection: "conservative" | "generous";
  configuredStressMarginLevel?: Decimal | null;
  configuredNopatTaxRate?: Decimal | null;
}

/** The base scenario's adopted D2 drivers the solve holds fixed. */
export interface ReverseDcfHeldDrivers {
  operatingMargin: Decimal;
  returnOnNewInvestment: Decimal;
  terminalReturnOnNewCapital: Decimal;
  // CF-METHODOLOGY-V3-IMPLEMENT-01 — the Base valuation's own v3 shape, held
  // while growth is solved: the D5 margin path (else the flat margin), the
  // D2′ return runway (else 10 years) and the D2.1 year-1 funding charge.
  marginPath?: Decimal[];
  runwayYears?: number;
  yearOne?: YearOneFundingInput | null;
}

export interface ReverseDcfInput {
  baseYearRevenue: SourcedValue<Decimal> | null;
  targetEnterpriseValue: SourcedValue<Decimal> | null;
  rate: Decimal;
  nopatTaxRate: Decimal | null;
  // null while the base scenario is not adopted with every D2 driver —
  // `heldDriversMissing` then says why.
  heldDrivers: ReverseDcfHeldDrivers | null;
  heldDriversMissing: string | null;
  stubYears?: Decimal;
}

export function solveReverseDcf(input: ReverseDcfInput): ReverseDcfSolve {
  const notSolved = (figure: Figure<Decimal>): ReverseDcfSolve => ({
    rate: input.rate,
    fiveYearGrowth: figure,
    tenYearCagr: figure,
    year10Revenue: figure,
    heldAt: input.heldDrivers,
  });

  const missing = [
    input.baseYearRevenue === null ? "baseYearRevenue" : null,
    input.targetEnterpriseValue === null ? "targetEnterpriseValue" : null,
    input.nopatTaxRate === null ? "nopatTaxRate (§7.1, unconfigured policy constant)" : null,
  ].filter((f): f is string => f !== null);
  if (missing.length > 0) {
    return notSolved(suppressedValue("INCOMPLETE", `missing REQUIRED input(s): ${missing.join(", ")}`));
  }
  if (input.heldDrivers === null) {
    return notSolved(suppressedValue("INCOMPLETE", input.heldDriversMissing ?? "the base scenario's drivers are not adopted"));
  }

  const baseRevenue = input.baseYearRevenue as SourcedValue<Decimal>;
  const target = input.targetEnterpriseValue as SourcedValue<Decimal>;
  const held = input.heldDrivers;
  const project = (g: Decimal) =>
    projectReverseDcfValue(
      g,
      held.operatingMargin,
      held.returnOnNewInvestment,
      held.terminalReturnOnNewCapital,
      input.rate,
      baseRevenue.value,
      input.nopatTaxRate as Decimal,
      POLICY.terminalGrowth,
      input.stubYears ?? new Decimal(0),
      { runwayYears: held.runwayYears, yearOne: held.yearOne ?? null },
      held.marginPath
    );
  const provenance = combineProvenance(baseRevenue.provenance, target.provenance);

  const result = solveImpliedGrowth(project, target.value);
  if (result.kind === "no-solution") {
    return notSolved(
      suppressedValue(
        "NO SOLUTION IN RANGE",
        `bracket [${result.lo.toFixed(2)}, ${result.hi.toFixed(2)}], value at bracket ends: ${result.evAtLo.toFixed(0)}, ${result.evAtHi.toFixed(0)}`
      )
    );
  }
  if (result.kind === "not-monotone") {
    return notSolved(suppressedValue("NOT COMPUTABLE", "value function not monotone in growth across the bracket"));
  }
  if (result.kind === "degenerate-terminal") {
    return notSolved(
      suppressedValue("DEGENERATE — TERMINAL EXCEEDS TOTAL VALUE", `terminal share ${result.terminalSharePercent.toFixed(0)}%`)
    );
  }
  return {
    rate: input.rate,
    fiveYearGrowth: computedValue(result.growth, provenance),
    tenYearCagr: computedValue(result.projection.tenYearCagr, provenance),
    year10Revenue: computedValue(result.projection.year10Revenue, provenance),
    heldAt: held,
  };
}

// --- valuation and solver -------------------------------------------------

export interface ReverseDcfProjection {
  ev: Decimal;
  terminalValuePV: Decimal;
  tenYearCagr: Decimal;
  year10Revenue: Decimal;
}

// The main engine at a given constant years-1–5 growth — exported for the
// round-trip and invariant tests and for a "show calculation" disclosure.
export function projectReverseDcfValue(
  growth: Decimal,
  margin: Decimal,
  returnOnNewInvestment: Decimal,
  terminalReturnOnNewCapital: Decimal,
  rate: Decimal,
  baseRevenue: Decimal,
  nopatTaxRate: Decimal,
  terminalGrowth: Decimal = POLICY.terminalGrowth,
  stubYears: Decimal = new Decimal(0),
  options: ScenarioValuationOptions = {},
  marginPath?: Decimal[]
): ReverseDcfProjection {
  const valuation = computeScenarioValuation(
    baseRevenue,
    buildFixedShapeGrowthPath(growth, terminalGrowth),
    marginPath ?? margin,
    returnOnNewInvestment,
    terminalReturnOnNewCapital,
    rate,
    nopatTaxRate,
    terminalGrowth,
    stubYears,
    options
  );
  const tenYearCagr = valuation.year10Revenue.dividedBy(baseRevenue).pow(new Decimal(1).dividedBy(10)).minus(1);
  return {
    ev: valuation.enterpriseValue,
    terminalValuePV: valuation.terminalValuePv,
    tenYearCagr,
    year10Revenue: valuation.year10Revenue,
  };
}

type SolveResult =
  | { kind: "solved"; growth: Decimal; projection: ReverseDcfProjection }
  | { kind: "no-solution"; lo: Decimal; hi: Decimal; evAtLo: Decimal; evAtHi: Decimal }
  | { kind: "not-monotone" }
  | { kind: "degenerate-terminal"; terminalSharePercent: Decimal };

function solveImpliedGrowth(project: (g: Decimal) => ReverseDcfProjection, targetEnterpriseValue: Decimal): SolveResult {
  const samples: Decimal[] = [];
  for (let i = 0; i <= MONOTONICITY_SAMPLE_COUNT; i++) {
    const g = GROWTH_SEARCH_LO.plus(GROWTH_SEARCH_HI.minus(GROWTH_SEARCH_LO).mul(i).dividedBy(MONOTONICITY_SAMPLE_COUNT));
    samples.push(project(g).ev);
  }

  let increasing = true;
  let decreasing = true;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].lessThan(samples[i - 1])) increasing = false;
    if (samples[i].greaterThan(samples[i - 1])) decreasing = false;
  }
  if (!increasing && !decreasing) return { kind: "not-monotone" };

  const evAtLo = samples[0];
  const evAtHi = samples[samples.length - 1];
  const loDiff = evAtLo.minus(targetEnterpriseValue);
  const hiDiff = evAtHi.minus(targetEnterpriseValue);
  if (loDiff.mul(hiDiff).greaterThan(0)) {
    return { kind: "no-solution", lo: GROWTH_SEARCH_LO, hi: GROWTH_SEARCH_HI, evAtLo, evAtHi };
  }

  let lo = GROWTH_SEARCH_LO;
  let hi = GROWTH_SEARCH_HI;
  for (let iter = 0; iter < BISECTION_ITERATIONS; iter++) {
    const mid = lo.plus(hi.minus(lo).dividedBy(2));
    const midDiff = project(mid).ev.minus(targetEnterpriseValue);
    // Same sign as the low end ⇒ the root is above mid.
    if (midDiff.isZero() ? false : midDiff.greaterThan(0) === loDiff.greaterThan(0)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const growth = lo.plus(hi).dividedBy(2);
  const projection = project(growth);
  const terminalSharePercent = projection.terminalValuePV.dividedBy(projection.ev).mul(100);
  if (terminalSharePercent.greaterThan(100)) return { kind: "degenerate-terminal", terminalSharePercent };
  return { kind: "solved", growth, projection };
}
