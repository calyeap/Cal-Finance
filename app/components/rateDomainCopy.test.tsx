// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import Decimal from "decimal.js";
import { AnalyzerReport } from "./AnalyzerReport";
import { AnalyzerReportFrame } from "./AnalyzerReportFrame";
import { AnalyzerOverview } from "./AnalyzerOverview";
import { assembleAnalysisResult, type CompanyFixture } from "@/lib/analyzer/assemble";
import { MSFT_FIXTURE } from "@/lib/analyzer/fixtures/msft";
import { rateInUseLine } from "@/lib/analyzer/trustCopy";
import { deriveVerdict } from "@/lib/analyzer/verdict";
import { profileNotConfirmedFor } from "@/lib/analyzer/trust";
import { toStorable, fromStorable } from "@/lib/analyzer/storable";
import type { AnalysisResult } from "@/lib/analyzer/types";

// ---------------------------------------------------------------------------
// CF-LEG2-RATE-DOMAIN-COPY-01 (#479) — the discount-rate domain statement is
// true in every leverage state.
//
// D1 is valid only inside §6.5's net-debt gate (net debt < 10% of EV). The
// gate has three states, not two: measured below 10% (PASS), measured at or
// above it, and not measured at all (a REQUIRED input missing, so
// `netDebtRatio` is null and the run fails closed to LEVERAGE UNSUPPORTED).
// Before this fix the third state printed the second state's sentence —
// "net debt is not below 10% of enterprise value" — about a company whose
// net debt was never measured (NVDA's real gated run: unmeasured, net cash).
// ---------------------------------------------------------------------------

afterEach(cleanup);

const MEASURED_SENTENCE = "Outside its validated domain: net debt is not below 10% of enterprise value.";
const NOT_BELOW_10 = /net debt is not below 10%/;
const UNKNOWN = /net debt could not be measured, so whether this rate is within its validated domain .* is unknown/i;
const ANY_DOMAIN_SENTENCE = /validated domain/i;

/** MSFT as filed: net debt measured, below 10% of EV — PASS. */
function passing(): AnalysisResult {
  return assembleAnalysisResult(MSFT_FIXTURE);
}

/** MSFT levered past §6.5's threshold: measured, at or above 10%. */
function measuredAbove(): AnalysisResult {
  const fixture: CompanyFixture = {
    ...MSFT_FIXTURE,
    leverage: { ...MSFT_FIXTURE.leverage, totalDebt: new Decimal(1200) },
  };
  return assembleAnalysisResult(fixture);
}

/** MSFT with a REQUIRED leverage input missing: net debt not measured. */
function unmeasured(): AnalysisResult {
  const fixture: CompanyFixture = {
    ...MSFT_FIXTURE,
    leverage: { ...MSFT_FIXTURE.leverage, totalDebt: null },
  };
  return assembleAnalysisResult(fixture);
}

function reportText(result: AnalysisResult): string {
  const { container } = render(<AnalyzerReport result={result} />);
  return container.textContent ?? "";
}

function frameText(result: AnalysisResult): string {
  const { container } = render(
    <AnalyzerReportFrame
      runId="run-rate-domain"
      result={result}
      verdict={deriveVerdict(result)}
      profileNotConfirmed={profileNotConfirmedFor(result)}
      activeTab="overview"
    >
      <AnalyzerOverview result={result} />
    </AnalyzerReportFrame>
  );
  return container.textContent ?? "";
}

function trustLine(result: AnalysisResult): string {
  return rateInUseLine(result.valuationBasis, result.gates.leverage) ?? "";
}

describe("the three leverage states are the ones this test is about", () => {
  it("PASS: measured below 10%", () => {
    const l = passing().gates.leverage;
    expect(l.result).toBe("PASS");
    expect(l.netDebtRatio).not.toBeNull();
  });

  it("measured at or above 10%", () => {
    const l = measuredAbove().gates.leverage;
    expect(l.result).toBe("LEVERAGE UNSUPPORTED IN v1");
    expect(l.netDebtRatio!.greaterThanOrEqualTo("0.10")).toBe(true);
  });

  it("not measured", () => {
    const l = unmeasured().gates.leverage;
    expect(l.result).toBe("LEVERAGE UNSUPPORTED IN v1");
    expect(l.netDebtRatio).toBeNull();
  });
});

