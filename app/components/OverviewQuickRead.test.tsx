// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { OverviewQuickRead, QuickRead } from "./QuickRead";
import { AnalyzerOverview } from "./AnalyzerOverview";
import { assembleAnalysisResult } from "@/lib/analyzer/assemble";
import { MSFT_FIXTURE } from "@/lib/analyzer/fixtures/msft";
import { overviewTextViolations } from "@/lib/analyzer/overviewCopy";
import { overviewTabText } from "@/app/components/overviewTabMarkup";
import type { ReportAnalysis } from "@/lib/analyzer/reportAnalysis";
import type { AnalysisResult, InterpretationStatement, PageOneProse } from "@/lib/analyzer/types";

afterEach(cleanup);

// CF-AR1-QUICK-READ-OVERVIEW-01 — DO item 1 ("render the existing Quick
// Read content in the Overview body ... no duplicate verdict card") and DO
// item 3 ("plain-language copy ... for every state Overview can show today
// — no raw state codes"). MSFT's real fixture is the regression case: its
// reverse-DCF grid has a DEGENERATE cell and its states.suppressing carries
// PRECONDITION FAILED / INCOMPLETE entries, so Quick Read's own
// (pre-AR1) raw-code rendering — `<b>DEGENERATE — TERMINAL EXCEEDS TOTAL
// VALUE</b>`, `<b>{state}</b>` per suppressing state — is genuinely
// exercised here, not just a hypothetical branch.
//
// RED on the base (pre-AR1): the Overview tab body did not render Quick
// Read at all, so "Quick read" / its item labels were absent from the
// rendered Overview.
function reportFor(result: AnalysisResult): ReportAnalysis {
  return { result, aiLayer: { status: "NOT CONFIGURED", model: null, detail: null } };
}

// Same minimal completion briefAcceptance.test.ts's own `complete()` applies
// to the bare assembled fixture — a business narrative, so slot 5 does not
// fall into its own unrelated "Not yet available" fallback (not a state
// this outcome changes; only present so the regression check below isolates
// Quick Read's own raw-code fix, not that pre-existing, unrelated gap).
function statement(text: string): InterpretationStatement {
  return { responsibility: "ASSUMPTION PLAUSIBILITY AND WHAT THE PRICE REQUIRES", statement: text, referencesValueIds: [] };
}

const PAGE_ONE: PageOneProse = {
  mainFinding: statement("The price requires sustained high growth alongside a margin held at the top of its own history."),
  whatSupportsTheCase: statement("Filed history is long, the debt load is low and margins have been stable."),
  whatWorriesCalboard: statement("Most of the enterprise value rests on growth opportunities rather than today's cash flow."),
  biggestUncertainty: statement("The discount rate, which moves the required growth more than any other input."),
};

function withBusinessNarrativeAndPageOne(result: AnalysisResult): AnalysisResult {
  return {
    ...result,
    business: {
      narrative: {
        source: "MARKET-DATA PROVIDER SUMMARY",
        text: "Microsoft Corporation develops and supports software, services, devices and solutions worldwide.",
        provider: "YAHOO",
        retrievedAt: "2026-10-07T03:30:00.000Z",
        primaryUnavailableReason:
          'The Item 1 extraction rule could not locate the section in the filing: no standalone "Item 1. Business" heading line was found.',
      },
      unavailableReason: null,
    },
    latestFiling: { form: "8-K", filingDate: "2026-08-14" },
    interpretation: { ...result.interpretation, pageOne: PAGE_ONE },
  };
}

describe("Quick Read on the Overview tab (CF-AR1-QUICK-READ-OVERVIEW-01)", () => {
  const result = assembleAnalysisResult(MSFT_FIXTURE);

  it("Quick Read's own items render inside the Overview tab body", () => {
    const { container } = render(<AnalyzerOverview result={result} />);
    const slot = container.querySelector("#slot-quickread");
    expect(slot).not.toBeNull();
    expect(slot!.textContent).toContain("Quick read");
    // Every one of Quick Read's eight item labels (§17.16), present on Overview too.
    for (const label of [
      "Main finding",
      "Price vs scenarios",
      "What today's price requires",
      "What supports the case",
      "What worries Calboard",
      "Biggest uncertainty",
      "Strongest challenger point",
      "Data and model quality",
    ]) {
      expect(slot!.textContent).toContain(label);
    }
  });

  it("does not duplicate the hero's verdict card (bear/base/bull/current-price grid) inside the Quick Read slot", () => {
    const { container } = render(<AnalyzerOverview result={result} />);
    const slot = container.querySelector("#slot-quickread")!;
    expect(slot.querySelector(".atglance")).toBeNull();
  });

  it("the rendered Overview carries no raw state code — regression for MSFT's own DEGENERATE/suppressing-state branches", () => {
    const report = reportFor(withBusinessNarrativeAndPageOne(result));
    const overviewText = overviewTabText("run-under-test", report);
    expect(overviewText).toContain("Quick read");
    expect(overviewTextViolations(overviewText)).toEqual([]);
  });

  it("the Evidence tab's own QuickRead keeps its verbatim raw state codes and Section cross-references — unchanged by this outcome", () => {
    // CF-AR4-RATE-REINVESTMENT-TERMINAL-01: MSFT_FIXTURE's reverse DCF is now
    // one solve that returns INCOMPLETE (its sheet is pending adoption), not
    // four DEGENERATE grid cells — so the verbatim raw code checked is that.
    const { container } = render(<QuickRead result={result} />);
    expect(container.textContent).toContain("INCOMPLETE");
    expect(container.querySelector("a[href='#E']")).not.toBeNull();
  });

  it("the Overview variant drops the Evidence-only Section cross-references (no dead anchor into a page that does not exist on this tab)", () => {
    const { container } = render(<OverviewQuickRead result={result} />);
    expect(container.querySelector("a[href^='#']")).toBeNull();
  });
});
