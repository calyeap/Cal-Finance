import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision } from "./runStore";
import { loadGateState } from "./gate";
import { createDeepSnapshot, reopenDeepSnapshot, type DeepSnapshotReport } from "./snapshotAnalysis";
import { compareSnapshots, diffStoredSnapshots } from "./snapshotComparison";
import type { StoredSnapshot } from "./snapshotStore";

// Self-seeding against execution-order fragility (CF-ANALYZER-STAGE3-
// VERDICT-FINISH-01): lib/analyzer/acquisition/msftStage2ValuationProof.test.ts
// and msftRealValuationUnblock.test.ts both delete MSFT's durably recorded
// bundle around their own tests and restore nothing
// (msftStage2DurableBundleSeed.test.ts's own header documents exactly this),
// so this file — whose MSFT case depends on that durable row — re-applies
// migration 010's own SQL directly rather than assuming some other file's
// cleanup already ran first in whatever order this serial suite discovers
// files.
const MIGRATION_010_SQL = readFileSync(
  join(process.cwd(), "migrations", "010_msft_recorded_bundle_seed.sql"),
  "utf-8"
);

// ---------------------------------------------------------------------------
// CF-LOOP-UPDATE-01 — the real MSFT and OKLO proof, driven through the same
// gated path and the same acquired SEC captures
// nonOperatingJudgmentRecordedOnRealRun.test.ts and snapshotAnalysis.test.ts
// already use. No new capture, no new ticker, no network (HARD BOUNDS).
//
// MSFT was originally this file's genuine-change case (profile confirmation
// moved verdict.reason between version 1 and 2 — see git history for that
// shape). CF-ANALYZER-INTEGRITY-PHASE-A-01 (A4) now suppresses MSFT's
// fair-value range unconditionally, for an unrelated reason that §9.6 rule
// 1 and verdict.ts's own UNUSABLE-first check both read before the profile-
// confirmation branch is ever reached — so that before/after pair no longer
// exists to demonstrate either, on the SAME real MSFT run this file already
// used. MSFT's own test below now demonstrates the honest consequence
// instead: nothing tracked moves between its two versions, same as OKLO's
// case, while still proving immutability (version 1 survives version 2) and
// the comparison's own correctness. OKLO is the pre-existing no-material-
// change case: it has zero tagged non-operating-investment candidates (§1
// of that doc), so no judgment can ever be recorded — durable or per-run —
// for it, and version 2 is an ordinary refresh of the same inputs, so the
// comparison between the two must say nothing moved.
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
    await getPool().query(MIGRATION_010_SQL);
  });

  afterAll(async () => {
    // Leave the table as migration 010 itself wants it to end up, for any
    // later file in this same run that exercises a real MSFT run.
    await getPool().query(MIGRATION_010_SQL);
    await getPool().end();
  });

  // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — reviewed evaluator change. With
  // migration 010's Stage-2 sheet superseded by D2 (product-decisions item
  // 27) and carrying no D2 input, MSFT's range is suppressed as pending
  // adoption — which, like A4 before it, is read before the profile-
  // confirmation branch (trust's §9.6 first match; verdict.ts's UNUSABLE-
  // first check). So profile confirmation's own effect is masked again, and
  // the comparison honestly reports no material change between versions.
  // What this test stands on is unchanged: version 1 reopens byte-for-byte
  // after version 2 exists, and the comparison is deterministic.
  it("real MSFT — version 1 reopens byte-for-byte after version 2 exists; with the sheet pending adoption, profile confirmation changes nothing material", async () => {
    const runId = await createRun("MSFT", "Microsoft Corporation");
    await completeSpotCheck(runId);

    // Version 1: no per-run §4.4 judgment recorded, and no human profile
    // confirmation — CF-ANALYZER-V1-SETTLE-01's durable MSFT override
    // (migration 007, carrying forward Calvin's CALVIN DECISION, issue
    // #188) already resolves leverage/EV identically to an explicit
    // recordJudgment call (automaticAnalysisOnRealRun.test.ts's "MSFT's
    // recorded §4.4 state"). PROFILE NOT CONFIRMED is this version's own
    // honest INCOMPLETE cause.
    //
    // CF-MSFT-STAGE2-DURABLE-SEED-01 (issue #442, migration 010) durably
    // recorded Calvin's approved MSFT Stage-2 bundle — a real,
    // driver-authored analyst bundle, never fixture-carried — so A4
    // (CF-ANALYZER-INTEGRITY-PHASE-A-01) no longer suppresses MSFT's range
    // unconditionally. Profile confirmation's effect, previously masked
    // behind that suppression (trust's §9.6 "FIRST MATCH WINS" and
    // verdict.ts's own UNUSABLE-first check both read the suppression
    // before reaching the profile-confirmation branch), is observable
    // again: this is the before/after pair the file header above describes
    // this test as "originally" demonstrating.
    const v1 = await createDeepSnapshot(runId, null);
    expect(v1.version).toBe(1);
    expect(v1.result.gates.leverage.result).toBe("PASS");
    expect(v1.result.trust.status).toBe("UNUSABLE");
    expect(v1.result.fairValueRange.kind).toBe("suppressed");
    expect(v1.verdict.status).toBe("INCOMPLETE");

    // Confirm the profile, then refresh: version 2. Nothing about the §4.4
    // judgment changes here — the durable override is untouched by a
    // profile decision, and no recordJudgment call happens in this test.
    const state = await loadGateState(runId);
    await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
    const v2 = await createDeepSnapshot(runId, null);
    expect(v2.version).toBe(2);
    expect(v2.result.gates.leverage.result).toBe("PASS");
    expect(v2.result.trust.status).toBe("UNUSABLE");
    expect(v2.result.fairValueRange.kind).toBe("suppressed");
    expect(v2.verdict.status).toBe("INCOMPLETE");
    expect(v2.verdict.reason).toMatch(/Pending adoption/);

    // Version 1 is byte-for-byte reopenable exactly as it was, after version
    // 2 exists and after the run's own decisions changed underneath it —
    // the immutability property this outcome stands on (CF-V2-PROOF-01).
    const reopenedV1 = await reopenDeepSnapshot(runId, 1);
    expect(reopenedV1).not.toBeNull();
    expect(reopenedV1!.result.gates.leverage.result).toBe("PASS");
    expect(reopenedV1!.result.trust.status).toBe("UNUSABLE");
    expect(reopenedV1!.result.fairValueRange.kind).toBe("suppressed");
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

    // Masked by the pending-adoption suppression (see above): nothing the
    // comparison reads changes between the two versions.
    expect(comparison!.changed).toEqual([]);
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
