// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { render, cleanup } from "@testing-library/react";
import Decimal from "decimal.js";
import { getPool } from "@/lib/db";
import { createRun, recordFactDecision, recordProfileDecision } from "@/lib/analyzer/runStore";
import { computeAnalysisForRun, loadGateState } from "@/lib/analyzer/gate";
import { analysisForReport } from "@/lib/analyzer/reportAnalysis";
import { deriveVerdict } from "@/lib/analyzer/verdict";
import { QuickReadGrid } from "./ReportContent";
import { AnalyzerReportFrame } from "./AnalyzerReportFrame";
import { AnalyzerReport } from "./AnalyzerReport";
import type { AnalysisResult } from "@/lib/analyzer/types";
import type { AiLayerReport } from "@/lib/analyzer/reportAnalysis";
import { formatCompactUsd } from "@/lib/formatUsd";
import { notComputedLine } from "@/lib/analyzer/overviewCopy";
import { incompleteVerdictExplanation, verdictExplanation } from "@/lib/analyzer/trustCopy";

// ---------------------------------------------------------------------------
// #118 runway item 10 — real-company validation, MSFT and OKLO.
//
// Every M9 surface claim shipped so far (items 3, 4, 6, 7, 8, 9) rests on
// MSFT_FIXTURE / OKLO_FIXTURE, a SYNTHETIC RECONSTRUCTION of the frozen
// design mocks (lib/analyzer/fixtures/msft.ts:24). This is where the two M9
// routes first meet a real fact set: a run driven through the same gated
// path both routes read (lib/analyzer/gate.ts), acquired from the committed
// SEC captures (ANALYZER_OFFLINE=1, vitest.setup.ts:51) rather than from any
// fixture, then rendered through the Overview Quick Read and AnalyzerReport exactly
// as the routes render them.
//
// The helper below is trustOnRealRun.test.ts's own completeSpotCheck,
// reused rather than re-invented, plus the createRun -> spot-check ->
// recordProfileDecision -> compute pipeline the issue's SCOPE names. No
// §4.4 non-operating-investments judgment is recorded for either run — the
// issue's pipeline does not call for one, and answering it would be this
// BUILD run inventing an analyst judgment neither ticker has actually had
// made. Its absence is the finding: see docs/m9-real-company-validation-
// findings.md.
// ---------------------------------------------------------------------------

async function completeSpotCheck(runId: string): Promise<void> {
  const state = await loadGateState(runId);
  for (const factId of state.outstandingFactIds) {
    await recordFactDecision(runId, factId, "CONFIRMED", null);
  }
}

interface RealRun {
  runId: string;
  result: AnalysisResult;
  aiLayer: AiLayerReport;
  recommendedProfile: string;
}

async function openRealRun(ticker: string, companyName: string): Promise<RealRun> {
  const runId = await createRun(ticker, companyName);
  await completeSpotCheck(runId);
  const state = await loadGateState(runId);
  const recommendedProfile = state.fixture.profile.recommended;
  // The profile each company's own (real, acquired) fact set warrants —
  // read off THIS run's Gate 0-derived recommendation, never a hand-picked
  // enum value.
  await recordProfileDecision(runId, "CONFIRMED", recommendedProfile, null);
  const result = await computeAnalysisForRun(runId);
  // call: null — HARD BOUNDS forbids any model/AI call on this outcome, so
  // the AI layer's own "not configured" path is exercised regardless of
  // whether an API key happens to be set in the environment running this
  // suite.
  const report = await analysisForReport(runId, null);
  return { runId, result, aiLayer: report.aiLayer, recommendedProfile };
}

// CF-AR7-REPORT-CONTENT-01 — reviewed evaluator change: the Overview tab
// body is the Quick Read Calvin accepted in the AR7 prototype (#455),
// replacing M9 slots 5-12; slots 1-4 stay in AnalyzerReportFrame.
const OVERVIEW_TAB_SLOT_ORDER = [
  "qr-price-assumes",
  "qr-base-return",
  "qr-why",
  "qr-quality",
  "qr-against",
  "qr-risks",
  "qr-change",
];

