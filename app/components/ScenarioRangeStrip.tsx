import Decimal from "decimal.js";
import type { AnalysisResult } from "@/lib/analyzer/types";
import { ValuationStrip } from "./ValuationStrip";
import { formatCompactUsd } from "@/lib/formatUsd";
import { fairValueRangeUnavailableLine, notComputedLine, positionHiddenLine } from "@/lib/analyzer/overviewCopy";

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
// position and its §10.6.4 action clause both require the full §10.6.2
// growth comparator — required side and achieved side, matched on the same
// series and horizon — and that comparator still does not exist as a whole
// (spec.md §10.6.5, "acquiring it is milestone M8 work").
//
// CORRECTED, CF-M9-BLOCKER14-RECON-01, 24 Sep 2026: `achievedRevenueCagr`
// (CF-VERDICT-NONPOLICY-GAPS-01) now carries the achieved side on
// AnalysisResult, but only as Step 7's explanatory input (§13) — the
// required side (one of the nine M7 reverse-DCF cells, §10.6.2) is still
// not assembled onto AnalysisResult for any run, so there is still no
// complete comparator to read a position or an action clause from here.
// The frozen spec's amended §10.6.4 (:1138) also now suppresses the action
// clause independently of §10.6.3 whenever this comparator is INCOMPLETE
// or UNAVAILABLE, and, per that same amendment, the comparator's absence
// does not by itself force the Step 5/6 position to INCONCLUSIVE.
//
// Building either item would still be inventing a threshold or a
// computation, which this outcome's HARD BOUNDS forbids. What IS built is
// the §10.6.3 suppression path itself — reusing the exact same guard
// report/page.tsx already ships (trust UNUSABLE, or the profile not
// human-confirmed) — since that suppression is real, already-computed
// state, not a new computation.

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
      {/* CF-ANALYZER-V1-SETTLE-01 — Calvin ruling 1: a decision-useful
          range-vs-price / valuation-position presentation beside the
          (possibly still INCOMPLETE) verdict, wherever a defensible range
          exists. `showLocation` already computes this from
          scenarioOutputs.priceLocationWithinRange — the same figure Quick
          Read's own call site already shows — so this is the existing
          figure surfaced one place earlier, not a new computation. Gated on
          `positionSuppressedBy === null`: §10.6.3 never renders the
          position where suppression rules say it must not, and the
          location line is that same position restated as a percentage. */}
      <ValuationStrip result={result} showLocation={positionSuppressedBy === null} />

      {fairValueRange.kind === "suppressed" ? (
        // CF-ANALYZER-V1-SETTLE-01 — Calvin's 7 Oct 2026 decision on #399
        // (Option 1): no raw state code and no "see Evidence" placeholder on
        // the normal Overview; one plain-English line names why there is no
        // range (overviewCopy.ts). The raw state and cause still reach
        // Evidence via `states.suppressing` (assemble.ts) unchanged.
        <div className="state" style={{ marginTop: 14 }}>
          <span className="cause">{fairValueRangeUnavailableLine(fairValueRange, result.gates.leverage)}</span>
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
              // CF-ANALYZER-V1-SETTLE-01 — `positionSuppressedBy` still
              // decides whether this note renders at all; its raw text
              // ("PROFILE NOT CONFIRMED", "TRUST STATUS UNUSABLE · ...")
              // renders on the Evidence tab via `TrustAndProfileNote`, and
              // here only the plain-English reason (overviewCopy.ts).
              <div className="state" style={{ marginTop: 10 }}>
                <span className="cause">
                  {positionHiddenLine({
                    trustUnusable: trust.status === "UNUSABLE",
                    profileNotConfirmed,
                  })}
                </span>
              </div>
            )}
          </div>
          <div>
            <h3>What the price assumes</h3>
            <p className="sub2">Restated from Section E</p>
            {priceImplied.steadyStateEv.suppressed ? (
              <div className="state">
                <span className="lbl">Steady-state EV</span>{" "}
                <span className="cause">
                  {notComputedLine(
                    priceImplied.steadyStateEv.state,
                    priceImplied.steadyStateEv.cause,
                    result.gates.leverage
                  )}
                </span>
              </div>
            ) : (
              <div className="pi">
                <span className="lbl">Steady-state EV</span>
                <b>${formatCompactUsd(priceImplied.steadyStateEv.value)}</b>
              </div>
            )}
            {priceImplied.pvgoShareOfEv.suppressed ? (
              <div className="state">
                <span className="lbl">PVGO share of EV</span>{" "}
                <span className="cause">
                  {notComputedLine(
                    priceImplied.pvgoShareOfEv.state,
                    priceImplied.pvgoShareOfEv.cause,
                    result.gates.leverage
                  )}
                </span>
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
