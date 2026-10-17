import type Decimal from "decimal.js";
import type { FairValueRange, LeverageResult, RateBand, TrustStatus, ValuationBasis } from "./types";
import { formatRate } from "./discountRate";
import { verdictUnavailableLine } from "./overviewCopy";
import type { VerdictResult } from "./verdict";
import { CHECK_RATES, UNCERTAINTY_LEVELS, type UncertaintyLevel } from "./verdictSynthesisV1";
import { NOT_SURE, type VerdictJudgements } from "./verdictJudgements";

// ---------------------------------------------------------------------------
// The page-one trust sentences, DERIVED from the computed status.
//
// report/page.tsx printed "Profile not confirmed · trust status PARTIAL" as a
// literal. That was true of the only run the page had been looked at with, and
// after Fix 1 it is reachable on a run whose fair-value range was suppressed —
// which §9.6 rule 1 makes UNUSABLE. A page asserting PARTIAL about a run the
// Analysis Result calls UNUSABLE is the same class of defect as the verification
// state that travelled beside the fact instead of deriving from the decision.
//
// §10.0.2 rule 3 states the general rule: "The renderer adds formatting and
// prose; it adds no content."
//
// THE COPY CONSTRAINT, which is §9.6's and not a preference: "UNUSABLE is a
// statement about the analysis, not about the investment. It says this run
// cannot tell you what the company is worth. It does not say the company is
// bad, and no copy may let it be read that way."
// ---------------------------------------------------------------------------

/** The state-slot name line: what this run's trust status is, and why. */
export function trustStatusLine(status: TrustStatus, profileNotConfirmed: boolean): string {
  const statusPart = `Trust status ${status}`;
  return profileNotConfirmed ? `Profile not confirmed · ${statusPart}` : statusPart;
}

/** What follows from the status for the reader, in §9.6's own terms. */
export function trustConsequenceLine(status: TrustStatus): string {
  switch (status) {
    case "UNUSABLE":
      // The refusal IS the instruction (§9.6), so the sentence reports it
      // rather than advising anything.
      return (
        "There is no fair-value range on this run: a suppressing state removed it, and the " +
        "state is the output. This run cannot tell you what the company is worth. It says " +
        "nothing about the company itself."
      );
    case "PARTIAL":
      // §6.3's own words for this case.
      return (
        "The fair-value range below still renders. The named parts of the analysis above it " +
        "do not, and the states beside them say which."
      );
    case "CLEAN":
      return "Every output this run produces can be used as it stands.";
  }
}

// ---------------------------------------------------------------------------
// M9-CONFIDENCE-LABEL-01 (issue #201, Calvin's ruling on #196, 21 Sep 2026
// 11:01:20Z, Option B) — the Overview slot-2 `ConfidenceIndicator` label.
//
// This is a SEPARATE mapping from the two functions above. Those render a
// full state-slot sentence for the page-one trust block; this renders one
// short label adjacent to a completed BUY/HOLD/SELL verdict, where the
// component's name (`ConfidenceIndicator`) and its position beside a verdict
// invite exactly the reading Calvin's ruling forbids: a numeric-flavoured
// certainty claim. So the copy here is deliberately narrower than
// `trustStatusLine`'s: it never uses "confidence", "probability",
// "certainty", "score" or a percentage, it says in its own words that it
// describes evidence completeness rather than certainty in the verdict, and
// under UNUSABLE it says so as a statement about this run, never about the
// company (§9.6).
// ---------------------------------------------------------------------------

/** The Overview slot-2 evidence-status label — a pure mapping, no computation. */
export function evidenceStatusLabel(status: TrustStatus): string {
  switch (status) {
    case "CLEAN":
      return "Evidence behind this analysis: complete.";
    case "PARTIAL":
      return "Evidence behind this analysis: partial.";
    case "UNUSABLE":
      return "Evidence behind this analysis: unusable — a statement about this run, not the company.";
  }
}

