import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision, recordJudgment } from "./runStore";
import { computeAnalysisForRun, loadGateState } from "./gate";
import { resetSheetsToMigrated } from "./sheets/testSupport";
import type { AnalysisResult } from "./types";

// ---------------------------------------------------------------------------
// A1 (CF-ANALYZER-INTEGRITY-PHASE-A-01) — the TTM-revenue fix, proved on the
// full real-run pipeline (gate.ts -> companyInputs.ts -> ttmFrom), not only
// on `quarterlySeriesWithDerivedQ4` in isolation (history.test.ts already
// covers that). Run-opening helpers copied verbatim from
// step4FinalRealRunProof.test.ts, which copied them from
// step4SignalObservationOnRealRun.test.ts in turn — not invented here.
// ---------------------------------------------------------------------------

async function completeSpotCheck(runId: string): Promise<void> {
  const state = await loadGateState(runId);
  for (const factId of state.outstandingFactIds) {
    await recordFactDecision(runId, factId, "CONFIRMED", null);
  }
}

async function openMsftRunWithRuling(): Promise<AnalysisResult> {
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

async function openOkloRunUnchanged(): Promise<AnalysisResult> {
  const runId = await createRun("OKLO", "Oklo Inc.");
  await completeSpotCheck(runId);
  const state = await loadGateState(runId);
  await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
  return computeAnalysisForRun(runId);
}


// CF-AR6-ANY-TICKER-DRAFTS-01 — NVDA's sheet is migration 014's copy of
// migration 008's approved bundle; restoring the migrated sheets leaves it
// exactly where the migrations put it.
async function seedApprovedNvdaBundle(): Promise<void> {
  await resetSheetsToMigrated();
}

async function openNvdaObservationRun(): Promise<AnalysisResult> {
  await resetSheetsToMigrated();
  const runId = await createRun("NVDA", "NVIDIA Corporation");
  await completeSpotCheck(runId);
  const state = await loadGateState(runId);
  await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
  return computeAnalysisForRun(runId);
}

describe("A1 (CF-ANALYZER-INTEGRITY-PHASE-A-01) — trailing-twelve-month revenue on the real-run pipeline", () => {
  beforeEach(async () => {
    await getPool().query("TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE");
    await seedApprovedNvdaBundle();
  });

  afterAll(async () => {
    await seedApprovedNvdaBundle();
    await getPool().end();
  });

  it("MSFT: diagnostics.runRate.ttm is FY2026's own filed total, never the bogus ~311.9B blend", async () => {
    const result = await openMsftRunWithRuling();
    const ttm = result.diagnostics.runRate.ttm;
    expect(ttm).not.toBeNull();
    expect(ttm!.toString()).toBe("331839000000");
  });

  it("NVDA: diagnostics.runRate.ttm is the independently-derivable ~302.9B, never the bogus ~281.6B blend", async () => {
    const result = await openNvdaObservationRun();
    const ttm = result.diagnostics.runRate.ttm;
    expect(ttm).not.toBeNull();
    expect(ttm!.toString()).toBe("302969000000");
  });

  it("OKLO regression: too few quarters for any TTM — reads unavailable, not a number", async () => {
    const result = await openOkloRunUnchanged();
    expect(result.diagnostics.runRate.ttm).toBeNull();
  });
});
