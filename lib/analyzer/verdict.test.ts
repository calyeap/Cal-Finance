import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { deriveVerdict } from "./verdict";
import { assembleAnalysisResult } from "./assemble";
import { MSFT_FIXTURE } from "./fixtures/msft";
import { OKLO_FIXTURE } from "./fixtures/oklo";
import type { AnalysisResult } from "./types";

// ---------------------------------------------------------------------------
// CF-V2-PROOF-01's verdict boundary. deriveVerdict is a pure function of an
// already-assembled AnalysisResult, so these tests build one real result
// (assembleAnalysisResult never touches the database) and override only the
// members each case is actually about — the same style trust.test.ts uses.
// ---------------------------------------------------------------------------

function withRange(
  result: AnalysisResult,
  range: Extract<AnalysisResult["fairValueRange"], { kind: "range" }>,
  price: Decimal
): AnalysisResult {
  return {
    ...result,
    price: { ...result.price, value: price },
    fairValueRange: range,
    trust: { status: "PARTIAL", determinedBy: [{ kind: "qualifying flag", detail: "irrelevant to this case" }] },
  };
}

function baseRange(): Extract<AnalysisResult["fairValueRange"], { kind: "range" }> {
  return {
    kind: "range",
    bear: new Decimal(265),
    bull: new Decimal(650),
    weightedValueInside: new Decimal(475),
    drivingInputs: ["years 1-5 revenue growth", "operating margin path", "reinvestment as % of NOPAT"],
    scenarioLabelsWarning: false,
  };
}

describe("deriveVerdict", () => {
  it("is BUY when price is at or below the bear-case value", () => {
    const result = assembleAnalysisResult(MSFT_FIXTURE);
    const verdict = deriveVerdict(withRange(result, baseRange(), new Decimal(265)));

    expect(verdict.status).toBe("BUY");
    expect(verdict.reason).toContain("265.00");
  });

  it("is BUY below the bear-case value too, not only exactly at it", () => {
    const result = assembleAnalysisResult(MSFT_FIXTURE);
    const verdict = deriveVerdict(withRange(result, baseRange(), new Decimal(100)));

    expect(verdict.status).toBe("BUY");
  });

  it("is SELL when price is at or above the bull-case value", () => {
    const result = assembleAnalysisResult(MSFT_FIXTURE);
    const verdict = deriveVerdict(withRange(result, baseRange(), new Decimal(650)));

    expect(verdict.status).toBe("SELL");
    expect(verdict.reason).toContain("650.00");
  });

  it("is HOLD strictly between bear and bull", () => {
    const result = assembleAnalysisResult(MSFT_FIXTURE);
    const verdict = deriveVerdict(withRange(result, baseRange(), new Decimal(499.7)));

    expect(verdict.status).toBe("HOLD");
    expect(verdict.reason).toContain("265.00");
    expect(verdict.reason).toContain("650.00");
  });

  it("does not require TrustStatus CLEAN — PARTIAL with a usable range still gets a verdict", () => {
    // §9.6 rule 2's causes (a qualifying flag, an unrelated INCOMPLETE
    // diagnostic, ...) are not about whether the range itself is usable.
    // Requiring CLEAN here would make the verdict unreachable on real runs
    // (M8-c: no acquired run in this codebase reaches CLEAN today).
    const result = assembleAnalysisResult(MSFT_FIXTURE);
    const verdict = deriveVerdict(withRange(result, baseRange(), new Decimal(499.7)));

    expect(result.trust.status).toBe("PARTIAL");
    expect(verdict.status).not.toBe("INCOMPLETE");
  });

  it("is INCOMPLETE, with no manufactured verdict, when TrustStatus is UNUSABLE", () => {
    const result = assembleAnalysisResult(MSFT_FIXTURE);
    const unusable: AnalysisResult = {
      ...result,
      trust: {
        status: "UNUSABLE",
        determinedBy: [{ kind: "suppressing state", detail: "LEVERAGE UNSUPPORTED IN v1" }],
      },
      fairValueRange: { kind: "suppressed", state: "LEVERAGE UNSUPPORTED IN v1", cause: "inputs missing" },
    };

    const verdict = deriveVerdict(unusable);

    expect(verdict.status).toBe("INCOMPLETE");
    expect(verdict.reason).toContain("LEVERAGE UNSUPPORTED IN v1");
  });

  it("is INCOMPLETE when the range is suppressed even if trust somehow disagreed", () => {
    // Defensive: the range's own suppression is read directly too, not only
    // through trust.status, so the two sources of the same fact cannot drift
    // apart under this function specifically.
    const result = assembleAnalysisResult(MSFT_FIXTURE);
    const suppressedOnly: AnalysisResult = {
      ...result,
      trust: { status: "PARTIAL", determinedBy: [] },
      fairValueRange: { kind: "suppressed", state: "LEVERAGE UNSUPPORTED IN v1", cause: "inputs missing" },
    };

    const verdict = deriveVerdict(suppressedOnly);

    expect(verdict.status).toBe("INCOMPLETE");
  });

  it("is INCOMPLETE for the pre-revenue distribution shape, honestly rather than reusing the range rule", () => {
    const result = assembleAnalysisResult(OKLO_FIXTURE);
    expect(result.fairValueRange.kind).toBe("pre-revenue-distribution");

    const verdict = deriveVerdict(result);

    expect(verdict.status).toBe("INCOMPLETE");
    expect(verdict.reason).toContain("pre-revenue");
  });
});
