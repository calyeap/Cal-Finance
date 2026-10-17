import { getPool } from "../db";
import type { AnalysisResult } from "./types";
import { writeAnalystLog, type AnalystCall } from "./ai/analystCall";
import { runUncertaintyProposal, type UncertaintyProposal } from "./ai/uncertaintyProposal";

// ---------------------------------------------------------------------------
// CF-AR5-VERDICT-CONSOLIDATION-01 — the AI uncertainty proposal for a run
// (migration 013), generated once and read back. Asked for only while the
// verdict poses the one uncertainty question; a failure costs the page the
// proposal and nothing else — the question still stands and Calvin answers
// it with or without one.
// ---------------------------------------------------------------------------

export type UncertaintyProposalReport =
  | { status: "COMPLETED"; proposal: UncertaintyProposal; model: string }
  | { status: "NOT CONFIGURED" | "FAILED"; detail: string };

async function getStored(runId: string): Promise<{ proposal: UncertaintyProposal; model: string } | null> {
  const { rows } = await getPool().query<{ level: UncertaintyProposal["level"]; evidence: UncertaintyProposal["evidence"]; model: string }>(
    `SELECT level, evidence, model FROM analyzer_uncertainty_proposals WHERE run_id = $1`,
    [runId]
  );
  return rows.length === 0 ? null : { proposal: { level: rows[0].level, evidence: rows[0].evidence }, model: rows[0].model };
}

export async function uncertaintyProposalForRun(
  runId: string,
  result: AnalysisResult,
  call: AnalystCall | null,
  model: string
): Promise<UncertaintyProposalReport> {
  const stored = await getStored(runId);
  if (stored !== null) return { status: "COMPLETED", ...stored };
  if (call === null) {
    return { status: "NOT CONFIGURED", detail: "No model credentials are configured, so the AI did not propose a level. Your answer is all the question needs." };
  }
  try {
    const proposal = await runUncertaintyProposal(result, call);
    await getPool().query(
      `INSERT INTO analyzer_uncertainty_proposals (run_id, level, evidence, model)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (run_id) DO NOTHING`,
      [runId, proposal.level, JSON.stringify(proposal.evidence), model]
    );
    const saved = await getStored(runId);
    return saved === null ? { status: "COMPLETED", proposal, model } : { status: "COMPLETED", ...saved };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    writeAnalystLog(`uncertaintyProposal failed for ${runId} — ${detail}`);
    return { status: "FAILED", detail: "The AI's proposal was refused or could not be produced. Your answer is all the question needs." };
  }
}
