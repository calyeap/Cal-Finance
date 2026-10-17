import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { projectReverseDcfValue } from "../modules/reverseDcf";
import type { CompanyFixture } from "../assemble";
import { computeScenarioEnterpriseValue } from "../modules/scenarioOutputs";
import { computeEnterpriseValue, type EnterpriseValueInput } from "../modules/enterpriseValue";
import { assembleAnalysisResult } from "../assemble";
import { MSFT_FIXTURE } from "../fixtures/msft";
import { CLEAN_PROVENANCE } from "../provenance";
import { POLICY } from "../policy";

// CF-AR2-GOLDEN-HARNESS-01, DO item 3 — the issue's named RED list, one
// `it.fails` per defect, each written as the behaviour the approved rule
// requires (Methodology v2.1 D1/D2, frozen spec §14.9 AR0-1..AR0-5) so it
// flips to a real failure — and must be converted to `it` — the moment its
// milestone fixes it.
//
// `it.fails` passes on ANY throw, so each RED is paired with a MECHANISM
// test that asserts, as a plain `it`, the exact defective behaviour the RED
// is failing on. A RED that started failing for some other reason (a typo, a
// renamed export) would leave its MECHANISM test red too. The MECHANISM tests
// describe today's defect, not a ruling: the milestone that fixes a RED
// deletes its MECHANISM test in the same change (test-transition list: "pins
// a defect — delete with the fix").
//
// CF-AR3-REPRODUCIBLE-RUNS-01 turned four of these GREEN — mid-year timing,
// terminal share, unconfirmed-fact gating and run identity.
// CF-AR4-RATE-REINVESTMENT-TERMINAL-01 turned the remaining three GREEN —
// the D1 profile band, D2's growth-linked reinvestment and the r + 3pp
// fallback. Each is now a plain `it` asserting the approved rule, and its
// MECHANISM test is deleted with the fix, as above.
//
// The other two named REDs live in valuationInvariants.test.ts: "RONIC = r
// growth-invariance fails" and the r+3pp terminal (via the Gordon and
// terminal ÷ year-10 FCF invariants); AR4 turned those GREEN there.

function D(n: string | number): Decimal {
  return new Decimal(n);
}

const MARGIN = D("0.4");
const RATE = D("0.1");
const BASE_REVENUE = D(1000);
const TAX = D("0.2");
const NOPAT = BASE_REVENUE.mul(MARGIN).mul(D(1).minus(TAX)); // 320, flat at zero growth

function flatPath(g: Decimal): Decimal[] {
  return Array.from({ length: 10 }, () => g);
}

describe("GREEN (AR4) — profile band applied (D1 / AR0-1)", () => {
  // D1: stable businesses at the market's expected return; cyclical
  // industries (SEC SIC code) at market + 2pp. assemble.ts used to value
  // every company at the single constant POLICY.rateGrid[1]; it now values
  // each at its own D1 rate (discountRate.ts).
  const stable = assembleAnalysisResult(MSFT_FIXTURE);
  const asSteel = assembleAnalysisResult({
    ...MSFT_FIXTURE,
    marketContext: { sic: "3312", sicDescription: "Steel Works, Blast Furnaces & Rolling Mills (Coke Ovens)" },
  });

  it("a cyclical-SIC company is valued at a higher rate than the same company classified stable — its steady-state EV is lower", () => {
    expect(stable.priceImplied.steadyStateEv.suppressed).toBe(false);
    expect(asSteel.priceImplied.steadyStateEv.suppressed).toBe(false);
    if (stable.priceImplied.steadyStateEv.suppressed || asSteel.priceImplied.steadyStateEv.suppressed) return;
    expect(asSteel.priceImplied.steadyStateEv.value.lessThan(stable.priceImplied.steadyStateEv.value)).toBe(true);
  });
});

