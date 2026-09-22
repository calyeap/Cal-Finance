import { notFound } from "next/navigation";
import { AnalyzerShell } from "@/app/components/AnalyzerShell";
import { AnalyzerTopBar } from "@/app/components/AnalyzerTopBar";
import { AnalyzerOverview } from "@/app/components/AnalyzerOverview";
import { SourcesAndDetails } from "@/app/components/SourcesAndDetails";
import { RunNotFoundError, SpotCheckIncompleteError } from "@/lib/analyzer/gate";
import { advanceRunAutomatically } from "@/lib/analyzer/autoRun";
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
//
// CF-ANALYZER-AUTORUN-01 — this route used to redirect to Screen 3 while the
// profile was undecided, and to Screen 2 on SpotCheckIncompleteError. Calvin
// ruled on 22 September 2026 04:28:04Z that no human interaction is required
// after ticker entry in the normal flow, so both redirects are gone: the run
// is advanced automatically here (idempotent, and a no-op for a run the
// action already advanced), and where it still cannot be completed the
// analyst gets an INCOMPLETE report saying why — never a queue.

export default async function OverviewPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;

  let state;
  try {
    state = await advanceRunAutomatically(runId);
  } catch (err) {
    if (err instanceof RunNotFoundError) notFound();
    throw err;
  }

  let report;
  try {
    report = await analysisForReport(runId);
  } catch (err) {
    if (err instanceof SpotCheckIncompleteError) {
      // Unreachable in the normal path: the automatic pass above decides every
      // queued fact. Kept because the gate is the gate — if it ever refuses
      // here, the honest answer is to say so at the run, not to send the
      // analyst to an operator screen.
      return (
        <AnalyzerShell>
          <AnalyzerTopBar variant="overview" />
          <IncompleteRun runId={runId} outstandingFactIds={err.outstandingFactIds} />
        </AnalyzerShell>
      );
    }
    if (err instanceof RunNotFoundError) notFound();
    throw err;
  }

  const profileNotConfirmed = !state.run.profileHumanConfirmed;
  const verdict = deriveVerdict(report.result);

  return (
    <AnalyzerShell>
      <AnalyzerTopBar variant="overview" />
      <AnalyzerOverview
        result={report.result}
        verdict={verdict}
        profileNotConfirmed={profileNotConfirmed}
        fullAnalysisHref={`/analyzer/${runId}/report`}
        aiLayer={report.aiLayer}
      />
      <SourcesAndDetails runId={runId} />
    </AnalyzerShell>
  );
}

/**
 * The honest end of a run the software could not complete.
 *
 * Calvin, 22 September 2026 04:28:04Z: "If the system cannot reliably complete
 * an analysis, return a clear INCOMPLETE report explaining the reason rather
 * than forcing me through an operator workflow." So this names the state and
 * what is outstanding, and links to the detail routes rather than redirecting
 * into them. It reuses the existing state markup; it is not a new screen.
 */
function IncompleteRun({
  runId,
  outstandingFactIds,
}: {
  runId: string;
  outstandingFactIds: string[];
}) {
  return (
    <>
      <div className="cb-steps">
        <div className="wrap">
          <div className="state">
            <span className="name">INCOMPLETE</span>
            <span className="cause">
              Automatic verification did not reach a decision on{" "}
              {outstandingFactIds.length} acquired{" "}
              {outstandingFactIds.length === 1 ? "figure" : "figures"} —{" "}
              {outstandingFactIds.join(", ")}. No calculation runs on an undecided figure (§2), so
              this run has no report. Nothing here is estimated or filled in.
            </span>
          </div>
        </div>
      </div>
      <SourcesAndDetails runId={runId} />
    </>
  );
}
