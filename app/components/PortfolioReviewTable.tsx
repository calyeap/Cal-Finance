import Link from "next/link";
import type { PortfolioReviewView } from "@/lib/portfolioReview";
import { UNCHECKABLE_CAPS, CONTEXT_ONLY_POLICY_FIGURES } from "@/lib/portfolioReview";
import { formatAssetClass } from "@/lib/assets";
import { MaskableValue } from "./MaskableValue";

// Renders the PORTFOLIO REVIEW surface (issue #352). Read-only: nothing here
// posts a form, calls a server action, or mutates anything. Zero
// BUY/HOLD/SELL, verdict, score, ranking or cross-company synthesized
// judgement content belongs in this file — every string below either states
// a fact already computed elsewhere or names a limitation.
export function PortfolioReviewTable({ review }: { review: PortfolioReviewView }) {
  return (
    <>
      <section className="dashboard-section">
        <div className="sechead">
          <h2>Portfolio review</h2>
          <div className="dashboard-note">Describes only — states what is true and stops</div>
        </div>
        <p className="dashboard-note">
          Weight is each holding&apos;s market value over US$
          <MaskableValue>{review.denominatorUsd}</MaskableValue> — the same priced-portfolio total the
          Dashboard shows as &quot;Portfolio value&quot;.
        </p>
        {review.isDenominatorFloor && (
          <p className="status-msg status-warning">
            This total excludes {review.excludedSymbols.length} holding
            {review.excludedSymbols.length === 1 ? "" : "s"} with no price yet (
            {review.excludedSymbols.join(", ")}) — it is a floor, not the true portfolio value. No
            mature-position cap state is named below for any holding while this holds, since every weight
            shown is inflated by an unknown amount.
          </p>
        )}

        <div className="editor-table">
          <table className="holdings">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Type</th>
                <th>Market value</th>
                <th>Weight</th>
                <th>Mature-position cap ({review.matureCapPercent}%)</th>
                <th>Analyzer report</th>
              </tr>
            </thead>
            <tbody>
              {review.entries.map((e, i) => (
                <tr key={`${e.symbol}-${i}`}>
                  <td className="sym">{e.symbol}</td>
                  <td className="dim">{formatAssetClass(e.assetClass)}</td>
                  <td className="num strong">
                    {e.marketValueUsd ? (
                      <>
                        US$<MaskableValue>{e.marketValueUsd}</MaskableValue>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="num">
                    {e.weightPercent ? `${e.weightPercent}%` : "not computable — no price"}
                  </td>
                  <td className={e.matureCapReview ? "num status-warning" : "num dim"}>
                    {e.matureCapReview
                      ? `REVIEW — above ${review.matureCapPercent}%`
                      : e.weightPercent
                        ? "within cap"
                        : "—"}
                  </td>
                  <td>
                    {e.analyzerRun ? (
                      <Link href={`/analyzer/${e.analyzerRun.runId}`}>View report</Link>
                    ) : (
                      <span className="dim">No Analyzer report yet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="dashboard-note">
          A REVIEW state names a mandatory concentration review only — it is never an automatic trim and is
          not by itself a trim candidate (docs/frozen/calfinance-methodology-v2.md:410).
        </p>
      </section>

      <section className="dashboard-section">
        <div className="sechead">
          <h2>Caps not yet checkable</h2>
        </div>
        <p className="dashboard-note">
          These existing approved caps cannot be honestly checked against any holding above — the
          classification they need does not exist anywhere in this repo yet, and nothing here invents one.
        </p>
        <ul>
          {UNCHECKABLE_CAPS.map((c) => (
            <li key={c.label}>
              <strong>{c.label}</strong> — {c.limitText}. {c.reason}
            </li>
          ))}
        </ul>
        <p className="dashboard-note">
          Shown for context only — these constrain a new or increased position at the point of sizing, not a
          current holding&apos;s weight, and nothing here checks a current holding against them:
        </p>
        <ul>
          {CONTEXT_ONLY_POLICY_FIGURES.map((f) => (
            <li key={f.label}>
              <strong>{f.label}</strong> — {f.text}
            </li>
          ))}
        </ul>
        <p className="dashboard-note">
          Every figure above is INVESTING&apos;s own approved policy, consumed and checked here — never
          authored, widened, or invented by Cal Finance (docs/product-decisions.md item 14).
        </p>
      </section>
    </>
  );
}
