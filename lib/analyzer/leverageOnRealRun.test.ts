import { describe, it, expect, beforeEach } from "vitest";
import Decimal from "decimal.js";
import { buildAcquiredRun } from "./acquiredRun";
import { assembleAnalysisResult } from "./assemble";
import { withStatedD2Inputs } from "./fixtures/statedD2Inputs";
import { __resetAcquisitionCache } from "./acquisition/provider";

// ---------------------------------------------------------------------------
// §6.5 on real filings — V4's reference behaviour, reproduced from EDGAR.
//
// THE DEFECT. companyInputs.ts sets `leverage.enterpriseValue` to null with the
// comment "Filled by assemble from M1's own output" — and assemble evaluated the
// leverage precondition BEFORE M1 and never filled it. So every acquired run
// failed the precondition closed on a missing input, whatever the company's
// actual leverage, and the comment described behaviour that did not exist.
//
// It matters beyond tidiness: V4 pins Microsoft at "Leverage PASS at 0.8%", so a
// real MSFT run returning LEVERAGE UNSUPPORTED IN v1 contradicts the validation
// case — and under Fix 1 it now also removes the fair-value range and drops
// trust to UNUSABLE. A suppression that fires because of a wiring gap looks
// exactly like one that fires because of the company.
//
// The figures below are EDGAR's, not the fixture's:
//   total debt                $40.294B
//   finance lease liabilities $66.594B   (§6.5's "$66.6B of finance leases")
//   cash and securities       $76.843B
//   net debt                  $30.045B   (§6.5's "net debt of $30.0B")
// ---------------------------------------------------------------------------

const MSFT_CAPTURE_CLOSE = new Decimal("499.70");

describe("§6.5 leverage on an acquired MSFT run", () => {
  beforeEach(() => {
    __resetAcquisitionCache();
  });

  it("computes the net debt ratio instead of failing closed on its own EV", async () => {
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

    expect(result.gates.leverage.netDebtRatio).not.toBeNull();
    expect(result.gates.leverage.result).toBe("PASS");
  });

  it("reproduces V4's 0.8% from the filings, not from a fixture", async () => {
    // §6.5's reference behaviour: "Microsoft passes at 0.8%". Computed here from
    // acquired EDGAR figures and the recorded capture close.
    const run = await buildAcquiredRun({
      ticker: "MSFT",
      price: { value: MSFT_CAPTURE_CLOSE, timestamp: "2026-09-04", source: "recorded capture" },
      source: "CAPTURE",
      nonOperatingInvestments: { tags: [], value: new Decimal(0), errorDirection: null },
      profileHumanConfirmed: true,
    });

    const result = assembleAnalysisResult(run.fixture);
    const ratio = result.gates.leverage.netDebtRatio!;

    // Within a tenth of a point of the spec's figure. Not pinned tighter: the
    // share count and the close move with the capture, and the claim under test
    // is that the real ratio is computed and small, not that it equals a
    // constant forever.
    expect(ratio.mul(100).toNumber()).toBeGreaterThan(0.5);
    expect(ratio.mul(100).toNumber()).toBeLessThan(1.1);
  });

  it("does not suppress the range FOR A LEVERAGE REASON when nothing about leverage suppresses it (Fix 1 does not over-suppress)", async () => {
    // The other half of Fix 1, on real data: a run whose gates all pass must
    // not have ITS LEVERAGE GATE be why the range is gone. A fix that
    // suppressed on leverage everywhere would pass every suppression test in
    // this milestone and be just as wrong.
    //
    // CF-MSFT-STAGE2-DURABLE-SEED-01 (issue #442, migration
    // 010_msft_recorded_bundle_seed.sql) durably recorded Calvin's approved
    // MSFT Stage-2 candidate — a real, driver-authored analyst bundle, not
    // the validation-fixture carry-over A4 (CF-ANALYZER-INTEGRITY-PHASE-A-01)
    // used to suppress here. A real range now computes (this run's own §4.4
    // judgment — "none of the candidates are non-operating" — differs from
    // the approved candidate's own judgment, so the figures below are this
    // run's own, not the $214.26/$283.31/$402.73 snapshot migration 010
    // records). The point under test is still the same: leverage PASSing is
    // not why a range exists or doesn't.
    const run = await buildAcquiredRun({
      ticker: "MSFT",
      price: { value: MSFT_CAPTURE_CLOSE, timestamp: "2026-09-04", source: "recorded capture" },
      source: "CAPTURE",
      nonOperatingInvestments: { tags: [], value: new Decimal(0), errorDirection: null },
      profileHumanConfirmed: true,
    });

    // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — MSFT's recorded sheet is pending
    // adoption under D2, which would itself remove the range; STATED D2 test
    // inputs keep this test about leverage alone.
    const result = assembleAnalysisResult({ ...withStatedD2Inputs(run.fixture), scenarioValues: null, scenarioValuesAreFixtureCarried: false });

    expect(result.gates.gate0.result).toBe("PASS");
    expect(result.gates.leverage.result).toBe("PASS");
    expect(result.fairValueRange.kind).toBe("range");
    if (result.fairValueRange.kind === "range") {
      expect(result.fairValueRange.bear.greaterThan(0)).toBe(true);
      expect(result.fairValueRange.bull.greaterThan(result.fairValueRange.bear)).toBe(true);
    }
  });

  it("still fails closed where the EV bridge is genuinely INCOMPLETE (§5.3, V8)", async () => {
    // The fix must not become "leverage always computes". With §4.4's judgment
    // unanswered, enterprise value is INCOMPLETE and the precondition fails
    // closed — which is V8's expectation and §6.5's explicit rule.
    const run = await buildAcquiredRun({
      ticker: "MSFT",
      price: { value: MSFT_CAPTURE_CLOSE, timestamp: "2026-09-04", source: "recorded capture" },
      source: "CAPTURE",
      nonOperatingInvestments: null,
      profileHumanConfirmed: true,
    });

    const result = assembleAnalysisResult(run.fixture);

    expect(result.gates.leverage.netDebtRatio).toBeNull();
    expect(result.gates.leverage.result).toBe("LEVERAGE UNSUPPORTED IN v1");
    // And then Fix 1 applies: the range is the state.
    expect(result.fairValueRange.kind).toBe("suppressed");
  });
});
