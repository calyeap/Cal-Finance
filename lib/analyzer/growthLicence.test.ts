import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { evaluateGrowthLicence } from "./growthLicence";
import { computedValue, suppressedValue } from "./figures";
import { CLEAN_PROVENANCE } from "./provenance";
import type { DiscountRate, RonicLadderState } from "./types";

// ---------------------------------------------------------------------------
// Pure, synthetic coverage of §10.6.2 Step 2's growth licence
// (growthLicence.ts). No acquired data, no fixtures — every case constructs
// the exact RONIC-ladder shape `reinvestmentRonic.ts:computeRonicLadder`
// already produces, so these tests pin the function's own decision rule
// independent of any one company's real numbers (real-company coverage is
// growthLicenceOnRealRun.test.ts).
// ---------------------------------------------------------------------------

function cell(rate: DiscountRate, state: RonicLadderState, value: string | null) {
  return { rate, state, value: value === null ? null : new Decimal(value) };
}

function ladder(cells: ReturnType<typeof cell>[]) {
  return computedValue({ cells }, CLEAN_PROVENANCE);
}

describe("evaluateGrowthLicence", () => {
  it("YES — RONIC CLEAN above every rate in the grid (MSFT/NVDA shape)", () => {
    const result = evaluateGrowthLicence(
      ladder([
        cell(0.08, "CLEAN", "0.1750"),
        cell(0.1, "CLEAN", "0.1750"),
        cell(0.12, "CLEAN", "0.1750"),
      ])
    );
    expect(result.status).toBe("YES");
    expect(result.reason).toContain("17.5%");
    expect(result.reason).toContain("8%/10%/12%");
  });

  it("YES — RONIC CAPPED AT 200% on every cell still licenses growth", () => {
    const result = evaluateGrowthLicence(
      ladder([
        cell(0.08, "RONIC CAPPED AT 200%", "2"),
        cell(0.1, "RONIC CAPPED AT 200%", "2"),
        cell(0.12, "RONIC CAPPED AT 200%", "2"),
      ])
    );
    expect(result.status).toBe("YES");
  });

  it("NO — RONIC LOW RONIC on every cell", () => {
    const result = evaluateGrowthLicence(
      ladder([
        cell(0.08, "LOW RONIC — VALUE-DESTROYING GROWTH", "0.03"),
        cell(0.1, "LOW RONIC — VALUE-DESTROYING GROWTH", "0.03"),
        cell(0.12, "LOW RONIC — VALUE-DESTROYING GROWTH", "0.03"),
      ])
    );
    expect(result.status).toBe("NO");
    expect(result.reason).toContain("3%");
  });

  it("UNKNOWN — RONIC NOT MEANINGFUL on every cell (not defaulted to a Step 1 failure or to NO)", () => {
    const result = evaluateGrowthLicence(
      ladder([
        cell(0.08, "RONIC NOT MEANINGFUL", null),
        cell(0.1, "RONIC NOT MEANINGFUL", null),
        cell(0.12, "RONIC NOT MEANINGFUL", null),
      ])
    );
    expect(result.status).toBe("UNKNOWN");
    expect(result.reason).toContain("RONIC NOT MEANINGFUL");
    expect(result.reason).toContain("§11 item 2");
  });

  it("UNKNOWN — RONIC straddles the grid (clean at 8%, low at 10% and 12%) — no cell is silently chosen", () => {
    const result = evaluateGrowthLicence(
      ladder([
        cell(0.08, "CLEAN", "0.09"),
        cell(0.1, "LOW RONIC — VALUE-DESTROYING GROWTH", "0.09"),
        cell(0.12, "LOW RONIC — VALUE-DESTROYING GROWTH", "0.09"),
      ])
    );
    expect(result.status).toBe("UNKNOWN");
    expect(result.reason).toContain("disagree");
    expect(result.reason).toContain("§11 item 4");
  });

  it("UNKNOWN — the ladder itself is unavailable (missing REQUIRED five-year deltas)", () => {
    const result = evaluateGrowthLicence(
      suppressedValue("INCOMPLETE", "missing REQUIRED input(s): fiveYearDeltaNopat, fiveYearDeltaInvestedCapital")
    );
    expect(result.status).toBe("UNKNOWN");
    expect(result.reason).toContain("RONIC ladder itself is unavailable");
    expect(result.reason).toContain("fiveYearDeltaNopat");
  });

  it("never reads a value against anything but the already-approved POLICY.rateGrid rates it was given", () => {
    // Regression guard: the function must not import or hardcode a rate of
    // its own — every rate it compares against comes from the cells it is
    // handed, which (in production) are always POLICY.rateGrid.
    const result = evaluateGrowthLicence(ladder([cell(0.08, "CLEAN", "0.09")]));
    expect(result.status).toBe("YES");
    expect(result.reason).toContain("8%");
  });
});
