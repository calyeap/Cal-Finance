import type { FactRecord } from "./types";
import type { FactDecision, ReasonCode } from "./decisions";
import { queuedFacts, type CrossCheckFailedFactIds, type DerivedExemptionEvidence } from "./spotCheck";

// ---------------------------------------------------------------------------
// CF-ANALYZER-AUTORUN-01 — automatic routine verification.
//
// AUTHORITY. Calvin's CALVIN RULING, 22 September 2026 04:28:04Z (PR #216
// comment 5771211284): "After I enter/select a ticker and start analysis, I
// should not be required to manually verify prices, margins, SEC facts,
// extraction states, provenance, gates, or other routine inputs. Acquisition,
// validation, calculation and routine verification should execute
// automatically behind the scenes. ... If the system cannot reliably complete
// an analysis, return a clear INCOMPLETE report explaining the reason rather
// than forcing me through an operator workflow."
//
// WHAT THIS MODULE IS. One pure function from (a run's queued facts, that
// run's §3.8.2 cross-check outcomes) to a Step 2 decision per queued fact.
// It computes; it does not store, render or gate. It invents no vocabulary:
// every decision it returns is one of §3.8.3's two, with a §3.8.4 reason code
// where the decision is a non-confirmation, and the verification state each
// one produces is one of criterion A24's four values, unchanged.
//
// WHAT THIS MODULE IS NOT. It is not a widening of the §3.8.1 exemption, and
// it does not remove a fact from the queue. Every queued fact stays queued and
// still requires a decision before any calculation module runs — that is the
// chokepoint in gate.ts, and this outcome changes how a run reaches
// verification-complete, never whether the gate exists. What changes is only
// WHO answers the queue in the normal path.
//
// WHAT "THE SOFTWARE CAN CONFIRM THIS" MEANS, DERIVED RATHER THAN ASSUMED.
// A human spot-check is a per-fact comparison of a value against the document
// it came from (§3.8's presentation requirement). The software cannot do that.
// What it can do is establish, deterministically and reproducibly, that
// nothing about how this figure was obtained requires a person to look at it:
//
//   1. No §3.8.2 cross-check FAILED on it. A failure is disqualifying and
//      unconditional — §3.8.2 forces such a fact into the queue "whatever its
//      acquisition path", and a failed check is positive evidence against the
//      figure, not an absence of evidence for it.
//   2. It has a value. §5.1 forbids estimating, carrying forward or
//      interpolating a missing figure, so a fact with no value has nothing to
//      confirm and confirming it would be a claim about a number that is not
//      there.
//   3. It carries its §3.2 provenance. A figure whose source or as-of date is
//      missing cannot be checked against anything, by a person or by this
//      software, and §3.2's fields are what make it checkable at all.
//   4. It was NOT AI-EXTRACTED. This is the whole reason the queue exists:
//      §3.8.1 records that what remains in the queue is "the AI-extracted set
//      — which is where all four recorded errors occurred". A model's own
//      output is precisely the value this software has no independent reading
//      of, so it is the one class it must not confirm on its own say-so.
//   5. It is PRIMARY. A SECONDARY figure is material (§3.8) because it came
//      from a transcript, press or aggregator rather than from the filing;
//      reconciling it to the primary document is a human act with no
//      deterministic equivalent here.
//
// Conditions 4 and 5 are read off the fact's own §3.2 fields, which is the
// same evidentiary discipline §3.8.1 guard 1 applies: the record's own
// declaration, never a label this layer assigns to it.
//
// THE FAIL DIRECTION IS A DECISION, NOT A GAP. Where a queued fact fails any
// of the five, the run does not stall and the analyst is not routed to an
// operator screen. The fact is recorded NOT CONFIRMED with a §3.8.4 reason
// code, and §5 propagates INCOMPLETE to every dependent output exactly as it
// already does for a human non-confirmation. That is Calvin's "clear
// INCOMPLETE report explaining the reason" expressed in the vocabulary the
// product already has.
//
// A NOTE ON §3.2's GLOSS, RECORDED RATHER THAN AMENDED. §3.2 glosses CONFIRMED
// as "A human checked the figure against its source and it matched", which
// describes ONE route to that state and, after this amendment, not the only
// one. The state itself is behaviourally correct for an automatically
// confirmed fact — it is decided, it counts toward completion, and it does not
// propagate INCOMPLETE — and criterion A24 fixes the field at four values, so
// inventing a fifth to carry the difference would break a frozen criterion.
// The difference is carried by the recorded ORIGIN instead, which every
// surface displays beside the state, so nothing presents an automatic
// confirmation as a human one. This is deliberately the same treatment
// Command Center ruled for SPOT-CHECK NOT REQUIRED on 8 September 2026 —
// record, do not amend — and the §3.2 wording goes into the amendment cycle
// with it. See the note at deriveVerificationState in spotCheck.ts.
// ---------------------------------------------------------------------------