// ---------------------------------------------------------------------------
// CF-AR5-VERDICT-CONSOLIDATION-01 — the hero's "Uncertainty" badge
// (docs/design/analyzer-v2-design-authority.md §"Compact report header":
// "Low / Medium / High uncertainty", never "confidence").
//
// It used to relabel the run's evidence completeness (TrustStatus) as an
// uncertainty level — a different fact. Uncertainty is the D3 level: how
// reliably value can be bounded, which only Calvin sets (Methodology v2.1
// D3, no mechanical checklist). So the badge shows his recorded answer, and
// otherwise says whether the level matters to this verdict at all. Evidence
// completeness keeps its own label beside the verdict (evidenceStatusLabel).
// ---------------------------------------------------------------------------

export type { UncertaintyLevel };

export interface UncertaintyBadge {
  /** Calvin's recorded level, or null where none is set. */
  level: UncertaintyLevel | null;
  text: string;
}

export function uncertaintyBadge(verdict: VerdictResult, judgements: VerdictJudgements | undefined): UncertaintyBadge {
  const answer = judgements?.uncertainty ?? null;
  if (answer !== null && answer.answer !== NOT_SURE) {
    return { level: answer.answer, text: `${answer.answer} uncertainty — your answer, ${answer.recordedAt.slice(0, 10)}` };
  }
  if (verdict.state === "UNCERTAINTY QUESTION") {
    return { level: null, text: answer !== null ? "Uncertainty — you answered not sure" : "Uncertainty — your call" };
  }
  if (verdict.check?.routing.kind === "AUTOMATIC") {
    return { level: null, text: "Uncertainty — doesn't change this verdict" };
  }
  return { level: null, text: "Uncertainty — not set" };
}

// ---------------------------------------------------------------------------
// CF-ANALYZER-V1-SETTLE-01 — CALVIN RULING — REJECT CURRENT HEAD FOR ONE
// FINAL PRODUCT-COMPLETION PASS, item 2: outside Evidence, the hero's
// INCOMPLETE verdict slot (DominantVerdictSlot) showed only "INCOMPLETE" /
// "Unavailable — see Evidence" — naming that a verdict is missing, never
// why. Calvin: "Explain the actual missing decision-critical condition(s)
// in plain English, then link/defer technical detail to Evidence."
//
// `deriveVerdict` (verdict.ts) is pinned by content hash
// (m9RealCompanyValidationGuards.test.ts) and stays untouched — this reads
// the exact same already-computed signals that function branches on (trust
// status, the fair-value range's kind, whether a human has confirmed the
// profile), in the same order, and states the condition in plain language
// instead of parsing `verdict.reason`'s pinned prose. No new computation,
// no new state; `verdict.reason` itself remains the full verbatim technical
// explanation, still shown in full on Evidence.
// ---------------------------------------------------------------------------

/**
 * Plain-English stand-in for the hero's INCOMPLETE verdict outside Evidence.
 *
 * CF-ANALYZER-V1-SETTLE-01 — Calvin's 7 Oct 2026 decision on #399 (Option
 * 1): the normal Overview carries no "see Evidence" placeholder, so each
 * branch states the condition itself. Where no fair-value range exists (the
 * case that also makes trust UNUSABLE, §9.6 rule 1), the sentence names the
 * range's own reason in plain words (overviewCopy.ts) instead of pointing
 * elsewhere for it.
 */
export function incompleteVerdictExplanation({
  trustStatus,
  fairValueRange,
  leverage,
  profileNotConfirmed,
}: {
  trustStatus: TrustStatus;
  fairValueRange: FairValueRange;
  leverage?: LeverageResult;
  profileNotConfirmed: boolean;
}): string {
  if (fairValueRange.kind === "suppressed") {
    return verdictUnavailableLine(fairValueRange, leverage);
  }
  if (trustStatus === "UNUSABLE") {
    return "This run's underlying data isn't reliable enough yet to support a verdict.";
  }
  if (fairValueRange.kind === "pre-revenue-distribution") {
    return "This company doesn't yet generate the kind of earnings this model prices against, so there is no buy/hold/sell line yet — only a cash-floor estimate below.";
  }
  if (profileNotConfirmed) {
    return "Nobody has confirmed which financial profile fits this company yet, so a verdict can't render until that happens.";
  }
  return "A fair-value range is available, but the verdict's ±0.5pp rate check could not be completed on this run.";
}

