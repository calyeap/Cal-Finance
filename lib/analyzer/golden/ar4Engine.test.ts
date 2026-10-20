import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { computeScenarioValuation, computeScenarioEnterpriseValue, solveRateForTargetValue } from "../modules/scenarioOutputs";
import { solveReverseDcf } from "../modules/reverseDcf";
import { computeEnterpriseValue, type EnterpriseValueInput } from "../modules/enterpriseValue";
import { buildFixedShapeGrowthPath } from "../growthPath";
import { returnRunwayYears, selectDiscountRate, terminalReturnOnNewCapital } from "../discountRate";
import { stubYearsBetween } from "../valuationTiming";
import { POLICY } from "../policy";
import { CLEAN_PROVENANCE } from "../provenance";
import type { MoatClass, Profile } from "../types";
import msft from "./msft.json";
import cost from "./cost.json";
import nvda from "./nvda.json";
import ko from "./ko.json";
import lly from "./lly.json";
import nue from "./nue.json";
import oklo from "./oklo.json";

// The §6.5 leverage result selectDiscountRate reads (CF-LEG2-RATE-DOMAIN-COPY-01
// replaced its boolean `leveragePass` input with the result itself, so the
// rate's domain can tell "measured at or above 10%" from "not measured").
const LEVERAGE_PASS = { result: "PASS" as const, netDebtRatio: new Decimal("0.02") };
const LEVERAGE_MEASURED_ABOVE = { result: "LEVERAGE UNSUPPORTED IN v1" as const, netDebtRatio: new Decimal("0.25") };
const LEVERAGE_NOT_MEASURED = { result: "LEVERAGE UNSUPPORTED IN v1" as const, netDebtRatio: null };

// CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — the issue's VERIFY, run against the
// real engine: Methodology v2.1 D1 (rate) and D2 (reinvestment, terminal),
// one reverse-DCF solve on the main engine, the expected return, and the R5
// bridge flags.
//
// Every driver below is a STATED TEST INPUT inside this harness. None is
// written to a recorded assumption sheet: the Part 4.4 inputs are the master
// plan's own stated 16 Oct 2026 inputs (MSFT reports Q1 FY27 on 28 Oct 2026,
// so nothing later is used), and the oracle's inputs are named per company.

function D(n: string | number): Decimal {
  return new Decimal(n);
}

// --- Master plan Part 4.4 — MSFT, stated 16 Oct 2026 inputs ----------------
//
// FY26 revenue $331.839B (TTM to 30 Jun 2026), base margin 45%, tax 19%,
// growth 14% for years 1–5 fading to 3%, return on new investment 21.5%
// (FY21→26 incremental return ex-Activision), narrow moat (terminal return =
// rate + 1pp — Part 4.4's own stated input, the v2.1 credit; v3 retired the
// credit, so it is stated here as the input it was, not read from policy),
// net cash $6.303B, 7,449,545,491 diluted shares, valued at
// 16 Oct 2026. Every value comes from computeScenarioValuation — the engine.
const PART_44 = {
  revenue: D("331.839e9"),
  margin: D("0.45"),
  tax: D("0.19"),
  growth: D("0.14"),
  ronic: D("0.215"),
  netCash: D("6.303e9"),
  shares: D("7449545491"),
  stub: stubYearsBetween("2026-06-30", "2026-10-16"),
  price: D("529.05"),
};

const PART_44_TERMINAL = (rate: Decimal) => rate.plus(D("0.01"));

function msftPerShare(rate: Decimal, { terminalRoic, ronic }: { terminalRoic?: Decimal; ronic?: Decimal } = {}): Decimal {
  const ev = computeScenarioEnterpriseValue(
    PART_44.revenue,
    buildFixedShapeGrowthPath(PART_44.growth),
    PART_44.margin,
    ronic ?? PART_44.ronic,
    terminalRoic ?? PART_44_TERMINAL(rate),
    rate,
    PART_44.tax,
    POLICY.terminalGrowth,
    PART_44.stub
  );
  return ev.plus(PART_44.netCash).dividedBy(PART_44.shares);
}

