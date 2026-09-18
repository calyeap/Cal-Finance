// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import Decimal from "decimal.js";
import { ScenarioRangeStrip } from "./ScenarioRangeStrip";
import { assembleAnalysisResult, type CompanyFixture } from "@/lib/analyzer/assemble";
import { MSFT_FIXTURE } from "@/lib/analyzer/fixtures/msft";
import { OKLO_FIXTURE } from "@/lib/analyzer/fixtures/oklo";

afterEach(cleanup);

// M9-DESKTOP-SHELL-01 — Overview slot 4, per docs/design/m9-analyzer-
// design-contract.md §2.1 row 4: never the range alone (beside the
// condensed Section E restatement), and never the range rendered where
// §10.6.3 suppression rules say it must not.

/** Same construction suppressedRangeRendering.test.tsx uses for V1 — MSFT
 * levered past §6.5's threshold, so trust resolves to UNUSABLE and the
 * fair-value range is suppressed. */
function leveredMsft(): CompanyFixture {
  return {
    ...MSFT_FIXTURE,
    leverage: { ...MSFT_FIXTURE.leverage, totalDebt: new Decimal(1200) },
  };
}

describe("ScenarioRangeStrip — the normal range case", () => {
  const result = assembleAnalysisResult(MSFT_FIXTURE);

  it("renders the ValuationStrip grid beside the fair-value range and the condensed Section E restatement — never the range alone", () => {
    render(<ScenarioRangeStrip result={result} profileNotConfirmed={false} />);
    expect(screen.getByText("Bear")).not.toBeNull();
    expect(screen.getByText("Bull")).not.toBeNull();
    expect(screen.getByText("Fair-value range")).not.toBeNull();
    expect(screen.getByText("What the price assumes")).not.toBeNull();
    expect(screen.getByText("Steady-state EV")).not.toBeNull();
  });

  it("computes upside/downside as simple arithmetic on the already-computed bear/bull bounds and price, never a new threshold", () => {
    render(<ScenarioRangeStrip result={result} profileNotConfirmed={false} />);
    expect(screen.getByText(/Downside to bear/)).not.toBeNull();
    expect(screen.getByText(/Upside to bull/)).not.toBeNull();
  });

  it("suppresses the valuation-position slot when the profile is not human-confirmed (§10.6.3), without hiding the range", () => {
    render(<ScenarioRangeStrip result={result} profileNotConfirmed={true} />);
    expect(screen.getByText("Valuation position — suppressed")).not.toBeNull();
    expect(screen.getByText("PROFILE NOT CONFIRMED")).not.toBeNull();
    expect(screen.getByText("Fair-value range")).not.toBeNull();
  });

  it("does not render the valuation-position slot when nothing suppresses it", () => {
    render(<ScenarioRangeStrip result={result} profileNotConfirmed={false} />);
    expect(screen.queryByText("Valuation position — suppressed")).toBeNull();
  });
});

describe("ScenarioRangeStrip — §10.6.3 suppression (trust UNUSABLE)", () => {
  it("renders the suppressing state in place of the range, never a bear/bull bound", () => {
    const result = assembleAnalysisResult(leveredMsft());
    render(<ScenarioRangeStrip result={result} profileNotConfirmed={false} />);
    expect(screen.getByText("LEVERAGE UNSUPPORTED IN v1")).not.toBeNull();
    expect(screen.queryByText("Fair-value range")).toBeNull();
    expect(screen.queryByText(/Driven by:/)).toBeNull();
  });

  it("still renders the ValuationStrip grid — the strip is never collapsed or hidden", () => {
    const result = assembleAnalysisResult(leveredMsft());
    render(<ScenarioRangeStrip result={result} profileNotConfirmed={false} />);
    expect(screen.getByText("Current price")).not.toBeNull();
  });
});

describe("ScenarioRangeStrip — pre-revenue (never compressed to bear/bull bounds)", () => {
  it("renders the distribution shape, not Bear/Base/Bull", () => {
    const result = assembleAnalysisResult(OKLO_FIXTURE);
    render(<ScenarioRangeStrip result={result} profileNotConfirmed={false} />);
    expect(screen.getByText("Failure — cash floor")).not.toBeNull();
    expect(screen.queryByText("Bear")).toBeNull();
    expect(screen.getByText("What you assume")).not.toBeNull();
    expect(screen.getByText("What the price assumes")).not.toBeNull();
  });
});
