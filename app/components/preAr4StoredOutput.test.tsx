// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AnalyzerReport } from "./AnalyzerReport";
import { AnalyzerReportFrame } from "./AnalyzerReportFrame";
import { QuickReadGrid } from "./ReportContent";
import { QuickRead } from "./QuickRead";
import { overviewTabText } from "./overviewTabMarkup";
import { fromStorable } from "@/lib/analyzer/storable";
import { deriveVerdict } from "@/lib/analyzer/verdict";
import { profileNotConfirmedFor } from "@/lib/analyzer/trust";
import { buildSlotCatalogue } from "@/lib/analyzer/ai/slots";
import { checkBriefAcceptance, ACCEPTANCE_POLICY } from "@/lib/analyzer/acceptance/briefAcceptance";
import type { AnalysisResult } from "@/lib/analyzer/types";
import type { ReportAnalysis } from "@/lib/analyzer/reportAnalysis";

// ---------------------------------------------------------------------------
// CF-LEG2-PREAR4-REPORT-CRASH-01 (#477) — a run output stored before AR4 is
// read back exactly as stored (a saved version's snapshot page; a run's
// stored output via reportAnalysis.ts storedRunOutput), never recomputed.
//
// The fixture is a real pre-AR4 stored shape, not a hand-edited one:
// assembleAnalysisResult(MSFT_FIXTURE) run at c963bcd (AR4's parent,
// 45e7890^) and written through that commit's own toStorable. Its RONIC
// ladder cells carry `rate` as a plain number (0.08/0.10/0.12, the retired
// grid) and its priceImplied carries no reverseDcf solve.
// ---------------------------------------------------------------------------

afterEach(cleanup);

function storedPreAr4(): AnalysisResult {
  const raw = readFileSync(join(__dirname, "../../lib/analyzer/fixtures/stored/msftPreAr4.json"), "utf8");
  return fromStorable(JSON.parse(raw)) as AnalysisResult;
}

function reportFor(result: AnalysisResult): ReportAnalysis {
  return { result, aiLayer: { status: "NOT CONFIGURED", model: null, detail: null } };
}

describe("a pre-AR4 stored output", () => {
  it("is the old shape this regression is about", () => {
    const result = storedPreAr4();
    const cells = result.diagnostics.reinvestmentRonic.ronic.suppressed ? [] : result.diagnostics.reinvestmentRonic.ronic.value.cells;
    expect(cells.map((c) => c.rate as unknown)).toEqual([0.08, 0.1, 0.12]);
    expect(result.priceImplied.reverseDcf).toBeUndefined();
  });

  it("renders through AnalyzerReport, showing the ladder rates it was stored with", () => {
    const { container } = render(<AnalyzerReport result={storedPreAr4()} />);
    expect(container.textContent).toMatch(/r=8\.0%: value-creating growth/);
    expect(container.textContent).toMatch(/r=10\.0%: value-creating growth/);
    expect(container.textContent).toMatch(/r=12\.0%: value-creating growth/);
  });

  it("renders through AnalyzerReportFrame, the Overview Quick Read and QuickRead", () => {
    const result = storedPreAr4();
    render(
      <AnalyzerReportFrame
        runId="run-pre-ar4"
        result={result}
        verdict={deriveVerdict(result)}
        profileNotConfirmed={profileNotConfirmedFor(result)}
        activeTab="overview"
      >
        <QuickReadGrid runId="run-pre-ar4" result={result} verdict={deriveVerdict(result)} sheet={null} />
      </AnalyzerReportFrame>
    );
    render(<QuickRead result={result} />);
  });

  it("derives an INCOMPLETE verdict rather than issuing one", () => {
    expect(deriveVerdict(storedPreAr4()).status).toBe("INCOMPLETE");
  });

  it("builds the AI slot catalogue without offering a reverse-DCF slot it never computed", () => {
    const catalogue = buildSlotCatalogue(storedPreAr4());
    expect([...catalogue.keys()].some((id) => id.startsWith("priceImplied.reverseDcf"))).toBe(false);
  });

  it("fails the brief-acceptance price section closed (MISSING) rather than crashing", () => {
    const report = reportFor(storedPreAr4());
    const acceptance = checkBriefAcceptance({
      ticker: "MSFT",
      policy: ACCEPTANCE_POLICY.MSFT,
      report,
      overviewText: overviewTabText("run-pre-ar4", report),
    });
    const section8 = acceptance.sections.find((s) => s.id === 8)!;
    expect(section8.status).toBe("MISSING");
    expect(section8.detail).toMatch(/stored before AR4/);
  });
});
