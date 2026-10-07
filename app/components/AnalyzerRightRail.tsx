import type Decimal from "decimal.js";
import type { AnalysisResult, Figure } from "@/lib/analyzer/types";
import { formatUsd, formatCompactUsd } from "@/lib/formatUsd";
import { FigureValue } from "./AnalyzerReport";
import {
  notComputedLine,
  leverageUnavailableLine,
  NO_UPCOMING_EVENTS_LINE,
  NO_INDUSTRY_CLASSIFICATION_LINE,
} from "@/lib/analyzer/overviewCopy";

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
//
// CF-ANALYZER-V1-SETTLE-01 — Calvin's 7 Oct 2026 decision on #399 (Option
// 1): the rail renders on the normal Overview, so a figure the engine
// cannot compute for this company shows one plain-English reason
// (lib/analyzer/overviewCopy.ts) instead of a raw state code
// ("INCOMPLETE", "LEVERAGE UNSUPPORTED IN v1") or a "see Evidence" /
// "Not yet available" placeholder. The raw states still reach Evidence via
// `states.suppressing` (assemble.ts), unchanged.

function pct(v: Decimal, dp = 1): string {
  return `${v.mul(100).toFixed(dp)}%`;
}
function usd(v: Decimal): string {
  return `$${formatUsd(v)}`;
}

/** A computed figure via the shared FigureValue (provenance marks travel with it); otherwise its plain reason. */
function StatValue({
  figure,
  format,
  leverage,
}: {
  figure: Figure<Decimal>;
  format: (v: Decimal) => string;
  leverage: AnalysisResult["gates"]["leverage"];
}) {
  if (figure.suppressed) {
    return <span className="cause">{notComputedLine(figure.state, figure.cause, leverage)}</span>;
  }
  return <FigureValue figure={figure} format={format} />;
}

export function AnalyzerRightRail({ result }: { result: AnalysisResult }) {
  const { diagnostics, marketContext, gates } = result;

  return (
    <aside className="az-rightrail" aria-label="Key stats, market context and upcoming events">
      <section className="az-rail-block">
        <h3>Key Stats (TTM)</h3>
        <dl className="az-keystats">
          <div>
            <dt>Market cap</dt>
            <dd>
              {diagnostics.enterpriseValue.suppressed ? (
                <span className="cause">
                  {notComputedLine(
                    diagnostics.enterpriseValue.state,
                    diagnostics.enterpriseValue.cause,
                    gates.leverage
                  )}
                </span>
              ) : (
                // CF-ANALYZER-V1-SETTLE-01 — REJECT CURRENT HEAD, item 3: a
                // company-scale dollar figure through plain `formatUsd`
                // reads as an unbroken wall of digits once in the hundreds
                // of billions or above; abbreviated to T/B/M instead.
                `$${formatCompactUsd(diagnostics.enterpriseValue.value.marketCap)}`
              )}
            </dd>
          </div>
          <div>
            <dt>P/E (trailing)</dt>
            <dd>
              <StatValue figure={diagnostics.multiples.peTrailing} format={(v) => v.toFixed(1)} leverage={gates.leverage} />
            </dd>
          </div>
          <div>
            <dt>FCF yield</dt>
            <dd>
              <StatValue figure={diagnostics.multiples.fcfYieldOnMarketCap} format={pct} leverage={gates.leverage} />
            </dd>
          </div>
          <div>
            <dt>52-week range</dt>
            <dd>
              {diagnostics.marginHistory.suppressed ? (
                <span className="cause">
                  {notComputedLine(diagnostics.marginHistory.state, diagnostics.marginHistory.cause, gates.leverage)}
                </span>
              ) : (
                `${usd(diagnostics.marginHistory.value.fiftyTwoWeekRange[0])} – ${usd(diagnostics.marginHistory.value.fiftyTwoWeekRange[1])}`
              )}
            </dd>
          </div>
          {/* CF-ANALYZER-V1-SETTLE-01 — #392's V1 Key Stats list names "one
              compact balance-sheet/leverage metric" alongside market cap,
              P/E and FCF yield. Same figure Section D's "Leverage
              precondition" row already reads (gates.leverage, one figure one
              computation). */}
          <div>
            <dt>Leverage</dt>
            <dd>
              {gates.leverage.result === "PASS" && gates.leverage.netDebtRatio !== null ? (
                `Net debt ${pct(gates.leverage.netDebtRatio)}`
              ) : (
                <span className="cause">{leverageUnavailableLine(gates.leverage)}</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="az-rail-block">
        <h3>Market Context</h3>
        {marketContext.sic === null || marketContext.sicDescription === null ? (
          <p className="note">{NO_INDUSTRY_CLASSIFICATION_LINE}</p>
        ) : (
          <p className="az-rail-note">
            SIC {marketContext.sic} &middot; {marketContext.sicDescription}
          </p>
        )}
      </section>

      <section className="az-rail-block">
        <h3>Upcoming Events</h3>
        <p className="note">{NO_UPCOMING_EVENTS_LINE}</p>
      </section>
    </aside>
  );
}
