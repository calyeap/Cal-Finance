import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { projectReverseDcfValue, solveReverseDcf } from "../modules/reverseDcf";
import { computeScenarioValuation } from "../modules/scenarioOutputs";
import { buildFixedShapeGrowthPath } from "../growthPath";
import { CLEAN_PROVENANCE } from "../provenance";
import { POLICY } from "../policy";
import msft from "./msft.json";

// CF-AR2-GOLDEN-HARNESS-01, DO item 4 — closed-form invariants, run for
// real against the REAL exported reverseDcf.ts functions (never a second,
// re-implemented copy of the formula). Every `it`/`it.fails` choice below
// was decided by actually running the file (`npx vitest run
// lib/analyzer/golden/valuationInvariants.test.ts`) and reading the
// result — never by prediction alone; see each block's comment for what
// was actually observed and why.
//
// `it.fails` is vitest's real, documented feature (confirmed by using it
// successfully below) — grepping the repo before this outcome confirms it
// was not used anywhere in this codebase before this file.

function D(n: string | number): Decimal {
  return new Decimal(n);
}

// CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — reviewed evaluator change: M7 and
// M15 are one engine on Methodology v2.1 D2, and projectReverseDcfValue now
// takes the terminal return on new capital as an explicit argument (the
// rate plus the moat credit) where it used to hard-code r + 3pp. Each call
// below passes it; the REDs this file recorded against the r + 3pp terminal
// and the unlinked growth are GREEN and asserted as plain `it`.

// CF-AR3-REPRODUCIBLE-RUNS-01 — reviewed evaluator change, as AR2's
// knownReds.test.ts note asked of AR3: under Methodology v2.1 D2's mid-year
// timing (cash flows at t − 0.5, terminal at 9.5 years) every perpetuity
// identity below carries a (1 + r)^0.5 factor. The identities themselves are
// unchanged; only the timing they are evaluated under moved.
describe("INVARIANT — zero growth and zero terminal growth: EV = NOPAT ÷ r × (1 + r)^0.5 (DO item 2; mid-year timing since AR3)", () => {
  it("holds exactly — a flat perpetuity decomposes exactly into the 10-year explicit annuity plus its own terminal continuation, so this is a genuine identity of the formula, not an approximation", () => {
    const margin = D("0.4");
    const ronic = D("0.3"); // irrelevant at g=0: reinvestment = nopat * 0 / ronic = 0 regardless of ronic
    const rate = D("0.1");
    const baseRevenue = D(1000);
    const taxRate = D("0.2");

    const result = projectReverseDcfValue(D(0), margin, ronic, rate, rate, baseRevenue, taxRate, D(0));
    const nopat = baseRevenue.mul(margin).mul(D(1).minus(taxRate));
    const expected = nopat.dividedBy(rate).mul(D(1).plus(rate).sqrt());

    expect(result.ev.minus(expected).abs().toNumber()).toBeLessThan(1e-6);
  });
});

describe("INVARIANT — single-stage Gordon equivalence for constant growth from year 1 (growth = terminalGrowth = g < r) (DO item 2)", () => {
  // AR2 recorded this RED: years 1–10 reinvested at the company's RONIC but
  // the terminal segment always used rate + 3pp, so the engine diverged from
  // the textbook Gordon value by ~9%. Under D2 the return on new investment
  // fades to the terminal return by year 10, and the terminal return is an
  // explicit argument: where they are equal the engine IS the Gordon value.
  it("holds exactly when the return on new investment equals the terminal return — at MSFT's 17.8% trailing RONIC", () => {
    const margin = D("0.4");
    const ronic = D("0.178"); // MSFT's real 5-year trailing RONIC, per the existing reverseDcf.test.ts GOLDEN fixture
    const rate = D("0.1");
    const baseRevenue = D(1000);
    const taxRate = D("0.2");
    const g = D("0.05"); // < rate, well inside the solver's economically plausible range

    const engine = projectReverseDcfValue(g, margin, ronic, ronic, rate, baseRevenue, taxRate, g);

    // Independent, textbook single-stage Gordon value — computed directly
    // in this test, NOT by calling any reverseDcf.ts internal.
    const nopat1 = baseRevenue.mul(D(1).plus(g)).mul(margin).mul(D(1).minus(taxRate));
    const fcff1 = nopat1.mul(D(1).minus(g.dividedBy(ronic)));
    const gordonEv = fcff1.dividedBy(rate.minus(g)).mul(D(1).plus(rate).sqrt()); // mid-year (AR3)

    expect(engine.ev.minus(gordonEv).abs().toNumber()).toBeLessThan(1e-6);
  });

  it("holds exactly at every D2 terminal return — rate + 0 / 1 / 3pp", () => {
    const margin = D("0.4");
    const rate = D("0.1");
    const baseRevenue = D(1000);
    const taxRate = D("0.2");
    const g = D("0.05");
    for (const credit of [POLICY.moatCredit.none, POLICY.moatCredit.narrow, POLICY.moatCredit.wide]) {
      const terminal = rate.plus(credit);
      const engine = projectReverseDcfValue(g, margin, terminal, terminal, rate, baseRevenue, taxRate, g);
      const nopat1 = baseRevenue.mul(D(1).plus(g)).mul(margin).mul(D(1).minus(taxRate));
      const gordonEv = nopat1.mul(D(1).minus(g.dividedBy(terminal))).dividedBy(rate.minus(g)).mul(D(1).plus(rate).sqrt());
      expect(engine.ev.minus(gordonEv).abs().toNumber()).toBeLessThan(1e-6);
    }
  });
});

