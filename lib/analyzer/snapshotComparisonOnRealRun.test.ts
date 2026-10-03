import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision } from "./runStore";
import { loadGateState } from "./gate";
import { createDeepSnapshot, reopenDeepSnapshot, type DeepSnapshotReport } from "./snapshotAnalysis";
import { compareSnapshots, diffStoredSnapshots } from "./snapshotComparison";
import type { StoredSnapshot } from "./snapshotStore";

// ---------------------------------------------------------------------------
// CF-LOOP-UPDATE-01 — the real MSFT and OKLO proof, driven through the same
// gated path and the same acquired SEC captures
// nonOperatingJudgmentRecordedOnRealRun.test.ts and snapshotAnalysis.test.ts
// already use. No new capture, no new ticker, no network (HARD BOUNDS).
//
// MSFT is the genuine-change case. Before CF-ANALYZER-V1-SETTLE-01, version
// 1 was taken pre-Calvin's-§4.4-ruling (CF-S44-RECORD-01, issue #188) —
// enterprise value INCOMPLETE, leverage unsupported, trust UNUSABLE, range
// suppressed — with version 2 after recording it. Migration 007's durable
// company-level override (Calvin ruling 2 on issue #392) now applies that
// exact same ruling automatically to every fresh MSFT run, so that
// before/after pair no longer exists to demonstrate — the gap it used to
// show is the one this outcome closes. The genuine change demonstrated
// below instead is profile confirmation: version 1 (automatic profile
// resolution, no human confirmation) reads INCOMPLETE for PROFILE NOT
// CONFIRMED; version 2 (the same run, profile then confirmed) reads
// INCOMPLETE for the different, unaffected M8 comparator gap. Leverage,
// trust status and the range itself are unchanged across both versions,
// proving the durable §4.4 override applies consistently regardless of the
// profile-confirmation change this test actually exercises. OKLO is the
// no-material-change case: it has zero tagged non-operating-investment
// candidates (§1 of that doc), so no judgment can ever be recorded — durable
// or per-run — for it, and version 2 is an ordinary refresh of the same
// inputs, so the comparison between the two must say nothing moved.
// ---------------------------------------------------------------------------

async function completeSpotCheck(runId: string): Promise<void> {
  const state = await loadGateState(runId);
  for (const factId of state.outstandingFactIds) {
    await recordFactDecision(runId, factId, "CONFIRMED", null);
  }
}

function asStoredSnapshot(runId: string, version: number, report: DeepSnapshotReport): StoredSnapshot {
  return { runId, version, result: report.result, aiLayer: report.aiLayer, verdict: report.verdict, createdAt: "" };
}

/** True when this module's own comparison reads no change between two reports. */
function compareSnapshotFields(a: DeepSnapshotReport, b: DeepSnapshotReport): boolean {
  const comparison = diffStoredSnapshots(asStoredSnapshot("r", 1, a), asStoredSnapshot("r", 2, b));
  return comparison.changed.length === 0;
}

async function openAndConfirmProfile(ticker: "MSFT" | "OKLO", companyName: string): Promise<string> {
  const runId = await createRun(ticker, companyName);
  await completeSpotCheck(runId);
  const state = await loadGateState(runId);
  await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
  return runId;
}

