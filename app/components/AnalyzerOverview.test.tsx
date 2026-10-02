// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { AnalyzerOverview } from "./AnalyzerOverview";
import { CHALLENGER_SELECTION_RULE_NOTE } from "./AnalyzerReport";
import { assembleAnalysisResult } from "@/lib/analyzer/assemble";
import { MSFT_FIXTURE } from "@/lib/analyzer/fixtures/msft";
import type { AnalysisResult, InterpretationStatement, PageOneProse } from "@/lib/analyzer/types";
import type { Step4ForecastDispersionReading } from "@/lib/analyzer/modules/sensitivity";
import { formatCompactUsd } from "@/lib/formatUsd";

afterEach(cleanup);

// M9-OVERVIEW-CONTENT-01 test fixture — a page-one sentence, shaped exactly
// as the interpretation call produces (lib/analyzer/ai/interpretation.ts):
// every member carries the §8.2 responsibility it discharges and the value
// ids it rests on. `assembleAnalysisResult` always sets `pageOne: null`
// (the interpretation call has not run in these fixtures), so tests for the
// filled-slot path build the prose onto the assembled result directly.
function statement(text: string): InterpretationStatement {
  return {
    responsibility: "ASSUMPTION PLAUSIBILITY AND WHAT THE PRICE REQUIRES",
    statement: text,
    referencesValueIds: [],
  };
}

function withPageOne(result: AnalysisResult, pageOne: PageOneProse): AnalysisResult {
  return { ...result, interpretation: { ...result.interpretation, pageOne } };
}

// CF-ANALYZER-V1-SETTLE-01 correction (CALVIN RULING — A, slot 11) — builds
// a result with a chosen `forecastDispersion` reading onto the assembled
// MSFT fixture, the same pattern `withPageOne` above already uses, so the
// "no computed source" fallback path (NVDA today) is reachable without a
// second DB-backed fixture.
function withForecastDispersion(result: AnalysisResult, forecastDispersion: Step4ForecastDispersionReading): AnalysisResult {
  return {
    ...result,
    diagnostics: { ...result.diagnostics, sensitivity: { ...result.diagnostics.sensitivity, forecastDispersion } },
  };
}

const FILLED_PAGE_ONE: PageOneProse = {
  mainFinding: statement("The price rests on growth well above the company's own history."),
  whatSupportsTheCase: statement("Returns on new capital sit above every discount rate in the policy grid."),
  whatWorriesCalboard: statement("The margin the grid is run from sits at the top of its own history."),
  biggestUncertainty: statement("Which margin level is the right base for the reverse-DCF grid."),
};

// CF-DESIGN-AUTHORITY-CUTOVER-01 — AnalyzerOverview now renders only the
// Overview tab's own body (slots 5-11); slots 1-4 and 12 moved to
// AnalyzerReportFrame, which renders identically on every tab (see
// AnalyzerReportFrame.test.tsx for that coverage). The fixed-order and
// per-slot content rules below are otherwise unchanged from M9-DESKTOP-
// SHELL-01/M9-OVERVIEW-CONTENT-01.

