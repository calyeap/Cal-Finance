// ---------------------------------------------------------------------------
// CF-M8-VERDICT-ENGINEERING-UNBLOCK-01 — §10.6.2 Step 6 ("flip test"), per
// `CALVIN RULING — C` (docs/verdict-methodology-reconciliation.md §9/§10):
//
//   "FLIP TEST — when the growth licence is UNKNOWN, if both growth-
//   inclusive and conservative values imply the same verdict, issue it; if
//   they imply different verdicts, return INCOMPLETE."
//
// A pure agreement check on two ALREADY-DERIVED Step 5 positions — it never
// computes, estimates or tolerates a numeric gap between them, and never
// substitutes an arbitrary closeness threshold for genuine agreement (the
// task's own "do not fabricate the missing band or substitute an arbitrary
// numeric tolerance"). It has no live caller yet: Step 3 (an approved
// growth-inclusive/conservative value) and Step 5 (a numeric CHEAP/FAIR/
// EXPENSIVE band) are both still open house-policy decisions (§11 items 1,
// 3, 4, 5 of the reconciliation doc), so no run can supply this function two
// genuine Step 5 positions today. It exists, tested, so that once Step 3/5
// land under their own Calvin ruling, Step 6 does not have to be invented
// then — see growthLicence.ts's own doc comment for the sibling Step 2
// mechanic this outcome implements for the same reason.
// ---------------------------------------------------------------------------

export type Step5Position = "CHEAP" | "FAIR" | "EXPENSIVE";

export interface FlipTestResult {
  status: "ISSUED" | "INCONCLUSIVE";
  position: Step5Position | null;
  reason: string;
}

export function evaluateFlipTest(growthInclusive: Step5Position, conservative: Step5Position): FlipTestResult {
  if (growthInclusive === conservative) {
    return {
      status: "ISSUED",
      position: growthInclusive,
      reason:
        `Step 6 (§10.6.2) flip test: the growth-inclusive and conservative / no-growth comparisons both imply ` +
        `${growthInclusive} — they agree, so the position issues.`,
    };
  }

  return {
    status: "INCONCLUSIVE",
    position: null,
    reason:
      `Step 6 (§10.6.2) flip test: the growth-inclusive comparison implies ${growthInclusive} but the ` +
      `conservative / no-growth comparison implies ${conservative} — they disagree, so the position is ` +
      "INCONCLUSIVE. Disagreement never falls back to a default HOLD/FAIR.",
  };
}
