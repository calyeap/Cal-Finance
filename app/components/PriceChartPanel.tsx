import Decimal from "decimal.js";
import { BoundStateBlock } from "./AnalyzerReport";
import type { BoundState } from "@/lib/analyzer/notComputed";

// M9-DESKTOP-SHELL-01 — Overview slot 3, per docs/design/m9-analyzer-design-
// contract.md §2.1 row 3, §3: current price, as-of timestamp and a chart,
// restating already-acquired facts only, computing nothing new.
//
// AnalysisResult carries exactly one price fact: { value, timestamp }
// (types.ts:879, "no 'approximate' price state anywhere ... always a value
// and a timestamp"). No historical price series exists anywhere in the
// Analysis Result or anywhere else this outcome may read from — the
// marketdata providers (lib/marketdata) fetch a live EOD point for price
// capture, not a stored series, and the one adjacent-looking field
// (MarginHistoryBreakdown.fiftyTwoWeekRange, types.ts:385) is a margin
// diagnostic's own window, not the traded price. Fabricating a trend line
// from nothing would be exactly the invented content this outcome's HARD
// BOUNDS forbids; fetching one live at render time would be new fact
// acquisition outside this outcome's scope. So the chart below plots the
// one point this run actually has — honestly a single point, not a
// simulated history — rather than inventing or silently omitting it. No
// target line, no annotation, no portfolio framing (contract's "must never
// contain" column): describes, never prescribes.
//
// CF-PRICE-DISPLAY-HONESTY-RECON-01 — CONTEXT item 5. `price` above is
// literally true ("carries its timestamp always"), but on a priceless run
// it is §3.4's own $0/blank-timestamp sentinel, not a real quote — this
// panel restated it as one, the identical defect CONTEXT items 1-4 name
// elsewhere. `priceState`, where bound (assemble.ts, the same
// `fixture.enterpriseValue.price === null` signal every other consumer in
// this class reads), replaces the whole panel body — chart and caption
// included — with the existing BoundStateBlock this report already uses
// for the same figure in Section A (AnalyzerReport.tsx): there is no real
// point to plot and no history sentence to restate when there is no price.

function num(value: Decimal, dp = 2): string {
  return value.toFixed(dp);
}

export function PriceChartPanel({
  price,
  priceState,
}: {
  price: { value: Decimal; timestamp: string };
  priceState: BoundState | null;
}) {
  if (priceState !== null) {
    return (
      <div className="pricechart">
        <BoundStateBlock bound={priceState} />
      </div>
    );
  }
  return (
    <div className="pricechart">
      <div className="pricerow">
        <span className="p">${num(price.value)}</span>
        <span className="ts">{price.timestamp}</span>
      </div>
      <svg className="pricechartsvg" viewBox="0 0 320 64" aria-hidden="true">
        <line x1="8" y1="32" x2="312" y2="32" className="axis" />
        <circle cx="312" cy="32" r="4" className="dot" />
      </svg>
      <p className="sub">No price history is in this analysis&apos; fact set.</p>
    </div>
  );
}
