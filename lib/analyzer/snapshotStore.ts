import Decimal from "decimal.js";
import { getPool } from "../db";
import type { AnalysisResult } from "./types";
import type { AiLayerReport } from "./reportAnalysis";
import type { VerdictResult } from "./verdict";

// ---------------------------------------------------------------------------
// Persistence for CF-V2-PROOF-01's versioned snapshot (migration 004).
//
// There is deliberately no listing function here, on the same R7 reasoning
// as runStore.ts and aiOutputStore.ts: every function below takes the run_id
// it operates on, and none returns snapshots for a run_id the caller did not
// already supply.
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DECIMAL_TAG = "__decimal__";

/**
 * AnalysisResult carries Decimal instances throughout (facts, gates,
 * scenarios, fairValueRange, ...). JSON.stringify would call Decimal's own
 * toJSON() and flatten them to plain strings before any replacer sees them,
 * which is indistinguishable on the way back from a string that was always a
 * string. Tagging first, in a walk that runs before JSON.stringify touches
 * the tree, is what makes the round trip exact rather than merely plausible.
 */
function toStorable(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Decimal) return { [DECIMAL_TAG]: value.toString() };
  if (Array.isArray(value)) return value.map(toStorable);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = toStorable(v);
    }
    return out;
  }
  return value;
}

function fromStorable(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(fromStorable);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record[DECIMAL_TAG] === "string") {
      return new Decimal(record[DECIMAL_TAG] as string);
    }
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(record)) {
      out[key] = fromStorable(v);
    }
    return out;
  }
  return value;
}

export interface StoredSnapshot {
  runId: string;
  version: number;
  result: AnalysisResult;
  aiLayer: AiLayerReport;
  verdict: VerdictResult;
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
  verdict: VerdictResult
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
          verdict_status, verdict_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        runId,
        version,
        result.schemaVersion,
        JSON.stringify(toStorable(result)),
        aiLayer.status,
        aiLayer.model,
        aiLayer.detail,
        verdict.status,
        verdict.reason,
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
                  verdict_status, verdict_reason, created_at
             FROM analyzer_run_snapshots
            WHERE run_id = $1
            ORDER BY version DESC
            LIMIT 1`,
          [runId]
        )
      : await getPool().query(
          `SELECT version, analysis_result, ai_layer_status, ai_layer_model, ai_layer_detail,
                  verdict_status, verdict_reason, created_at
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
    verdict: { status: r.verdict_status, reason: r.verdict_reason },
    createdAt: r.created_at,
  };
}