describe("CF-LOOP-UPDATE-01 — the comparison on real MSFT and OKLO runs", () => {
  beforeEach(async () => {
    await getPool().query(
      "TRUNCATE analyzer_run_snapshots, analyzer_run_ai_outputs, analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE"
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("real MSFT — version 1 survives version 2 unchanged, and the comparison reports exactly profile confirmation's real effect, with the durable §4.4 override applying identically both sides", async () => {
    const runId = await createRun("MSFT", "Microsoft Corporation");
    await completeSpotCheck(runId);

    // Version 1: no per-run §4.4 judgment recorded, and no human profile
    // confirmation — CF-ANALYZER-V1-SETTLE-01's durable MSFT override
    // (migration 007, carrying forward Calvin's CALVIN DECISION, issue
    // #188) already resolves leverage/EV/range identically to an explicit
    // recordJudgment call (automaticAnalysisOnRealRun.test.ts's "MSFT's
    // recorded §4.4 state"); PROFILE NOT CONFIRMED is this version's own
    // honest INCOMPLETE cause.
    const v1 = await createDeepSnapshot(runId, null);
    expect(v1.version).toBe(1);
    expect(v1.result.gates.leverage.result).toBe("PASS");
    expect(v1.result.trust.status).toBe("PARTIAL");
    expect(v1.result.fairValueRange.kind).toBe("range");
    expect(v1.verdict.reason).toContain("PROFILE NOT CONFIRMED");

    // Confirm the profile, then refresh: version 2. Nothing about the §4.4
    // judgment changes here — the durable override is untouched by a
    // profile decision, and no recordJudgment call happens in this test.
    const state = await loadGateState(runId);
    await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
    const v2 = await createDeepSnapshot(runId, null);
    expect(v2.version).toBe(2);
    expect(v2.result.gates.leverage.result).toBe("PASS");
    expect(v2.result.trust.status).toBe("PARTIAL");
    expect(v2.result.fairValueRange.kind).toBe("range");
    expect(v2.verdict.reason).not.toContain("PROFILE NOT CONFIRMED");

    // Version 1 is byte-for-byte reopenable exactly as it was, after version
    // 2 exists and after the run's own decisions changed underneath it —
    // the immutability property this outcome stands on (CF-V2-PROOF-01).
    const reopenedV1 = await reopenDeepSnapshot(runId, 1);
    expect(reopenedV1).not.toBeNull();
    expect(reopenedV1!.result.gates.leverage.result).toBe("PASS");
    expect(reopenedV1!.result.trust.status).toBe("PARTIAL");
    expect(reopenedV1!.result.fairValueRange.kind).toBe("range");
    expect(reopenedV1!.verdict).toEqual(v1.verdict);
    // Every field this outcome's comparison reads is unchanged on reopen —
    // the immutability property CF-V2-PROOF-01 already proved, restated
    // here in exactly the terms this outcome's comparison cares about
    // rather than a whole-object equality that would also pin unrelated
    // diagnostics this outcome does not touch.
    expect(compareSnapshotFields(v1, reopenedV1!)).toBe(true);

    // The comparison itself: read only the two stored rows.
    const comparison = await compareSnapshots(runId, 1, 2);
    expect(comparison).not.toBeNull();
    expect(comparison!.runId).toBe(runId);
    expect(comparison!.from).toBe(1);
    expect(comparison!.to).toBe(2);

    const byField = new Map(comparison!.changed.map((c) => [c.field, c]));

    // What moved — profile confirmation's real, honest effect: a different
    // INCOMPLETE cause, nothing more.
    expect(byField.has("verdict.reason")).toBe(true);
    expect((byField.get("verdict.reason")!.from as string)).not.toEqual(byField.get("verdict.reason")!.to as string);
    expect(byField.has("trust.determinedBy")).toBe(true);

    // What did not move — the verdict stays honestly INCOMPLETE both sides
    // (Calvin's 22 Sep 02:24:07Z ruling; deriveVerdict is untouched by this
    // outcome), the price never changed between these two versions of the
    // same run, and — the point of this rewritten case — the durable §4.4
    // override's own effect (leverage, trust status, the range itself)
    // holds identically across both versions, proving it is not reset or
    // perturbed by an unrelated profile-confirmation change.
    expect(v1.verdict.status).toBe("INCOMPLETE");
    expect(v2.verdict.status).toBe("INCOMPLETE");
    expect(comparison!.unchanged).toContain("verdict.status");
    expect(comparison!.unchanged).toContain("price.value");
    expect(comparison!.unchanged).toContain("gates.leverage");
    expect(comparison!.unchanged).toContain("trust.status");
    expect(comparison!.unchanged).toContain("fairValueRange");

    // Comparing the same two versions again gives back the identical
    // result — the determinism DONE WHEN requires.
    const comparisonAgain = await compareSnapshots(runId, 1, 2);
    expect(comparisonAgain).toEqual(comparison);
  });

  it("real OKLO — a refresh with no recorded change is a genuine no-material-change case, and version 1 still reopens unchanged", async () => {
    const runId = await openAndConfirmProfile("OKLO", "Oklo Inc.");

    // OKLO has zero tagged non-operating-investment candidates (§1 of
    // docs/m9-real-company-validation-findings.md) — no §4.4 judgment is
    // ever possible for it, ruled or otherwise. A refresh with nothing
    // recorded in between is the honest "nothing changed" case.
    const v1 = await createDeepSnapshot(runId, null);
    expect(v1.version).toBe(1);
    expect(v1.result.trust.status).toBe("UNUSABLE");
    expect(v1.result.fairValueRange.kind).not.toBe("range");
    expect(v1.verdict.status).toBe("INCOMPLETE");

    const v2 = await createDeepSnapshot(runId, null);
    expect(v2.version).toBe(2);

    const reopenedV1 = await reopenDeepSnapshot(runId, 1);
    expect(reopenedV1).not.toBeNull();
    expect(reopenedV1!.verdict).toEqual(v1.verdict);
    expect(compareSnapshotFields(v1, reopenedV1!)).toBe(true);

    const comparison = await compareSnapshots(runId, 1, 2);
    expect(comparison).not.toBeNull();

    // OKLO's honest upstream INCOMPLETE survives untouched on both sides —
    // if the proof appeared to change OKLO's state, that would be a defect
    // in the proof, not a result (SCOPE item 5).
    expect(v1.result.fairValueRange.kind).toBe(v2.result.fairValueRange.kind);
    expect(v1.result.trust.status).toBe(v2.result.trust.status);
    expect(v2.verdict.status).toBe("INCOMPLETE");

    // Nothing moved: every field is reported unchanged, none changed.
    expect(comparison!.changed).toEqual([]);
    expect(comparison!.unchanged.length).toBeGreaterThan(0);
    expect(comparison!.unchanged).toContain("verdict.status");
    expect(comparison!.unchanged).toContain("verdict.reason");
    expect(comparison!.unchanged).toContain("fairValueRange");
    expect(comparison!.unchanged).toContain("trust.status");

    const comparisonAgain = await compareSnapshots(runId, 1, 2);
    expect(comparisonAgain).toEqual(comparison);
  });

  it("returns null when either named version does not exist for the run, rather than falling back to another one", async () => {
    const runId = await openAndConfirmProfile("MSFT", "Microsoft Corporation");
    await createDeepSnapshot(runId, null);

    expect(await compareSnapshots(runId, 1, 99)).toBeNull();
    expect(await compareSnapshots(runId, 99, 1)).toBeNull();
  });
});
