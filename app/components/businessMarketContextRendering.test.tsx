// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { AnalyzerReport } from "./AnalyzerReport";
import { assembleAnalysisResult } from "@/lib/analyzer/assemble";
import { MSFT_FIXTURE } from "@/lib/analyzer/fixtures/msft";
import type { AnalysisResult } from "@/lib/analyzer/types";

afterEach(cleanup);

// M9-ITEM5-CONTENT-01 SCOPE item 5 — the Business section rendering with and
// without available narrative, Market Context rendering with and without a
// classification, and the provenance/authorship limits actually holding.
// Every case is a spread of a real assembled result, matching how the other
// AnalyzerReport render tests already build their fixtures (§10.0.2 rule 3:
// nothing here is a figure the renderer invented).
//
// Business and Market Context are flat theme-anchored siblings, not
// <section> elements (AnalyzerReport.tsx's own layout) — this walks the DOM
// siblings between one theme heading and the next so each assertion below is
// scoped to the section under test, not the whole report (which legitimately
// carries words like "EXPENSIVE" elsewhere, in the valuation position).
function sectionText(headingId: string, nextHeadingId: string): string {
  let node: Element | null = document.getElementById(headingId)!;
  let text = "";
  while (node && node.id !== nextHeadingId) {
    text += node.textContent ?? "";
    node = node.nextElementSibling;
  }
  return text;
}

const base = assembleAnalysisResult(MSFT_FIXTURE);

describe("Business section", () => {
  it("renders 'not yet available' with the stated reason when no narrative was acquired", () => {
    const result: AnalysisResult = {
      ...base,
      business: { narrative: null, unavailableReason: "No 10-K filing appears in this company's recent SEC submissions." },
    };
    render(<AnalyzerReport result={result} />);
    const text = sectionText("business", "financials");
    expect(text).toContain("Not yet available");
    expect(text).toContain("No 10-K filing appears in this company's recent SEC submissions.");
  });

  it("renders the acquired narrative verbatim, with provenance naming the source, filing and rule version", () => {
    const narrativeText =
      "We design, develop and sell a wide range of software, services, devices and solutions.";
    const result: AnalysisResult = {
      ...base,
      business: {
        narrative: {
          text: narrativeText,
          ruleVersion: "item1-2026-09-1",
          filingForm: "10-K",
          filingDate: "2026-07-30",
          accessionNumber: "0000320193-26-000106",
        },
        unavailableReason: null,
      },
    };
    render(<AnalyzerReport result={result} />);
    // Rendered exactly as given — no fact, ranking or portfolio-action
    // language added to it (spec.md §8.3 limits, EditorialProseBlock role).
    expect(screen.getByText(narrativeText)).not.toBeNull();

    const text = sectionText("business", "financials");
    expect(text).not.toContain("Not yet available");
    expect(text).toContain("10-K Item 1");
    expect(text).toContain("2026-07-30");
    expect(text).toContain("0000320193-26-000106");
    expect(text).toContain("item1-2026-09-1");
  });

  it("never introduces a verdict, target or recommendation word the acquired narrative did not itself contain (§8.3 limit 1)", () => {
    const narrativeText = "We manufacture and sell industrial equipment to commercial customers worldwide.";
    const result: AnalysisResult = {
      ...base,
      business: {
        narrative: {
          text: narrativeText,
          ruleVersion: "item1-2026-09-1",
          filingForm: "10-K",
          filingDate: "2026-01-01",
          accessionNumber: "0000000000-26-000000",
        },
        unavailableReason: null,
      },
    };
    render(<AnalyzerReport result={result} />);
    const text = sectionText("business", "financials");
    for (const forbidden of ["BUY", "SELL", "HOLD", "recommend", "overvalued", "undervalued", "CHEAP", "EXPENSIVE"]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe("Market Context section", () => {
  it("renders 'not yet available' when no SIC classification was acquired", () => {
    const result: AnalysisResult = {
      ...base,
      marketContext: { sic: null, sicDescription: null },
    };
    render(<AnalyzerReport result={result} />);
    const text = sectionText("market-context", "evidence");
    expect(text).toContain("Not yet available");
  });

  it("renders the acquired SIC classification as category framing, with an explicit no-peer-comparison disclaimer", () => {
    const result: AnalysisResult = {
      ...base,
      marketContext: { sic: "7372", sicDescription: "Services-Prepackaged Software" },
    };
    render(<AnalyzerReport result={result} />);
    const text = sectionText("market-context", "evidence");
    expect(text).toContain("7372");
    expect(text).toContain("Services-Prepackaged Software");
    // §2.2's "scoped down to what the existing facts support" rule — the
    // section's own copy must say plainly this is not a peer comparison.
    expect(text).toMatch(/not a peer/i);
    expect(text).not.toMatch(/Not yet available/);
  });

  it("never renders a peer, index or sector-average figure — the section has no source for one", () => {
    const result: AnalysisResult = {
      ...base,
      marketContext: { sic: "4911", sicDescription: "Electric Services" },
    };
    render(<AnalyzerReport result={result} />);
    const text = sectionText("market-context", "evidence").toLowerCase();
    for (const forbidden of ["peer average", "sector average", "index return", "vs. peers"]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
