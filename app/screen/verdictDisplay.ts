import { computeAnalysisForRun, SpotCheckIncompleteError } from "@/lib/analyzer/gate";
import { deriveVerdict, type VerdictStatus } from "@/lib/analyzer/verdict";

// SCREEN's read of each candidate's existing Analyzer verdict state
// (CF-SCREEN-FIRST-OUTCOME-01, issue #379 DO 3/DO 4; REVIEW-36553409661-1
// bounded correction on PR #380). SCREEN surfaces the report's own state
// honestly rather than re-deriving or summarising it: `computeAnalysisForRun`
// is the read-only gated entry to calculation (lib/analyzer/gate.ts) — never
// `advanceRunAutomatically` (writes) or `analysisForReport` (may call the
// model) — and `deriveVerdict`'s status/reason are shown exactly as
// returned. This module computes nothing of its own beyond that read.
//
// A run whose Step 2 spot-check is itself incomplete (`SpotCheckIncompleteError`)
// is a distinct, earlier INCOMPLETE than `deriveVerdict`'s own INCOMPLETE
// status. `gateIncompleteReason` below reproduces
// `app/analyzer/[runId]/page.tsx`'s `IncompleteRun` wording for that case
// word for word (no new text), without modifying that route.
export type ScreenVerdictDisplay =
  | { kind: "verdict"; status: VerdictStatus; reason: string }
  | { kind: "gate-incomplete"; outstandingFactIds: string[] };

export async function screenVerdictDisplay(runId: string): Promise<ScreenVerdictDisplay> {
  try {
    const result = await computeAnalysisForRun(runId);
    const verdict = deriveVerdict(result);
    return { kind: "verdict", status: verdict.status, reason: verdict.reason };
  } catch (err) {
    if (err instanceof SpotCheckIncompleteError) {
      return { kind: "gate-incomplete", outstandingFactIds: err.outstandingFactIds };
    }
    throw err;
  }
}

export function gateIncompleteReason(outstandingFactIds: string[]): string {
  return (
    `Automatic verification did not reach a decision on ${outstandingFactIds.length} acquired ` +
    `${outstandingFactIds.length === 1 ? "figure" : "figures"} — ${outstandingFactIds.join(", ")}. ` +
    `No calculation runs on an undecided figure (§2), so this run has no report. Nothing here is ` +
    `estimated or filled in.`
  );
}
