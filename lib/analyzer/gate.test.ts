import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { getPool } from "../db";
import { createRun, recordFactDecision } from "./runStore";
import { boundState, NOT_COMPUTED_BINDING } from "./notComputed";

// The spy is installed around the REAL assembleAnalysisResult, not a stub, so
// the passing path still computes a genuine result. What is being proved is
// not that the function is absent — it is that on the failing path it is never
// reached. A test that asserted only "an error was thrown" would pass even if
// every calculation module had run first and the error came afterwards.
const assembleSpy = vi.hoisted(() => vi.fn());

vi.mock("./assemble", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./assemble")>();
  assembleSpy.mockImplementation(actual.assembleAnalysisResult);
  return { ...actual, assembleAnalysisResult: assembleSpy };
});

const { computeAnalysisForRun, loadGateState, SpotCheckIncompleteError, RunNotFoundError } =
  await import("./gate");

/**
 * The facts THIS RUN actually queues, in queue order.
 *
 * Since M8-a a run's fact set is acquired from SEC filings rather than read
 * out of a fixture, so the queue is a property of the run and not of a
 * constant this file can import. Asking the gate is also the stronger test: it
 * exercises the same queue the route enforces, including any fact a §3.8.2
 * cross-check forced into it.
 */
async function queuedIdsForRun(runId: string): Promise<string[]> {
  const state = await loadGateState(runId);
  return state.outstandingFactIds;
}

