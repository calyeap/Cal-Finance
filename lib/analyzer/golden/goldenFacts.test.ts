import { describe, it, expect } from "vitest";
import { classifyCyclicality, CYCLICAL_SIC_CLASSES, type CyclicalityClass } from "./cyclicalSic";
import sicValidationSet from "./sicValidationSet.json";

import msft from "./msft.json";
import cost from "./cost.json";
import nvda from "./nvda.json";
import nue from "./nue.json";
import ko from "./ko.json";
import oklo from "./oklo.json";
import lly from "./lly.json";
import jpm from "./jpm.json";

// CF-AR2-GOLDEN-HARNESS-01, DO item 5 — validates the golden JSON files
// themselves: schema/shape (every fact carries its provenance fields,
// including the honest page-citation substitution) and the DO item 1/5/6
// structural assertions (OKLO pre-revenue, JPM refused, KO's debt-tag
// staleness flagged, cyclicalSic.ts reproducing the expected classification
// for all eight). This file does NOT re-fetch SEC data or re-run the
// classifier against raw row histories — see tagDrift.test.ts for the real
// mechanical tag-drift proof against KO/NVDA's actual row history.

type GoldenFact = {
  conceptLabel: string;
  xbrlConcept: string;
  value: number | null;
  unit?: string;
  periodStart: string | null;
  periodEnd: string;
  accessionNumber: string;
  form: string;
  fiscalYear: number;
  note: string | null;
};

interface GoldenCompany {
  ticker: string;
  cik: string;
  entityName: string;
  sic: string;
  sicDescription: string;
  classification: {
    cyclicality: CyclicalityClass;
    preRevenue: boolean;
    refused: boolean;
    reason: string;
  };
  provenance: {
    source: string;
    capturedAt: string;
    pageCitationNote: string;
  };
  facts: {
    revenue: GoldenFact | null;
    operatingIncome: GoldenFact | null;
    incomeTaxExpense: GoldenFact | null;
    incomeBeforeTax: GoldenFact | null;
    netIncome: GoldenFact | null;
    totalDebt: (GoldenFact & { staleAlternative?: unknown }) | null;
    cashAndEquivalents: GoldenFact | null;
    dilutedWeightedAverageShares: GoldenFact | null;
    // The dynamically-named "<key>Note" honesty fields (e.g. operatingIncomeNote,
    // revenueNote, totalDebtNote) live alongside the typed keys above —
    // indexed access to them goes through the untyped cast used below
    // rather than through this interface, since their presence is
    // conditional on the sibling fact being null.
    [key: string]: GoldenFact | null | string | undefined;
  };
  price: { value: number; date: string; source: string } | null;
  priceNote: string | null;
  notes: string[];
}

const ALL: [string, GoldenCompany][] = [
  ["MSFT", msft as GoldenCompany],
  ["COST", cost as GoldenCompany],
  ["NVDA", nvda as GoldenCompany],
  ["NUE", nue as GoldenCompany],
  ["KO", ko as GoldenCompany],
  ["OKLO", oklo as GoldenCompany],
  ["LLY", lly as GoldenCompany],
  ["JPM", jpm as GoldenCompany],
];

const REQUIRED_FACT_KEYS = [
  "revenue",
  "operatingIncome",
  "incomeTaxExpense",
  "incomeBeforeTax",
  "netIncome",
  "totalDebt",
  "cashAndEquivalents",
  "dilutedWeightedAverageShares",
] as const;

