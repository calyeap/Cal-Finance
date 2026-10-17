import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { projectReverseDcfValue } from "../modules/reverseDcf";
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
// The other two named REDs live in valuationInvariants.test.ts: "RONIC = r
// growth-invariance fails" and the r+3pp terminal (via the Gordon and
// terminal ÷ year-10 FCF invariants). The direct r+3pp fallback RED is below.

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

describe("RED — profile band not applied (D1 / AR0-1, built by AR4)", () => {
  // D1: stable businesses at the market's expected return; cyclical
  // industries (SEC SIC code) at market + 2pp. assemble.ts values every
  // company at the single constant POLICY.rateGrid[1] (steady-state EV,
  // scenario DCF) whatever its industry, so a steel company and a software
  // company with identical fundamentals get identical values.
  const stable = assembleAnalysisResult(MSFT_FIXTURE);
  const asSteel = assembleAnalysisResult({
    ...MSFT_FIXTURE,
    marketContext: { sic: "3312", sicDescription: "Steel Works, Blast Furnaces & Rolling Mills (Coke Ovens)" },
  });

  it.fails("a cyclical-SIC company is valued at a higher rate than the same company classified stable — its steady-state EV is lower", () => {
    expect(stable.priceImplied.steadyStateEv.suppressed).toBe(false);
    expect(asSteel.priceImplied.steadyStateEv.suppressed).toBe(false);
    if (stable.priceImplied.steadyStateEv.suppressed || asSteel.priceImplied.steadyStateEv.suppressed) return;
    expect(asSteel.priceImplied.steadyStateEv.value.lessThan(stable.priceImplied.steadyStateEv.value)).toBe(true);
  });

  it("MECHANISM — both are valued at the same POLICY.rateGrid[1], so steady-state EV is identical", () => {
    if (stable.priceImplied.steadyStateEv.suppressed || asSteel.priceImplied.steadyStateEv.suppressed) {
      throw new Error("steady-state EV unexpectedly suppressed — the RED above would be failing for the wrong reason");
    }
    expect(asSteel.priceImplied.steadyStateEv.value.toString()).toBe(stable.priceImplied.steadyStateEv.value.toString());
  });
});

describe("RED — end-of-year timing with no stub (D2 / AR0-3: mid-year timing, terminal at 9.5 years, valued at the price date; built by AR3)", () => {
  // Zero growth and zero terminal growth make the closed form exact: with
  // cash flows at t − 0.5 and the terminal at 9.5 years, EV = NOPAT ÷ r ×
  // (1 + r)^0.5. End-of-year discounting (cash flows at t, terminal at 10)
  // gives NOPAT ÷ r exactly, about 4.9% low at r = 10%.
  //
  // The stub half of this RED (valuing at the price date rather than at the
  // base fiscal year end) cannot be expressed as a test against today's code:
  // neither projectReverseDcfValue nor computeScenarioEnterpriseValue takes a
  // valuation date or a base-period end at all. It needs that input added to
  // modules/reverseDcf.ts and modules/scenarioOutputs.ts (AR3); its RED is
  // the mid-year one below, which the same change must turn GREEN.
  //
  // Note for AR3: valuationInvariants.test.ts's "zero growth ⇒ EV = NOPAT ÷ r"
  // encodes end-of-year timing. Under mid-year timing that identity becomes
  // EV = NOPAT ÷ r × (1 + r)^0.5, so AR3 updates it in the same change as a
  // reviewed evaluator change.
  const midYear = NOPAT.dividedBy(RATE).mul(D(1).plus(RATE).sqrt());

  it.fails("diagnostic reverse DCF (M7): zero-growth EV = NOPAT ÷ r × (1 + r)^0.5", () => {
    const ev = projectReverseDcfValue(D(0), MARGIN, D("0.3"), RATE, BASE_REVENUE, TAX, D(0)).ev;
    expect(ev.minus(midYear).abs().toNumber()).toBeLessThan(1e-6);
  });

  it.fails("scenario DCF (M15): zero-growth, zero-reinvestment EV = NOPAT ÷ r × (1 + r)^0.5", () => {
    const ev = computeScenarioEnterpriseValue(BASE_REVENUE, flatPath(D(0)), MARGIN, D(0), RATE, TAX, D(0));
    expect(ev.minus(midYear).abs().toNumber()).toBeLessThan(1e-6);
  });

  it("MECHANISM — both engines discount at whole years: zero-growth EV is exactly NOPAT ÷ r", () => {
    const m7 = projectReverseDcfValue(D(0), MARGIN, D("0.3"), RATE, BASE_REVENUE, TAX, D(0)).ev;
    const m15 = computeScenarioEnterpriseValue(BASE_REVENUE, flatPath(D(0)), MARGIN, D(0), RATE, TAX, D(0));
    expect(m7.minus(NOPAT.dividedBy(RATE)).abs().toNumber()).toBeLessThan(1e-6);
    expect(m15.minus(NOPAT.dividedBy(RATE)).abs().toNumber()).toBeLessThan(1e-6);
  });
});

