import type { AnalysisResult } from "./types";
import { PROFILE_NOT_CONFIRMED_DETAIL } from "./trust";

// ---------------------------------------------------------------------------
// CF-V2-PROOF-01's verdict boundary — bounded correction on PR #140 per
// Calvin's 18 Sep 2026 CALVIN DECISION RECEIPT:
//
//   "A fair-value range or any other single diagnostic must not by itself
//   determine BUY / HOLD / SELL. The verdict must synthesize the whole
//   approved methodology and evidence." ... "If decision-critical evidence
//   is insufficient to support a reliable conclusion, return analysis
//   incomplete / failure with cause and recovery path; do not manufacture
//   HOLD."
//
// The top-level vocabulary stays BUY / HOLD / SELL (the ruling is explicit
// that this overrides the frozen spec's CHEAP/FAIR/EXPENSIVE wording for
// this slot). But comparing price against the range alone — the earlier
// shape of this function — was exactly the single-diagnostic problem the
// ruling forbids.
//
// The only second input named anywhere in this outcome's methodology is
// §10.6.2's required-versus-achieved growth comparator, and §10.6.5 already
// rules that this fact "may not exist in the current fact set. Acquiring it
// is milestone M8 work" — sequencing, not deferral. AnalysisResult carries
// no such field today, for any run. Inventing a different second signal, or
// building the M8 comparator here, would both be exactly what this
// outcome's HARD BOUNDS forbid (manufacturing new finance policy; no M9
// implementation before this proof passes).
//
// So today, for every run, the evidence needed to synthesize a verdict
// beyond a single diagnostic is incomplete — not because any one run's
// inputs are bad, but because the second required input has not been
// acquired yet. This function says so honestly, with a stated cause and
// recovery path, rather than manufacturing BUY / HOLD / SELL from the range
// alone or manufacturing HOLD as a safe default. Once M8 lands the
// comparator fact on AnalysisResult, this function's synthesis branch can
// be completed without reopening this ruling.
// ---------------------------------------------------------------------------

export type VerdictStatus = "BUY" | "HOLD" | "SELL" | "INCOMPLETE";

export interface VerdictResult {
  status: VerdictStatus;
  reason: string;
}

const COMPARATOR_NOT_YET_AVAILABLE =
  "Decision-critical analysis is incomplete — a fair-value range alone cannot determine BUY / HOLD / SELL. " +
  "Synthesizing a verdict also requires the required-versus-achieved growth comparator (spec §10.6.2), and " +
  "that fact has not been acquired yet (spec §10.6.5, milestone M8). Recovery: this verdict becomes available " +
  "once M8 delivers the comparator fact.";

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

  // §10.6.3's third render condition, checked explicitly rather than being
  // reached only incidentally through the COMPARATOR_NOT_YET_AVAILABLE
  // fallback below. AnalysisResult carries no dedicated PROFILE NOT CONFIRMED
  // field of its own (§6.3's *Cannot judge* input lives on TrustInput, one
  // level upstream of this function) — trust.ts's own qualifying-flag entry,
  // written with this exact detail string whenever profileHumanConfirmed is
  // false, is the state this function reads instead.
  const profileNotConfirmed = result.trust.determinedBy.some(
    (d) => d.kind === "qualifying flag" && d.detail === PROFILE_NOT_CONFIRMED_DETAIL
  );
  if (profileNotConfirmed) {
    return {
      status: "INCOMPLETE",
      reason:
        "Decision-critical analysis is incomplete — PROFILE NOT CONFIRMED is active on the valuation path " +
        "(spec §10.6.3): the position does not render until a human confirms the profile.",
    };
  }

  return {
    status: "INCOMPLETE",
    reason: COMPARATOR_NOT_YET_AVAILABLE,
  };
}
