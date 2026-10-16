import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision, recordJudgment } from "./runStore";
import { computeAnalysisForRun, loadGateState } from "./gate";
import { deriveVerdict } from "./verdict";

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

describe("CF-ANALYZER-STAGE3-VERDICT-FINISH-01 — MSFT's real run reaches a defensible verdict", () => {
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

  it("is SELL — real price $499.70 against the real recomputed Base $283.31 (1.7638×) clears the strictest uncertainty-bucket SELL threshold, invariant to the one still-open house-policy item (the bucket formula)", async () => {
    const result = await openMsftRunWithRuling();

    // The same real, Calvin-approved figures msftStage2DurableBundleSeed.test.ts
    // proves at the valuation layer — re-asserted here so this file does not
    // silently drift from that proof if either changes.
    expect(result.trust.status).toBe("PARTIAL");
    expect(result.fairValueRange.kind).toBe("range");
    if (result.fairValueRange.kind !== "range") return;
    expect(result.fairValueRange.bear.toFixed(2)).toBe("214.26");
    expect(result.fairValueRange.bull.toFixed(2)).toBe("402.73");
    expect(result.scenarioOutputs.values.base.toFixed(2)).toBe("283.31");
    expect(result.price.value.toFixed(2)).toBe("499.70");
    expect(result.price.timestamp).not.toBe("");

    const verdict = deriveVerdict(result);

    expect(verdict.status).toBe("SELL");
    expect(verdict.reason).toContain("Verdict synthesis policy v1");
    expect(verdict.reason).toContain("1.7638");
    expect(verdict.reason).toContain("all three uncertainty buckets");
  });
});
