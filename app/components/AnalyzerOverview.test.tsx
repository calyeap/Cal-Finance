// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { AnalyzerOverview } from "./AnalyzerOverview";
import { assembleAnalysisResult } from "@/lib/analyzer/assemble";
import { MSFT_FIXTURE } from "@/lib/analyzer/fixtures/msft";
import { deriveVerdict } from "@/lib/analyzer/verdict";

afterEach(cleanup);

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

  it("slots 5-11 are present, never absent, and carry no invented editorial content", () => {
    const { container } = render(
      <AnalyzerOverview result={result} verdict={verdict} profileNotConfirmed={false} fullAnalysisHref="/analyzer/x/report" />
    );
    for (const id of ["slot-5", "slot-6", "slot-7", "slot-8", "slot-9", "slot-10", "slot-11"]) {
      const slot = container.querySelector(`#${id}`);
      expect(slot).not.toBeNull();
      expect(slot!.textContent).toMatch(/Not yet available/);
    }
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