describe("Part 4.4 — the MSFT rate table is reproduced from its stated 16 Oct 2026 inputs", () => {
  it.each([
    ["0.08", 411, "1.29"],
    ["0.085", 378, "1.40"],
    ["0.09", 348, "1.52"],
    ["0.10", 301, "1.76"],
  ])("rate %s → base $%i a share, price ÷ base %s×", (rate, base, ratio) => {
    const value = msftPerShare(D(rate));
    expect(value.toDecimalPlaces(0).toNumber()).toBe(base);
    expect(PART_44.price.dividedBy(value).toFixed(2)).toBe(ratio);
  });

  it("the moat lever at 9%: terminal return r → $335 · r + 1pp → $348 · 12.5% → $373 · 15% → $389 · 20% → $411", () => {
    const at = (t: string) => msftPerShare(D("0.09"), { terminalRoic: D(t) }).toDecimalPlaces(0).toNumber();
    expect([at("0.09"), at("0.10"), at("0.125"), at("0.15"), at("0.20")]).toEqual([335, 348, 373, 389, 411]);
  });

  it("the return-on-new-investment lever at 9% (terminal 10%): 12% → $283 · 17.5% → $329 · 21.5% → $348 · 30% → $374", () => {
    const at = (x: string) => msftPerShare(D("0.09"), { ronic: D(x) }).toDecimalPlaces(0).toNumber();
    expect([at("0.12"), at("0.175"), at("0.215"), at("0.30")]).toEqual([283, 329, 348, 374]);
  });

  it("one reverse-DCF solve on the main engine: $529.05 needs ~24% growth a year for five years at 9% (~22% at 8.5%)", () => {
    const targetEv = PART_44.price.mul(PART_44.shares).minus(PART_44.netCash);
    const solveAt = (rate: Decimal) =>
      solveReverseDcf({
        baseYearRevenue: { value: PART_44.revenue, provenance: CLEAN_PROVENANCE },
        targetEnterpriseValue: { value: targetEv, provenance: CLEAN_PROVENANCE },
        rate,
        nopatTaxRate: PART_44.tax,
        heldDrivers: {
          operatingMargin: PART_44.margin,
          returnOnNewInvestment: PART_44.ronic,
          terminalReturnOnNewCapital: PART_44_TERMINAL(rate),
        },
        heldDriversMissing: null,
        stubYears: PART_44.stub,
      }).fiveYearGrowth;
    const at9 = solveAt(D("0.09"));
    const at85 = solveAt(D("0.085"));
    if (at9.suppressed || at85.suppressed) throw new Error("reverse DCF unexpectedly suppressed");
    expect(at9.value.toDecimalPlaces(2).toNumber()).toBe(0.24);
    expect(at85.value.toDecimalPlaces(2).toNumber()).toBe(0.22);
    // Round trip: the solved growth, valued on the same engine, is the price.
    const back = computeScenarioEnterpriseValue(
      PART_44.revenue,
      buildFixedShapeGrowthPath(at9.value),
      PART_44.margin,
      PART_44.ronic,
      PART_44_TERMINAL(D("0.09")),
      D("0.09"),
      PART_44.tax,
      POLICY.terminalGrowth,
      PART_44.stub
    );
    expect(back.plus(PART_44.netCash).dividedBy(PART_44.shares).toFixed(2)).toBe("529.05");
  });

  it("expected return at today's price: ~7% a year, the base case's own cash flows held fixed", () => {
    const terminal = PART_44_TERMINAL(D("0.09"));
    const irr = solveRateForTargetValue((r) => msftPerShare(r, { terminalRoic: terminal }), PART_44.price, D("0.0325"));
    expect(irr).not.toBeNull();
    expect(irr!.toDecimalPlaces(2).toNumber()).toBe(0.07);
  });
});

