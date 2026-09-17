import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { deriveVerdict } from "./verdict";
import { assembleAnalysisResult } from "./assemble";
import { MSFT_FIXTURE } from "./fixtures/msft";
import { OKLO_FIXTURE } from "./fixtures/oklo";
import type { AnalysisResult } from "./types";

// ---------------------------------------------------------------------------
// CF-V2-PROOF-01's verdict boundary, bounded correction (PR #140, Calvin's
// 18 Sep 2026 ruling): a fair-value range alone is a single diagnostic and
// must not by itself determine BUY / HOLD / SELL, and insufficient evidence
// must return INCOMPLETE rather than a manufactured verdict. The required
// second input (spec §10.6.2's growth comparator) does not exist in
// AnalysisResult yet (spec §10.6.5, milestone M8), so every case below is
// INCOMPLETE today — that is the correct, honest behavior, not a gap in
// coverage. deriveVerdict is a pure function of an already-assembled
// AnalysisResult, so these tests build one real result (assembleAnalysisResult
// never touches the database) and override only the members each case is
// actually about — the same style trust.test.ts uses.
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
  it("is INCOMPLETE, not a manufactured verdict, when only the range is usable — the comparator is not yet acquired", () => {
    // A usable range is necessary but not sufficient: synthesizing BUY / HOLD
    // / SELL also needs the §10.6.2 comparator, which no AnalysisResult
    // carries yet (§10.6.5, M8). Reading the range alone would repeat the
    // single-diagnostic problem the ruling forbids.
    const result = assembleAnalysisResult(MSFT_FIXTURE);
    const verdict = deriveVerdict(withRange(result, baseRange(), new Decimal(265)));

    expect(verdict.status).toBe("INCOMPLETE");
    expect(verdict.reason).toContain("comparator");
  });

  it("stays INCOMPLETE regardless of where price sits inside or outside the range", () => {
    const result = assembleAnalysisResult(MSFT_FIXTURE);

    for (const price of [new Decimal(100), new Decimal(499.7), new Decimal(650)]) {
      const verdict = deriveVerdict(withRange(result, baseRange(), price));
      expect(verdict.status).toBe("INCOMPLETE");
    }
  });

  it("does not require TrustStatus CLEAN to reach the comparator-unavailable case — PARTIAL with a usable range still gets a reasoned INCOMPLETE, not a blanket one", () => {
    // §9.6 rule 2's causes (a qualifying flag, an unrelated INCOMPLETE
    // diagnostic, ...) are not about whether the range itself is usable, so
    // this case is distinguished from the UNUSABLE-trust case below by its
    // reason text, not merely by both being INCOMPLETE.
    const result = assembleAnalysisResult(MSFT_FIXTURE);
    const verdict = deriveVerdict(withRange(result, baseRange(), new Decimal(499.7)));

    expect(result.trust.status).toBe("PARTIAL");
    expect(verdict.status).toBe("INCOMPLETE");
    expect(verdict.reason).toContain("comparator");
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
