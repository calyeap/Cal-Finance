import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { acquire } from "./acquisition/acquire";
import { withDerivedFacts } from "./acquisition/derivedFacts";
import { dilutionFallback, resolveTax } from "./acquisition/v3Inputs";
import type { CompanyFactsDocument, XbrlFactUnitRow } from "./acquisition/secClient";
import { computeScenarioValuation } from "./modules/scenarioOutputs";
import { buildFixedShapeGrowthPath, buildMarginRampPath, buildRampedGrowthPath, buildRonicPath } from "./growthPath";
import { terminalDiscountTime } from "./valuationTiming";
import { assembleAnalysisResult, type CompanyFixture } from "./assemble";
import { withStatedD2Inputs } from "./fixtures/statedD2Inputs";
import { MSFT_FIXTURE } from "./fixtures/msft";
import { POLICY } from "./policy";
import type { V3FiledInputs } from "./types";

// ---------------------------------------------------------------------------
// CF-METHODOLOGY-V3-IMPLEMENT-01 (issue #499) — Methodology v3, approved by
// Calvin 20 Oct 2026 (frozen spec §14.10): D2′ runway, D2.1 year-1 funding,
// D5 driver construction, D6 implied drivers, D8 dilution fallback, and the
// build defects it routed (LLY / NUE operating income, LLY capex).
// ---------------------------------------------------------------------------

const D = (v: string | number) => new Decimal(v);

function capture(ticker: string): CompanyFactsDocument {
  return JSON.parse(
    readFileSync(join(__dirname, "acquisition", "captures", "v3-2026-10-20", `${ticker.toLowerCase()}-companyfacts.json`), "utf8")
  ) as CompanyFactsDocument;
}

function factValue(doc: CompanyFactsDocument, cik: string, id: string): string | null {
  const facts = acquire({ ticker: "T", cik, companyName: "T", companyFacts: doc, price: null, acquiredAt: "2026-10-20T00:00:00.000Z" }).facts;
  const f = facts.find((x) => x.id === id);
  return f === undefined || f.value === null ? null : String(f.value);
}

// --- Build defects (RED on the filer's raw facts, GREEN once derived) --------

describe("build defects — operating income and capex for filers that tag neither", () => {
  it("LLY: no operating-income line is tagged; the derived pre-tax − non-operating value is FY2025's 26,302m", () => {
    const raw = capture("LLY");
    expect(factValue(raw, "0000059478", "operating-income")).toBeNull();
    expect(factValue(withDerivedFacts(raw), "0000059478", "operating-income")).toBe("26302000000");
  });

  it("NUE: no operating-income line is tagged; the derived pre-tax + net interest value is FY2025's 2,627m", () => {
    const raw = capture("NUE");
    expect(factValue(raw, "0000073309", "operating-income")).toBeNull();
    expect(factValue(withDerivedFacts(raw), "0000073309", "operating-income")).toBe("2627000000");
  });

  it("the derived element reproduces a filer's own tagged operating income exactly (MSFT and NVDA, every filed year)", () => {
    for (const ticker of ["MSFT", "NVDA"]) {
      const doc = withDerivedFacts(capture(ticker));
      const tagged = doc.facts["us-gaap"].OperatingIncomeLoss.units.USD;
      const derived = doc.facts["cf-derived"].OperatingIncomeLossFromPretaxLessNonoperating.units.USD;
      const key = (r: XbrlFactUnitRow) => `${r.accn}|${r.start}|${r.end}`;
      const byKey = new Map(tagged.map((r) => [key(r), r.val]));
      const matched = derived.filter((r) => byKey.has(key(r)) && r.form === "10-K");
      expect(matched.length).toBeGreaterThan(3);
      for (const r of matched) expect(r.val).toBe(byKey.get(key(r)));
    }
  });

  it("a filer's own facts are untouched and the derivation is idempotent", () => {
    const raw = capture("LLY");
    const once = withDerivedFacts(raw);
    expect(once.facts["us-gaap"]).toBe(raw.facts["us-gaap"]);
    expect(withDerivedFacts(once)).toBe(once);
  });

  it("LLY capex: PaymentsToAcquireOtherPropertyPlantAndEquipment resolves FY2025's 7,841m", () => {
    expect(factValue(capture("LLY"), "0000059478", "capex")).toBe("7841000000");
  });
});

