import Link from "next/link";
import type { ScreenCandidate } from "@/lib/screen";
import { gateIncompleteReason, type ScreenVerdictDisplay } from "@/app/screen/verdictDisplay";

// SCREEN's own presentation, read-only (CF-SCREEN-FIRST-OUTCOME-01). Mirrors
// PortfolioReviewTable's link-only pattern for the symbol/report link — a row
// names a candidate and links to its existing Analyzer report by company
// name, never re-deriving or summarising the report's content itself. That
// reuse is the "not-held equivalent" docs/screen-workflow-mode-reconciliation.md
// §3 anticipated, not a new design system (SCOPE/DO 2).
//
// REVIEW-36553409661-1's bounded correction (issue #379 DO 3/DO 4): each row
// also shows the existing Analyzer verdict state read via
// `app/screen/verdictDisplay.ts` — status and reason exactly as
// `deriveVerdict` returned them, or the report's own INCOMPLETE wording when
// the run's Step 2 spot-check itself is incomplete. This is the run's
// already-computed state, not a verdict SCREEN itself makes up — no
// thesis excerpt, risk flag, score, or ranking is ever rendered here.
export interface ScreenCandidateWithVerdict extends ScreenCandidate {
  verdict: ScreenVerdictDisplay;
}

function verdictStatusText(verdict: ScreenVerdictDisplay): string {
  return verdict.kind === "gate-incomplete" ? "INCOMPLETE" : verdict.status;
}

function verdictReasonText(verdict: ScreenVerdictDisplay): string {
  return verdict.kind === "gate-incomplete"
    ? gateIncompleteReason(verdict.outstandingFactIds)
    : verdict.reason;
}

export function ScreenTable({ candidates }: { candidates: ScreenCandidateWithVerdict[] }) {
  return (
    <div className="editor-table">
      <table className="pr-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Analyzer report</th>
            <th>Analyzer state</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => (
            <tr key={candidate.symbol}>
              <td className="sym">
                <span className="cell-label">Symbol </span>
                {candidate.symbol}
              </td>
              <td>
                <span className="cell-label">Analyzer report </span>
                <Link href={`/analyzer/${candidate.analyzerRun.runId}`}>
                  {candidate.analyzerRun.resolvedCompanyName}
                </Link>
              </td>
              <td>
                <span className="cell-label">Analyzer state </span>
                <span className="name">{verdictStatusText(candidate.verdict)}</span>{" "}
                <span className="cause">{verdictReasonText(candidate.verdict)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