// ---------------------------------------------------------------------------
// CALVIN RULING — REJECT CURRENT PRODUCT SURFACE; BUILD ONE SIMPLE COMPLETE
// RM-BRIEF PROOF (PR #399, comment 5952716764), REMOVE/BYPASS item 1: "
// deriveVerdict / hero INCOMPLETE must not block or dominate the normal
// report. Use existing price-vs-range / current-price interpretation
// instead. Do not invent BUY/HOLD/SELL."
//
// `scenarioOutputs.priceLocationWithinRange` (modules/scenarioOutputs.ts)
// already computes exactly this — the same "X% of the way from bear to
// bull" figure Quick Read's ValuationStrip already states in words
// (`showLocation`). This restates that already-computed figure as the
// hero's own bottom-line sentence, in place of the literal "INCOMPLETE"
// label, whenever a defensible range exists. It states where the price
// sits, never whether that is good or bad — no BUY/HOLD/SELL word, no new
// computation.
// ---------------------------------------------------------------------------

/**
 * The hero's price-vs-range bottom line, or null where no defensible range
 * exists to describe a position within, OR where §10.6.3's existing
 * valuation-position suppression applies — trust UNUSABLE, or the profile
 * not yet human-confirmed (the same `positionSuppressedBy` gate
 * ScenarioRangeStrip already enforces, REVIEW's own `CORRECT:` on this PR,
 * comment 5932208513: "a fresh automatic run records no profile decision,
 * so §10.6.3 suppresses the valuation position; the hero must not show its
 * percentage restatement either"). This function reuses that exact gate
 * rather than loosening it — §10.6.3 itself is untouched by this outcome.
 * The caller falls back to `incompleteVerdictExplanation` in either case,
 * which already states the suppression's own plain-English cause.
 */
export function priceVsRangeHeadline({
  fairValueRange,
  priceLocationWithinRange,
  trustStatus,
  profileNotConfirmed,
}: {
  fairValueRange: FairValueRange;
  priceLocationWithinRange: Decimal | null;
  trustStatus: TrustStatus;
  profileNotConfirmed: boolean;
}): string | null {
  if (fairValueRange.kind !== "range" || priceLocationWithinRange === null) return null;
  if (trustStatus === "UNUSABLE" || profileNotConfirmed) return null;

  const pct = priceLocationWithinRange.mul(100);
  if (pct.lte(0)) {
    return "Trading at or below the bear case modeled for this company — the current price is already at or beyond the most pessimistic scenario in the range below.";
  }
  if (pct.gte(100)) {
    return "Trading at or above the bull case modeled for this company — the current price is already at or beyond the most optimistic scenario in the range below.";
  }
  return `Trading ${pct.toFixed(0)}% of the way from the bear case to the bull case modeled for this company.`;
}

// ---------------------------------------------------------------------------
// CF-AR5-VERDICT-CONSOLIDATION-01 — the verdict slot's plain-English line
// outside Evidence, for an issued verdict and for each pending-judgement
// state (Methodology v2.1 D3: "why" reasons are built from computed numbers;
// AI may not argue a position). Every figure is one the verdict itself
// computed (verdict.check, verdict.rates) and every word is a template:
// no raw state code, no new number, no new policy. The full `verdict.reason`
// still renders verbatim on Evidence.
// ---------------------------------------------------------------------------

function money2(value: Decimal): string {
  return `$${value.toDecimalPlaces(2).toFixed(2)}`;
}

function ratioSpan(verdict: VerdictResult): string | null {
  if (verdict.check === null || verdict.rates === null) return null;
  const ratios = CHECK_RATES.map((r) => verdict.check!.ratios[r]);
  const lo = ratios.reduce((a, b) => (a.lessThan(b) ? a : b));
  const hi = ratios.reduce((a, b) => (a.greaterThan(b) ? a : b));
  const span = lo.toFixed(2) === hi.toFixed(2) ? `${lo.toFixed(2)}×` : `${lo.toFixed(2)}×–${hi.toFixed(2)}×`;
  return `Price is ${span} the Base fair value across the ${formatRate(verdict.rates.lower)}–${formatRate(verdict.rates.upper)} rate band`;
}

