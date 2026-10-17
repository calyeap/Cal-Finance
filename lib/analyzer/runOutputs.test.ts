import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision, recordJudgment } from "./runStore";
import { loadGateState } from "./gate";
import { analysisForReport, currentRunOutput } from "./reportAnalysis";
import { assembleAnalysisResult } from "./assemble";
import { createDeepSnapshot } from "./snapshotAnalysis";
import { getRunOutput } from "./snapshotStore";
import { canonicalJson, fingerprint } from "./runIdentity";
import { getRecordedJudgementState } from "./runStore";
import { deriveVerdict } from "./verdict";

// ---------------------------------------------------------------------------
// CF-AR3-REPRODUCIBLE-RUNS-01 — reproducible, dated runs, through the real
// database and the same entry point the report page uses (migration 011).
// ---------------------------------------------------------------------------

async function completeMsftRun(): Promise<string> {
  const runId = await createRun("MSFT", "Microsoft Corporation");
  await recordJudgment(runId, "NON-OPERATING INVESTMENTS", "None of these are non-operating", null);
  const state = await loadGateState(runId);
  for (const factId of state.outstandingFactIds) await recordFactDecision(runId, factId, "CONFIRMED", null);
  await recordProfileDecision(runId, "CONFIRMED", "MATURE_PROFITABLE", null);
  return runId;
}

async function storedRowCount(runId: string): Promise<number> {
  const { rows } = await getPool().query("SELECT count(*)::int AS n FROM analyzer_run_outputs WHERE run_id = $1", [runId]);
  return rows[0].n;
}

describe("CF-AR3 — the report reads stored outputs", () => {
  beforeEach(async () => {
    await getPool().query(
      "TRUNCATE analyzer_run_outputs, analyzer_run_snapshots, analyzer_run_ai_outputs, analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE"
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("stores the first view's output, with its snapshot tuple, and reports nothing stored before it", async () => {
    const runId = await completeMsftRun();
    expect(await currentRunOutput(runId)).toBeNull();

    const report = await analysisForReport(runId, null);

    expect(await storedRowCount(runId)).toBe(1);
    const snapshot = report.snapshot!;
    expect(snapshot.policyVersion).toBe(report.result.policy.version);
    expect(snapshot.codeVersion).toBe(report.result.runIdentity!.codeVersion);
    expect(snapshot.sheetVersion).toMatch(/^sheet-sha256:/);
    expect(snapshot.inputsFingerprint).toBe(report.result.runIdentity!.inputsFingerprint);
    expect(snapshot.factSnapshot.length).toBe(report.result.facts.length);
    expect(snapshot.priceSnapshot.price?.timestamp).toBe(report.result.price.timestamp);
    // The AR5 judgement slots exist, unfilled.
    expect(snapshot.judgementSnapshot.uncertainty).toBeNull();
    expect(snapshot.judgementSnapshot.moatClass).toBeNull();
    expect(snapshot.judgementSnapshot.managementRating).toBeNull();
    expect(snapshot.judgementSnapshot.thesisState).toBeNull();
    expect(snapshot.judgementSnapshot.judgments).toEqual([
      { judgmentKey: "NON-OPERATING INVESTMENTS", selection: "None of these are non-operating" },
    ]);
  });

  it("a later view returns the stored row, not a recomputation", async () => {
    const runId = await completeMsftRun();
    await analysisForReport(runId, null);

    // Mark the stored row. A recomputation could not produce the mark; only a
    // read of the row can.
    await getPool().query(
      `UPDATE analyzer_run_outputs SET analysis_result = jsonb_set(analysis_result, '{companyName}', '"STORED ROW"') WHERE run_id = $1`,
      [runId]
    );
    const again = await analysisForReport(runId, null);

    expect(again.result.companyName).toBe("STORED ROW");
    expect(await storedRowCount(runId)).toBe(1);
  });

  it("first view and later views are identical — what the first view returns is the stored row", async () => {
    const runId = await completeMsftRun();
    const first = await analysisForReport(runId, null);
    const second = await analysisForReport(runId, null);
    expect(canonicalJson(second.result)).toBe(canonicalJson(first.result));
  });

  it("rerun with the same snapshot → identical outputs: re-assembling the stored engine input reproduces the stored result", async () => {
    const runId = await completeMsftRun();
    await analysisForReport(runId, null);
    const judgements = fingerprint("judgements", await getRecordedJudgementState(runId));
    const stored = (await getRunOutput(runId, judgements))!;

    const rerun = assembleAnalysisResult(stored.engineInput);

    expect(canonicalJson(rerun)).toBe(canonicalJson(stored.result));
    expect(deriveVerdict(rerun)).toEqual(deriveVerdict(stored.result));
  });

  it("two runs on the same inputs share the input fingerprint and the verdict", async () => {
    const a = await analysisForReport(await completeMsftRun(), null);
    const b = await analysisForReport(await completeMsftRun(), null);
    expect(b.result.runIdentity!.inputsFingerprint).toBe(a.result.runIdentity!.inputsFingerprint);
    expect(deriveVerdict(b.result)).toEqual(deriveVerdict(a.result));
  });

  it("recording a judgement produces a new stored output, valued on the run's own pinned market data", async () => {
    const runId = await completeMsftRun();
    const before = await analysisForReport(runId, null);

    // Pin a recognisably different market snapshot on the first row, so a
    // second computation that re-fetched the price could not match it.
    await getPool().query(
      `UPDATE analyzer_run_outputs
          SET price_snapshot = jsonb_set(price_snapshot, '{price,timestamp}', '"2026-01-02"')
        WHERE run_id = $1`,
      [runId]
    );
    await recordProfileDecision(runId, "CANNOT JUDGE", "MATURE_PROFITABLE", null);
    const after = await analysisForReport(runId, null);

    expect(await storedRowCount(runId)).toBe(2);
    expect(after.snapshot!.judgementSnapshot.profile.decision).toBe("CANNOT JUDGE");
    expect(after.result.price.timestamp).toBe("2026-01-02");
    expect(before.result.price.timestamp).not.toBe("2026-01-02");
  });

  it("a saved version records the tuple of the output it saved", async () => {
    const runId = await completeMsftRun();
    const saved = await createDeepSnapshot(runId, null);
    const { rows } = await getPool().query(
      `SELECT policy_version, code_version, sheet_version, inputs_fingerprint, price_snapshot, fact_snapshot, judgement_snapshot
         FROM analyzer_run_snapshots WHERE run_id = $1 AND version = $2`,
      [runId, saved.version]
    );
    expect(rows[0].policy_version).toBe(saved.result.policy.version);
    expect(rows[0].code_version).toBe(saved.result.runIdentity!.codeVersion);
    expect(rows[0].inputs_fingerprint).toBe(saved.result.runIdentity!.inputsFingerprint);
    expect(rows[0].sheet_version).toBe(saved.result.runIdentity!.sheetVersion);
    expect(rows[0].price_snapshot).not.toBeNull();
    expect(rows[0].fact_snapshot).not.toBeNull();
    expect(rows[0].judgement_snapshot).not.toBeNull();
  });
});
