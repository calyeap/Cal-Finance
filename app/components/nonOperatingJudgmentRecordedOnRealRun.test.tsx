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
import { priceVsRangeHeadline } from "@/lib/analyzer/trustCopy";

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
const OVERVIEW_TAB_SLOT_ORDER = ["slot-5", "slot-6", "slot-7", "slot-8", "slot-9", "slot-10", "slot-11", "slot-12"];

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

  // CF-MSFT-STAGE2-DURABLE-SEED-01 (issue #442, migration 010) durably
  // recorded Calvin's approved MSFT Stage-2 bundle — a real,
  // driver-authored analyst bundle, never fixture-carried — so A4
  // (CF-ANALYZER-INTEGRITY-PHASE-A-01) no longer suppresses MSFT's range
  // here. `priceVsRangeHeadline` now returns a real headline
  // (`fairValueRange.kind === "range"`, trust not UNUSABLE, profile
  // confirmed) and the hero shows THAT — still never the literal word
  // INCOMPLETE or verdict.reason leaked outside Evidence.
  //
  // CF-ANALYZER-STAGE3-VERDICT-FINISH-01: this run's verdict is now a real
  // SELL (price $499.70 is 1.7638× the real recomputed Base $283.31,
  // invariant across every uncertainty bucket — see verdict.test.ts and
  // msftStage3VerdictOnRealRun.test.ts), not INCOMPLETE. The property this
  // test actually guards — the hero never renders the literal word
  // "INCOMPLETE", and never leaks verdict.reason verbatim — is unaffected
  // either way, so it is re-asserted against the real SELL verdict.
  it("the shared hero states the real price-vs-scenarios headline, never the literal word INCOMPLETE or verdict.reason, outside Evidence", async () => {
    const { result } = await openMsftRunWithRuling();
    const verdict = deriveVerdict(result);
    expect(verdict.status).toBe("SELL");
    expect(result.fairValueRange.kind).toBe("range");

    const { container } = render(
      <AnalyzerReportFrame runId="x" result={result} verdict={verdict} profileNotConfirmed={false} activeTab="overview">
        <div />
      </AnalyzerReportFrame>
    );
    const hero = container.querySelector(".az-hero-verdict") as HTMLElement;
    // CALVIN RULING — REJECT CURRENT PRODUCT SURFACE; BUILD ONE SIMPLE
    // COMPLETE RM-BRIEF PROOF (PR #399, comment 5952716764), REMOVE/BYPASS
    // item 1: the hero must not reduce to the literal word "INCOMPLETE" —
    // trustCopy.ts's own plain-English explanation takes over instead
    // (DominantVerdictSlot.tsx).
    expect(hero.textContent).not.toContain("INCOMPLETE");
    // CF-ANALYZER-V1-SETTLE-01 — CALVIN RULING — A (PR #399): outside
    // Evidence the hero never leaks verdict.reason verbatim — see
    // DominantVerdictSlot.tsx and the design contract's §4 V1 narrowing.
    expect(hero.textContent).not.toContain(verdict.reason);
    // CF-ANALYZER-STAGE3-VERDICT-FINISH-01: a completed verdict (SELL) takes
    // DominantVerdictSlot's completed-verdict path, not the INCOMPLETE
    // priceVsRangeHeadline fallback path — the hero states the verdict word
    // itself and a plain-English rationale built from the same price/Base
    // figures (trustCopy.ts's `completedVerdictExplanation`), never the raw
    // reason.
    expect(hero.textContent).toContain("SELL");
    expect(hero.textContent).toContain(
      "above the SELL level under every uncertainty bucket in the approved verdict policy"
    );

    // priceVsRangeHeadline itself is unaffected by the verdict change — it
    // is computed purely from the range/price/trust facts deriveVerdict
    // never touches — re-asserted here as a regression guard on that
    // independent fact, even though the completed-verdict hero does not
    // render it.
    const headline = priceVsRangeHeadline({
      fairValueRange: result.fairValueRange,
      priceLocationWithinRange: result.scenarioOutputs.priceLocationWithinRange,
      trustStatus: result.trust.status,
      profileNotConfirmed: false,
    });
    // The committed offline capture's own $499.70 close sits above all
    // three approved scenario values (docs/proof/
    // cf-msft-stage2-real-valuation-proof-01.md §3).
    expect(headline).toBe(
      "Trading at or above the bull case modeled for this company — the current price is already at or beyond the most optimistic scenario in the range below."
    );
  });
});
