import Decimal from "decimal.js";

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

function num(value: Decimal, dp = 2): string {
  return value.toFixed(dp);
}

export function PriceChartPanel({ price }: { price: { value: Decimal; timestamp: string } }) {
  return (
    <div className="pricechart">
      <div className="pricerow">
        <span className="p">${num(price.value)}</span>
        <span className="ts">{price.timestamp}</span>
      </div>
      <svg
        className="pricechartsvg"
        viewBox="0 0 320 64"
        role="img"
        aria-label={`Current price $${num(price.value)} as of ${price.timestamp} — no price history is in this analysis' fact set`}
      >
        <line x1="8" y1="32" x2="312" y2="32" className="axis" />
        <circle cx="312" cy="32" r="4" className="dot" />
      </svg>
    </div>
  );
}