describe("GREEN (AR3) — mid-year timing, terminal at 9.5 years, valued at the price date (D2 / AR0-3)", () => {
  // Zero growth and zero terminal growth make the closed form exact: with
  // cash flows at t − 0.5 and the terminal at 9.5 years, EV = NOPAT ÷ r ×
  // (1 + r)^0.5. End-of-year discounting gave NOPAT ÷ r exactly, about 4.9%
  // low at r = 10%. The price-date half (a stub from the base period end to
  // the price date) is lib/analyzer/valuationTiming.test.ts's.
  const midYear = NOPAT.dividedBy(RATE).mul(D(1).plus(RATE).sqrt());

  it("diagnostic reverse DCF (M7): zero-growth EV = NOPAT ÷ r × (1 + r)^0.5", () => {
    const ev = projectReverseDcfValue(D(0), MARGIN, D("0.3"), RATE, RATE, BASE_REVENUE, TAX, D(0)).ev;
    expect(ev.minus(midYear).abs().toNumber()).toBeLessThan(1e-6);
  });

  it("scenario DCF (M15): zero-growth, zero-reinvestment EV = NOPAT ÷ r × (1 + r)^0.5", () => {
    const ev = computeScenarioEnterpriseValue(BASE_REVENUE, flatPath(D(0)), MARGIN, D("0.3"), RATE, RATE, TAX, D(0));
    expect(ev.minus(midYear).abs().toNumber()).toBeLessThan(1e-6);
  });
});

describe("GREEN (AR3) — terminal share computed from the run's own DCF (M8)", () => {
  // assemble.ts used to read terminal share from a fixture-supplied terminal
  // PV that nothing supplied, falling back to a literal 0. It now values the
  // base scenario through M15 and reports that valuation's terminal share.
  // Any DCF with g < r and a positive terminal FCF has a strictly positive
  // terminal share.
  //
  // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — reviewed evaluator change: the
  // base DCF is now D2's, which needs a return on new investment per
  // scenario and a moat class. MSFT_FIXTURE's sheet has neither, so it is
  // pending adoption; the check runs on STATED HARNESS INPUTS (never a
  // recorded sheet), and the pending sheet is asserted to report no share —
  // NaN with its cause, never the old literal 0.
  const adopted: CompanyFixture = {
    ...MSFT_FIXTURE,
    scenarios: {
      bear: { ...MSFT_FIXTURE.scenarios.bear, returnOnNewInvestment: D("0.15") },
      base: { ...MSFT_FIXTURE.scenarios.base, returnOnNewInvestment: D("0.215") },
      bull: { ...MSFT_FIXTURE.scenarios.bull, returnOnNewInvestment: D("0.25") },
    },
    moatClass: "narrow",
  };
  const result = assembleAnalysisResult(adopted);

  it("MSFT's terminal share of value is computed from its own valued DCF — strictly between 0 and 1", () => {
    const share = result.diagnostics.terminal.terminalShareOfValue;
    expect(share.greaterThan(0)).toBe(true);
    expect(share.lessThan(1)).toBe(true);
  });

  it("a sheet pending adoption reports no terminal share — NaN with its cause bound, never a zero", () => {
    const pending = assembleAnalysisResult(MSFT_FIXTURE);
    expect(pending.diagnostics.terminal.terminalShareOfValue.isNaN()).toBe(true);
    expect(pending.states.suppressing.some((s) => /terminal share/i.test(s.appliesTo))).toBe(true);
  });
});

describe("GREEN (AR3) — unconfirmed facts gate what depends on them (R7)", () => {
  // A fact whose verification state is NOT CONFIRMED (a human has not
  // confirmed it, or it failed a cross-check) used to feed value: the M1
  // bridge computed enterprise value from it and only carried the weaker
  // provenance along. It is now refused (figures.ts computedValue); the
  // cascade to every dependent output is unconfirmedFactGating.test.ts's.
  const sourced = (value: number, verificationState: "CONFIRMED" | "NOT CONFIRMED" = "CONFIRMED") => ({
    value: D(value),
    provenance: { ...CLEAN_PROVENANCE, verificationState },
  });
  const input: EnterpriseValueInput = {
    sharesOutstanding: sourced(100),
    treasuryMethodDilution: sourced(10),
    price: sourced(50),
    totalDebt: sourced(200, "NOT CONFIRMED"),
    financeLeaseLiabilities: sourced(50),
    cashAndMarketableDebtSecurities: sourced(300),
    nonOperatingEquityInvestmentsAtBook: sourced(20),
    nonOperatingInvestmentsErrorDirection: null,
  };

  it("enterprise value is not issued from a NOT CONFIRMED total-debt fact", () => {
    expect(computeEnterpriseValue(input).suppressed).toBe(true);
  });
});

