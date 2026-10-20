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
import {
  QuickReadGrid,
  AssumptionSheetSection,
  SensitivitySection,
  BusinessResearch,
  FinancialStatements,
  ScenarioStories,
  MarketFacts,
  SourceLedger,
} from "@/app/components/ReportContent";
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
import { RunNotFoundError, SpotCheckIncompleteError, type GateState } from "@/lib/analyzer/gate";
import { advanceRunAutomatically } from "@/lib/analyzer/autoRun";
import {
  analysisForReport,
  currentRunOutput,
  deterministicReport,
  reportMarketOptions,
  type AiLayerReport,
} from "@/lib/analyzer/reportAnalysis";
import { deriveVerdict, type VerdictResult } from "@/lib/analyzer/verdict";
import { getSheet } from "@/lib/analyzer/sheets/sheetStore";
import type { AssumptionSheet } from "@/lib/analyzer/sheets/sheet";
import { uncertaintyProposalForRun } from "@/lib/analyzer/uncertaintyProposalStore";
import { analystCallIfConfigured, ANALYST_MODEL } from "@/lib/analyzer/ai/anthropicCall";
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
  runId,
  result,
  verdict,
  sheet,
  aiLayer,
  profileNotConfirmed,
}: {
  tab: AnalyzerTabSlug;
  runId: string;
  result: AnalysisResult;
  verdict: VerdictResult;
  sheet: AssumptionSheet | null;
  aiLayer?: AiLayerReport;
  profileNotConfirmed: boolean;
}) {
  // CF-AR7-REPORT-CONTENT-01 — each tab leads with the content Calvin
  // accepted in the AR7 prototype (#455; app/components/ReportContent.tsx);
  // the existing deterministic sections follow as the deep dive.
  switch (tab) {
    case "overview":
      return <QuickReadGrid runId={runId} result={result} verdict={verdict} sheet={sheet} aiLayer={aiLayer} />;
    case "business":
      return (
        <>
          <BusinessSection result={result} />
          <BusinessResearch sheet={sheet} />
        </>
      );
    case "financials":
      return (
        <>
          <FinancialStatements runId={runId} result={result} />
          <FinancialsSections result={result} />
        </>
      );
    case "valuation":
      return (
        <>
          <AssumptionSheetSection runId={runId} result={result} sheet={sheet} />
          <SensitivitySection result={result} />
          <ValuationSections result={result} withScenarios={false} />
        </>
      );
    case "risks":
      return (
        <>
          <ScenarioStories result={result} sheet={sheet} />
          <RisksThesisSections result={result} aiLayer={aiLayer} />
        </>
      );
    case "market":
      return (
        <>
          <MarketFacts runId={runId} result={result} />
          <MarketContextSection result={result} />
        </>
      );
    case "evidence":
      // Section A and Quick Read have no other route in the unified shell
      // (AnalyzerReport, the only other renderer of either, now backs only
      // the snapshot page) — rendered here so EvidenceSections' own "See
      // Section A for what and why" cross-reference points at content that
      // actually exists on this tab. Trust/profile plumbing (CF-ANALYZER-
      // V1-SETTLE-01) lives here too, not repeated on the other six tabs.
      return (
        <>
          <SourceLedger runId={runId} sheet={sheet} />
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

  // CF-AR3-REPRODUCIBLE-RUNS-01 — the report reads stored outputs; viewing
  // never recomputes. Where this run already has an output for what is
  // recorded on it, there is nothing to advance or compute: the automatic
  // pass below loads the filings and the price, and a run with a stored
  // output was already past it.
  //
  // CF-AR7-REPORT-CONTENT-01 (speed fix from closed PR #421) — the gate state
  // the automatic pass loads is handed on to the computation, on the same
  // pinned market data, so one view loads it once rather than twice.
  let state: GateState | undefined;
  try {
    if ((await currentRunOutput(runId)) === null) {
      state = await advanceRunAutomatically(runId, await reportMarketOptions(runId));
    }
  } catch (err) {
    if (err instanceof RunNotFoundError) notFound();
    throw err;
  }

  // Only Overview, Risks & Thesis and Evidence show the AI layer's prose; the
  // other four tabs read the deterministic output alone, so they never wait
  // on, start or pay for a model call (speed fix from closed PR #421).
  const needsAiLayer = activeTab === "overview" || activeTab === "risks" || activeTab === "evidence";

  let report: { result: AnalysisResult; aiLayer?: AiLayerReport };
  try {
    report = needsAiLayer
      ? await analysisForReport(runId, undefined, undefined, state)
      : await deterministicReport(runId, state);
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
  const profileNotConfirmed = profileNotConfirmedFor(report.result);
  const verdict = deriveVerdict(report.result);
  // CF-AR7-REPORT-CONTENT-01 — the assumption sheet this output was valued
  // on (its drivers' anchors, citations and sources), read by id from the
  // append-only store. The Financials and Market Context tabs do not use it.
  const sheetRef = report.result.valuationBasis?.sheet ?? null;
  const sheet =
    sheetRef !== null && activeTab !== "financials" && activeTab !== "market" ? await getSheet(sheetRef.id) : null;
  // CF-AR5-VERDICT-CONSOLIDATION-01 — only while the verdict asks the one
  // uncertainty question does the AI propose a level (Methodology v2.1 D3).
  const uncertaintyProposal =
    verdict.state === "UNCERTAINTY QUESTION"
      ? await uncertaintyProposalForRun(runId, report.result, analystCallIfConfigured(), ANALYST_MODEL)
      : null;

  return (
    <AnalyzerShell>
      <AnalyzerTopBar variant="overview" />
      <AnalyzerReportFrame
        runId={runId}
        result={report.result}
        verdict={verdict}
        profileNotConfirmed={profileNotConfirmed}
        activeTab={activeTab}
        uncertaintyProposal={uncertaintyProposal}
      >
        <TabBody
          tab={activeTab}
          runId={runId}
          result={report.result}
          verdict={verdict}
          sheet={sheet}
          aiLayer={report.aiLayer}
          profileNotConfirmed={profileNotConfirmed}
        />
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
