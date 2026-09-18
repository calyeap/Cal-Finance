import { notFound, redirect } from "next/navigation";
import { AnalyzerShell } from "@/app/components/AnalyzerShell";
import { AnalyzerOverview } from "@/app/components/AnalyzerOverview";
import { loadGateState, RunNotFoundError, SpotCheckIncompleteError } from "@/lib/analyzer/gate";
import { analysisForReport } from "@/lib/analyzer/reportAnalysis";
import { deriveVerdict } from "@/lib/analyzer/verdict";

// M9-DESKTOP-SHELL-01 — the Overview route, per docs/design/m9-analyzer-
// design-contract.md §2.1: "a new top-level destination, not a subsection
// of Full Analysis." Loads the same gated computation the Full Analysis
// route (report/page.tsx) reads, for the same reason — every number either
// page shows is settled by the same refusal-before-calculation path
// (lib/analyzer/gate.ts, §2), and this route reads it independently rather
// than through report/page.tsx so Overview stands on its own as a
// destination, per the contract, not as a wrapper around Full Analysis.

export default async function OverviewPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;

  let state;
  try {
    state = await loadGateState(runId);
  } catch (err) {
    if (err instanceof RunNotFoundError) notFound();
    throw err;
  }

  if (state.run.profileDecision === null) {
    redirect(`/analyzer/${runId}/profile`);
  }

  let report;
  try {
    report = await analysisForReport(runId);
  } catch (err) {
    if (err instanceof SpotCheckIncompleteError) {
      redirect(`/analyzer/${runId}/facts`);
    }
    if (err instanceof RunNotFoundError) notFound();
    throw err;
  }

  const profileNotConfirmed = !state.run.profileHumanConfirmed;
  const verdict = deriveVerdict(report.result);

  return (
    <AnalyzerShell>
      <AnalyzerOverview
        result={report.result}
        verdict={verdict}
        profileNotConfirmed={profileNotConfirmed}
        fullAnalysisHref={`/analyzer/${runId}/report`}
      />
    </AnalyzerShell>
  );
}
