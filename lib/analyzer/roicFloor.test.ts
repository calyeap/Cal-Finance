import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateRoicFloor, type RoicYearInput } from "./roicFloor";

// ---------------------------------------------------------------------------
// CF-AR5-VERDICT-CONSOLIDATION-01 — Methodology v2.1 D4 item 2, the computed
// floor: 5-yr average ROIC including goodwill above the rate.
//
// The golden check re-derives the floor for the golden set from an
// independent capture of the presented SEC facts (golden/roicFloor.json —
// captured from data.sec.gov companyfacts for this outcome without reading
// tagMap.ts or the acquisition captures). The expected outcome is the
// contract's VERIFY line — passes MSFT, COST, NVDA, NUE, KO, LLY and fails
// OKLO — and every average is recomputed here, never imported.
// ---------------------------------------------------------------------------

const y = (fiscalYear: number, nopat: string | null, investedCapital: string | null): RoicYearInput => ({
  fiscalYear,
  nopat: nopat === null ? null : new Decimal(nopat),
  investedCapital: investedCapital === null ? null : new Decimal(investedCapital),
});
const RATE = new Decimal("0.09");

describe("evaluateRoicFloor", () => {
  const fiveAt = (roic: string) => [2026, 2025, 2024, 2023, 2022].map((fy) => y(fy, roic, "1"));

  it("PASS only when the five-year average is strictly above the rate", () => {
    expect(evaluateRoicFloor({ years: fiveAt("0.10"), filedHistoryYears: 10, rate: RATE }).status).toBe("PASS");
    expect(evaluateRoicFloor({ years: fiveAt("0.09"), filedHistoryYears: 10, rate: RATE }).status).toBe("FAIL");
    expect(evaluateRoicFloor({ years: fiveAt("0.05"), filedHistoryYears: 10, rate: RATE }).status).toBe("FAIL");
  });

  it("averages the latest five fiscal years, in any order, ignoring older ones", () => {
    const years = [y(2020, "-5", "1"), y(2022, "0.2", "1"), y(2026, "0.1", "1"), y(2024, "0.3", "1"), y(2023, "0.0", "1"), y(2025, "0.4", "1")];
    const r = evaluateRoicFloor({ years, filedHistoryYears: 7, rate: RATE });
    expect(r.status).toBe("PASS");
    expect(r.average!.toString()).toBe("0.2");
    expect(r.years.map((x) => x.fiscalYear)).toEqual([2026, 2025, 2024, 2023, 2022]);
  });

  it("a filed record shorter than five years cannot show the floor — FAIL, whatever its returns", () => {
    const r = evaluateRoicFloor({ years: fiveAt("0.5").slice(0, 3), filedHistoryYears: 3, rate: RATE });
    expect(r.status).toBe("FAIL");
    expect(r.reason).toContain("filed 3 fiscal years");
  });

  it("a missing fact or non-positive invested capital leaves it UNAVAILABLE — never a pass, never an invented fail", () => {
    const missing = fiveAt("0.5");
    missing[2] = y(2024, null, "1");
    expect(evaluateRoicFloor({ years: missing, filedHistoryYears: 10, rate: RATE }).status).toBe("UNAVAILABLE");
    const negative = fiveAt("0.5");
    negative[1] = y(2025, "0.5", "-3");
    expect(evaluateRoicFloor({ years: negative, filedHistoryYears: 10, rate: RATE }).status).toBe("UNAVAILABLE");
    expect(evaluateRoicFloor({ years: fiveAt("0.5").slice(0, 4), filedHistoryYears: 10, rate: RATE }).status).toBe("UNAVAILABLE");
  });
});

// --- golden set --------------------------------------------------------------

interface Fact {
  value: number;
}
interface GoldenYear {
  fiscalYear: number;
  operatingIncome: Fact | null;
  interestExpense?: Fact | null;
  incomeTaxExpense: Fact | null;
  incomeBeforeTax: Fact | null;
  totalEquity: Fact | null;
  totalDebt: Fact | null;
  financeLeaseLiabilities: Fact | null;
  cashAndMarketableSecurities: Fact | null;
}
const GOLDEN = JSON.parse(readFileSync(join(process.cwd(), "lib/analyzer/golden/roicFloor.json"), "utf-8")) as {
  companies: Record<string, { years: GoldenYear[] }>;
};

// Methodology v2.1 D1's band per company, from each golden file's own
// classification (stable 9.0%; cyclical and pre-revenue 11.0%).
function d1Rate(ticker: string): Decimal {
  const golden = JSON.parse(readFileSync(join(process.cwd(), `lib/analyzer/golden/${ticker.toLowerCase()}.json`), "utf-8")) as {
    classification: { cyclicality: string; preRevenue: boolean };
  };
  return golden.classification.preRevenue || golden.classification.cyclicality === "cyclical" ? new Decimal("0.11") : new Decimal("0.09");
}

/** One year, re-derived: EBIT × (1 − effective tax rate), over equity + debt + separate leases − cash and marketable securities. */
function rederive(year: GoldenYear): RoicYearInput {
  const ebit =
    year.operatingIncome !== null
      ? new Decimal(year.operatingIncome.value)
      : year.incomeBeforeTax !== null && year.interestExpense
        ? new Decimal(year.incomeBeforeTax.value).plus(year.interestExpense.value)
        : null;
  const preTax = year.incomeBeforeTax === null ? null : new Decimal(year.incomeBeforeTax.value);
  const tax = year.incomeTaxExpense === null ? null : new Decimal(year.incomeTaxExpense.value);
  const taxRate = preTax === null || tax === null ? null : preTax.lessThanOrEqualTo(0) ? new Decimal(0) : Decimal.min(1, Decimal.max(0, tax.dividedBy(preTax)));
  const capital =
    year.totalEquity === null || year.totalDebt === null || year.cashAndMarketableSecurities === null
      ? null
      : new Decimal(year.totalEquity.value)
          .plus(year.totalDebt.value)
          .plus(year.financeLeaseLiabilities?.value ?? 0)
          .minus(year.cashAndMarketableSecurities.value);
  return {
    fiscalYear: year.fiscalYear,
    nopat: ebit === null || taxRate === null ? null : ebit.mul(new Decimal(1).minus(taxRate)),
    investedCapital: capital,
  };
}

describe("D4 computed floor on the golden set (re-derived from the independent SEC capture)", () => {
  const expected: Record<string, "PASS" | "FAIL"> = { MSFT: "PASS", COST: "PASS", NVDA: "PASS", NUE: "PASS", KO: "PASS", LLY: "PASS", OKLO: "FAIL" };

  it.each(Object.entries(expected))("%s → %s", (ticker, outcome) => {
    const company = GOLDEN.companies[ticker];
    expect(company, ticker).toBeDefined();
    // A year is part of the company's own filed record when it has an operating result.
    const filed = company.years.filter((yr) => yr.operatingIncome !== null || (yr.incomeBeforeTax !== null && yr.interestExpense));
    const years = filed.map(rederive);
    const rate = d1Rate(ticker);
    const floor = evaluateRoicFloor({ years, filedHistoryYears: filed.length, rate });
    expect(floor.status, `${ticker}: ${floor.reason}`).toBe(outcome);

    if (floor.status === "PASS") {
      // The closed form, independently: the mean of the five yearly ratios.
      const mean = years.reduce((s, yr) => s.plus(yr.nopat!.dividedBy(yr.investedCapital!)), new Decimal(0)).dividedBy(5);
      expect(floor.average!.minus(mean).abs().lessThan("1e-15")).toBe(true);
      expect(floor.average!.greaterThan(rate)).toBe(true);
    }
  });
});