describe("the §2 ordering rule, enforced at the route boundary", () => {
  beforeEach(async () => {
    await getPool().query(
      "TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE"
    );
    assembleSpy.mockClear();
  });

  afterAll(async () => {
    await getPool().end();
  });

  // ---------------------------------------------------------------------
  // DONE WHEN 2 — "No calculation runs before Step 2 completes — proven by a
  // test that attempts it and fails closed, not by inspection."
  // ---------------------------------------------------------------------

  it("refuses to compute for a run with an untouched queue, and computes nothing", async () => {
    const runId = await createRun("MSFT", "Microsoft Corporation");

    await expect(computeAnalysisForRun(runId)).rejects.toBeInstanceOf(SpotCheckIncompleteError);
    expect(assembleSpy).not.toHaveBeenCalled();
  });

  it("refuses when the queue is partly decided, and computes nothing", async () => {
    const runId = await createRun("MSFT", "Microsoft Corporation");
    const queued = await queuedIdsForRun(runId);
    expect(queued.length).toBeGreaterThan(1);

    // Every fact but the last.
    for (const factId of queued.slice(0, -1)) {
      await recordFactDecision(runId, factId, "CONFIRMED", null);
    }

    await expect(computeAnalysisForRun(runId)).rejects.toBeInstanceOf(SpotCheckIncompleteError);
    expect(assembleSpy).not.toHaveBeenCalled();
  });

  it("names what is outstanding rather than only that something is", async () => {
    const runId = await createRun("MSFT", "Microsoft Corporation");
    const queued = await queuedIdsForRun(runId);
    await recordFactDecision(runId, queued[0], "CONFIRMED", null);

    await expect(computeAnalysisForRun(runId)).rejects.toMatchObject({
      outstandingFactIds: queued.slice(1),
    });
  });

  // Confirming an exempt fact must not be mistaken for progress on the queue.
  it("is not satisfied by decisions on facts the queue never contained", async () => {
    const runId = await createRun("MSFT", "Microsoft Corporation");
    await recordFactDecision(runId, "finance-lease-liabilities", "CONFIRMED", null);
    await recordFactDecision(runId, "operating-lease-liabilities", "CONFIRMED", null);

    await expect(computeAnalysisForRun(runId)).rejects.toBeInstanceOf(SpotCheckIncompleteError);
    expect(assembleSpy).not.toHaveBeenCalled();
  });

  it("computes once every queued fact carries a decision", async () => {
    const runId = await createRun("MSFT", "Microsoft Corporation");
    for (const factId of await queuedIdsForRun(runId)) {
      await recordFactDecision(runId, factId, "CONFIRMED", null);
    }

    const result = await computeAnalysisForRun(runId);
    expect(assembleSpy).toHaveBeenCalledTimes(1);
    expect(result.ticker).toBe("MSFT");
  });

  // §3.8.3: the two decisions count identically toward completion. Cannot
  // verify does not block the gate; it blocks dependents through §5.
  it("computes when the queue is complete but answered entirely with Cannot verify", async () => {
    const runId = await createRun("OKLO", "Oklo Inc.");
    for (const factId of await queuedIdsForRun(runId)) {
      await recordFactDecision(runId, factId, "NOT CONFIRMED", "NOT LOCATED");
    }

    await expect(computeAnalysisForRun(runId)).resolves.toBeDefined();
    expect(assembleSpy).toHaveBeenCalledTimes(1);
  });

  // The two H3 gating tests that stood here asserted on OKLO's pre-revenue
  // block, which was built around OKLO_FIXTURE's synthetic unit economics.
  // CF-AR6-ANY-TICKER-DRAFTS-01 — reviewed evaluator change: that fixture no
  // longer reaches a real run (issue #454 DO 6) and OKLO's real run carries
  // no pre-revenue block, so they are replaced by what still holds on the
  // same route: a fact decided "Cannot verify" carries that state onto the
  // run's fact set, and no H3 figure is computed from a fixture.
  it("carries a fact decided Cannot verify onto the run's fact set, and computes no fixture-built H3 figure", async () => {
    const runId = await createRun("OKLO", "Oklo Inc.");
    for (const factId of await queuedIdsForRun(runId)) {
      await recordFactDecision(runId, factId, "CONFIRMED", null);
    }
    await recordFactDecision(runId, "shares-outstanding", "NOT CONFIRMED", "NOT LOCATED");

    const result = await computeAnalysisForRun(runId);
    expect(result.preRevenue).toBeNull();
    expect(result.facts.find((f) => f.id === "shares-outstanding")?.verificationState).toBe("NOT CONFIRMED");
  });

  // A deep link or API call carrying an id that was never issued must not
  // compute, and must not leak whether the id could have existed.
  it.each([
    ["a well-formed id that was never issued", "11111111-1111-4111-8111-111111111111"],
    ["a malformed id", "not-a-uuid"],
    ["an empty id", ""],
    ["a SQL fragment", "'; DROP TABLE analyzer_runs; --"],
  ])("refuses %s, and computes nothing", async (_label, runId) => {
    await expect(computeAnalysisForRun(runId)).rejects.toBeInstanceOf(RunNotFoundError);
    expect(assembleSpy).not.toHaveBeenCalled();
  });

  // Fail-closed on a run whose ticker has no fact set: nothing to spot-check
  // means nothing that may be computed.
  it("refuses a run whose ticker has no fixture, rather than computing on an empty fact set", async () => {
    const runId = await createRun("NEWCO", "Newco Industries");
    await expect(computeAnalysisForRun(runId)).rejects.toBeInstanceOf(RunNotFoundError);
    expect(assembleSpy).not.toHaveBeenCalled();
  });

  it("does not compute merely because the gate state was inspected", async () => {
    const runId = await createRun("MSFT", "Microsoft Corporation");
    const state = await loadGateState(runId);
    expect(state.spotCheckComplete).toBe(false);
    expect(assembleSpy).not.toHaveBeenCalled();
  });

  // DONE WHEN 5 — a refresh mid-queue preserves what was decided. The state is
  // read from the database, not from a session, so this is the same assertion
  // as "a second request sees the first request's decisions".
  it("preserves decisions across independent reads, as a refresh would", async () => {
    const runId = await createRun("MSFT", "Microsoft Corporation");
    const [first] = await queuedIdsForRun(runId);
    await recordFactDecision(runId, first, "NOT CONFIRMED", "CONTRADICTED BY SOURCE");

    const reloaded = await loadGateState(runId);
    expect(reloaded.decidedFactIds.has(first)).toBe(true);
    expect(reloaded.spotCheckComplete).toBe(false);
    expect(reloaded.outstandingFactIds).not.toContain(first);
  });

  // Two runs of the same company must not see each other's work.
  it("gates each run on its own decisions", async () => {
    const done = await createRun("MSFT", "Microsoft Corporation");
    const fresh = await createRun("MSFT", "Microsoft Corporation");
    for (const factId of await queuedIdsForRun(done)) {
      await recordFactDecision(done, factId, "CONFIRMED", null);
    }

    await expect(computeAnalysisForRun(done)).resolves.toBeDefined();
    assembleSpy.mockClear();

    await expect(computeAnalysisForRun(fresh)).rejects.toBeInstanceOf(SpotCheckIncompleteError);
    expect(assembleSpy).not.toHaveBeenCalled();
  });

  // CF-ANALYZER-V1-SETTLE-01 — Calvin ruling 2: a fresh run must not need
  // its own §4.4 NON-OPERATING INVESTMENTS judgment re-supplied when a
  // durable company-level override already carries an already-ruled answer
  // (migration 007 seeds MSFT's, from Calvin's CALVIN DECISION on issue
  // #188). No `recordJudgment` call happens in the first test below — the
  // whole point is that this run never asks for one.
  describe("§4.4 durable company-level override", () => {
    it("resolves enterprise value on a fresh MSFT run with no per-run judgment recorded", async () => {
      const runId = await createRun("MSFT", "Microsoft Corporation");
      for (const factId of await queuedIdsForRun(runId)) {
        await recordFactDecision(runId, factId, "CONFIRMED", null);
      }

      const result = await computeAnalysisForRun(runId);
      expect(result.diagnostics.enterpriseValue.suppressed).toBe(false);
    });

    it("still lets an explicit per-run judgment win over the durable override", async () => {
      const runId = await createRun("MSFT", "Microsoft Corporation");
      for (const factId of await queuedIdsForRun(runId)) {
        await recordFactDecision(runId, factId, "CONFIRMED", null);
      }
      const { recordJudgment } = await import("./runStore");
      await recordJudgment(runId, "NON-OPERATING INVESTMENTS", "None of these are non-operating", null);

      const result = await computeAnalysisForRun(runId);
      expect(result.diagnostics.enterpriseValue.suppressed).toBe(false);
      if (!result.diagnostics.enterpriseValue.suppressed) {
        // The analyst's own "none" selection means zero non-operating value —
        // a different bridge than the durable override's LongTermInvestments
        // figure would have produced, proving the per-run choice was actually
        // used rather than silently overridden by the durable one.
        expect(result.diagnostics.enterpriseValue.value.nonOperatingEquityInvestmentsAtBook.toString()).toBe("0");
      }
    });

    it("a ticker with no durable override and no per-run judgment stays INCOMPLETE, exactly as before", async () => {
      const runId = await createRun("OKLO", "Oklo Inc.");
      for (const factId of await queuedIdsForRun(runId)) {
        await recordFactDecision(runId, factId, "CONFIRMED", null);
      }

      const result = await computeAnalysisForRun(runId);
      // OKLO has no tagged non-operating-investment candidates at all (no
      // override exists or could apply), so this assertion is about the
      // absence of a durable override never fabricating a value — not about
      // OKLO's own, separately-caused leverage/EV suppression.
      expect(result.diagnostics.enterpriseValue.suppressed).toBe(true);
    });
  });
});
