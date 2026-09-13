import { describe, it, expect, beforeEach } from "vitest";
import Decimal from "decimal.js";
import { buildAcquiredRun } from "./acquiredRun";
import { assembleAnalysisResult } from "./assemble";
import { __resetAcquisitionCache } from "./acquisition/provider";
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
// got it. So every acquired run returned all nine cells INCOMPLETE — missing
// REQUIRED input(s): targetEnterpriseValue — regardless of the company's
// actual price/value picture, making Section E, Section H's "What the price
// assumes", Quick Read's "What today's price requires" and the §10.6.2
// comparator chain unreachable outside the hand-written fixture.
//
// This is distinct from the parked RONIC chain: MSFT's capture data has no
// meaningful RONIC ladder (§7.2 M5), so its nine cells stay suppressed even
// after this fix — for "RONIC not meaningful", never again for a missing
// target EV. That remaining suppression is the parked chain's, not this
// issue's, and this fix must not touch it (see DO NOT in issue #82).
// ---------------------------------------------------------------------------

const MSFT_CAPTURE_CLOSE = new Decimal("499.70");

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

    const result = assembleAnalysisResult(run.fixture);
    const cells = result.priceImplied.reverseDcfGrid;

    expect(cells).toHaveLength(9);
    // The defect's own cause must be gone from every cell, whatever else
    // suppresses them.
    expect(cells.every((c) => causeOf(c.fiveYearGrowth) !== "missing REQUIRED input(s): targetEnterpriseValue")).toBe(
      true
    );
    // MSFT's capture has no meaningful RONIC ladder — a separate, parked
    // condition this issue does not touch — so every cell is still
    // suppressed here, but now for that reason, not the missing input this
    // fix removes. This is the evidence that assemble actually filled
    // targetEnterpriseValue from M1: computeReverseDcfGrid only reaches the
    // per-cell RONIC check once its own missing-base check (which named
    // targetEnterpriseValue before this fix) passes.
    expect(cells.every((c) => causeOf(c.fiveYearGrowth) === "RONIC not meaningful for this company (§7.2 M5 ladder)")).toBe(
      true
    );
  });

  it("still fails the grid closed where M1 is genuinely INCOMPLETE (§5.4 cascade, not softened)", async () => {
    // With §4.4's judgment unanswered, enterprise value is INCOMPLETE, so
    // there is nothing for assemble to fill the reverse-DCF input from — the
    // grid must still report every cell INCOMPLETE, naming the missing input.
    const run = await buildAcquiredRun({
      ticker: "MSFT",
      price: { value: MSFT_CAPTURE_CLOSE, timestamp: "2026-09-04", source: "recorded capture" },
      source: "CAPTURE",
      nonOperatingInvestments: null,
      profileHumanConfirmed: true,
    });

    const result = assembleAnalysisResult(run.fixture);
    const cells = result.priceImplied.reverseDcfGrid;

    expect(cells).toHaveLength(9);
    expect(cells.every((c) => c.fiveYearGrowth.suppressed && c.fiveYearGrowth.state === "INCOMPLETE")).toBe(true);
    expect(cells.every((c) => causeOf(c.fiveYearGrowth) === "missing REQUIRED input(s): targetEnterpriseValue")).toBe(true);
  });
});
