import type { TrustResult, UndefinedPolicyConstants, VerdictBlocker } from "./types";

// ---------------------------------------------------------------------------
// CF-M8-VERDICT-ENGINEERING-UNBLOCK-01 (REVIEW correction) — §10.6.2's
// explicit, testable blocker classification.
//
// The PR this corrects could only describe its own "shipping blocker
// summary" in prose. This turns that same summary into real code, checked
// against the real facts a run already carries — trust (§9.6) and this run's
// own configured policy constants (§7.1) — rather than a hand-maintained list
// that can silently drift from what a run actually blocks on.
//
// This is read-only classification. It introduces no new threshold, band, or
// numeric tolerance, and `deriveVerdict`'s user-facing status/reason text is
// untouched by it — see growthLicence.ts's own doc comment for the sibling
// reasoning. The four entries below are fixed by the still-open house-policy
// questions named in docs/verdict-methodology-reconciliation.md §11 and
// docs/verdict-decision-pack.md §8; nothing here decides any of them.
//
// Deliberately excluded: Step 7's missing reverse-DCF comparator. Under
// Ruling B it is Step 7's own explanatory input (§10.6.2/§13,
// CF-VERDICT-NONPOLICY-GAPS-01), never a Step 5 blocker — adding it here
// would misattribute it.
// ---------------------------------------------------------------------------

export interface VerdictBlockersInput {
  /** §9.6 — rule 1 (UNUSABLE) is the one Step 1 fail-closed signal every
   * acquired run already computes, whatever this run's own particular gate
   * (missing EV, unsupported leverage, a fixture-carried range, ...) turned
   * out to be. Read here, not re-derived, for the same one-fact reason
   * trust.ts's own header gives for reading `fairValueRange` rather than
   * recomputing its suppression. */
  trust: TrustResult;
  /** §7.1 — this run's own configured register, not the static default in
   * policy.ts: a company-specific fixture may already have supplied a value
   * POLICY's own register still records as LATER/null. */
  undefinedConstants: UndefinedPolicyConstants;
}

export function evaluateVerdictBlockers(input: VerdictBlockersInput): VerdictBlocker[] {
  const blockers: VerdictBlocker[] = [];

  // 1 — any Step 1 block. trust.status === "UNUSABLE" IS §9.6 rule 1: a §9.3
  // suppressing state removed the fair-value range, or a REQUIRED input of
  // the range itself is INCOMPLETE (trust.ts). Its own determinedBy[0].detail
  // already carries "<STATE> — <cause>" — the exact fact to report, reused
  // verbatim rather than read a second time off fairValueRange.
  if (input.trust.status === "UNUSABLE") {
    blockers.push({
      step: "Step 1",
      kind: "DATA",
      cause: input.trust.determinedBy[0]?.detail ?? "trust is UNUSABLE",
    });
  }

  // 2 — Step 3 value: no approved growth-inclusive/conservative value model
  // exists in production for ANY company today. §11 item 3 (fixed floor vs.
  // company-specific no-growth bound) is unresolved; Phase B's shadow FCFF
  // DCF (#428) remains test-only/NOT PROVEN and unused here.
  blockers.push({
    step: "Step 3",
    kind: "OPEN POLICY",
    cause:
      "no approved growth-inclusive/conservative value model exists in production — §11 item 3 (fixed floor vs. company-specific no-growth bound, docs/verdict-methodology-reconciliation.md) is unresolved.",
  });

  // 3 — Step 4/5: an explicit waiting-for-policy state, never HOLD. The
  // forecast-dispersion measure's SHAPE is ruled (CALVIN RULING — C), but it
  // cannot be built without AnalystSuppliedRange growth/margin (or
  // rate/terminal-growth) inputs captured for at least one company (§11 item
  // 1, docs/step4-forecast-dispersion.md) — none exist in the tree today.
  // Step 5's own numeric CHEAP/FAIR/EXPENSIVE band (§11 item 5) is a
  // separate, still-open decision, explicitly deferred by HARD BOUNDS.
  blockers.push({
    step: "Step 4/5",
    kind: "OPEN POLICY",
    cause:
      "waiting for policy — the ruled forecast-dispersion measure (§11 item 1) cannot be built without at least one company's AnalystSuppliedRange growth/margin (or rate/terminal-growth) capture, and Step 5's numeric band/cut-point (§11 item 5) remains a separate open decision. Disagreement or absence here is never resolved to a default verdict.",
  });

  // 4 — nopatTaxRate and the other UNDEFINED_POLICY_CONSTANTS still null for
  // THIS run. Checked against the run's own configured register, not
  // policy.ts's static default, so a company whose fixture already supplies
  // one of these (e.g. MSFT/NVDA's nopatTaxRate) is not reported as blocked
  // on a value it does not actually need.
  const stillUndefined = (Object.keys(input.undefinedConstants) as (keyof UndefinedPolicyConstants)[]).filter(
    (key) => input.undefinedConstants[key] === null
  );
  if (stillUndefined.length > 0) {
    blockers.push({
      step: "policy constants",
      kind: "DATA",
      cause: `${stillUndefined.join(", ")} not configured for this run (§7.1, policy.ts) — no Command Center ruling has landed.`,
    });
  }

  return blockers;
}
