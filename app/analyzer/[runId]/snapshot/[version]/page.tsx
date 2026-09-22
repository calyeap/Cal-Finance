import { notFound } from "next/navigation";
import { AnalyzerShell } from "@/app/components/AnalyzerShell";
import { AnalyzerTopBar } from "@/app/components/AnalyzerTopBar";
import { AnalyzerReport } from "@/app/components/AnalyzerReport";
import { reopenDeepSnapshot } from "@/lib/analyzer/snapshotAnalysis";
import { compareSnapshots, type SnapshotFieldChange } from "@/lib/analyzer/snapshotComparison";
import { trustStatusLine, trustConsequenceLine } from "@/lib/analyzer/trustCopy";

// CF-V2-PROOF-01's "reopen" half. This route reads ONE stored row
// (snapshotStore.getSnapshot) and renders it with the same AnalyzerReport
// component the live report uses — it never calls computeAnalysisForRun or
// analysisForReport, so what's on screen here is exactly what was saved,
// not a fresh derivation that happens to agree with it.
//
// CF-LOOP-UPDATE-01's "what changed" half. Where a prior version exists,
// this route also reads compareSnapshots(runId, version - 1, version) — the
// same two-stored-rows-only read as the reopen above — and shows what moved
// since it. The natural home for "what changed since version N−1" is the
// version it changed into, so this is the smallest honest surface for it:
// no new route, no judgement about whether a move matters, just what
// diffStoredSnapshots already computed.

function formatComparableValue(value: unknown): string {
  if (value === null) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function WhatChangedSince({ from, changed }: { from: number; changed: SnapshotFieldChange[] }) {
  return (
    <>
      <div className="state" style={{ marginTop: 14 }}>
        <span className="name">What changed since version {from}</span>
        <span className="cause">
          {changed.length === 0
            ? "Nothing moved between these two versions."
            : `${changed.length} field${changed.length === 1 ? "" : "s"} changed.`}
        </span>
      </div>
      {changed.length > 0 && (
        <ul style={{ marginTop: 8 }}>
          {changed.map((c) => (
            <li key={c.field}>
              <strong>{c.field}</strong>: {formatComparableValue(c.from)} → {formatComparableValue(c.to)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default async function SnapshotPage({
  params,
}: {
  params: Promise<{ runId: string; version: string }>;
}) {
  const { runId, version } = await params;

  const versionNumber = Number(version);
  if (!Number.isInteger(versionNumber) || versionNumber <= 0) notFound();

  const snapshot = await reopenDeepSnapshot(runId, versionNumber);
  if (snapshot === null) notFound();

  const trust = snapshot.result.trust;
  const comparison = versionNumber > 1 ? await compareSnapshots(runId, versionNumber - 1, versionNumber) : null;

  return (
    <AnalyzerShell>
      {/* AnalyzerReport below renders its own `.layout` container (no
          `.fa-shell` rail on this reopen route), so the bar tracks the same
          container the Overview route's bar does — see AnalyzerTopBar's
          variant comment. */}
      <AnalyzerTopBar variant="overview" />
      <div className="cb-steps">
        <div className="wrap" style={{ paddingBottom: 0 }}>
          <div className="state">
            <span className="name">Saved version {snapshot.version}</span>
            <span className="cause">
              Reopened from storage — this page has not recomputed the analysis.
            </span>
          </div>

          <div className="state" style={{ marginTop: 14 }}>
            <span className="name">{trustStatusLine(trust.status, false)}</span>
            <span className="cause">{trustConsequenceLine(trust.status)}</span>
          </div>

          <div className="state" style={{ marginTop: 14 }}>
            <span className="name">Verdict — {snapshot.verdict.status}</span>
            <span className="cause">{snapshot.verdict.reason}</span>
          </div>

          {comparison !== null && <WhatChangedSince from={comparison.from} changed={comparison.changed} />}
        </div>
      </div>

      <AnalyzerReport result={snapshot.result} aiLayer={snapshot.aiLayer} />
    </AnalyzerShell>
  );
}
