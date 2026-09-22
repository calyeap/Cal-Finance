import { loadGateState, type GateState } from "./gate";
import { automaticDecisionsFor } from "./autoVerify";
import { recordAutomaticFactDecisions, recordAutomaticProfileResolution } from "./runStore";

// ---------------------------------------------------------------------------
// CF-ANALYZER-AUTORUN-01 — the normal path, from a committed run to a run that
// can produce a report, with no human step in between.
//
// AUTHORITY. Calvin's CALVIN RULING, 22 September 2026 04:28:04Z (PR #216
// comment 5771211284): "V1 acceptance target: enter ticker → analyze →
// report. No mandatory human interaction after ticker entry in the normal
// flow."
//
// WHAT THIS DOES, AND ONLY THIS. Two writes, both idempotent:
//
//   1. Every queued fact that carries no decision gets the one the software
//      can defend (autoVerify.ts), recorded as AUTOMATIC.
//   2. Where nobody has decided the profile, the profile the acquired inputs
//      themselves recommended is recorded as an automatic resolution — not as
//      a §6.3 human outcome, and not as a confirmation.
//
// WHAT IT DOES NOT DO. It computes nothing. It calls no calculation module and
// it does not reach assembleAnalysisResult: computeAnalysisForRun is still the
// only route from a runId to an AnalysisResult, and it still checks the gate
// before computing. This function only changes how a run comes to satisfy that
// gate. Read gate.ts's opening comment before changing either.
//
// WHY IT IS SAFE ON EVERY LOAD. Both writes refuse to overwrite: the fact
// decisions insert ON CONFLICT DO NOTHING, and the profile resolution updates
// only where no decision and no earlier resolution exist. Running it twice is
// a no-op; running it on a run an analyst is part-way through leaves their
// decisions exactly as they made them. That is what lets it sit on the
// ordinary route load rather than needing a second state machine to decide
// when it may fire — and it means a run created before this outcome landed
// still reaches a report the first time it is opened.
// ---------------------------------------------------------------------------

/**
 * Brings a run to verification-complete without a human, and returns the gate
 * state as it then stands.
 *
 * Reloads after writing rather than mutating the state it already has: the
 * gate state is derived from the database on every request by design (R7), and
 * a locally patched copy would be this layer asserting a completion the store
 * has not confirmed.
 */
export async function advanceRunAutomatically(runId: string): Promise<GateState> {
  let state = await loadGateState(runId);
  let changed = false;

  if (!state.spotCheckComplete) {
    const decisions = automaticDecisionsFor(
      state.fixture.facts,
      state.decidedFactIds,
      state.crossCheckFailedFactIds,
      state.derivedExemption
    );
    if (decisions.length > 0) {
      await recordAutomaticFactDecisions(
        runId,
        decisions.map((d) => ({
          factId: d.factId,
          decision: d.decision,
          reasonCode: d.reasonCode,
        }))
      );
      changed = true;
    }
  }

  // Step 6. The recommendation is read off THIS run's own acquired inputs
  // (state.fixture.profile.recommended) — never a default, never a hand-picked
  // enum value, and never a profile from another run.
  if (state.run.profileDecision === null && state.run.profileAutoResolved === null) {
    await recordAutomaticProfileResolution(runId, state.fixture.profile.recommended);
    changed = true;
  }

  return changed ? loadGateState(runId) : state;
}
