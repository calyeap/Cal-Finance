import { getPool } from "../../db";
import type { JudgmentKey } from "../decisions";

// ---------------------------------------------------------------------------
// CF-ANALYZER-FINAL-CLOSEOUT-01 (issue #383) — a §4.4 judgment recorded once
// for a ticker, reusable by every later run of that same company. Migration
// 007's own header carries the full authority and the "what this is not"
// boundary; read that before changing this file.
//
// One resolver, same discipline as recordedBundles.ts (CF-ANALYST-INPUT-
// ENTRY-01): lib/analyzer/autoRun.ts is the only caller that reads a
// recorded judgment to apply it, and it applies one only where THIS run
// carries no judgment of its own yet (analyzer_run_judgments, keyed by
// run_id) — a human deciding differently on one run, past or future, always
// wins over what is recorded here.
// ---------------------------------------------------------------------------

export interface RecordedJudgment {
  selection: string;
  reason: string | null;
  recordedAt: string;
  updatedAt: string;
}

/**
 * Upserts the recorded judgment for one ticker + judgment key. The most
 * recent human decision wins — recording a new selection replaces the old
 * one for every run of this ticker from this point on, the same "last
 * decision wins" rule recordAnalystBundle already applies per ticker.
 */
export async function recordCompanyJudgment(
  rawTicker: string,
  judgmentKey: JudgmentKey,
  selection: string,
  reason: string | null
): Promise<void> {
  const ticker = rawTicker.trim().toUpperCase();
  if (ticker === "") throw new Error("A ticker is required");
  if (selection.trim() === "") throw new Error("A judgment records the selection that was made (§4.4)");

  await getPool().query(
    `INSERT INTO analyzer_recorded_judgments (ticker, judgment_key, selection, reason)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (ticker, judgment_key) DO UPDATE SET
       selection = EXCLUDED.selection,
       reason = EXCLUDED.reason,
       updated_at = now()`,
    [ticker, judgmentKey, selection, reason]
  );
}

/** The recorded judgment for one ticker + judgment key, or null if none was ever recorded. */
export async function getRecordedCompanyJudgment(
  rawTicker: string,
  judgmentKey: JudgmentKey
): Promise<RecordedJudgment | null> {
  const ticker = rawTicker.trim().toUpperCase();
  if (ticker === "") return null;

  const { rows } = await getPool().query(
    `SELECT selection, reason, recorded_at, updated_at
       FROM analyzer_recorded_judgments
      WHERE ticker = $1 AND judgment_key = $2`,
    [ticker, judgmentKey]
  );
  if (rows.length === 0) return null;
  const row = rows[0] as { selection: string; reason: string | null; recorded_at: string; updated_at: string };
  return {
    selection: row.selection,
    reason: row.reason,
    recordedAt: row.recorded_at,
    updatedAt: row.updated_at,
  };
}