describe("AnalyzerOverview — fixed slot order (slots 5-11)", () => {
  const result = assembleAnalysisResult(MSFT_FIXTURE);

  it("renders slots 5-11, in order, as direct children of .ovtab", () => {
    const { container } = render(<AnalyzerOverview result={result} />);
    const ids = Array.from(container.querySelectorAll(".ovtab > .ovslot")).map((el) => el.id);
    expect(ids).toEqual(["slot-5", "slot-6", "slot-7", "slot-8", "slot-9", "slot-10", "slot-11"]);
  });

  // CF-ANALYZER-V1-SETTLE-01 correction (CALVIN RULING — A, comment
  // 5946448076) — slot 11 is no longer unconditionally "not yet available":
  // where M14's tornado already names the largest-swing driver for this run
  // (MSFT has an analyst-supplied growth/margin range; growth's own swing
  // already exceeds margin's — msftSensitivityCaptureOnRealRun.test.ts), it
  // states that driver directly, a short statement naming the variable, not
  // a prediction or advice on when to act (design contract row 11).
  it("slot 11 states M14's own largest-swing driver for MSFT, a short statement naming the variable", () => {
    const { container } = render(<AnalyzerOverview result={result} />);
    const slot = container.querySelector("#slot-11");
    expect(slot).not.toBeNull();
    const reading = result.diagnostics.sensitivity.forecastDispersion as Step4ForecastDispersionReading;
    expect(reading.available).toBe(true);
    if (!reading.available) return;
    expect(reading.selectedDriver).toBe("growth");
    expect(slot!.textContent).toContain("growth");
    expect(slot!.textContent).toContain(`${reading.fullRangeValueImpact.mul(100).toFixed(1)}%`);
    expect(slot!.textContent).not.toMatch(/Not yet available/);
  });

  it("slot 11 falls back to an honest 'no computed change trigger' marker when no sensitivity range exists for this ticker (NVDA today)", () => {
    const unavailable = withForecastDispersion(result, {
      available: false,
      cause: "no tornado row is available: true — every analyst-supplied range for this run is missing",
    });
    const { container } = render(<AnalyzerOverview result={unavailable} />);
    const slot = container.querySelector("#slot-11");
    expect(slot).not.toBeNull();
    expect(slot!.textContent).toContain("No computed change trigger available yet.");
  });

  // CF-ANALYZER-V1-SETTLE-01 correction (REVIEW's `CORRECT:`, comment
  // 5945267878) — slot 5 is no longer a second "not yet available" marker
  // for content the Business tab already carries; it falls back to the
  // honest frame only where the business narrative itself is unavailable,
  // the same condition BusinessSection (AnalyzerReport.tsx) renders on.
  it("slot 5 falls back to the honest structural frame when the business narrative is unavailable", () => {
    const { container } = render(<AnalyzerOverview result={result} />);
    const slot = container.querySelector("#slot-5");
    expect(slot).not.toBeNull();
    expect(slot!.textContent).toMatch(/Not yet available/);
  });

  it("slot 5 restates the business narrative's first sentences, verbatim, when one is available", () => {
    const withNarrative: AnalysisResult = {
      ...result,
      business: {
        narrative: {
          text:
            "Microsoft develops, licenses and supports software, services, devices and solutions. " +
            "The company operates through three segments. " +
            "It serves customers worldwide. " +
            "This fourth sentence must not appear in the restated excerpt.",
          filingForm: "10-K",
          filingDate: "2024-07-30",
          accessionNumber: "0000789019-24-000123",
          ruleVersion: "item1-2026-09-1",
        },
        unavailableReason: null,
      },
    };
    const { container } = render(<AnalyzerOverview result={withNarrative} />);
    const slot = container.querySelector("#slot-5") as HTMLElement;
    expect(slot.textContent).toMatch(/develops, licenses and supports software/);
    expect(slot.textContent).toContain("It serves customers worldwide.");
    expect(slot.textContent).not.toContain("This fourth sentence must not appear");
    expect(slot.textContent).not.toMatch(/Not yet available/);
    expect(slot.textContent).toContain("Full description on the Business tab.");
  });

  // CF-ANALYZER-V1-SETTLE-01 — slots 6, 7, 9, 10 share one underlying cause
  // (pageOne === null), so they no longer each restate the full sentence:
  // that was up to four repeated failure-state markers on Overview for one
  // fact, over #392's "no more than 3 inline missing-data markers" bar.
  // Each slot instead shows a plain "—" and the one shared note above them
  // carries the explanation, once.
  it("slots 6, 7, 9, 10 render a plain placeholder, not a repeated failure-state sentence, when pageOne is null", () => {
    const { container } = render(<AnalyzerOverview result={result} />);
    for (const id of ["slot-6", "slot-7", "slot-9", "slot-10"]) {
      const slot = container.querySelector(`#${id}`);
      expect(slot).not.toBeNull();
      expect(slot!.querySelector(".note")!.textContent).toBe("—");
    }
  });

  it("renders exactly one shared note explaining why, for all four affected slots together", () => {
    const { container } = render(<AnalyzerOverview result={result} />);
    const note = container.querySelector("#interpretation-unavailable");
    expect(note).not.toBeNull();
    expect(note!.textContent).toMatch(/the interpretation call has not run/);
    expect(container.querySelectorAll("#interpretation-unavailable").length).toBe(1);
  });

  it("the shared note surfaces the AI layer's cause line when one is passed", () => {
    const { container } = render(
      <AnalyzerOverview
        result={result}
        aiLayer={{ status: "NOT CONFIGURED", model: null, detail: "No ANTHROPIC_API_KEY is configured." }}
      />
    );
    expect(container.querySelector("#interpretation-unavailable")!.textContent).toContain(
      "No ANTHROPIC_API_KEY is configured."
    );
  });

  it("Overview shows no more than 3 inline missing-data markers when interpretation has not run", () => {
    const { container } = render(<AnalyzerOverview result={result} />);
    // Slot 5 (no business narrative in this fixture) plus the one shared
    // interpretation note — never one marker per affected editorial slot.
    // Slot 11 carries no `.note` marker here: MSFT has a computed
    // forecastDispersion reading, so it renders real content, not a marker.
    const markers = container.querySelectorAll("#slot-5 .note, #slot-11 .note, #interpretation-unavailable .note");
    expect(markers.length).toBeLessThanOrEqual(3);
  });

  it("slot 8 restates Section E's steady-state EV, PVGO share and implied growth — the same figures, no second computation", () => {
    const { container } = render(<AnalyzerOverview result={result} />);
    const slot8 = container.querySelector("#slot-8") as HTMLElement;
    const baseRateCell = result.priceImplied.reverseDcfGrid.find((c) => c.marginLevel === "current" && c.rate === 0.08)!;
    expect(result.priceImplied.steadyStateEv.suppressed).toBe(false);
    expect(result.priceImplied.pvgoShareOfEv.suppressed).toBe(false);
    expect(baseRateCell.fiveYearGrowth.suppressed).toBe(false);
    if (
      result.priceImplied.steadyStateEv.suppressed ||
      result.priceImplied.pvgoShareOfEv.suppressed ||
      baseRateCell.fiveYearGrowth.suppressed
    ) {
      throw new Error("unreachable — narrowed by the assertions above");
    }
    expect(slot8.textContent).toContain(`$${formatCompactUsd(result.priceImplied.steadyStateEv.value)}`);
    expect(slot8.textContent).toContain(`${result.priceImplied.pvgoShareOfEv.value.mul(100).toFixed(1)}%`);
    expect(slot8.textContent).toContain(`${baseRateCell.fiveYearGrowth.value.mul(100).toFixed(1)}%`);
  });
});