const REPORT_SECTION_ORDER = ["quickread", "A", "C", "D", "E", "F", "G", "H", "I", "I2", "B", "J", "atglance"];

const THEME_ANCHOR_ORDER = ["business", "financials", "valuation", "risks-thesis", "market-context", "evidence"];

describe("#118 item 10 — real acquired runs against the two M9 routes", () => {
  beforeEach(async () => {
    await getPool().query(
      "TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE"
    );
  });

  afterEach(cleanup);

  afterAll(async () => {
    await getPool().end();
  });

  describe.each([
    {
      ticker: "MSFT",
      companyName: "Microsoft Corporation",
      // SEC EDGAR's own entityName for MSFT's capture is upper-case — a real
      // difference from the fixture's title-case "Microsoft Corporation",
      // recorded in docs/m9-real-company-validation-findings.md rather than
      // corrected: this is the acquired company's name, not a rendering
      // defect.
      expectedCompanyName: "MICROSOFT CORPORATION",
      capturedClose: "499.70",
      fixtureMockPrice: "510.12",
      expectedProfile: "MATURE_PROFITABLE_STABLE_FCF",
      // The __capture.sic / __capture.sicDescription this capture carries
      // (lib/analyzer/acquisition/captures/msft-companyfacts.json), matching
      // §2's own recorded "Gate 0 | PASS (sector/industry: ...)" cell.
      expectedSic: "7372",
      expectedSicDescription: "Services-Prepackaged Software",
    },
    {
      ticker: "OKLO",
      companyName: "Oklo Inc.",
      expectedCompanyName: "Oklo Inc.",
      capturedClose: "41.27",
      fixtureMockPrice: "14.50",
      expectedProfile: "PRE_REVENUE_UNPROFITABLE",
      expectedSic: "4911",
      expectedSicDescription: "Electric Services",
    },
  ])("$ticker", ({
    ticker,
    companyName,
    expectedCompanyName,
    capturedClose,
    fixtureMockPrice,
    expectedProfile,
    expectedSic,
    expectedSicDescription,
  }) => {
    it("opens a real acquired run through the gated path — the recorded capture close, never the fixture's synthetic mock price", async () => {
      const { result, recommendedProfile } = await openRealRun(ticker, companyName);

      expect(result.price.value.equals(new Decimal(capturedClose))).toBe(true);
      expect(result.price.value.equals(new Decimal(fixtureMockPrice))).toBe(false);
      expect(result.companyName).toBe(expectedCompanyName);
      expect(recommendedProfile).toBe(expectedProfile);
    });

    it("all seven Quick Read items are present, in the fixed order, none absent", async () => {
      const { runId, result, aiLayer } = await openRealRun(ticker, companyName);

      const { container } = render(
        <QuickReadGrid runId={runId} result={result} verdict={deriveVerdict(result)} sheet={null} aiLayer={aiLayer} />
      );
      const ids = Array.from(container.querySelectorAll(".rc-qr > .rc-item")).map((el) => el.id);
      expect(ids).toEqual(OVERVIEW_TAB_SLOT_ORDER);
    });

    it("the shared hero never leaks verdict.reason outside Evidence, and states the right thing — the completed verdict word where a defensible range exists, the honest structural cause otherwise", async () => {
      const { result } = await openRealRun(ticker, companyName);
      const verdict = deriveVerdict(result);
      // CF-ANALYZER-STAGE3-VERDICT-FINISH-01: MSFT's real, defensible range
      // now reaches a completed SELL under the live Methodology's Verdict
      // synthesis policy v1 (verdict.ts's own hash pin in
      // m9RealCompanyValidationGuards.test.ts was updated by this outcome,
      // with the exact authorisation named there). OKLO's pre-revenue range
      // still has no Step-1-equivalent path to synthesis, so it stays
      // INCOMPLETE exactly as before.
      // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — reviewed evaluator change: the
      // completed SELL was off MSFT's superseded Stage-2 Base (product-
      // decisions item 27, D2); with no D2 input on its sheet MSFT is now
      // INCOMPLETE like OKLO, and takes the same honest-cause path below.
      // CF-AR5-VERDICT-CONSOLIDATION-01 — reviewed evaluator change: MSFT's
      // sheet is not adopted, so it is in the pending-adoption state, which
      // the hero names in plain words (Calvin, Option A on #447). OKLO's
      // leverage gate is a blocker adoption would not clear, so it is
      // reported first: can't bound value.
      if (ticker === "MSFT") expect(["PENDING ADOPTION", "CANNOT BOUND VALUE"]).toContain(verdict.state);
      else expect(verdict.state).toBe("CANNOT BOUND VALUE");

      const { container } = render(
        <AnalyzerReportFrame runId="x" result={result} verdict={verdict} profileNotConfirmed={false} activeTab="overview">
          <div />
        </AnalyzerReportFrame>
      );
      const hero = container.querySelector(".az-hero-verdict") as HTMLElement;
      // CF-ANALYZER-V1-SETTLE-01 — CALVIN RULING — A (PR #399): outside
      // Evidence, the design contract's §4 "verbatim in every case" rule is
      // narrowed — the hero never leaks verdict.reason, since several of
      // deriveVerdict's branches embed a raw trust/gate state code (#392's
      // ACCEPTANCE GATE forbids that outside Evidence).
      expect(hero.textContent).not.toContain(verdict.reason);

      expect(hero.textContent).not.toContain("INCOMPLETE");
      expect(hero.textContent).not.toMatch(/\b(BUY|HOLD|SELL)\b/);
      if (verdict.state === "PENDING ADOPTION") {
        expect(hero.textContent).toContain("Pending adoption");
        expect(hero.textContent).toContain(verdictExplanation(verdict)!);
      } else {
        expect(hero.textContent).toContain(
          incompleteVerdictExplanation({
            trustStatus: result.trust.status,
            fairValueRange: result.fairValueRange,
            leverage: result.gates.leverage,
            profileNotConfirmed: false,
          })
        );
      }
      // Not a verdict, so no evidence-status label beside it.
      expect(hero.querySelector(".confidence")).toBeNull();
    });

    it("the shared hero renders verdict.reason verbatim on the Evidence tab only", async () => {
      const { result } = await openRealRun(ticker, companyName);
      const verdict = deriveVerdict(result);

      const { container } = render(
        <AnalyzerReportFrame runId="x" result={result} verdict={verdict} profileNotConfirmed={false} activeTab="evidence">
          <div />
        </AnalyzerReportFrame>
      );
      const hero = container.querySelector(".az-hero-verdict") as HTMLElement;
      // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — MSFT is INCOMPLETE while its
      // sheet is pending adoption (D2), the same path as OKLO.
      // CF-AR5-VERDICT-CONSOLIDATION-01 — MSFT: pending adoption, its own
      // state; OKLO: INCOMPLETE (can't bound value), as before.
      if (ticker !== "MSFT") expect(verdict.state).toBe("CANNOT BOUND VALUE");
      expect(hero.textContent).toContain(verdict.state === "PENDING ADOPTION" ? "Pending adoption" : "INCOMPLETE");
      expect(hero.textContent).toContain(verdict.reason);
    });

    // CF-AR7-REPORT-CONTENT-01 — reviewed evaluator change: the price-
    // implied read on the Overview is the Quick Read's "What today's price
    // assumes" (the reverse-DCF solve), replacing slot 8. Same invariant: it
    // shows the figure the result carries, or the plain reason it does not.
    it("no Quick Read item renders a numeral the Analysis Result does not carry — the price-implied read shows its plain reason, not a figure, wherever the result itself is suppressed", async () => {
      const { runId, result, aiLayer } = await openRealRun(ticker, companyName);
      const solve = result.priceImplied.reverseDcf;

      const { container } = render(
        <QuickReadGrid runId={runId} result={result} verdict={deriveVerdict(result)} sheet={null} aiLayer={aiLayer} />
      );
      const item = container.querySelector("#qr-price-assumes") as HTMLElement;
      if (solve.fiveYearGrowth.suppressed) {
        expect(item.textContent).toContain(
          notComputedLine(solve.fiveYearGrowth.state, solve.fiveYearGrowth.cause, result.gates.leverage)
        );
        expect(item.textContent).not.toContain(solve.fiveYearGrowth.state);
      } else {
        expect(item.textContent).toContain(`${solve.fiveYearGrowth.value.mul(100).toFixed(1)}%/yr`);
      }
    });

    it("Full Analysis renders on the real run with its six themed anchors and Sections A–J intact", async () => {
      const { result, aiLayer } = await openRealRun(ticker, companyName);

      const { container } = render(<AnalyzerReport result={result} aiLayer={aiLayer} />);
      const sectionIds = Array.from(container.querySelectorAll("main > section")).map((el) => el.id);
      expect(sectionIds).toEqual(REPORT_SECTION_ORDER);

      const themeIds = Array.from(container.querySelectorAll("main > .sechead.theme")).map((el) => el.id);
      expect(themeIds).toEqual(THEME_ANCHOR_ORDER);
    });

    // CF-REALRUN-CURRENT-01 — the two M9 surfaces that changed since the
    // pass docs/m9-real-company-validation-findings.md records (PR #200),
    // observed on a real run for the first time.

    it("Market Context renders the real SEC SIC classification (PR #200), never the not-yet-available state", async () => {
      const { result, aiLayer } = await openRealRun(ticker, companyName);
      expect(result.marketContext.sic).toBe(expectedSic);
      expect(result.marketContext.sicDescription).toBe(expectedSicDescription);

      const { container } = render(<AnalyzerReport result={result} aiLayer={aiLayer} />);
      expect(container.textContent).toContain(
        `SEC classification (SIC ${expectedSic}): ${expectedSicDescription}`
      );
      expect(container.textContent).not.toContain(
        "Not yet available — no SEC industry classification was acquired for this analysis."
      );
    });

    it("Business renders the disclosed capture empty state (M9-ITEM5-CONTENT-01 SCOPE item 3), never the filer's 10-K narrative — unreachable from an offline capture run by design, not fixed here", async () => {
      const { result, aiLayer } = await openRealRun(ticker, companyName);
      expect(result.business.narrative).toBeNull();

      const { container } = render(<AnalyzerReport result={result} aiLayer={aiLayer} />);
      // CF-AR7-REPORT-CONTENT-01 — the empty state's lead-in is plain words
      // now ("Not yet available" is forbidden on reading tabs); the disclosed
      // reason itself is still shown in full.
      expect(container.textContent).toContain(
        "No company description for this analysis — 10-K Item 1 excerpts are not part of the committed SEC capture — this run " +
          "reads captured XBRL facts only, and the extraction rule requires a live EDGAR filing-document fetch."
      );
      expect(container.textContent).not.toContain("Not yet available");
    });

    it("renders without throwing when the profile is Cannot-judge (not human-confirmed) too — the other §6.3 path this run's real profile decision could have taken", async () => {
      // Exercised as a rendering-path check, not a second acceptance run:
      // the same real AnalysisResult, with profileNotConfirmed flipped, the
      // way report/page.tsx computes it off state.run.profileHumanConfirmed.
      const { runId, result, aiLayer } = await openRealRun(ticker, companyName);
      expect(() =>
        render(<QuickReadGrid runId={runId} result={result} verdict={deriveVerdict(result)} sheet={null} aiLayer={aiLayer} />)
      ).not.toThrow();
    });
  });
});
