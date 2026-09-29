import Link from "next/link";
import type { ScreenCandidate } from "@/lib/screen";

// SCREEN's own presentation, read-only (CF-SCREEN-FIRST-OUTCOME-01). Mirrors
// PortfolioReviewTable's exact pattern: a row names a candidate and links to
// its existing Analyzer report by company name — it never renders anything
// the linked report itself concluded (no thesis excerpt, risk flag, verdict,
// score, or BUY/HOLD/SELL content of any kind). Reusing that pattern is the
// "not-held equivalent" docs/screen-workflow-mode-reconciliation.md §3
// anticipated, not a new design system (SCOPE/DO 2).
export function ScreenTable({ candidates }: { candidates: ScreenCandidate[] }) {
  return (
    <div className="editor-table">
      <table className="pr-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Analyzer report</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