describe("INVARIANT — RONIC = r ⇒ value independent of growth (DO item 2's own 'fails today' parenthetical)", () => {
  // AR2 recorded this RED. Under D2 every dollar of new investment that
  // earns exactly the rate has zero net present value, so growth adds
  // nothing. D2's timing fixes what that means exactly: this year's
  // investment funds next year's growth, so year 1's growth was funded by
  // the base year's investment — already made and not in the valuation
  // (funding it again would double-count the base year's capex). What growth
  // cannot change is therefore the value of year-1 NOPAT as a perpetuity:
  //   EV = NOPAT_1 ÷ r × (1 + r)^0.5, for ANY growth path,
  // exactly. Reviewed evaluator change: the AR2 assertion compared constant-
  // growth paths with different year-1 NOPAT and a loose 0-decimal tolerance;
  // this asserts the exact identity, which is the same claim stated under
  // D2's timing, across paths that do and do not share year 1.
  const margin = D("0.4");
  const rate = D("0.1");
  const baseRevenue = D(1000);
  const taxRate = D("0.2");
  const nopat0 = baseRevenue.mul(margin).mul(D(1).minus(taxRate));

  it.each(["0", "0.05", "0.08", "0.12", "0.25"])("constant growth %s from year 1: EV = NOPAT_1 ÷ r × (1 + r)^0.5 exactly", (gText) => {
    const g = D(gText);
    const ev = projectReverseDcfValue(g, margin, rate, rate, rate, baseRevenue, taxRate).ev;
    const expected = nopat0.mul(D(1).plus(g)).dividedBy(rate).mul(D(1).plus(rate).sqrt());
    expect(ev.minus(expected).abs().dividedBy(expected).toNumber()).toBeLessThan(1e-15);
  });

  it("paths that share year 1 and differ after it value identically", () => {
    const year1 = D("0.10");
    const slow = [year1, ...Array.from({ length: 9 }, () => D("0.02"))];
    const fast = [year1, ...Array.from({ length: 9 }, () => D("0.30"))];
    const at = (path: Decimal[]) => computeScenarioValuation(baseRevenue, path, margin, rate, rate, rate, taxRate).enterpriseValue;
    expect(at(slow).minus(at(fast)).abs().dividedBy(at(slow)).toNumber()).toBeLessThan(1e-15);
  });
});

describe("INVARIANT — reverse-DCF round-trips to the price it was generated from (DO item 2)", () => {
  it("recovers the exact same growth rate — via the real public solver entry point (solveReverseDcf), not a re-implemented solver", () => {
    const margin = D("0.4");
    const ronic = D("0.3");
    const rate = D("0.1");
    const terminal = D("0.11");
    const baseRevenue = D(1000);
    const taxRate = D("0.2");
    const knownGrowth = D("0.12");

    const known = projectReverseDcfValue(knownGrowth, margin, ronic, terminal, rate, baseRevenue, taxRate);

    const solve = solveReverseDcf({
      baseYearRevenue: { value: baseRevenue, provenance: CLEAN_PROVENANCE },
      targetEnterpriseValue: { value: known.ev, provenance: CLEAN_PROVENANCE },
      rate,
      nopatTaxRate: taxRate,
      heldDrivers: { operatingMargin: margin, returnOnNewInvestment: ronic, terminalReturnOnNewCapital: terminal },
      heldDriversMissing: null,
    });

    expect(solve.fiveYearGrowth.suppressed).toBe(false);
    if (!solve.fiveYearGrowth.suppressed) {
      expect(solve.fiveYearGrowth.value.toNumber()).toBeCloseTo(knownGrowth.toNumber(), 3);
    }
  });
});

