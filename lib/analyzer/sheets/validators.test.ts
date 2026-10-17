import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { validateSheet, staleFindings, errorsIn, type ValidationContext } from "./validators";
import type { HistoryMeasures } from "./research";
import type { SheetContent, SheetScenario } from "./sheet";

// ---------------------------------------------------------------------------
// CF-AR6-ANY-TICKER-DRAFTS-01 — the sheet validators (issue #454 DO 3), one
// check at a time on a hand-built sheet and history. Pure; no database.
// ---------------------------------------------------------------------------

const MEASURES: HistoryMeasures = {
  years: [],
  revenueCagr: { years: 9, value: new Decimal("0.12") },
  revenueGrowthRange: { low: new Decimal("0.02"), high: new Decimal("0.20") },
  operatingMarginRange: { low: new Decimal("0.25"), high: new Decimal("0.45") },
  roicRange: { low: new Decimal("0.18"), high: new Decimal("0.30") },
  incrementalReturn: new Decimal("0.22"),
  medianNetReinvestmentShare: new Decimal("0.04"),
  latestQuarter: { periodEnd: "2026-06-30", revenue: new Decimal("80"), yearOnYearGrowth: new Decimal("0.15"), ttmRevenue: new Decimal("300") },
};

const RATE = new Decimal("0.09");
const CTX: ValidationContext = { measures: MEASURES, rate: RATE, requireAnchors: true };

function scenario(g: string, m: string, r: string): SheetScenario {
  const a = (cites: string[]) => ({ text: "Anchored.", cites });
  return {
    revenueGrowthOrPath: g,
    operatingMargin: m,
    returnOnNewInvestment: r,
    reinvestmentCapitalIntensity: "0.04",
    shareCount: "1000",
    writtenAnchor: "Story.",
    anchors: {
      revenueGrowthOrPath: a(["H:revenue"]),
      operatingMargin: a(["H:margin"]),
      returnOnNewInvestment: a(["H:returns"]),
      reinvestmentCapitalIntensity: a(["H:capex"]),
      shareCount: a(["H:cashflow"]),
    },
  };
}

function sheet(edit: (c: SheetContent) => void = () => {}): SheetContent {
  const c: SheetContent = {
    profile: "MATURE_PROFITABLE_STABLE_FCF",
    classificationInputs: {
      revenueScale: "large",
      fcfCharacter: "positive_stable",
      revenueGrowthBand: "10-30%",
      capitalIntensity: "0.04",
      cyclicality: { tenYearMarginRange: "0.2", worstSingleYearChange: "0.03" },
      balanceSheetNature: "asset-light",
    },
    scenarios: { bear: scenario("0.06", "0.30", "0.12"), base: scenario("0.11", "0.38", "0.20"), bull: scenario("0.16", "0.44", "0.26") },
    moatClass: "narrow",
    moatAnchor: { text: "Switching costs.", cites: ["H:returns"] },
    configuredConstants: { nopatTaxRate: "0.19", stressMarginLevel: "0.25", preRevenueUnleveredRate: null, projectDebtCost: null },
    constantsAnchor: { text: "Statutory.", cites: ["STATUTORY"] },
    sources: ["H:revenue", "H:margin", "H:returns", "H:capex", "H:cashflow", "STATUTORY"].map((id) => ({
      id,
      kind: "HISTORY" as const,
      label: id,
      form: null,
      accession: null,
      filed: null,
      url: null,
      excerpt: "",
    })),
    basis: { latestFiscalYear: "2026", latestQuarterEnd: "2026-06-30", ttmRevenue: "300", dilutedShares: "1000" },
    cannotConclude: null,
  };
  edit(c);
  return c;
}

const checks = (c: SheetContent, ctx: ValidationContext = CTX) => validateSheet(c, ctx).map((f) => `${f.severity} ${f.check}`);

