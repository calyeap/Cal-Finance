// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { AnalyzerOverview } from "./AnalyzerOverview";
import { assembleAnalysisResult } from "@/lib/analyzer/assemble";
import { MSFT_FIXTURE } from "@/lib/analyzer/fixtures/msft";
import { deriveVerdict } from "@/lib/analyzer/verdict";
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

// M9-DESKTOP-SHELL-01 — Overview's fixed slot order, per docs/design/m9-
// analyzer-design-contract.md §2.1: #118's twelve slots, in that order,
// unconditionally — no slot reordered, dropped, or rendered only in some
// states.

describe("AnalyzerOverview — fixed slot order", () => {
  const result = assembleAnalysisResult(MSFT_FIXTURE);
  const verdict = deriveVerdict(result);

  it("renders all twelve slots, in order, as direct children of main", () => {
    const { container } = render(
      <AnalyzerOverview result={result} verdict={verdict} profileNotConfirmed={false} fullAnalysisHref="/analyzer/x/report" />
    );
    const ids = Array.from(container.querySelectorAll("main > .ovslot")).map((el) => el.id);
    expect(ids).toEqual([
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
    ]);
  });

  it("slot 1 (company header) carries no verdict, figure or finding-block content", () => {
    const { container } = render(
      <AnalyzerOverview result={result} verdict={verdict} profileNotConfirmed={false} fullAnalysisHref="/analyzer/x/report" />
    );
    const slot1 = container.querySelector("#slot-1") as HTMLElement;
    expect(slot1.textContent).toContain("Microsoft Corporation");
    expect(slot1.querySelector(".verdictword")).toBeNull();
    expect(slot1.textContent).not.toMatch(/\$\d/);
  });

  it("slot 2 renders the INCOMPLETE path, since every current fixture's deriveVerdict returns INCOMPLETE (M8 gap)", () => {
    render(
      <AnalyzerOverview result={result} verdict={verdict} profileNotConfirmed={false} fullAnalysisHref="/analyzer/x/report" />
    );
    expect(screen.getByText("INCOMPLETE")).not.toBeNull();
  });

  it("slots 5 and 11 remain honest structural frames — no approved content source (issue #160 SCOPE item 7)", () => {
    const { container } = render(
      <AnalyzerOverview result={result} verdict={verdict} profileNotConfirmed={false} fullAnalysisHref="/analyzer/x/report" />
    );
    for (const id of ["slot-5", "slot-11"]) {
      const slot = container.querySelector(`#${id}`);
      expect(slot).not.toBeNull();
      expect(slot!.textContent).toMatch(/Not yet available/);
    }
  });

  it("slots 6, 7, 9, 10 render the pageOne === null path honestly, since interpretation has not run in this fixture", () => {
    const { container } = render(
      <AnalyzerOverview result={result} verdict={verdict} profileNotConfirmed={false} fullAnalysisHref="/analyzer/x/report" />
    );
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
        verdict={verdict}
        profileNotConfirmed={false}
        fullAnalysisHref="/analyzer/x/report"
        aiLayer={{ status: "NOT CONFIGURED", model: null, detail: "No ANTHROPIC_API_KEY is configured." }}
      />
    );
    for (const id of ["slot-6", "slot-7", "slot-9", "slot-10"]) {
      const slot = container.querySelector(`#${id}`);
      expect(slot!.textContent).toContain("No ANTHROPIC_API_KEY is configured.");
    }
  });

  it("slot 8 restates Section E's steady-state EV, PVGO share and implied growth — the same figures, no second computation", () => {
    const { container } = render(
      <AnalyzerOverview result={result} verdict={verdict} profileNotConfirmed={false} fullAnalysisHref="/analyzer/x/report" />
    );
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

  it("slot 12 is a single, clearly primary link into Full Analysis", () => {
    render(
      <AnalyzerOverview result={result} verdict={verdict} profileNotConfirmed={false} fullAnalysisHref="/analyzer/x/report" />
    );
    const link = screen.getByRole("link", { name: "View full analysis" });
    expect(link.getAttribute("href")).toBe("/analyzer/x/report");
  });
});

describe("AnalyzerOverview — completed verdict path (first-class, independently exercised)", () => {
  it("renders the BUY word and no .state markup in slot 2 when the verdict is completed", () => {
    const result = assembleAnalysisResult(MSFT_FIXTURE);
    render(
      <AnalyzerOverview
        result={result}
        verdict={{ status: "BUY", reason: "The evidence supports it." }}
        profileNotConfirmed={false}
        fullAnalysisHref="/analyzer/x/report"
      />
    );
    expect(screen.getByText("BUY")).not.toBeNull();
    expect(screen.queryByText("INCOMPLETE")).toBeNull();
  });
});

// M9-OVERVIEW-CONTENT-01 — the filled-slot path. `pageOne` never comes
// populated out of `assembleAnalysisResult` in these fixtures (the
// interpretation call has not run), so this builds it onto the assembled
// result the same way the AI layer would (lib/analyzer/reportAnalysis.ts).
describe("AnalyzerOverview — filled editorial slots (pageOne present)", () => {
  const base = assembleAnalysisResult(MSFT_FIXTURE);
  const result = withPageOne(base, FILLED_PAGE_ONE);
  const verdict = deriveVerdict(result);

  it("renders each filled slot's own sourced content, and nothing else's", () => {
    const { container } = render(
      <AnalyzerOverview result={result} verdict={verdict} profileNotConfirmed={false} fullAnalysisHref="/analyzer/x/report" />
    );
    expect(container.querySelector("#slot-6")!.textContent).toContain(FILLED_PAGE_ONE.whatSupportsTheCase.statement);
    expect(container.querySelector("#slot-7")!.textContent).toContain(FILLED_PAGE_ONE.whatWorriesCalboard.statement);
    expect(container.querySelector("#slot-9")!.textContent).toContain(FILLED_PAGE_ONE.mainFinding.statement);
    expect(container.querySelector("#slot-10")!.textContent).toContain(FILLED_PAGE_ONE.biggestUncertainty.statement);
    // Cross-check: slot 6 never carries slot 10's sentence, etc.
    expect(container.querySelector("#slot-6")!.textContent).not.toContain(FILLED_PAGE_ONE.biggestUncertainty.statement);
  });

  it("slot 9's finding never renders as a ranked list — one point, restating already-computed material", () => {
    const { container } = render(
      <AnalyzerOverview result={result} verdict={verdict} profileNotConfirmed={false} fullAnalysisHref="/analyzer/x/report" />
    );
    const slot9 = container.querySelector("#slot-9") as HTMLElement;
    expect(slot9.querySelectorAll("li, ol, ul").length).toBe(0);
  });

  it("slots 5 and 11 still render as structural frames when pageOne is filled — they have no content source regardless", () => {
    const { container } = render(
      <AnalyzerOverview result={result} verdict={verdict} profileNotConfirmed={false} fullAnalysisHref="/analyzer/x/report" />
    );
    for (const id of ["slot-5", "slot-11"]) {
      expect(container.querySelector(`#${id}`)!.textContent).toMatch(/Not yet available/);
    }
  });

  it("the twelve-slot fixed order holds unchanged with pageOne filled", () => {
    const { container } = render(
      <AnalyzerOverview result={result} verdict={verdict} profileNotConfirmed={false} fullAnalysisHref="/analyzer/x/report" />
    );
    const ids = Array.from(container.querySelectorAll("main > .ovslot")).map((el) => el.id);
    expect(ids).toEqual([
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
    ]);
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
    const { container } = render(
      <AnalyzerOverview
        result={withChallenger}
        verdict={verdict}
        profileNotConfirmed={false}
        fullAnalysisHref="/analyzer/x/report"
      />
    );
    expect(container.querySelector("#slot-7")!.textContent).toContain(
      "The margin expansion assumed in the base case has no precedent in the company's own history."
    );
  });

  it("slot 7 surfaces nothing challenger-related when the challenger call has not completed", () => {
    const { container } = render(
      <AnalyzerOverview result={result} verdict={verdict} profileNotConfirmed={false} fullAnalysisHref="/analyzer/x/report" />
    );
    expect(container.querySelector("#slot-7")!.textContent).not.toMatch(/Challenger point/);
  });
});
