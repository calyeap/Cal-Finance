import { getPool } from "../db";
import type { AnalysisResult, FactRecord } from "./types";
import type { CompanyFixture } from "./assemble";
import type { MarketSnapshot } from "./gate";
import type { RecordedJudgementState } from "./runStore";
import type { AiLayerReport } from "./reportAnalysis";
import type { StoredVerdict, VerdictState, VerdictStatus } from "./verdict";
import { toStorable, fromStorable } from "./storable";

// Moved to storable.ts (CF-AR3-REPRODUCIBLE-RUNS-01) so pure code — the run
// identity fingerprints assembly computes — can use the same tagging without
// importing the database pool. Re-exported for the existing importers.
export { toStorable, fromStorable };

// ---------------------------------------------------------------------------
// Persistence for CF-V2-PROOF-01's versioned snapshot (migration 004).
//
// There is deliberately no listing function here, on the same R7 reasoning
// as runStore.ts and aiOutputStore.ts: every function below takes the run_id
// it operates on, and none returns snapshots for a run_id the caller did not
// already supply.
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface StoredSnapshot {
  runId: string;
  version: number;
  result: AnalysisResult;
  aiLayer: AiLayerReport;
  verdict: StoredVerdict;
  createdAt: string;
}

/**
 * Persists one immutable snapshot and returns its version, starting at 1 for
 * a run's first. Assigned inside the same transaction as the insert — see
 * migration 004 for why a shared sequence is not needed here.
 */
export async function createSnapshot(
  runId: string,
  result: AnalysisResult,
  aiLayer: AiLayerReport,
  verdict: StoredVerdict,
  // CF-AR3-REPRODUCIBLE-RUNS-01 — the tuple the saved result was computed
  // from (migration 011's columns). Omitted, they stay null.
  snapshot?: RunOutputSnapshot
): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ next_version: number }>(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
         FROM analyzer_run_snapshots
        WHERE run_id = $1`,
      [runId]
    );
    const version = rows[0].next_version;

    await client.query(
      `INSERT INTO analyzer_run_snapshots
         (run_id, version, schema_version, analysis_result,
          ai_layer_status, ai_layer_model, ai_layer_detail,
          verdict_status, verdict_reason,
          fact_snapshot, price_snapshot, sheet_version, policy_version,
          code_version, judgement_snapshot, inputs_fingerprint, verdict_state)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        runId,
        version,
        result.schemaVersion,
        JSON.stringify(toStorable(result)),
        aiLayer.status,
        aiLayer.model,
        aiLayer.detail,
        // A pending-judgement state is not a verdict (frozen spec §14.9
        // AR0-4): it is stored as INCOMPLETE, with verdict_state naming it.
        verdict.status === "PENDING" ? "INCOMPLETE" : verdict.status,
        verdict.reason,
        snapshot === undefined ? null : JSON.stringify(toStorable(snapshot.factSnapshot)),
        snapshot === undefined ? null : JSON.stringify(toStorable(snapshot.priceSnapshot)),
        snapshot?.sheetVersion ?? null,
        snapshot?.policyVersion ?? null,
        snapshot?.codeVersion ?? null,
        snapshot === undefined ? null : JSON.stringify(toStorable(snapshot.judgementSnapshot)),
        snapshot?.inputsFingerprint ?? null,
        verdict.state,
      ]
    );

    await client.query("COMMIT");
    return version;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * One snapshot, exactly as stored — never recomputed. Omitting `version`
 * reads the run's latest, which is still addressed only through a run_id the
 * caller already holds, not a cross-run listing.
 */
export async function getSnapshot(runId: string, version?: number): Promise<StoredSnapshot | null> {
  if (!UUID.test(runId)) return null;

  const { rows } =
    version === undefined
      ? await getPool().query(
          `SELECT version, analysis_result, ai_layer_status, ai_layer_model, ai_layer_detail,
                  verdict_status, verdict_reason, verdict_state, created_at
             FROM analyzer_run_snapshots
            WHERE run_id = $1
            ORDER BY version DESC
            LIMIT 1`,
          [runId]
        )
      : await getPool().query(
          `SELECT version, analysis_result, ai_layer_status, ai_layer_model, ai_layer_detail,
                  verdict_status, verdict_reason, verdict_state, created_at
             FROM analyzer_run_snapshots
            WHERE run_id = $1 AND version = $2`,
          [runId, version]
        );

  if (rows.length === 0) return null;
  const r = rows[0];

  return {
    runId,
    version: r.version,
    result: fromStorable(r.analysis_result) as AnalysisResult,
    aiLayer: { status: r.ai_layer_status, model: r.ai_layer_model, detail: r.ai_layer_detail },
    verdict: storedVerdictOf(r.verdict_status, r.verdict_state, r.verdict_reason),
    createdAt: r.created_at,
  };
}

const PENDING_STATES: VerdictState[] = ["PENDING ADOPTION", "UNCERTAINTY QUESTION", "CLOSE CALL", "BUY CANDIDATE"];

