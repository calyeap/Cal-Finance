import { notFound } from "next/navigation";
import { AnalyzerShell } from "@/app/components/AnalyzerShell";
import { AnalyzerReport } from "@/app/components/AnalyzerReport";
import { reopenDeepSnapshot } from "@/lib/analyzer/snapshotAnalysis";
import { trustStatusLine, trustConsequenceLine } from "@/lib/analyzer/trustCopy";

// CF-V2-PROOF-01's "reopen" half. This route reads ONE stored row
// (snapshotStore.getSnapshot) and renders it with the same AnalyzerReport
// component the live report uses — it never calls computeAnalysisForRun or
// analysisForReport, so what's on screen here is exactly what was saved,
// not a fresh derivation that happens to agree with it.

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

  return (
    <AnalyzerShell>
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
        </div>
      </div>

      <AnalyzerReport result={snapshot.result} aiLayer={snapshot.aiLayer} />
    </AnalyzerShell>
  );
}