// --- D5 tax and D8 dilution, on synthetic filings ---------------------------

function annualRow(fy: number, val: number, accn = `acc-${fy}`): XbrlFactUnitRow {
  return { start: `${fy}-01-01`, end: `${fy}-12-31`, val, fy, fp: "FY", form: "10-K", filed: `${fy + 1}-02-15`, accn };
}

function docWith(usGaap: Record<string, { USD?: XbrlFactUnitRow[]; shares?: XbrlFactUnitRow[] }>): CompanyFactsDocument {
  return {
    cik: 1,
    entityName: "Synthetic",
    facts: { "us-gaap": Object.fromEntries(Object.entries(usGaap).map(([tag, units]) => [tag, { label: tag, description: "", units }])) },
  } as CompanyFactsDocument;
}

const PRETAX = "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest";

describe("D5 — the NOPAT tax rate is the filed 3-yr average effective rate", () => {
  it("Σ tax ÷ Σ pre-tax over the latest three fiscal years", () => {
    const doc = docWith({
      IncomeTaxExpenseBenefit: { USD: [annualRow(2023, 18), annualRow(2024, 20), annualRow(2025, 22)] },
      [PRETAX]: { USD: [annualRow(2023, 100), annualRow(2024, 100), annualRow(2025, 100)] },
    });
    const t = resolveTax(doc, null);
    expect(t.basis).toBe("FILED 3-YR AVERAGE");
    expect(t.rate.toString()).toBe("0.2");
  });

  it("excludes a loss year and a rate outside 0–50%; fewer than two normal years falls to statutory, labelled", () => {
    const twoNormal = docWith({
      IncomeTaxExpenseBenefit: { USD: [annualRow(2023, 5), annualRow(2024, 30), annualRow(2025, 60)] },
      [PRETAX]: { USD: [annualRow(2023, -10), annualRow(2024, 100), annualRow(2025, 100)] },
    });
    const t2 = resolveTax(twoNormal, null);
    expect(t2.basis).toBe("STATUTORY");
    expect(t2.rate.toString()).toBe("0.21");
    expect(t2.label).toMatch(/statutory/);
    expect(t2.years.filter((y) => y.excluded !== null)).toHaveLength(2);
  });

  it("an adopted override wins and is labelled", () => {
    const doc = docWith({ IncomeTaxExpenseBenefit: { USD: [annualRow(2025, 20)] }, [PRETAX]: { USD: [annualRow(2025, 100)] } });
    const t = resolveTax(doc, D("0.17"));
    expect([t.basis, t.rate.toString()]).toEqual(["ADOPTED OVERRIDE", "0.17"]);
  });
});

describe("D8 — dilution fallback: diluted − basic weighted shares from the same 10-K, only with no convertibles", () => {
  const shares = (diluted: number, basic: number) => ({
    WeightedAverageNumberOfDilutedSharesOutstanding: { shares: [annualRow(2025, diluted)] },
    WeightedAverageNumberOfSharesOutstandingBasic: { shares: [annualRow(2025, basic)] },
  });

  it("applies, labelled with the filing", () => {
    const r = dilutionFallback(docWith(shares(1010, 1000)));
    expect(r.applied).toBe(true);
    expect(r.value?.toString()).toBe("10");
    expect(r.label).toMatch(/acc-2025/);
  });

  it("is refused where the same filing shows convertible debt", () => {
    const r = dilutionFallback(docWith({ ...shares(1010, 1000), ConvertibleDebt: { USD: [{ ...annualRow(2025, 500), start: undefined }] } }));
    expect(r.applied).toBe(false);
    expect(r.value).toBeNull();
    expect(r.label).toMatch(/refused/);
  });
});

// --- D2′ runway and D2.1 year-1 funding, on the engine ------------------------

