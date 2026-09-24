// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { getPool } from "@/lib/db";
import { createRun, recordFactDecision, recordJudgment, recordProfileDecision } from "@/lib/analyzer/runStore";
import { computeAnalysisForRun, loadGateState } from "@/lib/analyzer/gate";
import { analysisForReport } from "@/lib/analyzer/reportAnalysis";
import { deriveVerdict } from "@/lib/analyzer/verdict";
import { AnalyzerOverview } from "./AnalyzerOverview";
import { AnalyzerReportFrame } from "./AnalyzerReportFrame";

// ---------------------------------------------------------------------------
// CF-S44-RECORD-01 — the rendering half of MSFT's recorded §4.4 ruling: the
// M9 Overview surface must still present all twelve §2.1 slots, and slot 2's
// INCOMPLETE presentation, once the ruling is recorded and enterprise value,
// leverage and trust all change underneath it.
//
// Same helper pattern as app/components/analyzerSurfacesOnRealRun.test.tsx
// (completeSpotCheck, createRun -> spot-check -> recordProfileDecision ->
// compute), with one addition — recordJudgment, the seam SCOPE 1 fixes —
// rather than a second harness.
// ---------------------------------------------------------------------------

const MSFT_TAG = "us-gaap:LongTermInvestments";

// CF-DESIGN-AUTHORITY-CUTOVER-01 — AnalyzerOverview now renders only the
// Overview tab's own body (slots 5-11); slots 1-4 and 12 moved to
// AnalyzerReportFrame.
const OVERVIEW_TAB_SLOT_ORDER = ["slot-5", "slot-6", "slot-7", "slot-8", "slot-9", "slot-10", "slot-11"];

async function completeSpotCheck(runId: string): Promise<void> {
  const state = await loadGateState(runId);
  for (const factId of state.outstandingFactIds) {
    await recordFactDecision(runId, factId, "CONFIRMED", null);
  }
}

async function openMsftRunWithRuling() {
  const runId = await createRun("MSFT", "Microsoft Corporation");
  await recordJudgment(
    runId,
    "NON-OPERATING INVESTMENTS",
    MSFT_TAG,
    "Calvin's §4.4 ruling, 2026-09-21T08:19:14Z, issue #188."
  );
  await completeSpotCheck(runId);
  const state = await loadGateState(runId);
  await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
  const result = await computeAnalysisForRun(runId);
  // No model/AI call on this outcome (HARD BOUNDS) — the AI layer's own
  // "not configured" path, regardless of what credentials the environment
  // running this suite happens to carry.
  const report = await analysisForReport(runId, null);
  return { result, aiLayer: report.aiLayer };
}

describe("CF-S44-RECORD-01 — MSFT's ruled run on the Overview surface", () => {
  beforeEach(async () => {
    await getPool().query(
      "TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE"
    );
  });

  afterEach(cleanup);

  afterAll(async () => {
    await getPool().end();
  });

  it("all seven Overview tab slots are still present, in the fixed §2.1 order, none absent", async () => {
    const { result, aiLayer } = await openMsftRunWithRuling();

    const { container } = render(<AnalyzerOverview result={result} aiLayer={aiLayer} />);
    const ids = Array.from(container.querySelectorAll(".ovtab > .ovslot")).map((el) => el.id);
    expect(ids).toEqual(OVERVIEW_TAB_SLOT_ORDER);
  });

  it("the shared hero still renders INCOMPLETE — verdict.reason verbatim as the cause line, no confidence figure", async () => {
    const { result } = await openMsftRunWithRuling();
    const verdict = deriveVerdict(result);
    expect(verdict.status).toBe("INCOMPLETE");

    const { container } = render(
      <AnalyzerReportFrame runId="x" result={result} verdict={verdict} profileNotConfirmed={false} activeTab="overview">
        <div />
      </AnalyzerReportFrame>
    );
    const hero = container.querySelector(".az-hero-verdict") as HTMLElement;
    expect(hero.textContent).toContain("INCOMPLETE");
    expect(hero.textContent).toContain(verdict.reason);
    // §2.1 slot 2 — confidence only when the analysis is not INCOMPLETE.
    expect(hero.querySelector(".confidence")).toBeNull();
  });
});