describe("RED — terminal share never computed (M8, built by AR3)", () => {
  // assemble.ts reads terminal share from fixture.terminalValuePv, which no
  // fixture and no acquired run supplies (null for MSFT, OKLO and every
  // acquired run) — and falls back to a literal 0 instead of computing it
  // from the scenario DCF it has just valued. Any DCF with g < r and a
  // positive terminal FCF has a strictly positive terminal share.
  const result = assembleAnalysisResult(MSFT_FIXTURE);

  it.fails("MSFT's terminal share of value is computed from its own valued DCF — strictly between 0 and 1", () => {
    const share = result.diagnostics.terminal.terminalShareOfValue;
    expect(share.greaterThan(0)).toBe(true);
    expect(share.lessThan(1)).toBe(true);
  });

  it("MECHANISM — no terminal PV is supplied, and the reported share is the literal 0 fallback", () => {
    expect(MSFT_FIXTURE.terminalValuePv).toBeNull();
    expect(result.diagnostics.terminal.terminalShareOfValue.toString()).toBe("0");
  });
});

describe("RED — unconfirmed facts used (built by AR3: gating of contradicted / unconfirmed facts)", () => {
  // A fact whose verification state is NOT CONFIRMED (a human has not
  // confirmed it, or it failed a cross-check) still feeds value: the M1
  // bridge computes enterprise value from it and only carries the weaker
  // provenance along. The RED asserts the gate the master-plan audit names
  // (no value computed from an unconfirmed REQUIRED input); AR3 decides the
  // exact suppression state, so this asserts only that no figure is issued.
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

  it.fails("enterprise value is not issued from a NOT CONFIRMED total-debt fact", () => {
    expect(computeEnterpriseValue(input).suppressed).toBe(true);
  });

  it("MECHANISM — EV is computed (5430) and merely carries NOT CONFIRMED provenance", () => {
    const ev = computeEnterpriseValue(input);
    expect(ev.suppressed).toBe(false);
    if (ev.suppressed) return;
    expect(ev.value.enterpriseValue.toString()).toBe("5430");
    expect(ev.qualification.provenanceTokens.verificationState).toBe("NOT CONFIRMED");
  });
});

describe("RED — runs not reproducible (AR0-5 / §10.6.2 rule 1, built by AR3)", () => {
  // AR0-5: the same fact snapshot, adopted assumption sheet, policy version,
  // code version and recorded judgements always produce the same verdict.
  // Today a report load re-runs computeAnalysisForRun (gate.ts), which
  // re-fetches facts and price, and neither the AnalysisResult nor the
  // stored run/snapshot records which policy version or code version
  // produced it — so no two runs can be shown to share that tuple.
  //
  // The pure engine IS deterministic (valuationInvariants.test.ts's
  // reproducibility check passes); the defect is the missing run identity.
  // Key names are AR3's choice, so this matches on any key naming a policy
  // version and any naming a code version/SHA.
  const result = assembleAnalysisResult(MSFT_FIXTURE);
  const keyPaths = (value: unknown, prefix = ""): string[] => {
    if (value === null || typeof value !== "object" || Decimal.isDecimal(value)) return [];
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [`${prefix}${k}`, ...keyPaths(v, `${prefix}${k}.`)]);
  };
  const keys = keyPaths(result);

  it.fails("the AnalysisResult records the policy version and code version it was computed under", () => {
    expect(keys.some((k) => /policy\.?version/i.test(k))).toBe(true);
    expect(keys.some((k) => /code\.?(version|sha)/i.test(k))).toBe(true);
  });

  it("MECHANISM — no key in the assembled result names a policy version or a code version", () => {
    expect(keys.length).toBeGreaterThan(100); // the walk really reached the result's contents
    expect(keys.filter((k) => /policy\.?version|code\.?(version|sha)/i.test(k))).toEqual([]);
  });
});

