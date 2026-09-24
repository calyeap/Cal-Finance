import type { AnalysisResult } from "@/lib/analyzer/types";
import { formatUsd } from "@/lib/formatUsd";
import { FigureValue } from "./AnalyzerReport";

// CF-DESIGN-AUTHORITY-CUTOVER-01 — the wide-desktop persistent right rail
// (design authority doc: "wide-desktop right rail remains Key Stats (TTM) /
// Market Context / Upcoming Events"). CSS-hidden below the wide-desktop
// breakpoint (globals.css) rather than omitted from the DOM, per the
// contract's "relocate or stack, never crush the core reading flow" rule
// carried over from the frozen artefact (docs/design/m9-analyzer-design-
// contract.md §6) — nothing here is conditional on JS.
//
// Every figure is already computed elsewhere in the Analysis Result
// (diagnostics.enterpriseValue / .multiples / .marginHistory, restated by
// Sections D/E already — one figure, one computation, §10.0.2 rule 3); this
// panel restates a small selection of them, it computes nothing.

function pct(v: import("decimal.js").default, dp = 1): string {
  return `${v.mul(100).toFixed(dp)}%`;
}
function usd(v: import("decimal.js").default): string {
  return `$${formatUsd(v)}`;
}

export function AnalyzerRightRail({ result }: { result: AnalysisResult }) {
  const { diagnostics, marketContext } = result;

  return (
    <aside className="az-rightrail" aria-label="Key stats, market context and upcoming events">
      <section className="az-rail-block">
        <h3>Key Stats (TTM)</h3>
        <dl className="az-keystats">
          <div>
            <dt>Market cap</dt>
            <dd>
              {diagnostics.enterpriseValue.suppressed ? (
                <span className="name">{diagnostics.enterpriseValue.state}</span>
              ) : (
                usd(diagnostics.enterpriseValue.value.marketCap)
              )}
            </dd>
          </div>
          <div>
            <dt>P/E (trailing)</dt>
            <dd>
              <FigureValue figure={diagnostics.multiples.peTrailing} format={(v) => v.toFixed(1)} />
            </dd>
          </div>
          <div>
            <dt>FCF yield</dt>
            <dd>
              <FigureValue figure={diagnostics.multiples.fcfYieldOnMarketCap} format={pct} />
            </dd>
          </div>
          <div>
            <dt>52-week range</dt>
            <dd>
              {diagnostics.marginHistory.suppressed ? (
                <span className="name">{diagnostics.marginHistory.state}</span>
              ) : (
                `${usd(diagnostics.marginHistory.value.fiftyTwoWeekRange[0])} – ${usd(diagnostics.marginHistory.value.fiftyTwoWeekRange[1])}`
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="az-rail-block">
        <h3>Market Context</h3>
        {marketContext.sic === null || marketContext.sicDescription === null ? (
          <p className="note">Not yet available — no SEC industry classification was acquired for this analysis.</p>
        ) : (
          <p className="az-rail-note">
            SIC {marketContext.sic} &middot; {marketContext.sicDescription}
          </p>
        )}
      </section>

      <section className="az-rail-block">
        <h3>Upcoming Events</h3>
        <p className="note">Not yet available — no upcoming-events data source exists for this analysis.</p>
      </section>
    </aside>
  );
}
