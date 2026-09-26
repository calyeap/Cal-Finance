import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../db";
import { createRun, getRun, getFactDecisions, recordFactDecision } from "./runStore";
import { loadGateState, computeAnalysisForRun, SpotCheckIncompleteError } from "./gate";
import { advanceRunAutomatically } from "./autoRun";

// ---------------------------------------------------------------------------
// CF-UPDATE-FIRST-OUTCOME-01 — the UPDATE entry point (beginUpdateRunAction,
// app/actions/analyzer.ts) reuses createRun + advanceRunAutomatically
// verbatim, the same two statements beginAnalysisAction already runs for a
// first run (see automaticAnalysisOnRealRun.test.ts's own source pin). What
// makes UPDATE UPDATE rather than a second first-run is only WHERE the
// ticker comes from (the prior run's own stored record, not a client-typed
// one) — proved as a mocked unit test in app/actions/analyzer.test.ts, since
// that step needs a network identity resolution this offline suite does not
// exercise.
//
// This file proves the three DONE WHEN properties that DO belong to the real
// pipeline, against the real store and the real committed captures
// (ANALYZER_OFFLINE=1, vitest.setup.ts):
//
//   1. A re-look produces a genuinely distinct runId.
//   3. The new run passes through the unchanged Step 2 gate before any
//      number is calculated, and copies no fact/decision/judgment forward.
//   (and, folded into the same assertions) the prior run's own row and
//      report are left untouched by creating and running the new one.
// ---------------------------------------------------------------------------

describe("CF-UPDATE-FIRST-OUTCOME-01 — a re-look run against the real pipeline", () => {
  beforeEach(async () => {
    await getPool().query(
      "TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE"
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  describe.each([
    { ticker: "MSFT", companyName: "Microsoft Corporation" },
    { ticker: "OKLO", companyName: "Oklo Inc." },
  ])("$ticker", ({ ticker, companyName }) => {
    it("gives the re-look its own distinct runId, never reusing or deriving from the prior one", async () => {
      const priorRunId = await createRun(ticker, companyName);
      await advanceRunAutomatically(priorRunId);

      // What beginUpdateRunAction does once it has re-resolved the identity:
      // createRun + advanceRunAutomatically, exactly as a first run.
      const newRunId = await createRun(ticker, companyName);
      await advanceRunAutomatically(newRunId);

      expect(newRunId).not.toBe(priorRunId);
    });

    it("leaves the prior run's row and fact decisions completely untouched, still reachable by its own id", async () => {
      const priorRunId = await createRun(ticker, companyName);
      await advanceRunAutomatically(priorRunId);
      // The analyst had also overridden one fact by hand on the prior run —
      // proof that a re-look does not reach back and touch it.
      const priorState = await loadGateState(priorRunId);
      const [firstFactId] = priorState.outstandingFactIds.length > 0
        ? priorState.outstandingFactIds
        : [...priorState.decidedFactIds];
      if (priorState.outstandingFactIds.length > 0) {
        await recordFactDecision(priorRunId, firstFactId, "NOT CONFIRMED", "NOT LOCATED");
      }
      const priorRunBefore = await getRun(priorRunId);
      const priorDecisionsBefore = await getFactDecisions(priorRunId);
      const priorResultBefore = await computeAnalysisForRun(priorRunId);

      const newRunId = await createRun(ticker, companyName);
      await advanceRunAutomatically(newRunId);
      await computeAnalysisForRun(newRunId);

      expect(await getRun(priorRunId)).toEqual(priorRunBefore);
      expect(await getFactDecisions(priorRunId)).toEqual(priorDecisionsBefore);
      expect(await computeAnalysisForRun(priorRunId)).toEqual(priorResultBefore);
    });

    it("copies no fact decision or judgment forward — the new run starts with an entirely empty queue of ITS OWN decisions", async () => {
      const priorRunId = await createRun(ticker, companyName);
      await advanceRunAutomatically(priorRunId);
      const priorDecisions = await getFactDecisions(priorRunId);
      expect(priorDecisions.length).toBeGreaterThan(0);

      const newRunId = await createRun(ticker, companyName);
      // Before the pipeline runs: same as any freshly-created run, gated shut.
      expect(await getFactDecisions(newRunId)).toEqual([]);
      expect((await loadGateState(newRunId)).spotCheckComplete).toBe(false);
      await expect(computeAnalysisForRun(newRunId)).rejects.toBeInstanceOf(SpotCheckIncompleteError);

      // After the pipeline runs: its own decisions, not the prior run's.
      await advanceRunAutomatically(newRunId);
      const newDecisions = await getFactDecisions(newRunId);
      expect(newDecisions.length).toBeGreaterThan(0);
      expect(newDecisions.map((d) => d.factId).sort()).toEqual(priorDecisions.map((d) => d.factId).sort());
      // Every one of them was decided by THIS run's own automatic pass, not
      // inherited from the prior run's decisions.
      expect(newDecisions.every((d) => d.origin === "AUTOMATIC")).toBe(true);
    });

    it("pays the same Step 2 gate as a first run — no number is computed until the new run's own automatic pass completes it", async () => {
      const newRunId = await createRun(ticker, companyName);

      // The refusal-before-calculation gate (§2) applies identically: no
      // shortcut, no "same facts as before" bypass exists for this run.
      await expect(computeAnalysisForRun(newRunId)).rejects.toBeInstanceOf(SpotCheckIncompleteError);

      const state = await advanceRunAutomatically(newRunId);
      expect(state.spotCheckComplete).toBe(true);
      await expect(computeAnalysisForRun(newRunId)).resolves.toBeDefined();
    });
  });
});