describe("D2′ — the return on new capital fades to the rate over the moat's runway", () => {
  it("the explicit period runs to the last fade year; the terminal value sits half a year before its end", () => {
    expect(buildRonicPath(D("0.3"), D("0.09"), 20)).toHaveLength(20);
    expect(buildRonicPath(D("0.3"), D("0.09"), 20)[19].toString()).toBe("0.09");
    expect(terminalDiscountTime(D(0), 20).toString()).toBe("19.5");
    const v = computeScenarioValuation(D(100), buildFixedShapeGrowthPath(D("0.1")), D("0.3"), D("0.3"), D("0.09"), D("0.09"), D("0.2"), POLICY.terminalGrowth, D(0), {
      runwayYears: 15,
    });
    expect(v.horizonYears).toBe(15);
  });

  it("a longer runway at the same terminal return is worth more, and its terminal share is lower", () => {
    const at = (runwayYears: number) =>
      computeScenarioValuation(D(100), buildFixedShapeGrowthPath(D("0.1")), D("0.3"), D("0.3"), D("0.09"), D("0.09"), D("0.2"), POLICY.terminalGrowth, D(0), {
        runwayYears,
      });
    const [ten, twenty] = [at(10), at(20)];
    expect(twenty.enterpriseValue.greaterThan(ten.enterpriseValue)).toBe(true);
    expect(twenty.terminalValuePv.dividedBy(twenty.enterpriseValue).lessThan(ten.terminalValuePv.dividedBy(ten.enterpriseValue))).toBe(true);
  });
});

describe("D2.1 — year-1 growth is funded from last year's filed net reinvestment; any shortfall is charged at the valuation date", () => {
  const value = (yearOne: { nopat0: Decimal; available: Decimal | null } | null) =>
    computeScenarioValuation(D(100), buildFixedShapeGrowthPath(D("0.1")), D("0.3"), D("0.2"), D("0.09"), D("0.09"), D("0.2"), POLICY.terminalGrowth, D("0.3"), {
      yearOne,
    });
  const nopat0 = D(24);

  it("required = NOPAT₀ × g₁ ÷ RONIC₁; shortfall = max(0, required − available); EV falls by exactly the shortfall", () => {
    const none = value(null);
    const part = value({ nopat0, available: D(5) });
    expect(part.yearOneFunding).toEqual({ required: D(12), available: D(5), shortfall: D(7) });
    expect(none.enterpriseValue.minus(part.enterpriseValue).toString()).toBe("7");
    expect(value({ nopat0, available: D(20) }).yearOneFunding!.shortfall.toString()).toBe("0");
  });

  it("available that can't be formed from filings charges the whole requirement", () => {
    expect(value({ nopat0, available: null }).yearOneFunding!.shortfall.toString()).toBe("12");
  });
});

describe("D5 — Base ramps from the TTM anchor to the drafted year-5 value", () => {
  it("growth: year 1 at the anchor, linear to the drafted rate in year 5, then the fixed fade", () => {
    const p = buildRampedGrowthPath(D("0.06"), D("0.14"));
    expect(p.slice(0, 5).map((x) => x.toString())).toEqual(["0.06", "0.08", "0.1", "0.12", "0.14"]);
    expect(p.slice(5).map((x) => x.toString())).toEqual(buildFixedShapeGrowthPath(D("0.14")).slice(5).map((x) => x.toString()));
  });

  it("margin: year 1 at the TTM margin, linear to the drafted margin in year 5, then held", () => {
    const p = buildMarginRampPath(D("0.40"), D("0.48"));
    expect(p.map((x) => x.toString())).toEqual(["0.4", "0.42", "0.44", "0.46", "0.48", "0.48", "0.48", "0.48", "0.48", "0.48"]);
  });
});

// --- D5 / D6 / coherence on assembly ---------------------------------------

const anchor = (v: string | null, basis = "test") => ({ value: v === null ? null : D(v), basis });

function v3Inputs(over: Partial<V3FiledInputs> = {}): V3FiledInputs {
  return {
    ttmMargin: anchor("0.44"),
    ttmRevenueGrowth: anchor("0.08"),
    revenueCagr3: anchor("0.10"),
    tax: { rate: D("0.2"), basis: "FILED 3-YR AVERAGE", years: [], label: "NOPAT tax rate 20.0%: filed" },
    lastFyNetReinvestment: { formed: true, fiscalYear: 2026, capexLessDa: D(1), deltaNwc: D(0), acquisitions: D(0), total: D(1) },
    trailingNetReinvestment: { formed: true, fromFiscalYear: 2024, toFiscalYear: 2026, ratioToNopat: D("0.05") },
    roic: { latest: { fiscalYear: 2026, value: D("0.3") }, incremental3: { fromFiscalYear: 2023, toFiscalYear: 2026, value: D("0.25") } },
    dilutionFallback: null,
    ...over,
  };
}

