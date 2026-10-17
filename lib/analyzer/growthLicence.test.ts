import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { evaluateGrowthLicence } from "./growthLicence";
import { computedValue, suppressedValue } from "./figures";
import { CLEAN_PROVENANCE } from "./provenance";
import type { RonicLadderState } from "./types";

// ---------------------------------------------------------------------------
// Pure, synthetic coverage of §10.6.2 Step 2's growth licence
// (growthLicence.ts). No acquired data, no fixtures — every case constructs
// the exact RONIC-ladder shape `reinvestmentRonic.ts:computeRonicLadder`
// produces, so these tests pin the function's own decision rule independent
// of any one company's real numbers (real-company coverage is
// growthLicenceOnRealRun.test.ts).
//
// CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — reviewed evaluator change: the
// ladder has one cell, at the run's D1 rate (frozen spec §14.9 AR0-2), so
// the "straddles the grid" case and its §11 item 4 hand-off no longer
// exist; a rate it is CLEAN against and one it is LOW against are each
// their own one-cell ladder.
// ---------------------------------------------------------------------------

function cell(rate: string, state: RonicLadderState, value: string | null) {
  return { rate: new Decimal(rate), state, value: value === null ? null : new Decimal(value) };
}

function ladder(cells: ReturnType<typeof cell>[]) {
  return computedValue({ cells }, CLEAN_PROVENANCE);
}

describe("evaluateGrowthLicence", () => {
  it("YES — RONIC CLEAN above the D1 rate (MSFT/NVDA shape)", () => {
    const result = evaluateGrowthLicence(ladder([cell("0.09", "CLEAN", "0.1750")]));
    expect(result.status).toBe("YES");
    expect(result.reason).toContain("17.5%");
    expect(result.reason).toContain("9.0%");
  });

  it("YES — RONIC CAPPED AT 200% still licenses growth", () => {
    const result = evaluateGrowthLicence(ladder([cell("0.09", "RONIC CAPPED AT 200%", "2")]));
    expect(result.status).toBe("YES");
  });

  it("NO — RONIC LOW RONIC against the D1 rate", () => {
    const result = evaluateGrowthLicence(ladder([cell("0.11", "LOW RONIC — VALUE-DESTROYING GROWTH", "0.03")]));
    expect(result.status).toBe("NO");
    expect(result.reason).toContain("3%");
    expect(result.reason).toContain("11.0%");
  });

  it("UNKNOWN — RONIC NOT MEANINGFUL (not defaulted to a Step 1 failure or to NO)", () => {
    const result = evaluateGrowthLicence(ladder([cell("0.09", "RONIC NOT MEANINGFUL", null)]));
    expect(result.status).toBe("UNKNOWN");
    expect(result.reason).toContain("RONIC NOT MEANINGFUL");
    expect(result.reason).toContain("§11 item 2");
  });

  it("the same 9% RONIC is licensed against a rate it meets and not against one above it — the ladder's own rate decides", () => {
    expect(evaluateGrowthLicence(ladder([cell("0.09", "CLEAN", "0.09")])).status).toBe("YES");
    expect(evaluateGrowthLicence(ladder([cell("0.11", "LOW RONIC — VALUE-DESTROYING GROWTH", "0.09")])).status).toBe("NO");
  });

  it("UNKNOWN — the ladder itself is unavailable (missing REQUIRED five-year deltas)", () => {
    const result = evaluateGrowthLicence(
      suppressedValue("INCOMPLETE", "missing REQUIRED input(s): fiveYearDeltaNopat, fiveYearDeltaInvestedCapital")
    );
    expect(result.status).toBe("UNKNOWN");
    expect(result.reason).toContain("RONIC ladder itself is unavailable");
    expect(result.reason).toContain("fiveYearDeltaNopat");
  });

  it("never reads a value against anything but the rate it was given", () => {
    // Regression guard: the function must not import or hardcode a rate of
    // its own — every rate it compares against comes from the cell it is
    // handed, which (in production) is the run's D1 rate.
    const result = evaluateGrowthLicence(ladder([cell("0.08", "CLEAN", "0.09")]));
    expect(result.status).toBe("YES");
    expect(result.reason).toContain("8.0%");
  });
});
