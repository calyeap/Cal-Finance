import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { projectReverseDcfValue, solveReverseDcf, type ReverseDcfInput } from "./reverseDcf";
import { computeScenarioEnterpriseValue } from "./scenarioOutputs";
import { buildFixedShapeGrowthPath } from "../growthPath";
import { CLEAN_PROVENANCE } from "../provenance";

// M7 — one reverse-DCF solve on the main engine (frozen spec §14.9 AR0-2,
// CF-AR4-RATE-REINVESTMENT-TERMINAL-01). The 8/10/12% × three-margin grid
// these tests used to cover is deleted; its per-cell state rules apply to
// the one solve, and its MSFT golden grid (the frozen v1.0.1 reference,
// end-of-year, r + 3pp terminal) is superseded by the master plan Part 4.4
// reproduction in golden/ar4Engine.test.ts.

function sourced(value: number) {
  return { value: new Decimal(value), provenance: CLEAN_PROVENANCE };
}

function D(n: string | number): Decimal {
  return new Decimal(n);
}

function baseInput(overrides: Partial<ReverseDcfInput> = {}): ReverseDcfInput {
  return {
    baseYearRevenue: sourced(1000),
    targetEnterpriseValue: sourced(5000),
    rate: D("0.1"),
    nopatTaxRate: D("0.2"),
    heldDrivers: { operatingMargin: D("0.4"), returnOnNewInvestment: D("0.3"), terminalReturnOnNewCapital: D("0.11") },
    heldDriversMissing: null,
    ...overrides,
  };
}

describe("projectReverseDcfValue — the round-trip check", () => {
  it("recovers the same growth rate the target EV was generated from", () => {
    for (const known of ["0.02", "0.12", "0.3"]) {
      const target = projectReverseDcfValue(D(known), D("0.4"), D("0.3"), D("0.11"), D("0.1"), D(1000), D("0.2")).ev;
      const solve = solveReverseDcf(baseInput({ targetEnterpriseValue: { value: target, provenance: CLEAN_PROVENANCE } }));
      expect(solve.fiveYearGrowth.suppressed).toBe(false);
      if (!solve.fiveYearGrowth.suppressed) expect(solve.fiveYearGrowth.value.toNumber()).toBeCloseTo(Number(known), 8);
    }
  });

  it("is the main engine at a fixed-shape growth path — not a second model", () => {
    const projection = projectReverseDcfValue(D("0.12"), D("0.4"), D("0.3"), D("0.11"), D("0.1"), D(1000), D("0.2"));
    const engine = computeScenarioEnterpriseValue(D(1000), buildFixedShapeGrowthPath(D("0.12")), D("0.4"), D("0.3"), D("0.11"), D("0.1"), D("0.2"));
    expect(projection.ev.toString()).toBe(engine.toString());
  });
});

describe("solveReverseDcf — structural contract", () => {
  it("always reports five-year growth, ten-year CAGR and year-10 revenue together — never one without the others", () => {
    const solve = solveReverseDcf(baseInput());
    expect(solve.fiveYearGrowth.suppressed).toBe(false);
    expect(solve.tenYearCagr.suppressed).toBe(false);
    expect(solve.year10Revenue.suppressed).toBe(false);
  });

  it("records the rate it solved at and the base-scenario drivers it held", () => {
    const solve = solveReverseDcf(baseInput());
    expect(solve.rate.toString()).toBe("0.1");
    expect(solve.heldAt?.returnOnNewInvestment.toString()).toBe("0.3");
    expect(solve.heldAt?.terminalReturnOnNewCapital.toString()).toBe("0.11");
  });

  it("returns NO SOLUTION IN RANGE when the target EV is unreachable within the search bracket", () => {
    const solve = solveReverseDcf(baseInput({ targetEnterpriseValue: sourced(1e9) }));
    expect(solve.fiveYearGrowth.suppressed && solve.fiveYearGrowth.state).toBe("NO SOLUTION IN RANGE");
  });

  it("returns NOT COMPUTABLE when the value function is not monotone across the bracket (return on new investment far below the rate)", () => {
    const solve = solveReverseDcf(
      baseInput({ heldDrivers: { operatingMargin: D("0.4"), returnOnNewInvestment: D("0.02"), terminalReturnOnNewCapital: D("0.11") } })
    );
    expect(solve.fiveYearGrowth.suppressed && solve.fiveYearGrowth.state).toBe("NOT COMPUTABLE");
  });

  it("returns DEGENERATE — TERMINAL EXCEEDS TOTAL VALUE when the solved growth implies terminal share over 100%", () => {
    const solve = solveReverseDcf(
      baseInput({
        targetEnterpriseValue: sourced(20000),
        heldDrivers: { operatingMargin: D("0.4"), returnOnNewInvestment: D("0.15"), terminalReturnOnNewCapital: D("0.5") },
      })
    );
    expect(solve.fiveYearGrowth.suppressed && solve.fiveYearGrowth.state).toBe("DEGENERATE — TERMINAL EXCEEDS TOTAL VALUE");
  });
});

describe("solveReverseDcf — missing REQUIRED inputs", () => {
  it.each([
    ["base year revenue", { baseYearRevenue: null }, /baseYearRevenue/],
    ["target EV", { targetEnterpriseValue: null }, /targetEnterpriseValue/],
    ["the NOPAT tax rate (§7.1)", { nopatTaxRate: null }, /nopatTaxRate/],
  ] as const)("returns INCOMPLETE when %s is missing", (_label, override, cause) => {
    const solve = solveReverseDcf(baseInput(override as Partial<ReverseDcfInput>));
    expect(solve.fiveYearGrowth.suppressed && solve.fiveYearGrowth.state).toBe("INCOMPLETE");
    expect(solve.fiveYearGrowth.suppressed && solve.fiveYearGrowth.cause).toMatch(cause);
  });

  it("returns INCOMPLETE with the caller's cause when the base scenario's D2 drivers are not adopted — never solving on defaults", () => {
    const solve = solveReverseDcf(baseInput({ heldDrivers: null, heldDriversMissing: "Pending adoption: no moat class" }));
    expect(solve.fiveYearGrowth.suppressed && solve.fiveYearGrowth.state).toBe("INCOMPLETE");
    expect(solve.fiveYearGrowth.suppressed && solve.fiveYearGrowth.cause).toBe("Pending adoption: no moat class");
    expect(solve.heldAt).toBeNull();
  });
});