describe("INVARIANT — terminal ÷ year-10 FCF within 0.95-1.10 (DO item 2)", () => {
  // AR2 recorded a RED at the old 8% cell: MSFT's 17.8% RONIC in years 1–10
  // against an r + 3pp terminal put terminal FCF ~10% below year-10 FCF.
  // Under D2 the return on new investment fades to the terminal return by
  // year 10, so year 10 already reinvests at terminal economics and the
  // ratio is exactly 1 + terminal growth whatever the rate, moat or RONIC.
  // MSFT here; COST and NVDA are checked against an independent oracle in
  // ar4Engine.test.ts.
  const margin = D("0.468");
  const baseRevenueBillions = D("331.839"); // msft.json's real FY2026 revenue, in $B
  const taxRate = D("0.2");
  const ronic = D("0.178"); // reused input (reverseDcf.test.ts GOLDEN fixture) — NOT re-derived, NOT this harness's own golden fact

  it.each(["0.085", "0.09", "0.095", "0.11"])("rate %s, every moat class: ratio = 1.03, inside [0.95, 1.10]", (rateText) => {
    const rate = D(rateText);
    for (const credit of [POLICY.moatCredit.none, POLICY.moatCredit.narrow, POLICY.moatCredit.wide]) {
      const v = computeScenarioValuation(baseRevenueBillions, buildFixedShapeGrowthPath(D("0.10")), margin, ronic, rate.plus(credit), rate, taxRate);
      const ratio = v.terminalFcf.dividedBy(v.year10Fcf).toNumber();
      expect(ratio).toBeGreaterThanOrEqual(0.95);
      expect(ratio).toBeLessThanOrEqual(1.1);
      expect(ratio).toBeCloseTo(1 + POLICY.terminalGrowth.toNumber(), 12);
    }
  });

  it("is at least sanity-confirmed against the existing MSFT reference revenue figure, not a disconnected number", () => {
    expect(msft.facts.revenue?.value).toBe(331839000000);
  });
});

describe("INVARIANT — same fact snapshot + policy + code ⇒ identical outputs (reproducibility) (DO item 2)", () => {
  it("PASSES at the level of this pure deterministic function — byte-identical Decimal output across two calls with identical inputs", () => {
    const margin = D("0.4");
    const ronic = D("0.3");
    const rate = D("0.1");
    const baseRevenue = D(1000);
    const taxRate = D("0.2");

    const a = projectReverseDcfValue(D("0.1"), margin, ronic, rate, rate, baseRevenue, taxRate);
    const b = projectReverseDcfValue(D("0.1"), margin, ronic, rate, rate, baseRevenue, taxRate);

    expect(a.ev.toString()).toBe(b.ev.toString());
    expect(a.terminalValuePV.toString()).toBe(b.terminalValuePV.toString());
    expect(a.tenYearCagr.toString()).toBe(b.tenYearCagr.toString());
    expect(a.year10Revenue.toString()).toBe(b.year10Revenue.toString());
  });

  // IMPORTANT SCOPE NOTE, stated plainly rather than silently extrapolated:
  // this PASS is about `projectReverseDcfValue`/`solveReverseDcf`
  // alone — pure Decimal math over explicit arguments, with no I/O, no
  // wall-clock read, no randomness. The issue's own RED list separately
  // names "runs not reproducible" as an expected failure; that almost
  // certainly refers to a FULL system run (SEC acquisition timing, AI
  // drafting, policy-version resolution, snapshot/versioned-judgement
  // plumbing) — none of which this harness exercises, and none of which
  // this one passing test should be read as having cleared. Both things
  // are true at once: the core valuation formula is reproducible; the
  // full pipeline around it has not been shown to be, and this harness
  // does not have the tooling (AI calls, acquisition timing) to test that
  // claim one way or the other.
});