// --- An independent oracle — MSFT, COST, NVDA --------------------------------
//
// A second implementation, in plain floating point, sharing no code with the
// engine and taking a different algebraic route to reinvestment: the
// increment in NOPAT a year's investment funds, divided by that year's return
// on new investment, rather than NOPAT × next-year growth ÷ return. The two
// agree only if the engine's mechanics are right — Methodology v3 D2′'s
// runway (the return on new capital fades from year 5 to the rate by year
// 10 / 15 / 20, the explicit period running to the last fade year and the
// terminal value placed half a year before its end) and D2.1's year-1
// funding charge (year 1's NOPAT increment over its return, less what was
// reinvested last year, charged at the valuation date).
interface OracleInput {
  revenue: number;
  margin: number;
  tax: number;
  growth: number;
  ronic: number;
  terminalRoic: number;
  rate: number;
  stub: number;
  runway: number;
  available: number;
}

function oracleValue(i: OracleInput): { ev: number; terminalOverFinalYearFcf: number; shortfall: number } {
  const g = 0.03;
  const horizon = Math.max(10, i.runway);
  const growthIn = (t: number) => (t <= 5 ? i.growth : t <= 10 ? i.growth - ((i.growth - g) * (t - 5)) / 5 : g);
  const ronicIn = (t: number) =>
    t <= 5 ? i.ronic : t <= i.runway ? i.ronic - ((i.ronic - i.terminalRoic) * (t - 5)) / (i.runway - 5) : i.terminalRoic;
  const nopat: number[] = [i.revenue * i.margin * (1 - i.tax)];
  let revenue = i.revenue;
  for (let t = 1; t <= horizon + 1; t++) {
    revenue *= 1 + growthIn(t);
    nopat[t] = revenue * i.margin * (1 - i.tax);
  }
  let ev = 0;
  let fcfLast = 0;
  for (let t = 1; t <= horizon; t++) {
    const fcf = nopat[t] - (nopat[t + 1] - nopat[t]) / ronicIn(t);
    if (t === horizon) fcfLast = fcf;
    ev += fcf / Math.pow(1 + i.rate, t - 0.5 - i.stub);
  }
  const terminalFcf = nopat[horizon + 1] * (1 - g / i.terminalRoic);
  ev += terminalFcf / (i.rate - g) / Math.pow(1 + i.rate, horizon - 0.5 - i.stub);
  const shortfall = Math.max(0, (nopat[1] - nopat[0]) / ronicIn(1) - i.available);
  return { ev: ev - shortfall, terminalOverFinalYearFcf: terminalFcf / fcfLast, shortfall };
}

// Stated harness inputs: growth is a test choice; the return on new
// investment is each company's five-year incremental-return history the
// master plan records (MSFT 21.5% ex-Activision, COST 46%, NVDA 74%); the
// moat class and last year's net reinvestment (a share of year-0 NOPAT) are
// test choices. The rate is the engine's own D1 selection from the company's
// real SIC code.
const ORACLE_CASES: { name: string; golden: typeof msft; growth: string; ronic: string; moat: MoatClass; reinvestedShare: number }[] = [
  { name: "MSFT", golden: msft, growth: "0.14", ronic: "0.215", moat: "narrow", reinvestedShare: 0.2 },
  { name: "COST", golden: cost as unknown as typeof msft, growth: "0.08", ronic: "0.46", moat: "wide", reinvestedShare: 0.05 },
  { name: "NVDA", golden: nvda as unknown as typeof msft, growth: "0.20", ronic: "0.74", moat: "none", reinvestedShare: 0 },
];

