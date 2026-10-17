// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ValuationSections } from "./AnalyzerReport";
import { assembleAnalysisResult } from "@/lib/analyzer/assemble";
import { MSFT_FIXTURE } from "@/lib/analyzer/fixtures/msft";
import { withStatedD2Inputs } from "@/lib/analyzer/fixtures/statedD2Inputs";
import type { AnalysisResult } from "@/lib/analyzer/types";

afterEach(cleanup);

// CF-AR3-REPRODUCIBLE-RUNS-01 — Section G reports the terminal share of the
// base scenario's DCF every time, and the dates every DCF figure is valued on.

function rowText(container: HTMLElement, heading: string): string | null {
  const row = Array.from(container.querySelectorAll("#G tr")).find((tr) =>
    (tr.querySelector("th")?.textContent ?? "").startsWith(heading)
  );
  return row === undefined ? null : (row.querySelector("td")?.textContent ?? "");
}

describe("Section G — terminal share and valuation dates", () => {
  // STATED D2 test inputs (CF-AR4-RATE-REINVESTMENT-TERMINAL-01): the base
  // DCF the terminal share comes from needs an adopted sheet.
  const dated = assembleAnalysisResult({ ...withStatedD2Inputs(MSFT_FIXTURE), valuationBase: { periodEnd: "2026-06-30", kind: "TTM" } });

  it("shows the computed terminal share as a percentage", () => {
    const { container } = render(<ValuationSections result={dated} />);
    const expected = `${dated.diagnostics.terminal.terminalShareOfValue.mul(100).toFixed(0)}%`;
    expect(rowText(container, "Terminal share of value")).toBe(expected);
  });

  it("dates the valuation: the price date and the TTM base period it rolls forward from", () => {
    const { container } = render(<ValuationSections result={dated} />);
    const text = rowText(container, "Valued at");
    expect(text).toContain("price date 2026-09-04");
    expect(text).toContain("trailing twelve months ending 2026-06-30");
  });

  it("shows the bound state, never a number, where the terminal share could not be computed", () => {
    const undriven = assembleAnalysisResult({
      ...MSFT_FIXTURE,
      scenarios: { ...MSFT_FIXTURE.scenarios, base: { ...MSFT_FIXTURE.scenarios.base, operatingMargin: null } },
    });
    const { container } = render(<ValuationSections result={undriven} />);
    const text = rowText(container, "Terminal share of value");
    expect(text).toContain("INCOMPLETE");
    expect(text).not.toMatch(/\d%/);
  });

  it("renders neither row for a result stored before AR3 (no runIdentity; its terminal share was a placeholder)", () => {
    const legacy: AnalysisResult = { ...dated, runIdentity: undefined };
    const { container } = render(<ValuationSections result={legacy} />);
    expect(rowText(container, "Terminal share of value")).toBeNull();
    expect(rowText(container, "Valued at")).toBeNull();
  });
});