// M9-OVERVIEW-CONTENT-01 — the filled-slot path. `pageOne` never comes
// populated out of `assembleAnalysisResult` in these fixtures (the
// interpretation call has not run), so this builds it onto the assembled
// result the same way the AI layer would (lib/analyzer/reportAnalysis.ts).
describe("AnalyzerOverview — filled editorial slots (pageOne present)", () => {
  const base = assembleAnalysisResult(MSFT_FIXTURE);
  const result = withPageOne(base, FILLED_PAGE_ONE);

  it("renders each filled slot's own sourced content, and nothing else's", () => {
    const { container } = render(<AnalyzerOverview result={result} />);
    expect(container.querySelector("#slot-6")!.textContent).toContain(FILLED_PAGE_ONE.whatSupportsTheCase.statement);
    expect(container.querySelector("#slot-7")!.textContent).toContain(FILLED_PAGE_ONE.whatWorriesCalboard.statement);
    expect(container.querySelector("#slot-9")!.textContent).toContain(FILLED_PAGE_ONE.mainFinding.statement);
    expect(container.querySelector("#slot-10")!.textContent).toContain(FILLED_PAGE_ONE.biggestUncertainty.statement);
    // Cross-check: slot 6 never carries slot 10's sentence, etc.
    expect(container.querySelector("#slot-6")!.textContent).not.toContain(FILLED_PAGE_ONE.biggestUncertainty.statement);
  });

  it("slot 9's finding never renders as a ranked list — one point, restating already-computed material", () => {
    const { container } = render(<AnalyzerOverview result={result} />);
    const slot9 = container.querySelector("#slot-9") as HTMLElement;
    expect(slot9.querySelectorAll("li, ol, ul").length).toBe(0);
  });

  it("slot 11 still states the largest-swing driver when pageOne is filled — unaffected by interpretation content", () => {
    const { container } = render(<AnalyzerOverview result={result} />);
    expect(container.querySelector("#slot-11")!.textContent).toContain("growth");
    expect(container.querySelector("#slot-11")!.textContent).not.toMatch(/Not yet available/);
  });

  it("slot 5 still falls back to its honest frame when pageOne is filled but the business narrative is not available", () => {
    const { container } = render(<AnalyzerOverview result={result} />);
    expect(container.querySelector("#slot-5")!.textContent).toMatch(/Not yet available/);
  });

  it("the slot-5-through-11 fixed order holds unchanged with pageOne filled", () => {
    const { container } = render(<AnalyzerOverview result={result} />);
    const ids = Array.from(container.querySelectorAll(".ovtab > .ovslot")).map((el) => el.id);
    expect(ids).toEqual(["slot-5", "slot-6", "slot-7", "slot-8", "slot-9", "slot-10", "slot-11"]);
  });

  it("slot 7 surfaces the selected challenger point via the same selectChallengerPoint selection Section I/I2 share", () => {
    const withChallenger: AnalysisResult = {
      ...result,
      challenger: {
        findings: [
          {
            claimOrFactReference: "Section D — margin trend",
            boundSection: "D",
            evidence: "The margin expansion assumed in the base case has no precedent in the company's own history.",
            whatWouldHaveToBeTrue: "Cost discipline would have to improve materially beyond any prior year.",
          },
        ],
        completedAt: "2026-09-19T00:00:00.000Z",
      },
    };
    const { container } = render(<AnalyzerOverview result={withChallenger} />);
    expect(container.querySelector("#slot-7")!.textContent).toContain(
      "The margin expansion assumed in the base case has no precedent in the company's own history."
    );
    // §17.7.1 — the rendered copy must state the finding was selected by
    // report order, not by damage, and never call it the strongest. This is
    // Section I's exact sentence, imported rather than restated.
    expect(container.querySelector("#slot-7")!.textContent).toContain(CHALLENGER_SELECTION_RULE_NOTE);
  });

  it("slot 7 surfaces nothing challenger-related when the challenger call has not completed", () => {
    const { container } = render(<AnalyzerOverview result={result} />);
    expect(container.querySelector("#slot-7")!.textContent).not.toMatch(/Challenger point/);
    expect(container.querySelector("#slot-7")!.textContent).not.toContain(CHALLENGER_SELECTION_RULE_NOTE);
  });

  it("slot 7 surfaces nothing challenger-related when the challenger call completed but found nothing", () => {
    const withEmptyChallenger: AnalysisResult = {
      ...result,
      challenger: { findings: [], completedAt: "2026-09-19T00:00:00.000Z" },
    };
    const { container } = render(<AnalyzerOverview result={withEmptyChallenger} />);
    expect(container.querySelector("#slot-7")!.textContent).not.toMatch(/Challenger point/);
    expect(container.querySelector("#slot-7")!.textContent).not.toContain(CHALLENGER_SELECTION_RULE_NOTE);
  });
});
