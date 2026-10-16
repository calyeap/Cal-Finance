import type Decimal from "decimal.js";
import { POLICY } from "./policy";

// ---------------------------------------------------------------------------
// CF-ANALYZER-STAGE3-VERDICT-FINISH-01 — the live Cal Finance Methodology's
// own "Verdict synthesis policy v1" (APPROVED 22 Sep 2026), read verbatim:
//
//   "Global prerequisite: the security is reliably identified, trustworthy
//   core financials are sufficient, and a defensible Base fair value can be
//   formed. If not, the analysis fails rather than manufacturing a verdict."
//   "Valuation anchor: price / Base fair value is the deterministic
//   valuation input to the verdict bands."
//   "BUY thresholds: Low ≤ 0.90× Base; Medium ≤ 0.80× Base; High ≤ 0.70×
//   Base." "SELL thresholds: Low ≥ 1.20× Base; Medium ≥ 1.30× Base; High ≥
//   1.45× Base." "HOLD: any successfully completed analysis between the
//   applicable BUY and SELL thresholds, unless thesis invalidation requires
//   SELL."
//
// Calvin's `CALVIN RULING — NO` on PR #430 (2026-10-14, comment 6167808992)
// holds this policy is still APPROVED, not retired by `CALVIN RULING — C`'s
// later, separate seven-step derivation for the frozen spec's §10.6.2 — "do
// not retire the 22 Sep V1 bands yet... reconcile whether later rulings
// actually superseded them, rather than assuming they did." Reconciled here:
// ruling C's seven steps (growthLicence.ts, flipTest.ts) and this policy
// share no field — ruling C licenses WHICH value is compared (growth-
// inclusive vs. conservative, via RONIC), where this policy always compares
// price against the one Base scenario value AnalysisResult already carries.
// They are two independent, non-conflicting mechanisms for the same output
// vocabulary; this file implements only the one that is actually complete
// and approved today.
//
// Not resolved by this file, and not needed to be: Methodology names the
// uncertainty-bucket (Low/Medium/High) factors — "operating/financial
// leverage, cyclicality, disclosure quality/history, binary regulatory or
// litigation exposure, and Bear–Bull dispersion" — without a formula for
// combining them, and no such formula exists anywhere in this tree. Rather
// than invent one (exactly what this outcome's HARD BOUNDS forbid), this
// function only ever issues BUY or SELL where the result is identical under
// all three buckets at once — true whenever the ratio clears the strictest
// (High) threshold in that direction, which also clears the looser Low/
// Medium thresholds by construction. Where the bucket choice would actually
// change the answer, this returns INCOMPLETE naming the specific open
// ambiguity, never a default HOLD and never a guessed bucket.
// ---------------------------------------------------------------------------

export type VerdictSynthesisV1Status = "BUY" | "HOLD" | "SELL" | "INCOMPLETE";

export interface VerdictSynthesisV1Result {
  status: VerdictSynthesisV1Status;
  reason: string;
}

function money(value: Decimal): string {
  return `$${value.toDecimalPlaces(2).toString()}`;
}

function multiple(value: Decimal): string {
  return `${value.toDecimalPlaces(4).toString()}×`;
}