/** A saved verdict as read back. Rows saved before migration 013 carry no state; it follows from the status. */
function storedVerdictOf(status: Exclude<VerdictStatus, "PENDING">, state: VerdictState | null, reason: string): StoredVerdict {
  if (state !== null && PENDING_STATES.includes(state)) return { status: "PENDING", state, reason };
  return { status, state: state ?? (status === "INCOMPLETE" ? "INCOMPLETE" : "ISSUED"), reason };
}

// ---------------------------------------------------------------------------
// CF-AR3-REPRODUCIBLE-RUNS-01 — stored run outputs (migration 011).
//
// The report reads a run's output from here and never recomputes it on view
// (reportAnalysis.ts). One row per state of the run's recorded judgements,
// write-once: a row is an immutable record of one computation, with the
// snapshot tuple it was computed from (frozen spec §14.9 AR0-5). Same R7
// shape as everything above: every function takes the run_id it reads.
// ---------------------------------------------------------------------------

/** The AR0-5 tuple one output was computed from. */
export interface RunOutputSnapshot {
  factSnapshot: FactRecord[];
  priceSnapshot: MarketSnapshot;
  sheetVersion: string;
  policyVersion: string;
  codeVersion: string;
  inputsFingerprint: string;
  judgementSnapshot: RecordedJudgementState;
}

export interface StoredRunOutput {
  runId: string;
  judgementsFingerprint: string;
  result: AnalysisResult;
  /** The CompanyFixture the result was assembled from; re-assembling it reproduces `result`. */
  engineInput: CompanyFixture;
  snapshot: RunOutputSnapshot;
  createdAt: string;
}

/**
 * The engine input, as stored. A fixture's `revalueBaseCaseAtRate` is code,
 * not data, and cannot be stored: it is written as null (every acquired run's
 * value except a committed validation fixture's own illustrative function).
 */
function storableEngineInput(fixture: CompanyFixture): unknown {
  return toStorable({ ...fixture, revalueBaseCaseAtRate: null });
}

/**
 * Stores one output. Write-once: a second write for the same run and
 * judgement state is a no-op, so two overlapping first views cannot replace
 * one computation with another.
 */
export async function saveRunOutput(
  runId: string,
  judgementsFingerprint: string,
  result: AnalysisResult,
  engineInput: CompanyFixture,
  snapshot: RunOutputSnapshot
): Promise<void> {
  await getPool().query(
    `INSERT INTO analyzer_run_outputs
       (run_id, judgements_fingerprint, schema_version, analysis_result, engine_input,
        fact_snapshot, price_snapshot, sheet_version, policy_version, code_version,
        judgement_snapshot, inputs_fingerprint)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (run_id, judgements_fingerprint) DO NOTHING`,
    [
      runId,
      judgementsFingerprint,
      result.schemaVersion,
      JSON.stringify(toStorable(result)),
      JSON.stringify(storableEngineInput(engineInput)),
      JSON.stringify(toStorable(snapshot.factSnapshot)),
      JSON.stringify(toStorable(snapshot.priceSnapshot)),
      snapshot.sheetVersion,
      snapshot.policyVersion,
      snapshot.codeVersion,
      JSON.stringify(toStorable(snapshot.judgementSnapshot)),
      snapshot.inputsFingerprint,
    ]
  );
}

/** The run's stored output for this judgement state, exactly as stored — never recomputed. */
export async function getRunOutput(runId: string, judgementsFingerprint: string): Promise<StoredRunOutput | null> {
  if (!UUID.test(runId)) return null;
  const { rows } = await getPool().query(
    `SELECT analysis_result, engine_input, fact_snapshot, price_snapshot, sheet_version,
            policy_version, code_version, judgement_snapshot, inputs_fingerprint, created_at
       FROM analyzer_run_outputs
      WHERE run_id = $1 AND judgements_fingerprint = $2`,
    [runId, judgementsFingerprint]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    runId,
    judgementsFingerprint,
    result: fromStorable(r.analysis_result) as AnalysisResult,
    engineInput: fromStorable(r.engine_input) as CompanyFixture,
    snapshot: {
      factSnapshot: fromStorable(r.fact_snapshot) as FactRecord[],
      priceSnapshot: fromStorable(r.price_snapshot) as MarketSnapshot,
      sheetVersion: r.sheet_version,
      policyVersion: r.policy_version,
      codeVersion: r.code_version,
      inputsFingerprint: r.inputs_fingerprint,
      judgementSnapshot: fromStorable(r.judgement_snapshot) as RecordedJudgementState,
    },
    createdAt: r.created_at,
  };
}

/**
 * The market data this run is valued on: its FIRST stored output's. Every
 * later output of the same run reuses it, so recording a judgement never
 * moves the run to a newer price. Null before the run's first output.
 */
export async function getRunMarketSnapshot(runId: string): Promise<MarketSnapshot | null> {
  if (!UUID.test(runId)) return null;
  const { rows } = await getPool().query(
    `SELECT price_snapshot
       FROM analyzer_run_outputs
      WHERE run_id = $1
      ORDER BY created_at ASC
      LIMIT 1`,
    [runId]
  );
  return rows.length === 0 ? null : (fromStorable(rows[0].price_snapshot) as MarketSnapshot);
}