/** Plain-English line for an issued verdict or a pending-judgement state, or null for INCOMPLETE. */
export function verdictExplanation(verdict: VerdictResult, price?: Decimal, base?: Decimal): string | null {
  const span = ratioSpan(verdict);
  const bar = verdict.qualityBar;
  switch (verdict.state) {
    case "INCOMPLETE":
    case "CANNOT BOUND VALUE":
      return null;
    case "PENDING ADOPTION":
      return "No verdict until you adopt this company's assumption sheet — its moat class and the return on new investment for each scenario.";
    case "UNCERTAINTY QUESTION": {
      if (verdict.check === null || verdict.check.routing.kind !== "UNCERTAINTY QUESTION") return null;
      const byLevel = verdict.check.routing.byLevel;
      return `How reliably can this company's value be bounded? ${UNCERTAINTY_LEVELS.map((u) => `${u} uncertainty → ${byLevel[u]}`).join(", ")}. ${span}; the rate doesn't change the answer.`;
    }
    case "CLOSE CALL": {
      if (verdict.check === null || verdict.check.routing.kind !== "CLOSE CALL") return null;
      return `${span ?? "Price against Base"}, and the verdict changes across that band — ${verdict.check.routing.zones.join(" or ")}.`;
    }
    case "BUY CANDIDATE":
      return `${span ?? "Price against Base"}: in the BUY band. Still open: ${bar?.open.join("; ") ?? "the quality bar"}.`;
    case "ISSUED": {
      if (verdict.basis === "THESIS BROKEN") return "You recorded the thesis as broken, so the verdict is SELL.";
      const lead =
        span ?? (price !== undefined && base !== undefined ? `Price ${money2(price)} against the Base fair value ${money2(base)}` : "Price against Base");
      // Where the bar was checked, valuation reached the BUY band and the
      // bar decided between BUY and HOLD.
      const zone = bar === null ? verdict.status : "in the BUY band";
      const how =
        verdict.basis === "YOUR UNCERTAINTY ANSWER"
          ? `; at the uncertainty level you set, that is ${zone} at every rate`
          : verdict.basis === "YOUR CLOSE CALL"
            ? `; the verdict changes across the band and your close call puts it ${bar === null ? `at ${zone}` : zone}`
            : `: ${zone} at every rate and uncertainty level`;
      const quality =
        bar === null
          ? ""
          : bar.status === "PASS"
            ? " The quality bar for BUY passes, so BUY."
            : ` The quality bar for BUY is not met (${bar.failed.join("; ")}), so HOLD.`;
      return `${lead}${how}.${quality}`;
    }
  }
}

// ---------------------------------------------------------------------------
// CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — product-decisions.md item 26 ("the
// product shows the dated rate in use"), frozen spec §14.9 AR0-1. Replaces
// the AR1 caveat that said the engine still priced off the retired fixed
// rate. Read from the run's own `valuationBasis`, the rate every valuation
// in it used — not a second figure. A snapshot stored before AR4 carries no
// basis and gets no line.
// ---------------------------------------------------------------------------

const BAND_PHRASE: Record<RateBand, string> = {
  stable: "the market's expected return, for a stable business",
  cyclical: "the market's expected return plus 2pp, for a cyclical business",
  "pre-revenue": "the market's expected return plus 2pp, for a pre-revenue company",
};

/** "Valued at 9.0% — …" — the dated discount rate in use, in plain words. */
export function rateInUseLine(basis: ValuationBasis | undefined): string | null {
  if (basis === undefined) return null;
  const r = basis.discountRate;
  const domain = r.withinValidatedDomain ? "" : " Outside its validated domain: net debt is not below 10% of enterprise value.";
  return `Valued at ${formatRate(r.rate)} — ${BAND_PHRASE[r.band]} (rate dated ${r.effectiveFrom}).${domain}`;
}
