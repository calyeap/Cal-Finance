// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { getPool } from "@/lib/db";
import { createRun, recordFactDecision, recordProfileDecision } from "@/lib/analyzer/runStore";
import { loadGateState } from "@/lib/analyzer/gate";

// ---------------------------------------------------------------------------
// CF-ANALYZER-USABLE-REPORT-REPAIR-01 — two of the repair's performance
// fixes, proved directly rather than by timing (timing against a real
// network/model call is not reproducible in CI):
//
// 1. Visiting a tab that never reads aiLayer or the AI-merged
//    result.interpretation/result.challenger (business, financials,
//    valuation, market) must not call analysisForReport at all — so it
//    cannot be made to wait on, or pay for, a model call it was never going
//    to show. Before this outcome, every tab routed through
//    analysisForReport unconditionally.
// 2. A single tab render must call loadGateState exactly once. Before this
//    outcome, advanceRunAutomatically and computeAnalysisForRun (reached via
//    analysisForReport) each called it independently — the same live
//    market-data/acquisition work, twice, on every page view.
//
// Kept in its own file (rather than added to analyzerRoutesOnRealRun.test.tsx)
// because vi.mock/vi.spyOn on lib/analyzer/reportAnalysis and lib/analyzer/gate
// must not leak into that file's real-call-path assertions.
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`UNEXPECTED REDIRECT to ${url}`);
  },
  notFound: () => {
    throw new Error("UNEXPECTED notFound()");
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const reportAnalysisModule = await import("@/lib/analyzer/reportAnalysis");
const runStoreModule = await import("@/lib/analyzer/runStore");
const { default: AnalyzerPage } = await import("./[runId]/page");

type TabbedPage = (props: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) => Promise<React.JSX.Element>;

async function renderTab(runId: string, tab: string) {
  return render(
    await (AnalyzerPage as unknown as TabbedPage)({
      params: Promise.resolve({ runId }),
      searchParams: Promise.resolve({ tab }),
    })
  );
}

async function decidedMsftRun(): Promise<string> {
  const runId = await createRun("MSFT", "Microsoft Corporation");
  const state = await loadGateState(runId);
  for (const factId of state.outstandingFactIds) {
    await recordFactDecision(runId, factId, "CONFIRMED", null);
  }
  await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
  return runId;
}

describe("CF-ANALYZER-USABLE-REPORT-REPAIR-01 — the AI layer's cost is scoped to the tabs that read it", () => {
  beforeEach(async () => {
    await getPool().query(
      "TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE"
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await getPool().end();
  });

  it.each(["business", "financials", "valuation", "market"])(
    "the %s tab never calls analysisForReport",
    async (tab) => {
      const spy = vi.spyOn(reportAnalysisModule, "analysisForReport");
      const runId = await decidedMsftRun();

      await renderTab(runId, tab);

      expect(spy).not.toHaveBeenCalled();
    }
  );

  it.each(["overview", "risks", "evidence"])("the %s tab does call analysisForReport", async (tab) => {
    const spy = vi.spyOn(reportAnalysisModule, "analysisForReport");
    const runId = await decidedMsftRun();

    await renderTab(runId, tab);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it.each(["overview", "business", "financials", "valuation", "market", "risks", "evidence"])(
    "the %s tab loads the run's gate state exactly once per render, not once per internal caller",
    async (tab) => {
      // getRun (lib/analyzer/runStore.ts) is called from exactly one place,
      // loadGateState — never directly by page.tsx or autoRun.ts — so its
      // call count is an external, spy-visible proxy for "how many times did
      // this render call loadGateState". loadGateState itself cannot be
      // spied on directly for this: advanceRunAutomatically calls it through
      // an import (a different module, spy-visible), but
      // computeAnalysisForRun's own call is a same-module reference to its
      // own file's function and is invisible to vi.spyOn regardless of
      // whether the preloadedState seam is used — a false negative this test
      // avoids by counting one level deeper.
      //
      // The run is set up (including decidedMsftRun's own loadGateState
      // call, to discover the outstanding facts) BEFORE the spy attaches, so
      // only the render itself is counted.
      const runId = await decidedMsftRun();
      const spy = vi.spyOn(runStoreModule, "getRun");

      await renderTab(runId, tab);

      expect(spy).toHaveBeenCalledTimes(1);
    }
  );
});