describe("an independent oracle reproduces the engine for MSFT, COST and NVDA", () => {
  it.each(ORACLE_CASES)("$name", ({ golden, growth, ronic, moat, reinvestedShare }) => {
    const f = golden.facts;
    const revenue = D(f.revenue!.value!);
    const margin = D(f.operatingIncome!.value!).dividedBy(revenue);
    const tax = D(f.incomeTaxExpense!.value!).dividedBy(D(f.incomeBeforeTax!.value!));
    const rate = selectDiscountRate({
      sic: golden.sic,
      triggerBFired: false,
      profile: "MATURE_PROFITABLE_STABLE_FCF",
      leverage: LEVERAGE_PASS,
      priceDate: "2026-10-16",
    }).rate;
    const terminalRoic = terminalReturnOnNewCapital(rate, "base");
    const runway = returnRunwayYears(moat, "base");
    const stub = stubYearsBetween(f.revenue!.periodEnd, "2026-10-16");
    const nopat0 = revenue.mul(margin).mul(D(1).minus(tax));
    const available = nopat0.mul(reinvestedShare);

    const engine = computeScenarioValuation(
      revenue,
      buildFixedShapeGrowthPath(D(growth)),
      margin,
      D(ronic),
      terminalRoic,
      rate,
      tax,
      POLICY.terminalGrowth,
      stub,
      { runwayYears: runway, yearOne: { nopat0, available } }
    );
    const oracle = oracleValue({
      revenue: revenue.toNumber(),
      margin: margin.toNumber(),
      tax: tax.toNumber(),
      growth: Number(growth),
      ronic: Number(ronic),
      terminalRoic: terminalRoic.toNumber(),
      rate: rate.toNumber(),
      stub: stub.toNumber(),
      runway,
      available: available.toNumber(),
    });

    expect(engine.horizonYears).toBe(Math.max(10, runway));
    expect(Math.abs(engine.enterpriseValue.toNumber() / oracle.ev - 1)).toBeLessThan(1e-9);
    expect(Math.abs(engine.yearOneFunding!.shortfall.toNumber() - oracle.shortfall)).toBeLessThan(1e-3);
    // AR2's terminal ÷ final-year FCF band, on both implementations.
    const ratio = engine.terminalFcf.dividedBy(engine.finalYearFcf).toNumber();
    expect(ratio).toBeGreaterThanOrEqual(0.95);
    expect(ratio).toBeLessThanOrEqual(1.1);
    expect(Math.abs(ratio - oracle.terminalOverFinalYearFcf)).toBeLessThan(1e-9);
  });
});

// --- D1 — the rate ---------------------------------------------------------

