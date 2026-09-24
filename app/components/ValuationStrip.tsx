import Decimal from "decimal.js";
import type { AnalysisResult, ProvenanceTokens } from "@/lib/analyzer/types";
import { boundState, NOT_COMPUTED_BINDING } from "@/lib/analyzer/notComputed";
import { provenanceQualifierParts } from "@/lib/analyzer/provenance";

// E1 — an authorised presentation deviation from §17.16 (Calvin approved it
// directly, 5 Sep 2026; re-frozen 6 Sep 2026, PR #27 — re-freeze is
// complete, not pending). It remains a deviation, not one of §17.16's ten
// items: this bear/base/bull/current-price grid is a different object from
// §17.16 item 1's CHEAP/FAIR/EXPENSIVE valuation-position token per §10.6 —
// same words, a name collision only, resolved 14 Sep 2026 (CB-AUDIT-01 §7
// conflict B). The SAME component "Investment case — at a glance" already
// renders, reused here as a header above Quick Read's eight items rather
// than duplicated — one component, two call sites, identical figures.
// Every value below already exists in the AnalysisResult; nothing here
// computes, rounds differently, or invents a score/verdict/target.
//
// `showLocation` is Quick Read's own addition (the price-location line);
// the closing recap's call site omits it and keeps its exact prior
// appearance — the grid only, unchanged.
//
// E1 authorises reusing this component's placement and figures; it is not,
// and has never been, an exemption from §3.3/§5.2's never-hidden-provenance
// rule (H3 consumer-provenance recovery, CB-H3-ARCH-01). The cash-floor
// figure below is the one place in this component that can carry inherited
// non-default provenance (a SECONDARY or AI-EXTRACTED acquired cash basis),
// so it alone gets a qualifier mark when one applies — the bear/base/bull
// scenario values and the success-range figures are always clean deterministic
// computations and never need one.

function num(value: Decimal, dp = 2): string {
  return value.toFixed(dp);
}

function formatRange(range: { low: Decimal; high: Decimal }): string {
  return range.low.equals(range.high) ? `$${num(range.low)}` : `$${num(range.low)} - $${num(range.high)}`;
}

/** Same non-default-only rule and words as AnalyzerReport.tsx's ProvenanceMarks. */
function ProvenanceQualifier({ provenance }: { provenance: ProvenanceTokens | null }) {
  if (provenance === null) return null;
  const parts = provenanceQualifierParts(provenance);
  if (parts.length === 0) return null;
  return (
    <div className="prov">
      {parts.map((p, i) => (
        <span key={p} className={p === "AI-extracted" ? "ai" : undefined}>
          {i > 0 && <span className="sep">·</span>}
          {p}
        </span>
      ))}
    </div>
  );
}

export function ValuationStrip({ result, showLocation = false }: { result: AnalysisResult; showLocation?: boolean }) {
  const { preRevenue, fairValueRange, scenarioOutputs, states } = result;
  // CF-NOPRICE-HONESTY-RECON-01 — null exactly where this run has no price
  // (modules/scenarioOutputs.ts). This decorative line is omitted rather
  // than shown on a fabricated position, the same "never a placeholder"
  // rule the rest of this catalogue already follows.
  const locationPct =
    scenarioOutputs.priceLocationWithinRange !== null ? scenarioOutputs.priceLocationWithinRange.mul(100).toFixed(0) : null;
  const cashPerShareState = boundState(states, NOT_COMPUTED_BINDING.cashPerShare);
  // CF-PRICE-DISPLAY-HONESTY-RECON-01 — the same "bound state string in
  // place of a figure" treatment cashPerShareState already has, two lines
  // above, for this same tile shape.
  const priceState = boundState(states, NOT_COMPUTED_BINDING.price);

  if (preRevenue) {
    return (
      <>
        <div className="atglance" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <div>
            <span className="lb">Failure — cash floor</span>
            <span className="fig">{cashPerShareState !== null ? cashPerShareState.state : `$${num(preRevenue.cashPerShare)}`}</span>
            {cashPerShareState === null && <ProvenanceQualifier provenance={preRevenue.cashPerShareProvenance} />}
          </div>
          <div>
            <span className="lb">Success as described</span>
            <span className="fig">
              {fairValueRange.kind === "pre-revenue-distribution" ? formatRange(fairValueRange.successAsCommonlyDescribed) : "—"}
            </span>
          </div>
          <div className="cur">
            <span className="lb">Current price</span>
            <span className="fig">{priceState !== null ? priceState.state : `$${num(result.price.value)}`}</span>
          </div>
        </div>
        {showLocation && locationPct !== null && <p className="striploc">{locationPct}% of the way from failure to success</p>}
      </>
    );
  }

  return (
    <>
      <div className="atglance">
        <div>
          <span className="lb">Bear</span>
          <span className="fig">{fairValueRange.kind === "range" ? `$${num(fairValueRange.bear, 0)}` : "—"}</span>
        </div>
        <div>
          <span className="lb">Base</span>
          <span className="fig">${num(scenarioOutputs.values.base, 0)}</span>
        </div>
        <div>
          <span className="lb">Bull</span>
          <span className="fig">{fairValueRange.kind === "range" ? `$${num(fairValueRange.bull, 0)}` : "—"}</span>
        </div>
        <div className="cur">
          <span className="lb">Current price</span>
          <span className="fig">{priceState !== null ? priceState.state : `$${num(result.price.value)}`}</span>
        </div>
      </div>
      {showLocation && locationPct !== null && <p className="striploc">{locationPct}% of the way from bear to bull</p>}
    </>
  );
}
