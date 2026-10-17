import { describe, it, expect } from "vitest";
import { POLICY, UNDEFINED_POLICY_CONSTANTS, POLICY_THRESHOLD_PROVENANCE, buildProvisionalLabels } from "./policy";

describe("POLICY", () => {
  // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — the 8/10/12% grid is retired
  // (frozen spec §14.9 AR0-1, AR0-2); these are Methodology v2.1 D1's and
  // D2's approved values, restated.
  it("carries D1's approved dated rates — 9.0% stable, 11.0% cyclical / pre-revenue, dated 17 Oct 2026 — checked at ±0.5pp", () => {
    const [row] = POLICY.discountRate.table;
    expect(POLICY.discountRate.table).toHaveLength(1);
    expect([row.effectiveFrom, row.stable.toString(), row.cyclicalOrPreRevenue.toString()]).toEqual(["2026-10-17", "0.09", "0.11"]);
    expect(POLICY.discountRate.verdictCheckOffset.toString()).toBe("0.005");
  });

  it("carries D2's approved moat credits — +0 / +1 / +3pp, bull = base + 1.5pp", () => {
    expect([POLICY.moatCredit.none, POLICY.moatCredit.narrow, POLICY.moatCredit.wide].map((v) => v.toString())).toEqual(["0", "0.01", "0.03"]);
    expect(POLICY.bullMoatCreditUplift.toString()).toBe("0.015");
  });

  it("fixes the leverage threshold at 10%", () => {
    expect(POLICY.leverageThreshold.toString()).toBe("0.1");
  });

  it("fixes terminal growth at 3%, never above nominal GDP", () => {
    expect(POLICY.terminalGrowth.toString()).toBe("0.03");
  });

  it("fixes the levered cost-of-equity cap at 30%", () => {
    expect(POLICY.leveredCostOfEquityCap.toString()).toBe("0.3");
  });

  it("fixes Gate 1's history thresholds at <5 and 5-9 filed years", () => {
    expect(POLICY.gate1HistoryInsufficientYears).toBe(5);
    expect(POLICY.gate1ShortHistoryYears).toBe(9);
  });

  it("fixes Gate 0's interest-income test at 50% of revenue", () => {
    expect(POLICY.gate0InterestIncomeOverRevenueThreshold.toString()).toBe("0.5");
  });
});

describe("UNDEFINED_POLICY_CONSTANTS", () => {
  it("keeps all four LATER constants explicitly null rather than a guessed number", () => {
    // A regression here would mean someone quietly assigned a real value to
    // one of the four constants the register records as undefined (§7.1) —
    // exactly the silent invention the frozen contract forbids.
    expect(UNDEFINED_POLICY_CONSTANTS).toEqual({
      nopatTaxRate: null,
      stressMarginLevel: null,
      preRevenueUnleveredRate: null,
      projectDebtCost: null,
    });
  });
});

describe("POLICY_THRESHOLD_PROVENANCE / buildProvisionalLabels", () => {
  it("records exactly the eight constants the frozen spec labels PROVISIONAL or 'no observations behind it', and no others", () => {
    // A hardcoded expected key set, verified against every PROVISIONAL / "no
    // observations" occurrence in the spec (§6.1, §6.2, §7.1, §7.2 M12). A
    // constant added here without spec support, or a genuinely provisional
    // constant left out, both fail this test. CF-AR4-RATE-REINVESTMENT-
    // TERMINAL-01 removed three with the constants they labelled: the r + 3pp
    // terminal ROIC premium (retired by AR0-2/AR0-3) and the two Step 4
    // dispersion-tier boundaries (product-decisions items 23–24, retired).
    expect(Object.keys(POLICY_THRESHOLD_PROVENANCE).sort()).toEqual(
      [
        "preRevenueConstructionLeadYears",
        "leveredCostOfEquityCap",
        "gate0InterestIncomeOverRevenueThreshold",
        "gate1HistoryInsufficientYears",
        "gate1ShortHistoryYears",
        "historyInsufficientStressMarginRelativeReductions",
        "runRateSequentialGrowthTrigger",
        "seasonalityPriorYearThreshold",
      ].sort()
    );
  });

  it("gives every entry a non-empty calibration note, never a bare PROVISIONAL tag with no explanation", () => {
    for (const provenance of Object.values(POLICY_THRESHOLD_PROVENANCE)) {
      expect(provenance?.status).toBe("PROVISIONAL");
      expect(provenance?.calibration.length).toBeGreaterThan(0);
    }
  });

  it("carries the Gate 0 threshold's 'no observations' basis specifically, per this session's ruling", () => {
    expect(POLICY_THRESHOLD_PROVENANCE.gate0InterestIncomeOverRevenueThreshold?.calibration).toContain(
      "No observations"
    );
  });

  it("derives provisionalLabels mechanically — same key set, same text, never hand-retyped", () => {
    const labels = buildProvisionalLabels();
    expect(Object.keys(labels).sort()).toEqual(Object.keys(POLICY_THRESHOLD_PROVENANCE).sort());
    expect(labels.gate0InterestIncomeOverRevenueThreshold).toBe(
      POLICY_THRESHOLD_PROVENANCE.gate0InterestIncomeOverRevenueThreshold?.calibration
    );
  });

  it("does not label a fixed (non-provisional) constant, e.g. the leverage threshold or the D1 rate table", () => {
    expect(POLICY_THRESHOLD_PROVENANCE.leverageThreshold).toBeUndefined();
    expect(POLICY_THRESHOLD_PROVENANCE.discountRate).toBeUndefined();
    expect(POLICY_THRESHOLD_PROVENANCE.terminalGrowth).toBeUndefined();
  });
});