describe("validateSheet", () => {
  it("passes a complete, anchored sheet inside its history", () => {
    expect(validateSheet(sheet(), CTX)).toEqual([]);
  });

  it("COMPLETE — every driver, the moat class and the tax rate must be set; returns must be positive", () => {
    expect(checks(sheet((c) => (c.scenarios.base.returnOnNewInvestment = null)))).toContain("ERROR COMPLETE");
    expect(checks(sheet((c) => (c.moatClass = null)))).toContain("ERROR COMPLETE");
    expect(checks(sheet((c) => (c.configuredConstants.nopatTaxRate = null)))).toContain("ERROR COMPLETE");
    expect(checks(sheet((c) => (c.scenarios.bear.returnOnNewInvestment = "0")))).toContain("ERROR COMPLETE");
  });

  it("ANCHORED — every driver cites a source the sheet carries", () => {
    expect(checks(sheet((c) => delete c.scenarios.bull.anchors!.operatingMargin))).toContain("ERROR ANCHORED");
    expect(checks(sheet((c) => (c.scenarios.base.anchors!.revenueGrowthOrPath = { text: "x", cites: [] })))).toContain("ERROR ANCHORED");
    expect(checks(sheet((c) => (c.moatAnchor = { text: "x", cites: ["E9"] })))).toContain("ERROR ANCHORED");
    // An adoption keeps the draft's anchors and is not re-checked for them.
    expect(checks(sheet((c) => delete c.scenarios.bull.anchors), { ...CTX, requireAnchors: false })).not.toContain("ERROR ANCHORED");
  });

  it("ORDERED — growth, margin and return on new investment run bear ≤ base ≤ bull", () => {
    expect(checks(sheet((c) => (c.scenarios.bear.revenueGrowthOrPath = "0.12")))).toContain("ERROR ORDERED");
    expect(checks(sheet((c) => (c.scenarios.bull.returnOnNewInvestment = "0.19")))).toContain("ERROR ORDERED");
  });

  it("HISTORY RANGE — outside the filed range widened by the bands; a warning on adoption", () => {
    expect(checks(sheet((c) => (c.scenarios.bull.revenueGrowthOrPath = "0.31")))).toContain("ERROR HISTORY RANGE");
    expect(checks(sheet((c) => (c.scenarios.bull.revenueGrowthOrPath = "0.29")))).not.toContain("ERROR HISTORY RANGE");
    expect(checks(sheet((c) => (c.scenarios.bull.operatingMargin = "0.51")))).toContain("ERROR HISTORY RANGE");
    expect(checks(sheet((c) => (c.scenarios.bull.returnOnNewInvestment = "0.50")))).toContain("ERROR HISTORY RANGE");
    expect(checks(sheet((c) => (c.scenarios.bull.revenueGrowthOrPath = "0.31")), { ...CTX, forAdoption: true })).toContain("WARNING HISTORY RANGE");
  });

  it("RONIC PATH — base and bull fade down to their terminal return, never up into it", () => {
    // narrow: base terminal 10%, bull 11.5%.
    expect(checks(sheet((c) => (c.scenarios.base.returnOnNewInvestment = "0.095")))).toContain("ERROR RONIC PATH");
    expect(checks(sheet((c) => (c.scenarios.bull.returnOnNewInvestment = "0.21")))).not.toContain("ERROR RONIC PATH");
    expect(checks(sheet((c) => (c.scenarios.bear.returnOnNewInvestment = "0.08")))).toContain("WARNING RONIC PATH");
  });

  it("TERMINAL CONSISTENCY — no perpetual return above any return the company has filed", () => {
    const lowReturns = { ...MEASURES, roicRange: { low: new Decimal("0.05"), high: new Decimal("0.11") }, incrementalReturn: null };
    expect(checks(sheet((c) => (c.moatClass = "wide")), { ...CTX, measures: lowReturns })).toContain("ERROR TERMINAL CONSISTENCY");
    const belowRate = { ...MEASURES, roicRange: { low: new Decimal("0.03"), high: new Decimal("0.08") }, incrementalReturn: null };
    expect(checks(sheet(), { ...CTX, measures: belowRate })).toContain("ERROR TERMINAL CONSISTENCY");
  });

  it("NOT FROM REVERSE DCF — an anchor leaning on the price or a market-implied figure is refused", () => {
    for (const text of ["The reverse DCF implies 11%.", "In line with market-implied growth.", "What the current share price implies."]) {
      expect(checks(sheet((c) => (c.scenarios.base.anchors!.revenueGrowthOrPath = { text, cites: ["H:revenue"] })))).toContain("ERROR NOT FROM REVERSE DCF");
    }
  });

  it("SHARE COUNT — a count far from the drafted diluted count is a unit mistake", () => {
    expect(checks(sheet((c) => (c.scenarios.base.shareCount = "1")))).toContain("ERROR SHARE COUNT");
    expect(checks(sheet((c) => (c.scenarios.base.shareCount = "950")))).not.toContain("ERROR SHARE COUNT");
  });

  it("a sheet that records it cannot be concluded is one error and nothing else", () => {
    const f = validateSheet(sheet((c) => (c.cannotConclude = "pre-revenue")), CTX);
    expect(f).toHaveLength(1);
    expect(errorsIn(f)[0].message).toMatch(/pre-revenue/);
  });
});

describe("staleFindings — the stale-assumption check against the latest quarter", () => {
  it("is quiet for a sheet drafted on the latest quarter and in line with it", () => {
    expect(staleFindings(sheet(), MEASURES)).toEqual([]);
  });

  it("flags a newer filed quarter", () => {
    const newer = { ...MEASURES, latestQuarter: { ...MEASURES.latestQuarter!, periodEnd: "2026-09-30" } };
    expect(staleFindings(sheet(), newer).map((f) => f.message).join()).toMatch(/newer quarter \(ended 2026-09-30\)/);
  });

  it("flags year-1 revenue below the latest quarter's run-rate (NVDA's stale drivers)", () => {
    // TTM 300 × 1.11 = 333 < 90 × 4 = 360.
    const hot = { ...MEASURES, latestQuarter: { ...MEASURES.latestQuarter!, revenue: new Decimal("90") } };
    expect(staleFindings(sheet(), hot).some((f) => /below the latest quarter's annualised run-rate/.test(f.message))).toBe(true);
  });

  it("flags a latest quarter growing well outside bear…bull", () => {
    const fast = { ...MEASURES, latestQuarter: { ...MEASURES.latestQuarter!, yearOnYearGrowth: new Decimal("0.60") } };
    expect(staleFindings(sheet(), fast).some((f) => /outside this sheet's bear…bull growth/.test(f.message))).toBe(true);
    expect(staleFindings(sheet(), fast).every((f) => f.severity === "WARNING")).toBe(true);
  });
});
