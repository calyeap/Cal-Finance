import { describe, it, expect, beforeEach } from "vitest";
import Decimal from "decimal.js";
import { buildAcquiredRun } from "./acquiredRun";
import { assembleAnalysisResult } from "./assemble";
import { __resetAcquisitionCache } from "./acquisition/provider";
import { withStatedD2Inputs } from "./fixtures/statedD2Inputs";
import type { Figure } from "./types";

function causeOf(figure: Figure<Decimal>): string | undefined {
  return figure.suppressed ? figure.cause : undefined;
}

// ---------------------------------------------------------------------------
// CB-RDCF-EV-01 (CB-AUDIT-01 finding H1) on a real filing.
//
// THE DEFECT. companyInputs.ts sets `reverseDcf.targetEnterpriseValue` to null
// with the comment "filled by assemble from M1's own output" — but assemble
// never filled it. Unlike `leverage.enterpriseValue`, which got exactly this
// fix for exactly this reason (§6.5, "AFTER M1"), the reverse-DCF input never
// got it. So every acquired run returned every reverse-DCF cell INCOMPLETE — missing
// REQUIRED input(s): targetEnterpriseValue — regardless of the company's
// actual price/value picture, making Section E, Section H's "What the price
// assumes", Quick Read's "What today's price requires" and the §10.6.2
// comparator chain unreachable outside the hand-written fixture.
//
// This is distinct from the separate RONIC chain (§7.2 M5): this fix touches
// only the missing-targetEnterpriseValue defect, never the RONIC ladder
// itself.
// ---------------------------------------------------------------------------

const MSFT_CAPTURE_CLOSE = new Decimal("499.70");

// CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — M7 is one solve on the main engine
// (AR0-2), holding the base scenario's adopted D2 drivers. These runs take
// STATED D2 test inputs (withStatedD2Inputs) so the solve has drivers to
// hold; what they check is unchanged — where the target EV comes from.
describe("reverse-DCF target enterprise value on an acquired MSFT run", () => {
  beforeEach(() => {
    __resetAcquisitionCache();
  });

  it("stops failing closed on a missing target EV once M1 computes", async () => {
    const run = await buildAcquiredRun({
      ticker: "MSFT",
      price: { value: MSFT_CAPTURE_CLOSE, timestamp: "2026-09-04", source: "recorded capture" },
      source: "CAPTURE",
      // §4.4's judgment answered: none of the candidate investments are
      // non-operating, so the EV bridge computes rather than reporting
      // INCOMPLETE.
      nonOperatingInvestments: { tags: [], value: new Decimal(0), errorDirection: null },
      profileHumanConfirmed: true,
    });

    const result = assembleAnalysisResult(withStatedD2Inputs(run.fixture));
    const solve = result.priceImplied.reverseDcf;

    expect(causeOf(solve.fiveYearGrowth)).not.toBe("missing REQUIRED input(s): targetEnterpriseValue");
    expect(solve.fiveYearGrowth.suppressed).toBe(false);
    expect(solve.rate.toString()).toBe("0.09");
  });

  it("still fails the solve closed where M1 is genuinely INCOMPLETE (§5.4 cascade, not softened)", async () => {
    // With §4.4's judgment unanswered, enterprise value is INCOMPLETE, so
    // there is nothing for assemble to fill the reverse-DCF input from — the
    // solve must report INCOMPLETE, naming the missing input.
    const run = await buildAcquiredRun({
      ticker: "MSFT",
      price: { value: MSFT_CAPTURE_CLOSE, timestamp: "2026-09-04", source: "recorded capture" },
      source: "CAPTURE",
      nonOperatingInvestments: null,
      profileHumanConfirmed: true,
    });

    const result = assembleAnalysisResult(withStatedD2Inputs(run.fixture));
    const solve = result.priceImplied.reverseDcf;

    expect(solve.fiveYearGrowth.suppressed && solve.fiveYearGrowth.state).toBe("INCOMPLETE");
    expect(causeOf(solve.fiveYearGrowth)).toBe("missing REQUIRED input(s): targetEnterpriseValue");
  });
});
