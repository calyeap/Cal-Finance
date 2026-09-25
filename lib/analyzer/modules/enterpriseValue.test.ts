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
