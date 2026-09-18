import Decimal from "decimal.js";
import type { AnalysisResult } from "@/lib/analyzer/types";
import { ValuationStrip } from "./ValuationStrip";
import { humanizeCause } from "./AnalyzerReport";

// M9-DESKTOP-SHELL-01 — Overview slot 4, per docs/design/m9-analyzer-
// design-contract.md §2.1 row 4, §3.
//
// Reuses ValuationStrip for the bear/base/bull/current-price grid (contract:
// "Reuse the existing ValuationStrip component and figures ... rather than
// duplicating the grid — one figure, one computation") and, beside it,
// design.md §10.2's two-column frame (Section H, the frozen artefact's own
// mechanism, reframed here as a first-class Overview slot rather than a
// mid-report frame): the fair-value range on the left, a condensed
// restatement of Section E's price-implied content on the right. H is
// never shown without E adjacent (design.md:523); this component enforces
// that pairing structurally — there is no render path that shows the range
// without its adjacent restatement.
//
// Two items named in the contract's slot-4 "must contain" column are not
// rendered here, honestly, because no computation for them exists anywhere
// in this codebase for any run: the CHEAP/FAIR/EXPENSIVE/INCONCLUSIVE
// position and its §10.6.4 action clause both require the same §10.6.2
// growth comparator that leaves deriveVerdict returning INCOMPLETE on
// every run today (spec.md §10.6.5, "acquiring it is milestone M8 work" —
// no AnalysisResult field exists for it). Building either would be
// inventing a threshold or a computation, which this outcome's HARD BOUNDS
// forbids. What IS built is the §10.6.3 suppression path itself — reusing
// the exact same guard report/page.tsx already ships (trust UNUSABLE, or
// the profile not human-confirmed) — since that suppression is real,
// already-computed state, not a new computation.

function num(value: Decimal, dp = 2): string {
  return value.toFixed(dp);
}
function pct(value: Decimal, dp = 1): string {
  return `${value.mul(100).toFixed(dp)}%`;
}

export function ScenarioRangeStrip({
  result,
  profileNotConfirmed,
}: {
  result: AnalysisResult;
  profileNotConfirmed: boolean;
}) {
  const { trust, fairValueRange, priceImplied, price } = result;

  // Same rule as report/page.tsx's positionSuppressedBy and Section H's own
  // suppressed branch: §10.6.3's guard is "a range exists and trust is
  // CLEAN or PARTIAL" — failing it, the slot names the state rather than a
  // value (spec.md §10.6.3, contract's "never renders the position rendered
  // where suppression rules say it must not").
  const positionSuppressedBy =
    trust.status === "UNUSABLE"
      ? `TRUST STATUS UNUSABLE · ${trust.determinedBy[0]?.detail ?? ""}`
      : profileNotConfirmed
        ? "PROFILE NOT CONFIRMED"
        : null;

  return (
    <div className="scenariorangestrip">
      <ValuationStrip result={result} />

      {fairValueRange.kind === "suppressed" ? (
        <div className="state" style={{ marginTop: 14 }}>
          <span className="name">{fairValueRange.state}</span>
          <span className="cause">{humanizeCause(fairValueRange.cause)}</span>
        </div>
      ) : (
        <div className="hframe" style={{ marginTop: 14 }}>
          <div>
            <h3>{fairValueRange.kind === "pre-revenue-distribution" ? "What you assume" : "Fair-value range"}</h3>
            {fairValueRange.kind === "range" ? (
              <>
                <div className="rangeends">
                  <span>${num(fairValueRange.bear, 0)}</span>
                  <span>${num(fairValueRange.bull, 0)}</span>
                </div>
                {/* Upside/downside — the contract's own slot-4 "must
                    contain" item — restated as simple arithmetic on
                    already-computed range bounds and the already-computed
                    current price, never a new threshold or judgment. */}
                <p className="updown">
                  Downside to bear {pct(new Decimal(1).minus(fairValueRange.bear.div(price.value)))} · Upside to
                  bull {pct(fairValueRange.bull.div(price.value).minus(1))}
                </p>
              </>
            ) : (
              <p className="sub2">Cash floor ${num(fairValueRange.cashFloor)} per current share.</p>
            )}
            {positionSuppressedBy !== null && (
              <div className="state" style={{ marginTop: 10 }}>
                <span className="name">Valuation position — suppressed</span>
                <span className="cause">{positionSuppressedBy}</span>
              </div>
            )}
          </div>
          <div>
            <h3>What the price assumes</h3>
            <p className="sub2">Restated from Section E</p>
            {priceImplied.steadyStateEv.suppressed ? (
              <div className="state">
                <span className="name">{priceImplied.steadyStateEv.state}</span>
                <span className="cause">{humanizeCause(priceImplied.steadyStateEv.cause)}</span>
              </div>
            ) : (
              <div className="pi">
                <span className="lbl">Steady-state EV</span>
                <b>${num(priceImplied.steadyStateEv.value, 0)}</b>
              </div>
            )}
            {priceImplied.pvgoShareOfEv.suppressed ? (
              <div className="state">
                <span className="name">{priceImplied.pvgoShareOfEv.state}</span>
                <span className="cause">{humanizeCause(priceImplied.pvgoShareOfEv.cause)}</span>
              </div>
            ) : (
              <div className="pi" style={{ borderBottom: 0 }}>
                <span className="lbl">PVGO share of EV</span>
                <b>{pct(priceImplied.pvgoShareOfEv.value)}</b>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
