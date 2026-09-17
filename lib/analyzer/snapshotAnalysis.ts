import { analysisForReport, type AiLayerReport } from "./reportAnalysis";
import { deriveVerdict, type VerdictResult } from "./verdict";
import { createSnapshot, getSnapshot } from "./snapshotStore";
import type { AnalysisResult } from "./types";
import type { AnalystCall } from "./ai/analystCall";

// ---------------------------------------------------------------------------
// CF-V2-PROOF-01's V2 boundary, end to end.
//
// ONE SHARED EXECUTION PATH. createDeepSnapshot calls analysisForReport —
// the exact function the live report page calls — and forks no calculation:
// the deterministic engine and the AI merge both run exactly as they do for
// a live view. The only new step is what happens to the result afterward.
//
// reopenDeepSnapshot never calls analysisForReport, computeAnalysisForRun or
// any calculation module. It reads the stored row and nothing else — the
// "reopen it faithfully... without silently recomputing it" half of the
// proof is that this function's only data source is the database write
// createDeepSnapshot already made.
// ---------------------------------------------------------------------------

export interface DeepSnapshotReport {
  version: number;
  result: AnalysisResult;
  aiLayer: AiLayerReport;
  verdict: VerdictResult;
}

export async function createDeepSnapshot(
  runId: string,
  call?: AnalystCall | null
): Promise<DeepSnapshotReport> {
  const report = call === undefined ? await analysisForReport(runId) : await analysisForReport(runId, call);
  const verdict = deriveVerdict(report.result);
  const version = await createSnapshot(runId, report.result, report.aiLayer, verdict);

  return { version, result: report.result, aiLayer: report.aiLayer, verdict };
}

export async function reopenDeepSnapshot(runId: string, version?: number): Promise<DeepSnapshotReport | null> {
  const stored = await getSnapshot(runId, version);
  if (stored === null) return null;

  return { version: stored.version, result: stored.result, aiLayer: stored.aiLayer, verdict: stored.verdict };
}