/** Why the software could not confirm a fact by itself. Diagnostic, not vocabulary. */
export type AutomaticRefusalCause =
  | "CROSS-CHECK FAILED"
  | "NO VALUE"
  | "PROVENANCE INCOMPLETE"
  | "AI-EXTRACTED"
  | "SECONDARY SOURCE";

export interface AutomaticFactDecision {
  factId: string;
  decision: FactDecision;
  reasonCode: ReasonCode | null;
  /** null on a confirmation; the disqualifying condition otherwise. */
  cause: AutomaticRefusalCause | null;
}

/**
 * The §3.8.4 reason code each refusal maps onto.
 *
 * The two codes are fixed by criterion A22 and neither branches behaviour
 * (A23), so this mapping decides nothing downstream — it decides which work
 * queue the refusal lands in, which is the only job §3.8.4 gives the codes:
 * "they separate a pipeline defect from an acquisition gap".
 *
 * CONTRADICTED BY SOURCE for a failed cross-check: the figure was located and
 * a deterministic rule found it inconsistent with the facts it must agree
 * with — §3.8.4's "the pipeline delivered a wrong figure from a document that
 * holds the right one", which is the pipeline-defect queue.
 *
 * NOT LOCATED for the other four: from this software's position the figure
 * could not be found in a form it can check at all — no value, no provenance
 * to check it against, or an acquisition path (a model's reading, a secondary
 * document) this software cannot re-derive. §3.8.4 calls that "a provenance or
 * citation defect", which is the acquisition-gap queue, and that is the
 * correct destination for every one of them.
 */
const REASON_CODE_FOR: Readonly<Record<AutomaticRefusalCause, ReasonCode>> = {
  "CROSS-CHECK FAILED": "CONTRADICTED BY SOURCE",
  "NO VALUE": "NOT LOCATED",
  "PROVENANCE INCOMPLETE": "NOT LOCATED",
  "AI-EXTRACTED": "NOT LOCATED",
  "SECONDARY SOURCE": "NOT LOCATED",
};

function isNonEmpty(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Why the software cannot confirm this fact itself, or null where it can.
 *
 * Order is the order of the five conditions above and is load-bearing only in
 * that the FIRST disqualifying condition is the one reported — a fact whose
 * cross-check failed is reported as a cross-check failure rather than as
 * whatever else might also be true of it, because that is the condition an
 * analyst would act on.
 */
export function automaticRefusalCause(
  fact: FactRecord,
  crossCheckFailedFactIds: CrossCheckFailedFactIds
): AutomaticRefusalCause | null {
  if (crossCheckFailedFactIds.has(fact.id)) return "CROSS-CHECK FAILED";
  if (fact.value === null) return "NO VALUE";
  // The §3.2 fields this software needs to have anything to check against.
  // retrievalTimestamp is deliberately absent: §3.2 admits null "where
  // genuinely not applicable", so requiring it would refuse facts the contract
  // itself says may not carry one.
  if (!isNonEmpty(fact.source) || !isNonEmpty(fact.asOfDate) || !isNonEmpty(fact.type)) {
    return "PROVENANCE INCOMPLETE";
  }
  if (fact.extractionType === "AI-EXTRACTED") return "AI-EXTRACTED";
  if (fact.sourceClass === "SECONDARY") return "SECONDARY SOURCE";
  return null;
}

/** The one decision the software takes on one queued fact. */
export function automaticDecisionFor(
  fact: FactRecord,
  crossCheckFailedFactIds: CrossCheckFailedFactIds
): AutomaticFactDecision {
  const cause = automaticRefusalCause(fact, crossCheckFailedFactIds);
  if (cause === null) {
    return { factId: fact.id, decision: "CONFIRMED", reasonCode: null, cause: null };
  }
  return {
    factId: fact.id,
    decision: "NOT CONFIRMED",
    reasonCode: REASON_CODE_FOR[cause],
    cause,
  };
}

/**
 * Every decision the software takes on a run's queue, for the queued facts
 * that carry none yet.
 *
 * A fact already decided is skipped, whoever decided it. That is what makes
 * this safe to run on every load: a second pass over a run an analyst has
 * already worked through changes nothing, and a human decision is never
 * overwritten by an automatic one. The store enforces the same rule
 * independently (ON CONFLICT DO NOTHING) — neither layer is trusted alone.
 *
 * The queue itself is `queuedFacts`, unchanged and unwidened: this asks the
 * same function the gate asks, with the same three inputs, so the set answered
 * here is exactly the set the gate is waiting on.
 */
export function automaticDecisionsFor(
  facts: readonly FactRecord[],
  decidedFactIds: ReadonlySet<string>,
  crossCheckFailedFactIds: CrossCheckFailedFactIds,
  evidence?: DerivedExemptionEvidence
): AutomaticFactDecision[] {
  return queuedFacts(facts, crossCheckFailedFactIds, evidence)
    .filter((f) => !decidedFactIds.has(f.id))
    .map((f) => automaticDecisionFor(f, crossCheckFailedFactIds));
}