describe("RED — reinvestment unlinked to growth (D2 / AR0-3: reinvestment = NOPAT × growth ÷ RONIC; built by AR4)", () => {
  // The scenario DCF (M15) subtracts revenue × an analyst capital-intensity
  // figure every year, whatever the growth rate. Under D2 reinvestment is
  // NOPAT × g ÷ RONIC, so a zero-growth company reinvests nothing and its
  // value is NOPAT ÷ r (end-of-year timing here, so this RED is independent
  // of the timing RED above). M7's own reinvestment IS growth-linked — this
  // defect is M15's.
  const intensity = D("0.05");

  it.fails("scenario DCF: zero growth ⇒ zero reinvestment ⇒ EV = NOPAT ÷ r, whatever capital intensity was entered", () => {
    const ev = computeScenarioEnterpriseValue(BASE_REVENUE, flatPath(D(0)), MARGIN, intensity, RATE, TAX, D(0));
    expect(ev.minus(NOPAT.dividedBy(RATE)).abs().toNumber()).toBeLessThan(1e-6);
  });

  it("MECHANISM — explicit years subtract revenue × intensity at zero growth: EV is exactly the closed form with that drag", () => {
    const ev = computeScenarioEnterpriseValue(BASE_REVENUE, flatPath(D(0)), MARGIN, intensity, RATE, TAX, D(0));
    const fcf = NOPAT.minus(BASE_REVENUE.mul(intensity)); // 270 for years 1-10
    const annuity = D(1).minus(D(1).plus(RATE).pow(-10)).dividedBy(RATE);
    const terminalPv = NOPAT.dividedBy(RATE).dividedBy(D(1).plus(RATE).pow(10)); // terminal reinvestment = g/ROIC × NOPAT = 0
    expect(ev.minus(fcf.mul(annuity).plus(terminalPv)).abs().toNumber()).toBeLessThan(1e-6);
  });
});

describe("RED — non-MSFT tickers use the reverse-DCF-only r + 3pp terminal (D2 / AR0-2, AR0-3; built by AR4)", () => {
  // D2: the terminal return on new capital is the rate plus the moat credit
  // (+0 / +1 / +3pp for none / narrow / wide). Only a recorded bundle that
  // carries its own terminalRoic (MSFT's) escapes it; every other ticker's
  // scenario DCF silently falls back to r + 3pp — the wide-moat credit, by
  // default, for every company. The RED asserts only that the fallback is
  // not that silent wide-moat value; which default replaces it is AR4's.
  const g = D("0.08");
  const tg = POLICY.terminalGrowth;

  it.fails("a scenario DCF with no terminal ROIC supplied is not valued at the wide-moat r + 3pp terminal", () => {
    const fallback = computeScenarioEnterpriseValue(BASE_REVENUE, flatPath(g), MARGIN, D("0.05"), RATE, TAX, tg);
    const wideMoat = computeScenarioEnterpriseValue(BASE_REVENUE, flatPath(g), MARGIN, D("0.05"), RATE, TAX, tg, RATE.plus(D("0.03")));
    expect(fallback.equals(wideMoat)).toBe(false);
  });

  it("MECHANISM — the fallback equals the value at terminal ROIC = r + POLICY.terminalRoicPremium (3pp) exactly", () => {
    const fallback = computeScenarioEnterpriseValue(BASE_REVENUE, flatPath(g), MARGIN, D("0.05"), RATE, TAX, tg);
    const explicit = computeScenarioEnterpriseValue(BASE_REVENUE, flatPath(g), MARGIN, D("0.05"), RATE, TAX, tg, RATE.plus(POLICY.terminalRoicPremium));
    expect(POLICY.terminalRoicPremium.toString()).toBe("0.03");
    expect(fallback.toString()).toBe(explicit.toString());
  });
});