function adoptedMsft(over: Partial<CompanyFixture> = {}): CompanyFixture {
  return { ...withStatedD2Inputs(MSFT_FIXTURE), scenarioValues: null, ...over };
}

describe("D5 on assembly — Base only, a cyclical company keeps the drafted growth, a missing anchor is labelled", () => {
  it("ramps Base growth from min(TTM growth, 3-yr CAGR) and margin from the TTM margin; Bear and Bull stay flat", () => {
    const result = assembleAnalysisResult(adoptedMsft({ v3Inputs: v3Inputs() }));
    const b = result.valuationBasis!.v3!.baseDrivers;
    expect(b.growthRamped && b.marginRamped).toBe(true);
    expect(b.growthPath[0].toString()).toBe("0.08");
    expect(b.marginPath[0].toString()).toBe("0.44");
    expect(b.growthPath[4].toString()).toBe((MSFT_FIXTURE.scenarios.base.revenueGrowthOrPath as Decimal).toString());
    expect(result.verdictInputs?.flatGrowthBaseAtCheckRates).toBeDefined();
  });

  it("holds the drafted value from year 1 where the anchor is missing, and says so", () => {
    const result = assembleAnalysisResult(adoptedMsft({ v3Inputs: v3Inputs({ ttmMargin: anchor(null, "no filed operating income") }) }));
    const b = result.valuationBasis!.v3!.baseDrivers;
    expect(b.marginRamped).toBe(false);
    expect(b.notes.join(" ")).toMatch(/no TTM anchor \(no filed operating income\)/);
  });

  it("a D1-cyclical company uses the drafted growth from year 1 (no growth ramp, no ramp-dependent check)", () => {
    const cyclical = adoptedMsft({ v3Inputs: v3Inputs(), marketContext: { sic: "3674", sicDescription: "Semiconductors" } });
    const result = assembleAnalysisResult(cyclical);
    if (result.valuationBasis!.discountRate.band !== "cyclical") throw new Error("expected the cyclical band for SIC 3674");
    expect(result.valuationBasis!.v3!.baseDrivers.growthRamped).toBe(false);
    expect(result.valuationBasis!.v3!.baseDrivers.notes.join(" ")).toMatch(/cyclical/);
    expect(result.verdictInputs?.flatGrowthBaseAtCheckRates).toBeUndefined();
  });
});

describe("D2.1, coherence and D6 on assembly", () => {
  const result = assembleAnalysisResult(adoptedMsft({ v3Inputs: v3Inputs() }));
  const v3 = result.valuationBasis!.v3!;

  it("charges every scenario its own year-1 shortfall, per share", () => {
    for (const key of ["bear", "base", "bull"] as const) {
      const f = v3.yearOneFunding.byScenario[key]!;
      expect(f.shortfall.equals(Decimal.max(0, f.required.minus(1)))).toBe(true);
      expect(f.perShare!.equals(f.shortfall.dividedBy(MSFT_FIXTURE.scenarios[key].shareCount))).toBe(true);
    }
  });

  it("compares model reinvestment ÷ NOPAT in years 1–5 with the filed trailing actual, flagging a gap above 15pp", () => {
    const c = v3.reinvestmentCoherence!;
    expect(c.actual!.toString()).toBe("0.05");
    expect(c.gap!.equals(c.model.minus("0.05"))).toBe(true);
    expect(c.flagged).toBe(c.gap!.abs().greaterThan("0.15"));
  });

  it("D6: the solved single driver values Base at the price (display only)", () => {
    const growth = v3.impliedDrivers!.growth;
    expect(growth.state).toBe("SOLVED");
    expect(growth.history).toMatch(/TTM growth 8\.0%/);
    // Revalue with Base growth flat at the implied rate (no growth anchor) and
    // everything else as the solve held it: Base per share is the price.
    const atImplied = assembleAnalysisResult(
      adoptedMsft({
        v3Inputs: v3Inputs({ ttmRevenueGrowth: anchor(null) }),
        scenarios: { ...adoptedMsft().scenarios, base: { ...adoptedMsft().scenarios.base, revenueGrowthOrPath: growth.value! } },
      })
    );
    const price = MSFT_FIXTURE.enterpriseValue.price!.value;
    expect(atImplied.scenarioOutputs.values.base.minus(price).abs().toNumber()).toBeLessThan(0.01);
  });
});

