import type { AnalysisResult } from "./types";

// ---------------------------------------------------------------------------
// CF-V2-PROOF-01's verdict boundary (Calvin, 17 Sep 2026): "return BUY / HOLD
// / SELL only when analysis is complete, otherwise an explicit incomplete
// state with no manufactured verdict."
//
// COMPLETE MEANS THE RANGE ITSELF IS USABLE, not that every diagnostic in the
// report is clean. §9.6 already draws this exact line: TrustStatus UNUSABLE
// is rule 1 alone — a §9.3 suppressing state removed the fair-value range, or
// a REQUIRED input of the range is INCOMPLETE (trust.ts). PARTIAL (rule 2)
// still means "the range renders"; its causes are qualifications on OTHER
// outputs or the analyst's confidence in inputs, not an absent range. Since
// this function's only input is the range itself, UNUSABLE is the one trust
// value that means "decision-critical analysis is incomplete" for THIS
// decision — treating PARTIAL the same way would make a verdict unreachable
// for any acquired run in this codebase today (see M8-c: even the two
// analyst-input companies never reach CLEAN), which is not what "complete
// analysis" can mean if the outcome is to be provable at all.
//
// THE VERDICT ITSELF IS NEVER A NEW CALIBRATED THRESHOLD. It reads the
// bear/bull bounds the shared finance engine already produced — no single
// diagnostic becomes the verdict (methodology, "Valuation methodology") and
// M8-c found no defensible calibrated band exists for anything finer than
// this. Comparing price against the engine's own blended scenario range is
// therefore the one verdict rule available without reopening methodology or
// manufacturing a threshold the evidence does not support.
//
// Pre-revenue companies (fairValueRange.kind === "pre-revenue-distribution")
// are a distinct valuation model this outcome does not extend a verdict
// rule to — that would be a new methodology decision, not a bounded proof of
// the existing one, so they return INCOMPLETE honestly rather than reusing a
// rule built for a different shape of output.
// ---------------------------------------------------------------------------

export type VerdictStatus = "BUY" | "HOLD" | "SELL" | "INCOMPLETE";

export interface VerdictResult {
  status: VerdictStatus;
  reason: string;
}

export function deriveVerdict(result: AnalysisResult): VerdictResult {
  if (result.trust.status === "UNUSABLE") {
    const detail = result.trust.determinedBy[0]?.detail ?? "the fair-value range is not usable";
    return {
      status: "INCOMPLETE",
      reason: `Decision-critical analysis is incomplete — ${detail}`,
    };
  }

  const range = result.fairValueRange;

  if (range.kind === "suppressed") {
    return {
      status: "INCOMPLETE",
      reason: `Decision-critical analysis is incomplete — ${range.cause}`,
    };
  }

  if (range.kind === "pre-revenue-distribution") {
    return {
      status: "INCOMPLETE",
      reason: "The pre-revenue valuation model does not yet define a BUY / HOLD / SELL boundary.",
    };
  }

  const price = result.price.value;

  if (price.lte(range.bear)) {
    return {
      status: "BUY",
      reason: `Price $${price.toFixed(2)} is at or below the bear-case fair value $${range.bear.toFixed(2)}.`,
    };
  }

  if (price.gte(range.bull)) {
    return {
      status: "SELL",
      reason: `Price $${price.toFixed(2)} is at or above the bull-case fair value $${range.bull.toFixed(2)}.`,
    };
  }

  return {
    status: "HOLD",
    reason: `Price $${price.toFixed(2)} sits within the bear-to-bull fair-value range ($${range.bear.toFixed(2)}–$${range.bull.toFixed(2)}).`,
  };
}
