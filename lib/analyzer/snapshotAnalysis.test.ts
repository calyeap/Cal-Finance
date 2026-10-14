import { describe, it, expect, beforeEach, afterAll } from "vitest";
import Decimal from "decimal.js";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision, recordJudgment } from "./runStore";
import { loadGateState } from "./gate";
import { createDeepSnapshot, reopenDeepSnapshot } from "./snapshotAnalysis";

// ---------------------------------------------------------------------------
// CF-V2-PROOF-01, exercised through the real database and the same gated
// entry point the report page uses — not the fixture directly, for the same
// reason trustOnRealRun.test.ts crosses this seam: the defect class this
// outcome exists to rule out is a value produced one way and reopened
// another.
// ---------------------------------------------------------------------------

async function completeSpotCheck(runId: string): Promise<void> {
  const state = await loadGateState(runId);
  for (const factId of state.outstandingFactIds) {
    await recordFactDecision(runId, factId, "CONFIRMED", null);
  }
}

/**
 * One complete DEEP MSFT run: §4.4's non-operating-investments judgment
 * answered (so the leverage precondition computes and the range renders,
 * per leverageOnRealRun.test.ts), every queued fact confirmed, and the
 * profile confirmed. This is the one bounded proof case CF-V2-PROOF-01
 * asks for — a run whose fair-value range is usable on its own terms,
 * independent of the verdict boundary's own INCOMPLETE result (see
 * verdict.test.ts: the verdict stays INCOMPLETE today regardless, because
 * its required second input — the §10.6.2 comparator — is not yet acquired,
 * per Calvin's 18 Sep 2026 ruling on PR #140).
 */
async function completeMsftRun(): Promise<string> {
  const runId = await createRun("MSFT", "Microsoft Corporation");
  await recordJudgment(runId, "NON-OPERATING INVESTMENTS", "None of these are non-operating", null);
  await completeSpotCheck(runId);
  await recordProfileDecision(runId, "CONFIRMED", "MATURE_PROFITABLE", null);
  return runId;
}

