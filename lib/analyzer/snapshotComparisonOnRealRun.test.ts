import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordJudgment, recordProfileDecision } from "./runStore";
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
// MSFT is the genuine-change case: version 1 is taken before Calvin's §4.4
// ruling is recorded (CF-S44-RECORD-01, issue #188) — enterprise value
// INCOMPLETE, leverage unsupported, trust UNUSABLE, range suppressed —
// version 2 after recording it, matching
// docs/m9-real-company-validation-findings.md §2's before/after figures
// exactly. OKLO is the no-material-change case: it has zero tagged
// non-operating-investment candidates (§1 of that doc), so no judgment can
// ever be recorded for it — version 2 is an ordinary refresh of the same
// inputs, and the comparison between the two must say nothing moved.
// ---------------------------------------------------------------------------

const MSFT_RULED_TAG = "us-gaap:LongTermInvestments";
const MSFT_JUDGMENT_REASON = "Calvin's §4.4 ruling, 2026-09-21T08:19:14Z, issue #188.";

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

  it("real MSFT — version 1 (pre-ruling) survives version 2 (post-ruling) unchanged, and the comparison reports exactly the §4.4 ruling's real effect", async () => {
    const runId = await openAndConfirmProfile("MSFT", "Microsoft Corporation");

    // Version 1: no §4.4 judgment recorded yet — enterprise value INCOMPLETE,
    // leverage unsupported, trust UNUSABLE, range suppressed (§1/§2 of
    // docs/m9-real-company-validation-findings.md, pre-ruling state).
    const v1 = await createDeepSnapshot(runId, null);
    expect(v1.version).toBe(1);
    expect(v1.result.gates.leverage.result).toBe("LEVERAGE UNSUPPORTED IN v1");
    expect(v1.result.trust.status).toBe("UNUSABLE");
    expect(v1.result.fairValueRange.kind).toBe("suppressed");

    // Record Calvin's ruling, then refresh: version 2.
    await recordJudgment(runId, "NON-OPERATING INVESTMENTS", MSFT_RULED_TAG, MSFT_JUDGMENT_REASON);
    const v2 = await createDeepSnapshot(runId, null);
    expect(v2.version).toBe(2);
    expect(v2.result.gates.leverage.result).toBe("PASS");
    expect(v2.result.trust.status).toBe("PARTIAL");
    expect(v2.result.fairValueRange.kind).toBe("range");

    // Version 1 is byte-for-byte reopenable exactly as it was, after version
    // 2 exists and after the run's own decisions changed underneath it —
    // the immutability property this outcome stands on (CF-V2-PROOF-01).
    const reopenedV1 = await reopenDeepSnapshot(runId, 1);
    expect(reopenedV1).not.toBeNull();
    expect(reopenedV1!.result.gates.leverage.result).toBe("LEVERAGE UNSUPPORTED IN v1");
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

    const byField = new Map(comparison!.changed.map((c) => [c.field, c]));

    // What moved — the ruling's real, documented effect.
    expect((byField.get("fairValueRange")!.from as { kind: string }).kind).toBe("suppressed");
    expect((byField.get("fairValueRange")!.to as { kind: string }).kind).toBe("range");
    expect((byField.get("gates.leverage")!.from as { result: string }).result).toBe("LEVERAGE UNSUPPORTED IN v1");
    expect((byField.get("gates.leverage")!.to as { result: string }).result).toBe("PASS");
    expect(byField.get("trust.status")).toEqual({ field: "trust.status", to: "PARTIAL", from: "UNUSABLE" });
    expect(byField.has("verdict.reason")).toBe(true);
    expect((byField.get("verdict.reason")!.from as string)).not.toEqual(byField.get("verdict.reason")!.to as string);

    // What did not move — the verdict stays honestly INCOMPLETE both sides
    // (Calvin's 22 Sep 02:24:07Z ruling; deriveVerdict is untouched by this
    // outcome), and the price itself never changed between these two
    // versions of the same run.
    expect(v1.verdict.status).toBe("INCOMPLETE");
    expect(v2.verdict.status).toBe("INCOMPLETE");
    expect(comparison!.unchanged).toContain("verdict.status");
    expect(comparison!.unchanged).toContain("price.value");

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
