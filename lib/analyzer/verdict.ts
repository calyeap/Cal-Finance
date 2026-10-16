import type { AnalysisResult } from "./types";
import { PROFILE_NOT_CONFIRMED_DETAIL } from "./trust";
import { synthesizeVerdictV1 } from "./verdictSynthesisV1";

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
// is milestone M8 work" — sequencing, not deferral.
//
// CORRECTED, CF-M9-BLOCKER14-RECON-01, 24 Sep 2026: `achievedRevenueCagr`
// (CF-VERDICT-NONPOLICY-GAPS-01) now carries the achieved half of that
// comparator on AnalysisResult, but only as Step 7's explanatory input
// (§13) — the required half (one of the nine M7 reverse-DCF cells,
// §10.6.2) is still not assembled onto AnalysisResult for any run, so the
// full required-versus-achieved comparator this function would need to
// synthesize past INCOMPLETE still does not exist. Inventing a different
// second signal, or picking a grid cell and building the M8 comparator
// here, would both be exactly what this outcome's HARD BOUNDS forbid
// (manufacturing new finance policy; no M9 implementation before this
// proof passes).
//
// So from 24 Sep 2026 (the correction above) until this outcome, the §10.6.2
// seven-step comparator remained the only path this function tried, and it
// never finished acquiring its own second input — not because any run's
// facts were bad, but because that input had not been acquired. This
// function said so honestly rather than manufacturing BUY / HOLD / SELL from
// the range alone or manufacturing HOLD as a safe default.
//
// CF-ANALYZER-STAGE3-VERDICT-FINISH-01, 16 Oct 2026: that §10.6.2 path
// (`CALVIN RULING — C`) is not the only approved mechanism. The live Cal
// Finance Methodology's own "Verdict synthesis policy v1" (APPROVED 22 Sep
// 2026) is a second, independent, already-complete synthesis — price versus
// the Base scenario value, banded by an uncertainty bucket — that Calvin's
// `CALVIN RULING — NO` on PR #430 (2026-10-14) confirmed is still approved
// and not superseded ("do not retire the 22 Sep V1 bands yet"). It shares no
// field with ruling C's growth-licensing structure (verdictSynthesisV1.ts's
// own header has the full reconciliation) and is implemented below as this
// function's fallback, in place of the permanent COMPARATOR_NOT_YET_AVAILABLE
// result every prior run received. It still fails closed — INCOMPLETE, never
// a manufactured BUY/HOLD/SELL — wherever its own open items (the
// uncertainty-bucket formula; the unbuilt business-quality/thesis-
// invalidation judgement) would actually change the answer.
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

  // §3.4 — no "approximate" price state; the empty-timestamp sentinel is
  // this run's own honest "no price was available" signal (buildAcquiredRun),
  // never a zero price to divide by.
  if (result.price.timestamp === "") {
    return {
      status: "INCOMPLETE",
      reason:
        "Decision-critical analysis is incomplete — no price was available for this run, so the Verdict " +
        "synthesis policy v1 (Methodology, approved 22 Sep 2026) valuation anchor (price / Base) cannot be formed.",
    };
  }

  const synthesis = synthesizeVerdictV1(result.price.value, result.scenarioOutputs.values.base);
  return { status: synthesis.status, reason: synthesis.reason };
}