describe("CF-V2-PROOF-01 — the DEEP + versioned-snapshot boundary", () => {
  beforeEach(async () => {
    await getPool().query(
      "TRUNCATE analyzer_run_snapshots, analyzer_run_ai_outputs, analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE"
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("produces one complete DEEP analysis, and an honest INCOMPLETE verdict — A4 (CF-ANALYZER-INTEGRITY-PHASE-A-01) now suppresses the range itself rather than letting the M8 comparator gap be the only cause quoted", async () => {
    const runId = await completeMsftRun();

    const snapshot = await createDeepSnapshot(runId, null);

    expect(snapshot.version).toBe(1);
    // A4 — MSFT's fair-value range is honestly suppressed (its scenario
    // dollar values are the validation fixture's, never a real computation
    // for this real run), so §9.6 rule 1 reads UNUSABLE here; this was
    // "not UNUSABLE" before A4 existed.
    expect(snapshot.result.trust.status).toBe("UNUSABLE");
    expect(snapshot.result.fairValueRange.kind).toBe("suppressed");
    // The verdict boundary still does not manufacture BUY/HOLD/SELL from
    // a single diagnostic (verdict.test.ts) — now reading A4's own cause.
    expect(snapshot.verdict.status).toBe("INCOMPLETE");
    expect(snapshot.verdict.reason).toContain("scenario dollar values");
  });

  it("reopens the exact stored snapshot without recomputing — it survives the run's own decisions being deleted", async () => {
    const runId = await completeMsftRun();
    const saved = await createDeepSnapshot(runId, null);

    // If reopening recomputed, this would now fail the §2 gate: the
    // decisions computeAnalysisForRun requires no longer exist.
    await getPool().query("DELETE FROM analyzer_run_fact_decisions WHERE run_id = $1", [runId]);
    await getPool().query("DELETE FROM analyzer_run_judgments WHERE run_id = $1", [runId]);

    const reopened = await reopenDeepSnapshot(runId, saved.version);

    expect(reopened).not.toBeNull();
    expect(reopened!.verdict).toEqual(saved.verdict);
    expect(reopened!.result.trust).toEqual(saved.result.trust);
  });

  it("round-trips Decimal figures as Decimal instances, not strings", async () => {
    const runId = await completeMsftRun();
    const saved = await createDeepSnapshot(runId, null);

    const reopened = await reopenDeepSnapshot(runId, saved.version);
    // A4 (CF-ANALYZER-INTEGRITY-PHASE-A-01) honestly suppresses this real
    // MSFT run's fair-value range (its scenario dollar values are the
    // validation fixture's, never a real computation for this run), so it
    // no longer carries a bear/bull Decimal to round-trip — `result.price.
    // value` (this run's own real recorded-capture close) is this test's
    // same claim on a Decimal field the suppressed shape still carries.
    expect(reopened!.result.fairValueRange.kind).toBe("suppressed");
    const price = reopened!.result.price.value;
    expect(price).toBeInstanceOf(Decimal);
    expect(price.toString()).toBe(saved.result.price.value.toString());
    // A Decimal survives arithmetic, not just a string that looks like one.
    expect(price.plus(1).minus(1).toString()).toBe(price.toString());
  });

  it("preserves the underlying facts and provenance graph exactly", async () => {
    const runId = await completeMsftRun();
    const saved = await createDeepSnapshot(runId, null);

    const reopened = await reopenDeepSnapshot(runId, saved.version);

    expect(reopened!.result.facts).toEqual(saved.result.facts);
    expect(reopened!.result.provenance).toEqual(saved.result.provenance);
  });

  it("assigns increasing versions per run and reopens each by its own number", async () => {
    const runId = await completeMsftRun();

    const first = await createDeepSnapshot(runId, null);
    const second = await createDeepSnapshot(runId, null);

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);

    const reopenedFirst = await reopenDeepSnapshot(runId, 1);
    expect(reopenedFirst!.version).toBe(1);
  });

  it("returns an explicit INCOMPLETE verdict, never a manufactured one", async () => {
    // CF-ANALYZER-V1-SETTLE-01 — no §4.4 judgment recorded for this run,
    // but migration 007's durable MSFT override now resolves the leverage
    // precondition the same way an explicit recordJudgment would
    // (automaticAnalysisOnRealRun.test.ts's "MSFT's recorded §4.4 state").
    // A4 (CF-ANALYZER-INTEGRITY-PHASE-A-01) now suppresses the range itself
    // regardless (its scenario dollar values are the validation fixture's,
    // never a real computation for this real run) — trust reads UNUSABLE,
    // not PARTIAL, by §9.6 rule 1. The verdict itself is still honestly
    // INCOMPLETE either way; that boundary is untouched by this outcome.
    const runId = await createRun("MSFT", "Microsoft Corporation");
    await completeSpotCheck(runId);
    await recordProfileDecision(runId, "CONFIRMED", "MATURE_PROFITABLE", null);

    const snapshot = await createDeepSnapshot(runId, null);

    expect(snapshot.result.trust.status).toBe("UNUSABLE");
    expect(snapshot.result.fairValueRange.kind).toBe("suppressed");
    expect(snapshot.verdict.status).toBe("INCOMPLETE");
    expect(snapshot.verdict.reason).not.toBe("");
  });

  it("getSnapshot with no version given returns the run's latest, still addressed only by a runId the caller holds", async () => {
    const runId = await completeMsftRun();
    await createDeepSnapshot(runId, null);
    const second = await createDeepSnapshot(runId, null);

    const latest = await reopenDeepSnapshot(runId);

    expect(latest!.version).toBe(second.version);
  });

  it("reopening an unknown version returns null rather than falling back to another one", async () => {
    const runId = await completeMsftRun();
    await createDeepSnapshot(runId, null);

    expect(await reopenDeepSnapshot(runId, 99)).toBeNull();
  });
});
