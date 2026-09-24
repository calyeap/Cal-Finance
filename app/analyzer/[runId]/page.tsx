import { notFound } from "next/navigation";
import { AnalyzerShell } from "@/app/components/AnalyzerShell";
import { AnalyzerTopBar } from "@/app/components/AnalyzerTopBar";
import {
  AnalyzerReportFrame,
  DEFAULT_ANALYZER_TAB,
  isAnalyzerTabSlug,
  type AnalyzerTabSlug,
} from "@/app/components/AnalyzerReportFrame";
import { AnalyzerOverview } from "@/app/components/AnalyzerOverview";
import {
  BusinessSection,
  FinancialsSections,
  ValuationSections,
  RisksThesisSections,
  MarketContextSection,
  EvidenceSections,
} from "@/app/components/AnalyzerReport";
import { SourcesAndDetails } from "@/app/components/SourcesAndDetails";
import { RunNotFoundError, SpotCheckIncompleteError } from "@/lib/analyzer/gate";
import { advanceRunAutomatically } from "@/lib/analyzer/autoRun";
import { analysisForReport, type AiLayerReport } from "@/lib/analyzer/reportAnalysis";
import { deriveVerdict } from "@/lib/analyzer/verdict";
import type { AnalysisResult } from "@/lib/analyzer/types";

// CF-DESIGN-AUTHORITY-CUTOVER-01 — docs/design/analyzer-v2-design-authority.md
// "One shell, seven tabs": this one route now renders every report tab
// (Overview, and the six themes AnalyzerReport's own sections already
// group), selected by `?tab=`, inside the single AnalyzerReportFrame shell
// — not a route per tab, and not the old separate `/report` route's own
// second shell (design authority doc: "do not duplicate the shell per
// report"). `/analyzer/{runId}/report` now redirects here (report/page.tsx).
//
// CF-ANALYZER-AUTORUN-01 — the automatic-advance and INCOMPLETE-run
// handling below is unchanged from the route this replaces: every number
// any tab shows is settled by the same refusal-before-calculation path
// (lib/analyzer/gate.ts §2) before any tab renders.

function TabBody({ tab, result, aiLayer }: { tab: AnalyzerTabSlug; result: AnalysisResult; aiLayer?: AiLayerReport }) {
  switch (tab) {
    case "overview":
      return <AnalyzerOverview result={result} aiLayer={aiLayer} />;
    case "business":
      return <BusinessSection result={result} />;
    case "financials":
      return <FinancialsSections result={result} />;
    case "valuation":
      return <ValuationSections result={result} />;
    case "risks":
      return <RisksThesisSections result={result} aiLayer={aiLayer} />;
    case "market":
      return <MarketContextSection result={result} />;
    case "evidence":
      return <EvidenceSections result={result} />;
  }
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { runId } = await params;
  const { tab: tabParam } = await searchParams;
  const activeTab = tabParam !== undefined && isAnalyzerTabSlug(tabParam) ? tabParam : DEFAULT_ANALYZER_TAB;

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
      <AnalyzerReportFrame
        runId={runId}
        result={report.result}
        verdict={verdict}
        profileNotConfirmed={profileNotConfirmed}
        activeTab={activeTab}
      >
        <TabBody tab={activeTab} result={report.result} aiLayer={report.aiLayer} />
      </AnalyzerReportFrame>
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
