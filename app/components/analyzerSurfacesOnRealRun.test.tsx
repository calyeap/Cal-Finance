// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { render, cleanup } from "@testing-library/react";
import Decimal from "decimal.js";
import { getPool } from "@/lib/db";
import { createRun, recordFactDecision, recordProfileDecision } from "@/lib/analyzer/runStore";
import { computeAnalysisForRun, loadGateState } from "@/lib/analyzer/gate";
import { analysisForReport } from "@/lib/analyzer/reportAnalysis";
import { deriveVerdict } from "@/lib/analyzer/verdict";
import { AnalyzerOverview } from "./AnalyzerOverview";
import { AnalyzerReport } from "./AnalyzerReport";
import type { AnalysisResult } from "@/lib/analyzer/types";
import type { AiLayerReport } from "@/lib/analyzer/reportAnalysis";

// ---------------------------------------------------------------------------
// #118 runway item 10 — real-company validation, MSFT and OKLO.
//
// Every M9 surface claim shipped so far (items 3, 4, 6, 7, 8, 9) rests on
// MSFT_FIXTURE / OKLO_FIXTURE, a SYNTHETIC RECONSTRUCTION of the frozen
// design mocks (lib/analyzer/fixtures/msft.ts:24). This is where the two M9
// routes first meet a real fact set: a run driven through the same gated
// path both routes read (lib/analyzer/gate.ts), acquired from the committed
// SEC captures (ANALYZER_OFFLINE=1, vitest.setup.ts:51) rather than from any
// fixture, then rendered through AnalyzerOverview and AnalyzerReport exactly
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

const OVERVIEW_SLOT_ORDER = [
  "slot-1",
  "slot-2",
  "slot-3",
  "slot-4",
  "slot-5",
  "slot-6",
  "slot-7",
  "slot-8",
  "slot-9",
  "slot-10",
  "slot-11",
  "slot-12",
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
    },
    {
      ticker: "OKLO",
      companyName: "Oklo Inc.",
      expectedCompanyName: "Oklo Inc.",
      capturedClose: "41.27",
      fixtureMockPrice: "14.50",
      expectedProfile: "PRE_REVENUE_UNPROFITABLE",
    },
  ])("$ticker", ({ ticker, companyName, expectedCompanyName, capturedClose, fixtureMockPrice, expectedProfile }) => {
    it("opens a real acquired run through the gated path — the recorded capture close, never the fixture's synthetic mock price", async () => {
      const { result, recommendedProfile } = await openRealRun(ticker, companyName);

      expect(result.price.value.equals(new Decimal(capturedClose))).toBe(true);
      expect(result.price.value.equals(new Decimal(fixtureMockPrice))).toBe(false);
      expect(result.companyName).toBe(expectedCompanyName);
      expect(recommendedProfile).toBe(expectedProfile);
    });

    it("all twelve Overview slots are present, in the fixed §2.1 order, none absent", async () => {
      const { result, aiLayer } = await openRealRun(ticker, companyName);
      const verdict = deriveVerdict(result);

      const { container } = render(
        <AnalyzerOverview
          result={result}
          verdict={verdict}
          profileNotConfirmed={false}
          fullAnalysisHref={`/analyzer/x/report`}
          aiLayer={aiLayer}
        />
      );
      const ids = Array.from(container.querySelectorAll("main > .ovslot")).map((el) => el.id);
      expect(ids).toEqual(OVERVIEW_SLOT_ORDER);
    });

    it("slot 2 renders the INCOMPLETE presentation — state name, verdict.reason verbatim as the cause line, and no confidence figure", async () => {
      const { result, aiLayer } = await openRealRun(ticker, companyName);
      const verdict = deriveVerdict(result);
      // Calvin's 19 Sep 2026 (B) ruling: INCOMPLETE is the first-class,
      // expected result for this pass, not a defect. Both real runs are
      // asserted to land here explicitly rather than assumed.
      expect(verdict.status).toBe("INCOMPLETE");

      const { container } = render(
        <AnalyzerOverview
          result={result}
          verdict={verdict}
          profileNotConfirmed={false}
          fullAnalysisHref={`/analyzer/x/report`}
          aiLayer={aiLayer}
        />
      );
      const slot2 = container.querySelector("#slot-2") as HTMLElement;
      expect(slot2.textContent).toContain("INCOMPLETE");
      expect(slot2.textContent).toContain(verdict.reason);
      // §2.1 slot 2 — confidence only when the analysis is not INCOMPLETE.
      expect(slot2.querySelector(".confidence")).toBeNull();
    });

    it("no slot renders a numeral the Analysis Result does not carry — the price-implied restatement (slot 8) shows its suppression state, not a figure, wherever the result itself is suppressed", async () => {
      const { result, aiLayer } = await openRealRun(ticker, companyName);
      const verdict = deriveVerdict(result);
      const { priceImplied } = result;

      const { container } = render(
        <AnalyzerOverview
          result={result}
          verdict={verdict}
          profileNotConfirmed={false}
          fullAnalysisHref={`/analyzer/x/report`}
          aiLayer={aiLayer}
        />
      );
      const slot8 = container.querySelector("#slot-8") as HTMLElement;
      const steadyStateEv = priceImplied.steadyStateEv;
      const pvgoShareOfEv = priceImplied.pvgoShareOfEv;

      if (steadyStateEv.suppressed) {
        expect(slot8.textContent).toContain(steadyStateEv.state);
      } else {
        expect(slot8.textContent).toContain(`$${steadyStateEv.value.toFixed(0)}`);
      }
      if (pvgoShareOfEv.suppressed) {
        expect(slot8.textContent).toContain(pvgoShareOfEv.state);
      } else {
        expect(slot8.textContent).toContain(`${pvgoShareOfEv.value.mul(100).toFixed(1)}%`);
      }
      // The one shared cause both figures suppress under on a real run
      // whose §4.4 judgment is unanswered — asserted directly, not only
      // inferred from the branch taken above.
      if (steadyStateEv.suppressed && pvgoShareOfEv.suppressed) {
        expect(steadyStateEv.state).toBe("LEVERAGE UNSUPPORTED IN v1");
        expect(pvgoShareOfEv.state).toBe("LEVERAGE UNSUPPORTED IN v1");
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

    it("renders without throwing when the profile is Cannot-judge (not human-confirmed) too — the other §6.3 path this run's real profile decision could have taken", async () => {
      // Exercised as a rendering-path check, not a second acceptance run:
      // the same real AnalysisResult, with profileNotConfirmed flipped, the
      // way report/page.tsx computes it off state.run.profileHumanConfirmed.
      const { result, aiLayer } = await openRealRun(ticker, companyName);
      const verdict = deriveVerdict(result);
      expect(() =>
        render(
          <AnalyzerOverview
            result={result}
            verdict={verdict}
            profileNotConfirmed={true}
            fullAnalysisHref={`/analyzer/x/report`}
            aiLayer={aiLayer}
          />
        )
      ).not.toThrow();
    });
  });
});
