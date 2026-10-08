import { notFound } from "next/navigation";
import { AnalyzerShell } from "@/app/components/AnalyzerShell";
import { AnalyzerTopBar } from "@/app/components/AnalyzerTopBar";
import {
  AnalyzerReportFrame,
  TrustAndProfileNote,
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
  HeaderAndStatesSection,
} from "@/app/components/AnalyzerReport";
import { QuickRead } from "@/app/components/QuickRead";
import { SourcesAndDetails } from "@/app/components/SourcesAndDetails";
import { RunNotFoundError, SpotCheckIncompleteError, computeAnalysisForRun } from "@/lib/analyzer/gate";
import { advanceRunAutomatically } from "@/lib/analyzer/autoRun";
import { analysisForReport, type AiLayerReport } from "@/lib/analyzer/reportAnalysis";
import { deriveVerdict } from "@/lib/analyzer/verdict";
import { profileNotConfirmedFor } from "@/lib/analyzer/trust";
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

function TabBody({
  tab,
  result,
  aiLayer,
  profileNotConfirmed,
}: {
  tab: AnalyzerTabSlug;
  result: AnalysisResult;
  aiLayer?: AiLayerReport;
  profileNotConfirmed: boolean;
}) {
  switch (tab) {
    case "overview":
      return <AnalyzerOverview result={result} aiLayer={aiLayer} />;
    case "business":
      return <BusinessSection result={result} />;
    case "financials":
      // `plain` — CF-ANALYZER-USABLE-REPORT-REPAIR-01: Financials/Valuation
      // are ordinary reading surfaces, not Evidence, so a suppressed figure
      // shows the same plain-English reason Overview already shows rather
      // than its raw internal state code. Evidence (HeaderAndStatesSection,
      // EvidenceSections, AnalyzerReport's own snapshot rendering) leaves
      // `plain` unset and keeps the raw code — diagnostics stay available
      // where deliberately opened.
      return <FinancialsSections result={result} plain />;
    case "valuation":
      return <ValuationSections result={result} plain />;
    case "risks":
      return <RisksThesisSections result={result} aiLayer={aiLayer} />;
    case "market":
      return <MarketContextSection result={result} />;
    case "evidence":
      // Section A and Quick Read have no other route in the unified shell
      // (AnalyzerReport, the only other renderer of either, now backs only
      // the snapshot page) — rendered here so EvidenceSections' own "See
      // Section A for what and why" cross-reference points at content that
      // actually exists on this tab. Trust/profile plumbing (CF-ANALYZER-
      // V1-SETTLE-01) lives here too, not repeated on the other six tabs.
      return (
        <>
          <QuickRead result={result} />
          <TrustAndProfileNote result={result} profileNotConfirmed={profileNotConfirmed} />
          <HeaderAndStatesSection result={result} />
          <EvidenceSections result={result} />
        </>
      );
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

  // CF-ANALYZER-USABLE-REPORT-REPAIR-01 — only overview, risks and evidence
  // actually read aiLayer or the AI-merged result.interpretation/
  // result.challenger (TabBody's switch below, and QuickRead on the evidence
  // tab); business, financials, valuation and market never do. Routing every
  // tab through analysisForReport unconditionally meant visiting any one of
  // those four could still wait on the interpretation/challenger call (or on
  // the in-flight generation another tab started) for content it was never
  // going to show. Calling computeAnalysisForRun directly for those four
  // tabs is the same deterministic result with no AI dependency at all.
  const needsAiLayer = activeTab === "overview" || activeTab === "risks" || activeTab === "evidence";

  let result: AnalysisResult;
  let aiLayer: AiLayerReport | undefined;
  try {
    if (needsAiLayer) {
      // `state` is passed through so this does not call loadGateState a
      // second time for work advanceRunAutomatically already did this same
      // request (lib/analyzer/gate.ts's computeAnalysisForRun doc comment).
      const report = await analysisForReport(runId, undefined, state);
      result = report.result;
      aiLayer = report.aiLayer;
    } else {
      result = await computeAnalysisForRun(runId, state);
    }
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

  // CF-ANALYZER-V1-SETTLE-01 — read the same fact trust.ts already computed
  // (§9.6's PROFILE NOT CONFIRMED qualifier) rather than re-deriving it from
  // the raw DB field: trust.ts also treats an unambiguous automatic
  // resolution (Gate 0 PASS, no human decision) as confirmed-enough for V1,
  // and a second, independent derivation here would be free to disagree —
  // exactly the failure mode trust.ts's own header comment warns against.
  const profileNotConfirmed = profileNotConfirmedFor(result);
  const verdict = deriveVerdict(result);

  return (
    <AnalyzerShell>
      <AnalyzerTopBar variant="overview" />
      <AnalyzerReportFrame
        runId={runId}
        result={result}
        verdict={verdict}
        profileNotConfirmed={profileNotConfirmed}
        activeTab={activeTab}
      >
        <TabBody tab={activeTab} result={result} aiLayer={aiLayer} profileNotConfirmed={profileNotConfirmed} />
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
