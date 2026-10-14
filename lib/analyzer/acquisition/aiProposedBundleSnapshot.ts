import { getPool } from "../../db";
import { toStorable, fromStorable } from "../snapshotStore";
import type { AnalystInputBundle } from "./analystInputs";

// ---------------------------------------------------------------------------
// A5 (CF-ANALYZER-INTEGRITY-PHASE-A-01) — see migration
// 009_ai_proposed_bundle_snapshot.sql for the defect and the fix. This file
// is that table's persistence, read and written only by analystInputsFor
// (analystInputs.ts) — never a second resolver, and never imported by
// acquiredRun.ts or any script directly.
// ---------------------------------------------------------------------------

/** This run's own pinned bundle, or null if it has never resolved one. */
export async function getAiProposedBundleSnapshot(runId: string): Promise<AnalystInputBundle | null> {
  const { rows } = await getPool().query<{ bundle: unknown }>(
    `SELECT bundle FROM analyzer_run_ai_proposed_bundles WHERE run_id = $1`,
    [runId]
  );
  if (rows.length === 0) return null;
  return fromStorable(rows[0].bundle) as AnalystInputBundle;
}

/**
 * Pins `bundle` to `runId`, once. `ON CONFLICT DO NOTHING` rather than an
 * upsert: a row here is this run's own FIRST successful resolution, and the
 * whole point of A5 is that nothing — a later re-resolution, a cache
 * expiry, a process restart — may ever replace it. Idempotent to call on
 * every open, like `recordAutomaticFactDecisions`' own "never overwrites a
 * decision already made" discipline (runStore.ts), not something the
 * caller needs to guard with its own existence check first.
 */
export async function saveAiProposedBundleSnapshot(runId: string, bundle: AnalystInputBundle): Promise<void> {
  await getPool().query(
    `INSERT INTO analyzer_run_ai_proposed_bundles (run_id, bundle)
     VALUES ($1, $2)
     ON CONFLICT (run_id) DO NOTHING`,
    [runId, JSON.stringify(toStorable(bundle))]
  );
}
