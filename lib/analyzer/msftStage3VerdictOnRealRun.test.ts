import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision, recordJudgment } from "./runStore";
import { computeAnalysisForRun, loadGateState } from "./gate";
import { deriveVerdict } from "./verdict";
import { assembleAnalysisResult } from "./assemble";
import { withStatedD2Inputs } from "./fixtures/statedD2Inputs";

// ---------------------------------------------------------------------------
// CF-ANALYZER-STAGE3-VERDICT-FINISH-01 — the real production-path proof this
// outcome's own DONE WHEN (A) asks for: one eligible real company, running
// through createRun -> computeAnalysisForRun -> deriveVerdict exactly as a
// live request would, produces a defensible, non-fabricated BUY/HOLD/SELL
// under ALREADY-APPROVED rules — the live Cal Finance Methodology's "Verdict
// synthesis policy v1" (APPROVED 22 Sep 2026), confirmed still current by
// `CALVIN RULING — NO` on PR #430 (2026-10-14).
//
// MSFT is eligible: migration 010 durably recorded Calvin's approved Stage-2
// candidate (issue #442/#443), so this run's own fair-value range and Base
// scenario value are not a fixture stand-in — they are the exact
// $214.26/$283.31/$402.73 figures Calvin approved
// (PR #440#issuecomment-6213272009), recomputed dynamically from the
// recorded drivers against the real pinned SEC capture, exactly as
// msftStage2DurableBundleSeed.test.ts already proves for the valuation
// layer alone. This file is the one additional step that outcome's own HARD
// BOUNDS deferred: calling deriveVerdict on the resulting AnalysisResult.
//
// Self-seeding, not order-dependent: lib/analyzer/acquisition/
// msftStage2ValuationProof.test.ts and msftRealValuationUnblock.test.ts both
// delete MSFT's recorded row around their own tests and restore nothing
// (msftStage2DurableBundleSeed.test.ts's own header documents exactly this),
// so this file re-applies migration 010's own SQL directly, the same
// discipline msftStage2DurableBundleSeed.test.ts uses, rather than assuming
// another file's cleanup already ran first in a serial suite.
// ---------------------------------------------------------------------------

const MIGRATION_SQL = readFileSync(
  join(process.cwd(), "migrations", "010_msft_recorded_bundle_seed.sql"),
  "utf-8"
);

async function applySeedMigration(): Promise<void> {
  await getPool().query(MIGRATION_SQL);
}

async function completeSpotCheck(runId: string): Promise<void> {
  const state = await loadGateState(runId);
  for (const factId of state.outstandingFactIds) {
    await recordFactDecision(runId, factId, "CONFIRMED", null);
  }
}

async function openMsftRunWithRuling() {
  const runId = await createRun("MSFT", "Microsoft Corporation");
  await recordJudgment(
    runId,
    "NON-OPERATING INVESTMENTS",
    "us-gaap:LongTermInvestments",
    "Calvin's §4.4 ruling, 2026-09-21T08:19:14Z, issue #188."
  );
  await completeSpotCheck(runId);
  const state = await loadGateState(runId);
  await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
  return computeAnalysisForRun(runId);
}

describe("CF-ANALYZER-STAGE3-VERDICT-FINISH-01 — MSFT's real run reaches a defensible verdict, or says why not", () => {
  beforeEach(async () => {
    await getPool().query("TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE");
    await applySeedMigration();
  });

  afterAll(async () => {
    // Leave the table as migration 010 itself wants it to end up, for any
    // later file in this same run that exercises a real MSFT run.
    await applySeedMigration();
    await getPool().end();
  });

  // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — reviewed evaluator change. This
  // pinned SELL off the 16 Oct 2026 Stage-2 Base ($283.31 end-of-year, 10%
  // rate, capital-intensity reinvestment), which product-decisions item 27
  // (D2) supersedes. Migration 010's sheet carries no D2 input, so it is
  // pending adoption: the verdict is INCOMPLETE and says why — never a
  // manufactured HOLD (Methodology, verdict semantics), never the superseded
  // SELL. The verdict rule itself is unchanged (AR5 owns it): once the sheet
  // carries the D2 inputs — STATED TEST INPUTS here, never recorded — the
  // same rule reads price against the D2 Base at the D1 rate.
  it("is INCOMPLETE while MSFT's recorded sheet is pending adoption — no value, so no verdict, and the reason says so", async () => {
    const result = await openMsftRunWithRuling();

    expect(result.valuationBasis?.d2.status).toBe("PENDING ADOPTION");
    expect(result.fairValueRange.kind).toBe("suppressed");
    expect(result.price.value.toFixed(2)).toBe("499.70");

    const verdict = deriveVerdict(result);
    expect(verdict.status).toBe("INCOMPLETE");
    expect(verdict.reason).toMatch(/Pending adoption/);
  });

  it("with the D2 inputs on the sheet, the unchanged V1 rule reads price against the D2 Base at the D1 rate", async () => {
    const runId = await createRun("MSFT", "Microsoft Corporation");
    await recordJudgment(
      runId,
      "NON-OPERATING INVESTMENTS",
      "us-gaap:LongTermInvestments",
      "Calvin's §4.4 ruling, 2026-09-21T08:19:14Z, issue #188."
    );
    await completeSpotCheck(runId);
    const state = await loadGateState(runId);
    await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
    const decided = await loadGateState(runId);

    const result = assembleAnalysisResult(withStatedD2Inputs(decided.fixture));
    expect(result.valuationBasis?.discountRate.rate.toString()).toBe("0.09");
    expect(result.fairValueRange.kind).toBe("range");

    // At these stated inputs price sits just under the High-bucket SELL
    // line, so which band applies depends on the uncertainty bucket — the
    // rule says so rather than picking one (Methodology v2.1 D3's "one
    // question" case, which AR5 builds). The rule is read, not changed.
    const verdict = deriveVerdict(result);
    expect(verdict.reason).toContain("Verdict synthesis policy v1");
    expect(verdict.reason).not.toMatch(/Pending adoption/);
    // The ratio the reason states is price ÷ this run's own D2 Base, to 4 dp.
    expect(verdict.reason).toContain(result.price.value.dividedBy(result.scenarioOutputs.values.base).toFixed(4));
  });
});