describe("RED — a run whose leverage was never measured", () => {
  it("the trust copy does not say net debt is not below 10%; it says the domain is unknown", () => {
    const line = trustLine(unmeasured());
    expect(line).not.toMatch(NOT_BELOW_10);
    expect(line).toMatch(UNKNOWN);
  });

  it("the report (Section E) does not say net debt is not below 10%; it says the domain is unknown", () => {
    const text = reportText(unmeasured());
    expect(text).not.toMatch(NOT_BELOW_10);
    expect(text).toMatch(UNKNOWN);
  });

});

describe("each leverage state gets its own true sentence", () => {
  it("PASS shows no domain sentence — trust copy, report and hero", () => {
    const result = passing();
    expect(trustLine(result)).not.toMatch(ANY_DOMAIN_SENTENCE);
    expect(reportText(result)).not.toMatch(ANY_DOMAIN_SENTENCE);
    expect(frameText(result)).not.toMatch(ANY_DOMAIN_SENTENCE);
  });

  it("measured at or above 10% keeps today's sentence — trust copy, report and hero", () => {
    const result = measuredAbove();
    expect(trustLine(result)).toContain(MEASURED_SENTENCE);
    expect(trustLine(result)).not.toMatch(UNKNOWN);
    expect(reportText(result)).toContain(MEASURED_SENTENCE);
    expect(reportText(result)).not.toMatch(UNKNOWN);
  });

  it("not measured shows the unknown-domain sentence only — trust copy, report and hero", () => {
    const result = unmeasured();
    expect(trustLine(result)).not.toContain(MEASURED_SENTENCE);
    expect(reportText(result)).not.toContain(MEASURED_SENTENCE);
  });

  // The hero names the rate only beside a rate-derived reading (a fair-value
  // range or a completed verdict), which a run outside PASS does not have —
  // so on the two non-PASS states it carries no domain sentence at all.
  it("the verdict hero never states a domain sentence the run's leverage does not support", () => {
    expect(frameText(unmeasured())).not.toMatch(NOT_BELOW_10);
    expect(frameText(measuredAbove())).not.toMatch(UNKNOWN);
  });

  it("the rate itself is unchanged by the leverage state (no number moves)", () => {
    const rates = [passing(), measuredAbove(), unmeasured()].map((r) => r.valuationBasis!.discountRate.rate.toString());
    expect(new Set(rates).size).toBe(1);
  });
});

// A result stored between AR4 and this fix carries only the old boolean,
// `withinValidatedDomain`, which was false for both "measured at or above
// 10%" and "not measured". Read back exactly as stored, it is resolved from
// the same run's own leverage result — the value that boolean was set from —
// never from the boolean alone.
describe("a result stored before this fix (boolean domain only)", () => {
  function storedWithOldBoolean(result: AnalysisResult): AnalysisResult {
    const stored = toStorable(result) as { valuationBasis: { discountRate: Record<string, unknown> } };
    delete stored.valuationBasis.discountRate.validatedDomain;
    stored.valuationBasis.discountRate.withinValidatedDomain = result.gates.leverage.result === "PASS";
    return fromStorable(stored) as AnalysisResult;
  }

  it("not measured: the unknown-domain sentence, not the measured one", () => {
    const result = storedWithOldBoolean(unmeasured());
    expect(trustLine(result)).toMatch(UNKNOWN);
    expect(trustLine(result)).not.toMatch(NOT_BELOW_10);
    expect(reportText(result)).toMatch(UNKNOWN);
    expect(reportText(result)).not.toMatch(NOT_BELOW_10);
  });

  it("measured at or above 10%: today's sentence", () => {
    const result = storedWithOldBoolean(measuredAbove());
    expect(trustLine(result)).toContain(MEASURED_SENTENCE);
    expect(reportText(result)).toContain(MEASURED_SENTENCE);
  });

  it("PASS: no sentence", () => {
    const result = storedWithOldBoolean(passing());
    expect(trustLine(result)).not.toMatch(ANY_DOMAIN_SENTENCE);
    expect(reportText(result)).not.toMatch(ANY_DOMAIN_SENTENCE);
  });
});
