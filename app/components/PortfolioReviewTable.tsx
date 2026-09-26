import Link from "next/link";
import type { PortfolioReviewRow } from "@/lib/portfolioReview";
import { MaskableValue } from "./MaskableValue";

// PORTFOLIO REVIEW's own presentation, read-only. Reuses the existing
// money-masking primitive (MaskableValue) for consistency with
// Dashboard/Holdings, per SCOPE 7 — no new design system is introduced.
//
// Zero BUY/HOLD/SELL, verdict, score, or ranking content anywhere in this
// component (DONE WHEN 5): a row states its own weight and cap state and
// links to an existing Analyzer report by name only — it never renders
// anything the linked report itself concluded.
export function PortfolioReviewTable({ rows }: { rows: PortfolioReviewRow[] }) {
  return (
    <div className="editor-table">
      <table className="pr-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Market value</th>
            <th>Weight</th>
            <th>Mature-position cap (10%)</th>
            <th>Analyzer report</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="sym">
                <span className="cell-label">Symbol </span>
                {row.symbol}
              </td>
              <td className="num">
                <span className="cell-label">Market value </span>
                {row.marketValueUsd ? (
                  <MaskableValue>{`$${row.marketValueUsd}`}</MaskableValue>
                ) : (
                  "No price"
                )}
              </td>
              <td className="num">
                <span className="cell-label">Weight </span>
                {row.weightPercent ? `${row.weightPercent}%` : "Not computable"}
              </td>
              <td className={`pr-cap pr-cap-${row.matureCapState.toLowerCase()}`}>
                <span className="cell-label">Mature-position cap (10%) </span>
                {row.matureCapNote}
              </td>
              <td>
                <span className="cell-label">Analyzer report </span>
                {row.analyzerRun ? (
                  <Link href={`/analyzer/${row.analyzerRun.runId}`}>
                    {row.analyzerRun.resolvedCompanyName}
                  </Link>
                ) : (
                  "No existing Analyzer report for this holding."
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