describe("GREEN (AR3) — runs carry their identity (AR0-5 / §10.6.2 rule 1)", () => {
  // AR0-5: the same fact snapshot, adopted assumption sheet, policy version,
  // code version and recorded judgements always produce the same verdict.
  // The AnalysisResult now records the policy version and code version (and
  // fingerprints of the rest) it was computed under; the stored-output
  // reproducibility proof is runOutputs.test.ts's. Key names are matched
  // loosely, as the RED was written before AR3 chose them.
  const result = assembleAnalysisResult(MSFT_FIXTURE);
  const keyPaths = (value: unknown, prefix = ""): string[] => {
    if (value === null || typeof value !== "object" || Decimal.isDecimal(value)) return [];
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [`${prefix}${k}`, ...keyPaths(v, `${prefix}${k}.`)]);
  };
  const keys = keyPaths(result);

  it("the AnalysisResult records the policy version and code version it was computed under", () => {
    expect(keys.some((k) => /policy\.?version/i.test(k))).toBe(true);
    expect(keys.some((k) => /code\.?(version|sha)/i.test(k))).toBe(true);
  });
});

describe("GREEN (AR4) — reinvestment linked to growth (D2 / AR0-3: reinvestment = NOPAT × growth ÷ RONIC)", () => {
  // The scenario DCF (M15) used to subtract revenue × an analyst
  // capital-intensity figure every year, whatever the growth rate. Under D2
  // reinvestment is NOPAT × g ÷ RONIC, so a zero-growth company reinvests
  // nothing and its value is the zero-growth closed form, NOPAT ÷ r × (1 +
  // r)^0.5 under the mid-year timing AR3 built — whatever return on new
  // investment is entered. Capital intensity no longer reaches the engine.
  it.each(["0.05", "0.15", "0.5"])("scenario DCF: zero growth ⇒ zero reinvestment ⇒ EV = NOPAT ÷ r × (1 + r)^0.5, at a return on new investment of %s", (ronic) => {
    const ev = computeScenarioEnterpriseValue(BASE_REVENUE, flatPath(D(0)), MARGIN, D(ronic), RATE, RATE, TAX, D(0));
    expect(ev.minus(NOPAT.dividedBy(RATE).mul(D(1).plus(RATE).sqrt())).abs().toNumber()).toBeLessThan(1e-6);
  });
});

describe("GREEN (AR4) — no silent r + 3pp terminal (D2 / AR0-2, AR0-3)", () => {
  // D2: the terminal return on new capital is the rate plus the moat credit
  // (+0 / +1 / +3pp for none / narrow / wide). Every non-MSFT ticker's
  // scenario DCF used to fall back silently to r + 3pp — the wide-moat
  // credit, by default. The engine now has no fallback: the terminal return
  // is a required argument, and a sheet with no moat class is pending
  // adoption — no D2 value at all — rather than valued at any default.
  const g = D("0.08");
  const tg = POLICY.terminalGrowth;

  it("the engine values the terminal at exactly the return it is given — r, r + 1pp and r + 3pp give three different values", () => {
    const at = (terminal: Decimal) => computeScenarioEnterpriseValue(BASE_REVENUE, flatPath(g), MARGIN, D("0.2"), terminal, RATE, TAX, tg);
    const none = at(RATE);
    const narrow = at(RATE.plus(POLICY.moatCredit.narrow));
    const wide = at(RATE.plus(POLICY.moatCredit.wide));
    expect(none.lessThan(narrow) && narrow.lessThan(wide)).toBe(true);
  });

  it("a recorded sheet with no moat class computes no scenario value — never the wide-moat value, never any default", () => {
    const sheet: CompanyFixture = {
      ...MSFT_FIXTURE,
      recordedScenarioValuesComputeFromDrivers: true,
      scenarios: {
        bear: { ...MSFT_FIXTURE.scenarios.bear, returnOnNewInvestment: D("0.15") },
        base: { ...MSFT_FIXTURE.scenarios.base, returnOnNewInvestment: D("0.2") },
        bull: { ...MSFT_FIXTURE.scenarios.bull, returnOnNewInvestment: D("0.25") },
      },
      moatClass: null,
    };
    const result = assembleAnalysisResult(sheet);
    expect(result.valuationBasis?.d2.status).toBe("PENDING ADOPTION");
    expect(result.valuationBasis?.d2.missing).toEqual(["moat class"]);
    expect(result.scenarioOutputs.values.base.isNaN()).toBe(true);
    expect(result.fairValueRange.kind).toBe("suppressed");
  });
});
