// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import Decimal from "decimal.js";
import { AnalyzerRightRail } from "./AnalyzerRightRail";
import { assembleAnalysisResult, type CompanyFixture } from "@/lib/analyzer/assemble";
import { MSFT_FIXTURE } from "@/lib/analyzer/fixtures/msft";

afterEach(cleanup);

// CF-ANALYZER-INTEGRITY-FIRST-01 — `gates.leverage.netDebtRatio` (gates.ts)
// is a signed total-debt-plus-finance-leases-minus-cash ratio, but the Key
// Stats rail's "Leverage" row always printed "Net debt" even when the sign
// meant the company holds more cash than debt. These fixtures move only
// `cashAndMarketableDebtSecurities` — never a threshold, formula or any
// other leverage input — to walk the ratio through negative, positive and
// exactly zero while it stays PASS throughout.

function withCash(cash: string): CompanyFixture {
  return {
    ...MSFT_FIXTURE,
    leverage: { ...MSFT_FIXTURE.leverage, cashAndMarketableDebtSecurities: new Decimal(cash) },
  };
}

/** Same construction ScenarioRangeStrip.test.tsx uses for the UNUSABLE case. */
function leveredMsft(): CompanyFixture {
  return {
    ...MSFT_FIXTURE,
    leverage: { ...MSFT_FIXTURE.leverage, totalDebt: new Decimal(1200) },
  };
}

describe("AnalyzerRightRail — Key Stats leverage row (net debt vs net cash)", () => {
  it("shows truthful 'Net cash', with a positive magnitude, when the ratio is negative", () => {
    const result = assembleAnalysisResult(withCash("300"));
    expect(result.gates.leverage.result).toBe("PASS");
    const ratio = result.gates.leverage.netDebtRatio!;
    expect(ratio.isNegative()).toBe(true);

    render(<AnalyzerRightRail result={result} />);
    const expectedPct = `${ratio.abs().mul(100).toFixed(1)}%`;
    expect(screen.getByText(`Net cash ${expectedPct}`)).not.toBeNull();
    expect(screen.queryByText(/Net debt/)).toBeNull();
  });

  it("shows 'Net debt' with a positive magnitude when the ratio is positive", () => {
    const result = assembleAnalysisResult(MSFT_FIXTURE);
    expect(result.gates.leverage.result).toBe("PASS");
    const ratio = result.gates.leverage.netDebtRatio!;
    expect(ratio.isPositive()).toBe(true);

    render(<AnalyzerRightRail result={result} />);
    const expectedPct = `${ratio.mul(100).toFixed(1)}%`;
    expect(screen.getByText(`Net debt ${expectedPct}`)).not.toBeNull();
    expect(screen.queryByText(/Net cash/)).toBeNull();
  });

  it("shows a clear neutral description, never a signed label, when the ratio is exactly zero", () => {
    const result = assembleAnalysisResult(withCash("111.6"));
    expect(result.gates.leverage.result).toBe("PASS");
    expect(result.gates.leverage.netDebtRatio!.isZero()).toBe(true);

    render(<AnalyzerRightRail result={result} />);
    expect(screen.getByText("No net debt or net cash (0%)")).not.toBeNull();
    expect(screen.queryByText(/Net debt/)).toBeNull();
    expect(screen.queryByText(/Net cash/)).toBeNull();
  });

  it("stays an honest unavailable line, never a fabricated sign, when leverage does not PASS", () => {
    const result = assembleAnalysisResult(leveredMsft());
    expect(result.gates.leverage.result).not.toBe("PASS");

    render(<AnalyzerRightRail result={result} />);
    expect(screen.queryByText(/Net debt/)).toBeNull();
    expect(screen.queryByText(/Net cash/)).toBeNull();
    expect(screen.queryByText("No net debt or net cash (0%)")).toBeNull();
  });
});