export function synthesizeVerdictV1(price: Decimal, base: Decimal): VerdictSynthesisV1Result {
  if (!base.isFinite() || base.lessThanOrEqualTo(0)) {
    return {
      status: "INCOMPLETE",
      reason:
        "Verdict synthesis policy v1 (Methodology, approved 22 Sep 2026) requires a defensible Base fair value, " +
        `and this run's Base scenario value (${base.toString()}) is not a positive, finite figure — the global ` +
        "prerequisite does not clear.",
    };
  }

  const ratio = price.dividedBy(base);
  const buy = POLICY.verdictSynthesisV1Buy;
  const sell = POLICY.verdictSynthesisV1Sell;
  const bandsText =
    `BUY ≤ ${buy.low.toString()}×/${buy.medium.toString()}×/${buy.high.toString()}× (Low/Medium/High), ` +
    `SELL ≥ ${sell.low.toString()}×/${sell.medium.toString()}×/${sell.high.toString()}× (Low/Medium/High)`;

  // Invariant SELL: clears the strictest (High) SELL threshold, so it also
  // clears Medium and Low — true under every uncertainty bucket at once.
  if (ratio.greaterThanOrEqualTo(sell.high)) {
    return {
      status: "SELL",
      reason:
        `Verdict synthesis policy v1 (Methodology, approved 22 Sep 2026): price ${money(price)} is ` +
        `${multiple(ratio)} of the Base fair value ${money(base)} — at or above the High-uncertainty SELL ` +
        `threshold (${sell.high.toString()}×), so also at or above Medium (${sell.medium.toString()}×) and Low ` +
        `(${sell.low.toString()}×). SELL under all three uncertainty buckets alike; which bucket actually applies ` +
        "(Methodology names the factors — leverage, cyclicality, disclosure quality/history, binary regulatory " +
        "exposure, Bear–Bull dispersion — with no combining formula) does not change this result.",
    };
  }

  // Invariant BUY-eligible on valuation alone: clears the strictest (High)
  // BUY threshold, so it also clears Medium and Low. Methodology still
  // requires the minimum business-quality bar to pass before BUY issues,
  // and reserves thesis invalidation as an independent, judgement-owned
  // route to SELL — neither has a product mechanism on AnalysisResult today
  // (product-decisions.md items 3/9: AI does not make the final qualitative
  // call), so this stays INCOMPLETE rather than manufacturing BUY from
  // valuation alone, which would repeat exactly the single-diagnostic
  // problem the 18 Sep 2026 ruling forbids.
  if (ratio.lessThanOrEqualTo(buy.high)) {
    return {
      status: "INCOMPLETE",
      reason:
        `Verdict synthesis policy v1 (Methodology, approved 22 Sep 2026): price ${money(price)} is ` +
        `${multiple(ratio)} of the Base fair value ${money(base)} — at or below every BUY threshold ` +
        `(${bandsText}) regardless of uncertainty bucket. But BUY also requires the policy's own minimum ` +
        "business-quality bar to pass, and no human-confirmed quality judgement exists on this run — valuation " +
        "alone cannot produce BUY (Methodology: \"valuation alone cannot produce BUY\"). Decision-critical " +
        "analysis is incomplete until that judgement is recorded.",
    };
  }

  // Invariant HOLD: clears neither the loosest (Low) BUY threshold nor the
  // loosest (Low) SELL threshold, so no uncertainty bucket would place it in
  // either band.
  if (ratio.greaterThan(buy.low) && ratio.lessThan(sell.low)) {
    return {
      status: "HOLD",
      reason:
        `Verdict synthesis policy v1 (Methodology, approved 22 Sep 2026): price ${money(price)} is ` +
        `${multiple(ratio)} of the Base fair value ${money(base)} — strictly between the loosest BUY threshold ` +
        `(${buy.low.toString()}×, Low) and the loosest SELL threshold (${sell.low.toString()}×, Low), so between ` +
        "the applicable BUY and SELL thresholds under every uncertainty bucket alike. HOLD, Methodology's own " +
        "default for this zone, unless thesis invalidation requires SELL — no thesis-invalidation signal exists " +
        "on this run.",
    };
  }

  // Genuinely ambiguous: which uncertainty bucket applies would change the
  // answer, and no combining formula for the named factors exists anywhere
  // in this tree (docs/verdict-decision-pack.md item 1's residual half).
  // Fails closed, naming the specific open question, never a default.
  return {
    status: "INCOMPLETE",
    reason:
      `Verdict synthesis policy v1 (Methodology, approved 22 Sep 2026): price ${money(price)} is ` +
      `${multiple(ratio)} of the Base fair value ${money(base)} (${bandsText}) — which BUY/HOLD/SELL band applies ` +
      "depends on which uncertainty bucket (Low/Medium/High) this run falls into, and Methodology names the " +
      "contributing factors (operating/financial leverage, cyclicality, disclosure quality/history, binary " +
      "regulatory or litigation exposure, Bear–Bull dispersion) without a formula for combining them into one " +
      "bucket — no such formula exists anywhere in this codebase. Decision-critical analysis is incomplete until " +
      "that open house-policy question is resolved; this is not a manufactured HOLD.",
  };
}
