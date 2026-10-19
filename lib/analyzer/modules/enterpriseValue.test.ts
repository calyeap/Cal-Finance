import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { computeEnterpriseValue, computeEquityValueFromEnterpriseValue, type EnterpriseValueInput } from "./enterpriseValue";
import { CLEAN_PROVENANCE } from "../provenance";

function sourced(value: number, overrides: Partial<typeof CLEAN_PROVENANCE> = {}) {
  return { value: new Decimal(value), provenance: { ...CLEAN_PROVENANCE, ...overrides } };
}

function baseInput(overrides: Partial<EnterpriseValueInput> = {}): EnterpriseValueInput {
  return {
    sharesOutstanding: sourced(100),
    treasuryMethodDilution: sourced(10),
    price: sourced(50),
    totalDebt: sourced(200),
    financeLeaseLiabilities: sourced(50),
    cashAndMarketableDebtSecurities: sourced(300),
    nonOperatingEquityInvestmentsAtBook: sourced(20),
    nonOperatingInvestmentsErrorDirection: null,
    ...overrides,
  };
}

describe("computeEnterpriseValue", () => {
  it("computes market cap from diluted shares (outstanding + treasury-method dilution), never weighted-average diluted shares", () => {
    const result = computeEnterpriseValue(baseInput());
    expect(result.suppressed).toBe(false);
    if (!result.suppressed) {
      // (100 + 10) * 50 = 5500
      expect(result.value.marketCap.toString()).toBe("5500");
    }
  });

  it("computes EV = market cap + debt + finance leases - cash - non-operating investments (§2.1)", () => {
    const result = computeEnterpriseValue(baseInput());
    expect(result.suppressed).toBe(false);
    if (!result.suppressed) {
      // 5500 + 200 + 50 - 300 - 20 = 5430
      expect(result.value.enterpriseValue.toString()).toBe("5430");
    }
  });

  it("carries the error direction for non-operating investments through unchanged", () => {
    const result = computeEnterpriseValue(baseInput({ nonOperatingInvestmentsErrorDirection: "understates" }));
    expect(result.suppressed).toBe(false);
    if (!result.suppressed) {
      expect(result.value.nonOperatingInvestmentsErrorDirection).toBe("understates");
    }
  });

  it("treats a genuinely zero non-operating-investments figure as present, not missing", () => {
    const result = computeEnterpriseValue(baseInput({ nonOperatingEquityInvestmentsAtBook: sourced(0) }));
    expect(result.suppressed).toBe(false);
  });

  it.each(["sharesOutstanding", "treasuryMethodDilution", "price", "totalDebt", "financeLeaseLiabilities", "cashAndMarketableDebtSecurities", "nonOperatingEquityInvestmentsAtBook"] as const)(
    "returns INCOMPLETE, never a computed value, when %s is missing",
    (field) => {
      const result = computeEnterpriseValue(baseInput({ [field]: null }));
      expect(result.suppressed).toBe(true);
      if (result.suppressed) {
        expect(result.state).toBe("INCOMPLETE");
        expect(result.cause).toContain(field);
      }
    }
  );

  it("combines provenance across all seven inputs — one SECONDARY input makes the whole EV SECONDARY", () => {
    const result = computeEnterpriseValue(baseInput({ totalDebt: sourced(200, { sourceClass: "SECONDARY" }) }));
    expect(result.suppressed).toBe(false);
    if (!result.suppressed) {
      expect(result.qualification.provenanceTokens.sourceClass).toBe("SECONDARY");
    }
  });

  // CALVIN RULING — A, REQUIRE SAME-DATE EV BRIDGE INPUTS (issue #308,
  // ruled 25 Sep 2026 03:46:48Z; implemented under issue #309).
  describe("CALVIN RULING A — same-date bridge inputs", () => {
    const SAME = "2026-06-30";

    it("computes normally when all three named inputs share one as-of date", () => {
      const result = computeEnterpriseValue(
        baseInput({
          totalDebtAsOfDate: SAME,
          financeLeaseLiabilitiesAsOfDate: SAME,
          cashAndMarketableDebtSecuritiesAsOfDate: SAME,
        })
      );
      expect(result.suppressed).toBe(false);
    });

    it("returns INCOMPLETE naming all three mismatched dates when the three named inputs disagree", () => {
      const result = computeEnterpriseValue(
        baseInput({
          totalDebtAsOfDate: "2026-06-30",
          financeLeaseLiabilitiesAsOfDate: "2026-06-30",
          cashAndMarketableDebtSecuritiesAsOfDate: "2026-07-26",
        })
      );
      expect(result.suppressed).toBe(true);
      if (result.suppressed) {
        expect(result.state).toBe("INCOMPLETE");
        expect(result.cause).toContain("total-debt=2026-06-30");
        expect(result.cause).toContain("finance-lease-liabilities=2026-06-30");
        expect(result.cause).toContain("cash-and-marketable-debt-securities=2026-07-26");
      }
    });

    it("uses zero-tolerance string comparison — a one-day difference is still a mismatch", () => {
      const result = computeEnterpriseValue(
        baseInput({
          totalDebtAsOfDate: "2026-06-30",
          financeLeaseLiabilitiesAsOfDate: "2026-06-29",
          cashAndMarketableDebtSecuritiesAsOfDate: "2026-06-30",
        })
      );
      expect(result.suppressed).toBe(true);
      if (result.suppressed) expect(result.state).toBe("INCOMPLETE");
    });

    it("never substitutes an older/newer value to force alignment — a mismatch suppresses the whole bridge, not just the odd input", () => {
      const result = computeEnterpriseValue(
        baseInput({
          totalDebtAsOfDate: "2026-06-30",
          financeLeaseLiabilitiesAsOfDate: "2026-06-30",
          cashAndMarketableDebtSecuritiesAsOfDate: "2026-07-26",
        })
      );
      expect(result.suppressed).toBe(true);
      // Never the computed variant carrying a partial/mixed-date figure.
      if (result.suppressed === false) throw new Error("unreachable");
    });

    it("does not run the same-date test at all when a caller supplies no dates — every pre-#309 caller is unaffected", () => {
      const result = computeEnterpriseValue(baseInput());
      expect(result.suppressed).toBe(false);
    });

    it("does not run the same-date test when only some dates are supplied", () => {
      const result = computeEnterpriseValue(
        baseInput({ totalDebtAsOfDate: "2026-06-30", financeLeaseLiabilitiesAsOfDate: "2026-07-26" })
      );
      expect(result.suppressed).toBe(false);
    });

    it("lets the missing-REQUIRED-input check take precedence — an absent input is not read as a date mismatch", () => {
      // NVDA today: finance-lease-liabilities does not resolve at all, so
      // there is no date to compare it against — the existing missing-
      // REQUIRED-input INCOMPLETE governs, not a mismatch cause.
      const result = computeEnterpriseValue(
        baseInput({
          financeLeaseLiabilities: null,
          totalDebtAsOfDate: "2026-07-26",
          cashAndMarketableDebtSecuritiesAsOfDate: "2026-07-26",
        })
      );
      expect(result.suppressed).toBe(true);
      if (result.suppressed) {
        expect(result.state).toBe("INCOMPLETE");
        expect(result.cause).toContain("missing REQUIRED input(s)");
        expect(result.cause).toContain("financeLeaseLiabilities");
        expect(result.cause).not.toContain("as-of date");
      }
    });

    it("does not alter the timing of the other four REQUIRED inputs — a shares/price/dilution/non-operating-investments date is never compared", () => {
      // No asOfDate field exists on the module's input type for these four,
      // by construction (EnterpriseValueInput) — this asserts the bridge
      // still computes correctly using them when the three named inputs
      // agree, i.e. nothing about their own timing was folded into the test.
      const result = computeEnterpriseValue(
        baseInput({
          totalDebtAsOfDate: SAME,
          financeLeaseLiabilitiesAsOfDate: SAME,
          cashAndMarketableDebtSecuritiesAsOfDate: SAME,
        })
      );
      expect(result.suppressed).toBe(false);
      if (!result.suppressed) {
        expect(result.value.enterpriseValue.toString()).toBe("5430");
      }
    });
  });

  // Methodology v2.1 D7 (issue #491 ruling B; CF-AR6-FINANCE-LEASE-UPPER-
  // BOUND-01, issue #492): a finance-lease liability the filer never reports
  // enters at a cited, same-date upper bound — never zero.
  describe("Methodology D7 — an undisclosed finance-lease liability at its upper bound", () => {
    const SAME = "2026-06-30";
    const BOUND_SOURCE = "total liabilities less total debt, 10-Q 0000000000-26-000001";
    const bound = (value: number, asOfDate: string | null = SAME) => ({ value: sourced(value), asOfDate, source: BOUND_SOURCE });
    const dated = { totalDebtAsOfDate: SAME, cashAndMarketableDebtSecuritiesAsOfDate: SAME };

    it("uses the bound as the lease term, labels it and states its per-share effect", () => {
      const result = computeEnterpriseValue(
        baseInput({ ...dated, financeLeaseLiabilities: null, financeLeaseLiabilitiesUpperBound: bound(40) })
      );
      expect(result.suppressed).toBe(false);
      if (!result.suppressed) {
        // 5500 + 200 + 40 (bound) - 300 - 20
        expect(result.value.enterpriseValue.toString()).toBe("5420");
        expect(result.value.financeLeaseLiabilities.toString()).toBe("40");
        expect(result.value.bridgeFlags!.financeLeases.treatment).toBe("UPPER BOUND — NOT DISCLOSED");
        expect(result.value.bridgeFlags!.financeLeases.note).toContain(BOUND_SOURCE);
        // 40 / (100 + 10) diluted shares
        expect(result.value.bridgeFlags!.financeLeases.note).toContain("$0.36 per diluted share");
      }
    });

    it("refuses a bound dated other than the bridge's balance sheet (CALVIN RULING A, #308/#309)", () => {
      const result = computeEnterpriseValue(
        baseInput({ ...dated, financeLeaseLiabilities: null, financeLeaseLiabilitiesUpperBound: bound(40, "2026-03-31") })
      );
      expect(result.suppressed).toBe(true);
      if (result.suppressed) {
        expect(result.cause).toContain("different as-of dates");
        expect(result.cause).toContain("finance-lease-liabilities=2026-03-31");
      }
    });

    it("never replaces a reported lease figure", () => {
      const result = computeEnterpriseValue(baseInput({ ...dated, financeLeaseLiabilitiesAsOfDate: SAME, financeLeaseLiabilitiesUpperBound: bound(40) }));
      expect(result.suppressed).toBe(false);
      if (!result.suppressed) {
        expect(result.value.financeLeaseLiabilities.toString()).toBe("50");
        expect(result.value.bridgeFlags!.financeLeases.treatment).toBe("ADDED SEPARATELY");
      }
    });

    it("never overrides a cited nesting record", () => {
      const result = computeEnterpriseValue(
        baseInput({
          ...dated,
          financeLeaseLiabilities: null,
          financeLeasesInsideTotalDebt: { source: "cited lease note" },
          financeLeaseLiabilitiesUpperBound: bound(40),
        })
      );
      expect(result.suppressed).toBe(false);
      if (!result.suppressed) {
        expect(result.value.financeLeaseLiabilities.toString()).toBe("0");
        expect(result.value.bridgeFlags!.financeLeases.treatment).toBe("INCLUDED IN TOTAL DEBT");
      }
    });

    it("with no lease figure, no record and no bound, stays INCOMPLETE — never zero", () => {
      const result = computeEnterpriseValue(baseInput({ ...dated, financeLeaseLiabilities: null, financeLeaseLiabilitiesUpperBound: null }));
      expect(result.suppressed).toBe(true);
      if (result.suppressed) expect(result.cause).toBe("missing REQUIRED input(s): financeLeaseLiabilities");
    });
  });
});

describe("computeEquityValueFromEnterpriseValue", () => {
  it("reverses the EV bridge exactly, recovering market cap from EV", () => {
    // Using the same fixture: EV 5430 -> equity value should recover 5500.
    const equityValue = computeEquityValueFromEnterpriseValue(
      new Decimal(5430),
      new Decimal(300),
      new Decimal(20),
      new Decimal(200),
      new Decimal(50)
    );
    expect(equityValue.toString()).toBe("5500");
  });
});