describe("D1 — the dated rate in use, by the approved two-band rule", () => {
  const rateFor = (sic: string | null, profile: Profile = "MATURE_PROFITABLE_STABLE_FCF", triggerBFired = false) =>
    selectDiscountRate({ sic, triggerBFired, profile, leverage: LEVERAGE_PASS, priceDate: "2026-10-16" });

  it.each([
    ["MSFT", msft.sic, "0.09", "stable"],
    ["COST", cost.sic, "0.09", "stable"],
    ["KO", ko.sic, "0.09", "stable"],
    ["LLY", lly.sic, "0.09", "stable"],
    ["NVDA", nvda.sic, "0.11", "cyclical"],
    ["NUE", nue.sic, "0.11", "cyclical"],
  ])("%s (SIC %s) → %s, %s", (_name, sic, rate, band) => {
    const r = rateFor(sic);
    expect(r.rate.toString()).toBe(D(rate).toString());
    expect(r.band).toBe(band);
    expect(r.effectiveFrom).toBe("2026-10-17");
  });

  it("a pre-revenue company (OKLO) → 11%, whatever its SIC", () => {
    const r = rateFor(oklo.sic, "PRE_REVENUE_UNPROFITABLE");
    expect(r.rate.toString()).toBe("0.11");
    expect(r.band).toBe("pre-revenue");
  });

  it("trigger B alone puts a stable-SIC company in the cyclical band", () => {
    expect(rateFor(msft.sic, "MATURE_PROFITABLE_STABLE_FCF", true).rate.toString()).toBe("0.11");
  });

  it("growth alone never raises the rate: a high-growth stable company is valued at the market's expected return", () => {
    expect(rateFor(msft.sic, "HIGH_GROWTH_PROFITABLE_UNCERTAIN_DURABILITY").rate.toString()).toBe("0.09");
  });

  it("the verdict check points sit ±0.5pp either side, and the rule is marked outside its domain when the net-debt gate fails", () => {
    const r = selectDiscountRate({ sic: msft.sic, triggerBFired: false, profile: "MATURE_PROFITABLE_STABLE_FCF", leverage: LEVERAGE_MEASURED_ABOVE, priceDate: "2026-10-16" });
    expect([r.checkRates.lower.toString(), r.checkRates.upper.toString()]).toEqual(["0.085", "0.095"]);
    expect(r.validatedDomain).toBe("OUTSIDE");
  });

  // CF-LEG2-RATE-DOMAIN-COPY-01 (#479) — three leverage states, three domain
  // states; the rate itself is the same in all three.
  it.each([
    ["net debt measured below 10% (PASS)", LEVERAGE_PASS, "WITHIN"],
    ["net debt measured at or above 10%", LEVERAGE_MEASURED_ABOVE, "OUTSIDE"],
    ["net debt not measured", LEVERAGE_NOT_MEASURED, "NOT MEASURED"],
  ] as const)("%s → domain %s", (_name, leverage, domain) => {
    const r = selectDiscountRate({ sic: msft.sic, triggerBFired: false, profile: "MATURE_PROFITABLE_STABLE_FCF", leverage, priceDate: "2026-10-16" });
    expect(r.validatedDomain).toBe(domain);
    expect(r.rate.toString()).toBe("0.09");
  });

  it("records the measurement convention as provenance — an AI DEFAULT, not a rule value", () => {
    const r = rateFor(msft.sic);
    expect(r.provenance.measurementConvention).toMatch(/AI DEFAULT/);
    expect(r.provenance.measurementConvention).toMatch(/nearest 0\.5%/);
  });
});

// --- D2′ — terminal returns and runways (Methodology v3) ----------------------

describe("D2′ — the terminal return on new capital is the rate; the moat sets the runway to it", () => {
  const r = D("0.09");
  it("terminal return: bear and base the rate, bull the rate + 1.5pp — whatever the moat", () => {
    expect(terminalReturnOnNewCapital(r, "bear").toString()).toBe("0.09");
    expect(terminalReturnOnNewCapital(r, "base").toString()).toBe("0.09");
    expect(terminalReturnOnNewCapital(r, "bull").toString()).toBe("0.105");
  });

  it.each([
    ["none", 10, 10, 10],
    ["narrow", 10, 15, 15],
    ["wide", 10, 20, 20],
  ] as const)("%s moat → runway bear %i, base %i, bull %i years", (moat, bear, base, bull) => {
    expect([returnRunwayYears(moat, "bear"), returnRunwayYears(moat, "base"), returnRunwayYears(moat, "bull")]).toEqual([bear, base, bull]);
  });

  it("with no moat input the runway is ten years", () => {
    expect(returnRunwayYears(null, "base")).toBe(10);
  });
});

// --- R5 — the bridge flags ------------------------------------------------