function assertFactShapeOrHonestNote(company: GoldenCompany, key: string) {
  const fact = (company.facts as unknown as Record<string, GoldenFact | null>)[key];
  if (fact === null) {
    // A null fact MUST carry a sibling "<key>Note" explaining why — never a
    // silent gap. These notes live as top-level keys on the parsed JSON
    // object (facts.<key>Note), since JSON has no comments.
    const note = (company.facts as unknown as Record<string, unknown>)[`${key}Note`];
    expect(typeof note, `${company.ticker}.facts.${key} is null but has no "${key}Note" explaining why`).toBe(
      "string"
    );
    expect((note as string).length).toBeGreaterThan(10);
    return;
  }
  expect(typeof fact.conceptLabel).toBe("string");
  expect(fact.conceptLabel.length).toBeGreaterThan(0);
  expect(typeof fact.xbrlConcept).toBe("string");
  expect(fact.xbrlConcept.startsWith("us-gaap:")).toBe(true);
  expect(typeof fact.value).toBe("number");
  expect(typeof fact.periodEnd).toBe("string");
  expect(fact.periodEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(typeof fact.accessionNumber).toBe("string");
  // Real SEC accession numbers are NNNNNNNNNN-YY-NNNNNN.
  expect(fact.accessionNumber).toMatch(/^\d{10}-\d{2}-\d{6}$/);
  expect(typeof fact.form).toBe("string");
  expect(fact.form.startsWith("10-K")).toBe(true);
  expect(typeof fact.fiscalYear).toBe("number");
}

describe("golden facts — schema and provenance (DO item 5)", () => {
  it.each(ALL)("%s: has the required top-level shape", (_ticker, company) => {
    expect(company.ticker).toBeTruthy();
    expect(company.cik).toMatch(/^\d{10}$/);
    expect(company.sic).toMatch(/^\d{3,4}$/);
    expect(company.sicDescription.length).toBeGreaterThan(0);
    expect(company.provenance.source.length).toBeGreaterThan(0);
    expect(company.provenance.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof company.provenance.pageCitationNote).toBe("string");
  });

  it.each(ALL)(
    "%s: the page-citation note is HONEST — it names the real substitution, never a fabricated page number",
    (_ticker, company) => {
      const note = company.provenance.pageCitationNote;
      expect(note).toContain("page");
      // Must not contain anything that looks like an invented page-number
      // citation ("p. 42", "page 17") — only the substitution language.
      expect(note).not.toMatch(/\bp\.?\s*\d+\b/i);
    }
  );

  it.each(ALL)("%s: every captured fact matches the schema, or is null with an honest note", (_ticker, company) => {
    for (const key of REQUIRED_FACT_KEYS) {
      assertFactShapeOrHonestNote(company, key);
    }
  });

  it.each(ALL)("%s: netIncome, incomeTaxExpense and incomeBeforeTax, where all three are present, are at least roughly consistent (netIncome ≈ incomeBeforeTax − incomeTaxExpense, within a wide tolerance for non-controlling interests / other adjustments)", (_ticker, company) => {
    const netIncome = company.facts.netIncome;
    const tax = company.facts.incomeTaxExpense;
    const pretax = company.facts.incomeBeforeTax;
    if (!netIncome || !tax || !pretax) return; // honest-gap case, covered above
    const implied = pretax.value! - tax.value!;
    const diff = Math.abs(implied - netIncome.value!);
    // Wide tolerance (15% of pretax income) — this is a sanity cross-check,
    // not an exact identity. Non-controlling interests create a REAL gap
    // for some companies in this exact golden set — NUE (joint-venture
    // minority interests) has an observed ~11.4% gap on its real FY2025
    // figures, confirmed against the actual 10-K values above, not a bug
    // in this check.
    expect(diff).toBeLessThan(Math.abs(pretax.value!) * 0.15);
  });
});

describe("golden facts — D1 SIC classification table reproduces the expected eight-company split (DO item 2/5)", () => {
  const expected: Record<string, CyclicalityClass> = {
    MSFT: "stable",
    COST: "stable",
    NVDA: "cyclical",
    NUE: "cyclical",
    KO: "stable",
    LLY: "stable",
    // OKLO and JPM are special-cased (pre-revenue / refused respectively),
    // not by the cyclical/stable table — classifyCyclicality still returns
    // a literal answer for their SIC codes (neither matches a confirmed
    // cyclical prefix), asserted below for completeness, not as "the"
    // classification that governs them.
    OKLO: "stable",
    JPM: "stable",
  };

  it.each(ALL)("%s: classifyCyclicality(sic) matches the golden JSON's own recorded classification.cyclicality", (ticker, company) => {
    expect(classifyCyclicality(company.sic)).toBe(company.classification.cyclicality);
  });

  it.each(ALL)("%s: classifyCyclicality(sic) matches this outcome's expected eight-company split", (ticker, company) => {
    expect(classifyCyclicality(company.sic)).toBe(expected[ticker]);
  });
});

describe("D1 cyclical SIC list — validated on a wider real company set (DO item 5)", () => {
  // sicValidationSet.json: 50 real SEC SIC codes captured from
  // data.sec.gov/submissions by scripts/evidence/golden/captureSicValidationSet.ts.
  // `expected` is each company's economic classification, written before
  // and independently of the table — never derived from classifyCyclicality.
  const companies = sicValidationSet.companies;

  // The one documented miss, observed on the real capture rather than
  // predicted: Sherwin-Williams makes paint (chemicals, cyclical) but files
  // under SIC 5200, Retail-Building Materials. SIC is the filer's own primary
  // code, so the table cannot see it; D1's trigger-B route (§6.4) is the
  // backstop. Listed here so a new miss — or this one disappearing — fails.
  const DOCUMENTED_MISSES = ["SHW"];

  it("covers a set wider than the golden eight, on both sides of the split", () => {
    expect(companies.length).toBeGreaterThanOrEqual(40);
    expect(companies.filter((c) => c.expected === "cyclical").length).toBeGreaterThanOrEqual(20);
    expect(companies.filter((c) => c.expected === "stable").length).toBeGreaterThanOrEqual(20);
  });

  it("every company's real SIC classifies as expected, except exactly the documented misses", () => {
    const misses = companies.filter((c) => classifyCyclicality(c.sic) !== c.expected).map((c) => c.ticker);
    expect(misses).toEqual(DOCUMENTED_MISSES);
  });

  it("each of the four D1-confirmed members is present, marked confirmed, and exercised by at least one real company", () => {
    const confirmed = CYCLICAL_SIC_CLASSES.filter((c) => c.confirmed).map((c) => c.prefix).sort();
    expect(confirmed).toEqual(["28", "331", "367", "371"]);
    for (const prefix of confirmed) {
      expect(companies.some((c) => c.sic.startsWith(prefix) && classifyCyclicality(c.sic) === "cyclical")).toBe(true);
    }
  });

  it("pharmaceutical preparations (283x) and soaps/cosmetics (284x) stay stable inside the chemicals band", () => {
    for (const ticker of ["JNJ", "PFE", "MRK", "ABT", "PG", "CL"]) {
      const c = companies.find((x) => x.ticker === ticker)!;
      expect(c.sic.startsWith("283") || c.sic.startsWith("284")).toBe(true);
      expect(classifyCyclicality(c.sic)).toBe("stable");
    }
  });
});

describe("golden facts — structural special cases (DO item 1/5)", () => {
  it("OKLO reads as pre-revenue: no 10-K-sourced revenue fact, preRevenue flag set, refused NOT set", () => {
    expect(oklo.classification.preRevenue).toBe(true);
    expect(oklo.classification.refused).toBe(false);
    expect(oklo.facts.revenue).toBeNull();
    const note = (oklo.facts as unknown as Record<string, unknown>).revenueNote as string;
    expect(note).toContain("10-K");
  });

  it("OKLO still has a real recorded price — pre-revenue and priced are not a contradiction, and the engine must still read 'can't conclude' rather than compute a number from no base revenue", () => {
    expect(oklo.price).not.toBeNull();
    expect(oklo.facts.revenue).toBeNull();
  });

  it("JPM reads as refused: a depository-institution SIC, refused flag set, no totalDebt computed", () => {
    expect(jpm.sic).toBe("6021");
    expect(jpm.classification.refused).toBe(true);
    expect(jpm.facts.totalDebt).toBeNull();
  });

  it("JPM's 'Revenues' fact is present but explicitly annotated as not DCF-comparable (a present tag with a structurally different meaning, not an absent one)", () => {
    expect(jpm.facts.revenue).not.toBeNull();
    expect(jpm.facts.revenue!.note).toContain("bank");
  });

  it("KO's total-debt golden fact documents its own tag-drift decision explicitly (the dead legacy tags are recorded, not silently dropped)", () => {
    expect(ko.facts.totalDebt).not.toBeNull();
    expect(ko.facts.totalDebt!.note).toContain("DEAD");
    const staleAlt = (ko.facts.totalDebt as unknown as { staleAlternative?: { lastRowEverSeen?: { periodEnd?: string } } }).staleAlternative;
    expect(staleAlt).toBeDefined();
    expect(staleAlt!.lastRowEverSeen!.periodEnd).toBe("2024-03-29");
  });

  it("none of MSFT/COST/NVDA/NUE/KO/LLY is marked pre-revenue or refused — only OKLO and JPM carry those flags", () => {
    const nonSpecial: [string, GoldenCompany][] = [
      ["MSFT", msft as GoldenCompany],
      ["COST", cost as GoldenCompany],
      ["NVDA", nvda as GoldenCompany],
      ["NUE", nue as GoldenCompany],
      ["KO", ko as GoldenCompany],
      ["LLY", lly as GoldenCompany],
    ];
    for (const [, company] of nonSpecial) {
      expect(company.classification.preRevenue).toBe(false);
      expect(company.classification.refused).toBe(false);
    }
  });
});
