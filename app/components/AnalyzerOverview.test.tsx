// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { AnalyzerOverview } from "./AnalyzerOverview";
import { CHALLENGER_SELECTION_RULE_NOTE } from "./AnalyzerReport";
import { assembleAnalysisResult } from "@/lib/analyzer/assemble";
import { MSFT_FIXTURE } from "@/lib/analyzer/fixtures/msft";
import type { AnalysisResult, InterpretationStatement, PageOneProse } from "@/lib/analyzer/types";

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

  it("slots 5 and 11 remain honest structural frames — no approved content source (issue #160 SCOPE item 7)", () => {
    const { container } = render(<AnalyzerOverview result={result} />);
    for (const id of ["slot-5", "slot-11"]) {
      const slot = container.querySelector(`#${id}`);
      expect(slot).not.toBeNull();
      expect(slot!.textContent).toMatch(/Not yet available/);
    }
  });

  it("slots 6, 7, 9, 10 render the pageOne === null path honestly, since interpretation has not run in this fixture", () => {
    const { container } = render(<AnalyzerOverview result={result} />);
    for (const id of ["slot-6", "slot-7", "slot-9", "slot-10"]) {
      const slot = container.querySelector(`#${id}`);
      expect(slot).not.toBeNull();
      expect(slot!.textContent).toMatch(/the interpretation call has not run/);
    }
  });

  it("slots 6, 7, 9, 10 surface the AI layer's cause line when one is passed", () => {
    const { container } = render(
      <AnalyzerOverview
        result={result}
        aiLayer={{ status: "NOT CONFIGURED", model: null, detail: "No ANTHROPIC_API_KEY is configured." }}
      />
    );
    for (const id of ["slot-6", "slot-7", "slot-9", "slot-10"]) {
      const slot = container.querySelector(`#${id}`);
      expect(slot!.textContent).toContain("No ANTHROPIC_API_KEY is configured.");
    }
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
    expect(slot8.textContent).toContain(`$${result.priceImplied.steadyStateEv.value.toFixed(0)}`);
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

  it("slots 5 and 11 still render as structural frames when pageOne is filled — they have no content source regardless", () => {
    const { container } = render(<AnalyzerOverview result={result} />);
    for (const id of ["slot-5", "slot-11"]) {
      expect(container.querySelector(`#${id}`)!.textContent).toMatch(/Not yet available/);
    }
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