describe("R5 — bridge flags", () => {
  const sourced = (value: string | number) => ({ value: D(value), provenance: CLEAN_PROVENANCE });
  const base: EnterpriseValueInput = {
    sharesOutstanding: sourced(100),
    treasuryMethodDilution: sourced(0),
    price: sourced(10),
    totalDebt: sourced(200),
    financeLeaseLiabilities: sourced(50),
    cashAndMarketableDebtSecurities: sourced(100),
    nonOperatingEquityInvestmentsAtBook: sourced(30),
    nonOperatingInvestmentsErrorDirection: "understates",
  };
  const ev = (input: EnterpriseValueInput) => {
    const bridge = computeEnterpriseValue(input);
    if (bridge.suppressed) throw new Error(`bridge suppressed: ${bridge.cause}`);
    return bridge.value;
  };

  it("LLY: finance leases inside total debt are counted once — no separate term is required or added", () => {
    // LLY's real golden debt, and the cited issuer disclosure that its
    // finance leases sit inside it (FY2024 10-K). LLY tags no finance-lease
    // liability at all.
    const debt = lly.facts.totalDebt!.value!;
    const nested = { ...base, totalDebt: sourced(debt), financeLeaseLiabilities: null, financeLeasesInsideTotalDebt: { source: "LLY FY2024 10-K" } };
    const value = ev(nested);
    expect(value.enterpriseValue.toString()).toBe(D(1000).plus(debt).minus(100).minus(30).toString());
    expect(value.bridgeFlags?.financeLeases.treatment).toBe("INCLUDED IN TOTAL DEBT");
    // A lease figure tagged as well is still not added a second time.
    expect(ev({ ...nested, financeLeaseLiabilities: sourced(99) }).enterpriseValue.toString()).toBe(value.enterpriseValue.toString());
    // Without the disclosure record the missing lease figure is still a missing REQUIRED input.
    expect(computeEnterpriseValue({ ...nested, financeLeasesInsideTotalDebt: null }).suppressed).toBe(true);
  });

  it("minorities and preferred stock are in the bridge where tagged; untagged they are flagged, never zero", () => {
    const tagged = ev({ ...base, minorityInterest: sourced(7), preferredStock: sourced(3) });
    expect(tagged.enterpriseValue.toString()).toBe(D(1000 + 200 + 50 + 7 + 3 - 100 - 30).toString());
    expect(tagged.bridgeFlags?.claims.map((c) => c.status)).toEqual(["IN BRIDGE", "IN BRIDGE", "NOT TAGGED"]);
    const untagged = ev(base);
    expect(untagged.enterpriseValue.toString()).toBe(D(1000 + 200 + 50 - 100 - 30).toString());
    expect(untagged.bridgeFlags?.claims.every((c) => c.status === "NOT TAGGED" && c.amount === null)).toBe(true);
  });

  it("a claim tagged at another balance-sheet date is flagged NOT CURRENT and not added", () => {
    const stale = ev({
      ...base,
      totalDebtAsOfDate: "2026-06-30",
      financeLeaseLiabilitiesAsOfDate: "2026-06-30",
      cashAndMarketableDebtSecuritiesAsOfDate: "2026-06-30",
      minorityInterest: sourced(7),
      seniorClaimAsOfDates: { minorityInterest: "2014-12-31" },
    });
    expect(stale.enterpriseValue.toString()).toBe(D(1000 + 200 + 50 - 100 - 30).toString());
    expect(stale.bridgeFlags?.claims[0].status).toBe("NOT CURRENT");
  });

  it("convertibles are shown inside total debt, not added again", () => {
    const value = ev({ ...base, convertibleDebt: sourced(40) });
    expect(value.enterpriseValue.toString()).toBe(ev(base).enterpriseValue.toString());
    expect(value.bridgeFlags?.claims[2].status).toBe("IN TOTAL DEBT");
  });

  it("strategic stakes stay at book with any disclosed fair value shown separately; contingent items are listed, never deducted", () => {
    const utb = ko.facts.unrecognizedTaxBenefits!.value!;
    const value = ev({
      ...base,
      nonOperatingEquityInvestmentsFairValue: sourced(45),
      contingentItems: [{ item: "unrecognized tax benefits (open tax positions, e.g. an IRS dispute)", amount: sourced(utb) }],
    });
    expect(value.enterpriseValue.toString()).toBe(ev(base).enterpriseValue.toString());
    expect(value.bridgeFlags?.strategicStakes).toMatchObject({ atBook: D(30), disclosedFairValue: D(45) });
    expect(value.bridgeFlags?.contingentItems.map((c) => c.amount.toString())).toEqual([String(utb)]);
  });
});
