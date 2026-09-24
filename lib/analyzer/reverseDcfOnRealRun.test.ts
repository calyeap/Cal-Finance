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
// This is distinct from the separate RONIC chain (§7.2 M5): this fix touches
// only the missing-targetEnterpriseValue defect, never the RONIC ladder
// itself. Historically MSFT's capture had no meaningful RONIC ladder, so
// every cell stayed suppressed for "RONIC not meaningful" even after this
// fix; since CF-RONIC-DELTAS-RECON-01 (issue #298) acquired both of RONIC's
// five-year deltas, MSFT's ladder is CLEAN and growth solves on most cells
// (docs/ronic-deltas-composition-reconciliation.md §7) — a change in the
// RONIC chain's own data, not in anything this fix does.
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
    // CF-RONIC-DELTAS-RECON-01 (issue #298) — MSFT's capture now carries a
    // real, non-degenerate RONIC ladder (previously "no meaningful RONIC
    // ladder", the condition this test used to assert). `ronic` on every
    // cell is CLEAN at ~17.498% — well above 8/10/12% and the 200% cap
    // alike — evidence this is the same "RONIC ladder now computed" state
    // docs/ronic-deltas-composition-reconciliation.md §7 reports for NVDA.
    // The "RONIC not meaningful" cause this test used to require is gone
    // entirely — this is the evidence that assemble actually filled
    // targetEnterpriseValue from M1: computeReverseDcfGrid only reaches the
    // per-cell RONIC check once its own missing-base check (which named
    // targetEnterpriseValue before this fix) passes.
    expect(cells.every((c) => causeOf(c.fiveYearGrowth) !== "RONIC not meaningful for this company (§7.2 M5 ladder)")).toBe(
      true
    );
    expect(cells.every((c) => !c.ronic.suppressed)).toBe(true);
    for (const cell of cells) {
      if (!cell.ronic.suppressed) {
        expect(cell.ronic.value.toDecimalPlaces(4).toString()).toBe("0.175");
      }
    }
    // Growth itself now solves on 5 of 9 cells; the other 4 (every 12% rate,
    // plus stress@10%) hit a real, pre-existing, RONIC-independent solver
    // state — the terminal value exceeding total value in that cell's own
    // bracket — never again the missing-input defect this test is named for.
    expect(cells.filter((c) => !c.fiveYearGrowth.suppressed)).toHaveLength(5);
    expect(
      cells
        .map((c) => c.fiveYearGrowth)
        .filter((f): f is Extract<Figure<Decimal>, { suppressed: true }> => f.suppressed)
        .every((f) => f.state === "DEGENERATE — TERMINAL EXCEEDS TOTAL VALUE")
    ).toBe(true);
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
