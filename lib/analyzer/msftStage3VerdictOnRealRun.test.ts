import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision, recordJudgment } from "./runStore";
import { computeAnalysisForRun, loadGateState } from "./gate";
import { deriveVerdict } from "./verdict";
import { assembleAnalysisResult } from "./assemble";
import { withStatedD2Inputs } from "./fixtures/statedD2Inputs";
import { NO_VERDICT_JUDGEMENTS } from "./verdictJudgements";

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

  // CF-AR5-VERDICT-CONSOLIDATION-01 — reviewed evaluator change (MSFT
  // first). Migration 010's sheet carries no D2 input, so it is pending
  // adoption: a pending-judgement state, not a verdict and not INCOMPLETE
  // (Calvin, Option A on #447). Real-app MSFT verdicts move to AR6 (#454),
  // after Calvin adopts the sheet.
  it("is PENDING ADOPTION while MSFT's recorded sheet carries no D2 input — no value, so no verdict, and the reason says so", async () => {
    const result = await openMsftRunWithRuling();

    expect(result.valuationBasis?.d2.status).toBe("PENDING ADOPTION");
    expect(result.fairValueRange.kind).toBe("suppressed");
    expect(result.price.value.toFixed(2)).toBe("499.70");

    const verdict = deriveVerdict(result);
    expect(verdict.status).toBe("PENDING");
    expect(verdict.state).toBe("PENDING ADOPTION");
    expect(verdict.reason).toMatch(/Pending adoption/);
  });

  // With the D2 inputs on the sheet — STATED TEST INPUTS here, never
  // recorded and nobody's judgement — the real MSFT run goes through the
  // whole D3 path: the Base revalued at 8.5% / 9.0% / 9.5% by the same engine,
  // the nine-point check, and Calvin's answer as a versioned input.
  it("with the D2 inputs on the sheet, the real run's nine-point check is internally consistent and only Calvin's bound answer resolves it", async () => {
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

    // The check's Base at the rate in use IS the Base the report shows, and
    // a lower rate values the same cash flows higher.
    const baseAt = result.verdictInputs!.baseAtCheckRates!;
    expect(baseAt.rate.equals(result.scenarioOutputs.values.base)).toBe(true);
    expect(baseAt.lower.greaterThan(baseAt.rate)).toBe(true);
    expect(baseAt.rate.greaterThan(baseAt.upper)).toBe(true);

    const verdict = deriveVerdict(result);
    expect(verdict.check).not.toBeNull();
    for (const r of ["lower", "rate", "upper"] as const) {
      expect(verdict.check!.ratios[r].equals(result.price.value.dividedBy(baseAt[r]))).toBe(true);
    }
    // At these stated inputs $499.70 is ≈1.34× / 1.45× / 1.56× Base: the
    // High-uncertainty SELL line (1.45×) falls inside the rate band, so the
    // rate matters — a close call between HOLD and SELL, never an issued
    // verdict without Calvin.
    expect(verdict.status).toBe("PENDING");
    expect(verdict.state).toBe("CLOSE CALL");
    expect(verdict.check!.routing).toEqual({ kind: "CLOSE CALL", zones: ["HOLD", "SELL"] });
    expect(verdict.closeCallBinding).toBe(result.runIdentity!.inputsFingerprint);

    const recorded = (answer: "SELL" | "not sure", boundTo: string) => ({
      ...result,
      verdictJudgements: {
        ...NO_VERDICT_JUDGEMENTS,
        closeCalls: [{ answer, note: null, recordedAt: "2026-10-17T00:00:00.000Z", version: 1, boundTo }],
      },
    });
    const answered = deriveVerdict(recorded("SELL", verdict.closeCallBinding!));
    expect(answered.status).toBe("SELL");
    expect(answered.basis).toBe("YOUR CLOSE CALL");
    expect(deriveVerdict(recorded("not sure", verdict.closeCallBinding!)).state).toBe("CLOSE CALL");
    expect(deriveVerdict(recorded("SELL", "inputs-sha256:some-other-run")).state).toBe("CLOSE CALL");

    // D4's computed floor on the real filings: MSFT's 5-yr average ROIC
    // including goodwill is well above the 9.0% rate.
    expect(result.verdictInputs!.roicFloor.status).toBe("PASS");
  });
});
