import type { TrustStatus } from "./types";

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
