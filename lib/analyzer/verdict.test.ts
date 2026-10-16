import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { deriveVerdict } from "./verdict";
import { assembleAnalysisResult } from "./assemble";
import { MSFT_FIXTURE } from "./fixtures/msft";
import { OKLO_FIXTURE } from "./fixtures/oklo";
import type { AnalysisResult } from "./types";

// ---------------------------------------------------------------------------
// CF-ANALYZER-STAGE3-VERDICT-FINISH-01 — deriveVerdict's own Step-1-equivalent
// gates (trust UNUSABLE, suppressed range, pre-revenue, PROFILE NOT
// CONFIRMED, no price) are unchanged and still proven first, exactly as
// CF-V2-PROOF-01/CF-VERDICT-NONPOLICY-GAPS-01 left them. Beyond those gates,
// deriveVerdict now falls through to the live Methodology's "Verdict
// synthesis policy v1" (verdictSynthesisV1.ts) instead of the permanent
// COMPARATOR_NOT_YET_AVAILABLE result every run previously received — see
// that module's own header for the full reconciliation. deriveVerdict is a
// pure function of an already-assembled AnalysisResult, so these tests build
// one real result (assembleAnalysisResult never touches the database) and
// override only the members each case is actually about — the same style
// trust.test.ts uses.
// ---------------------------------------------------------------------------

function withValuation(
  result: AnalysisResult,
  range: Extract<AnalysisResult["fairValueRange"], { kind: "range" }>,
  price: Decimal,
  base: Decimal
): AnalysisResult {
  return {
    ...result,
    price: { ...result.price, value: price, timestamp: "2026-10-16T00:00:00.000Z" },
    fairValueRange: range,
    scenarioOutputs: { ...result.scenarioOutputs, values: { ...result.scenarioOutputs.values, base } },
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
  it("is SELL, invariant across every uncertainty bucket, when price clears the strictest (High) SELL threshold — the real approved MSFT Stage-2 candidate's own numbers ($499.70 vs Base $283.31, 1.76×)", () => {
    const result = assembleAnalysisResult(MSFT_FIXTURE);
    const verdict = deriveVerdict(withValuation(result, baseRange(), new Decimal("499.70"), new Decimal("283.31")));

    expect(verdict.status).toBe("SELL");
    expect(verdict.reason).toContain("Verdict synthesis policy v1");
    expect(verdict.reason).toContain("1.7638");
    expect(verdict.reason).toContain("all three uncertainty buckets");
  });

  it("is HOLD, invariant across every uncertainty bucket, strictly between the loosest BUY and SELL thresholds", () => {
    const result = assembleAnalysisResult(MSFT_FIXTURE);
    // 1.00× — clears neither the loosest BUY (0.90×) nor the loosest SELL (1.20×) threshold under any bucket.
    const verdict = deriveVerdict(withValuation(result, baseRange(), new Decimal(300), new Decimal(300)));

    expect(verdict.status).toBe("HOLD");
    expect(verdict.reason).toContain("Verdict synthesis policy v1");
    expect(verdict.reason).toContain("every uncertainty bucket alike");
  });

  it("is INCOMPLETE, not a manufactured BUY, when price clears the strictest (High) BUY threshold on valuation alone — the quality bar has no product mechanism yet", () => {
    const result = assembleAnalysisResult(MSFT_FIXTURE);
    // 0.50× — clears every BUY threshold (even High's strictest 0.70×) under every bucket.
    const verdict = deriveVerdict(withValuation(result, baseRange(), new Decimal(150), new Decimal(300)));

    expect(verdict.status).toBe("INCOMPLETE");
    expect(verdict.reason).toContain("business-quality bar");
  });

  it("is INCOMPLETE, naming the open uncertainty-bucket question, when the BUY/HOLD boundary is genuinely ambiguous", () => {
    const result = assembleAnalysisResult(MSFT_FIXTURE);
    // 0.85× — BUY under Medium/High (≤0.80×? no — 0.85 > 0.80, so BUY only under Low's 0.90× bucket), HOLD under Medium/High.
    const verdict = deriveVerdict(withValuation(result, baseRange(), new Decimal(255), new Decimal(300)));

    expect(verdict.status).toBe("INCOMPLETE");
    expect(verdict.reason).toContain("uncertainty bucket");
    expect(verdict.reason).toContain("without a formula for combining them into one bucket");
  });

  it("is INCOMPLETE, naming the open uncertainty-bucket question, when the HOLD/SELL boundary is genuinely ambiguous", () => {
    const result = assembleAnalysisResult(MSFT_FIXTURE);
    // 1.25× — SELL under Low's 1.20× bucket, HOLD under Medium (1.30×) and High (1.45×).
    const verdict = deriveVerdict(withValuation(result, baseRange(), new Decimal(375), new Decimal(300)));

    expect(verdict.status).toBe("INCOMPLETE");
    expect(verdict.reason).toContain("uncertainty bucket");
  });

  it("is INCOMPLETE, with no manufactured verdict, when the Base scenario value is not positive", () => {
    const result = assembleAnalysisResult(MSFT_FIXTURE);
    const verdict = deriveVerdict(withValuation(result, baseRange(), new Decimal(100), new Decimal(0)));

    expect(verdict.status).toBe("INCOMPLETE");
    expect(verdict.reason).toContain("defensible Base fair value");
  });

  it("is INCOMPLETE, with no manufactured verdict, when no price is available for this run", () => {
    const result = assembleAnalysisResult(MSFT_FIXTURE);
    const withPriceAndBase = withValuation(result, baseRange(), new Decimal(499.7), new Decimal(283.31));
    const noPrice: AnalysisResult = {
      ...withPriceAndBase,
      price: { value: new Decimal(0), timestamp: "" },
    };

    const verdict = deriveVerdict(noPrice);

    expect(verdict.status).toBe("INCOMPLETE");
    expect(verdict.reason).toContain("no price was available");
  });

  it("does not require TrustStatus CLEAN to reach synthesis — PARTIAL with a usable range still reaches a reasoned result, not a blanket one", () => {
    const result = assembleAnalysisResult(MSFT_FIXTURE);
    const verdict = deriveVerdict(withValuation(result, baseRange(), new Decimal(499.7), new Decimal(283.31)));

    expect(result.trust.status).toBe("PARTIAL");
    expect(verdict.status).toBe("SELL");
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

  it("is INCOMPLETE, naming PROFILE NOT CONFIRMED as the cause, when that flag is active on an otherwise-usable range — §10.6.3's third condition, checked explicitly rather than reached only via the V1-synthesis fallback", () => {
    const result = assembleAnalysisResult(MSFT_FIXTURE);
    const profileNotConfirmed: AnalysisResult = withValuation(
      result,
      baseRange(),
      new Decimal(499.7),
      new Decimal(283.31)
    );
    const withFlag: AnalysisResult = {
      ...profileNotConfirmed,
      trust: {
        status: "PARTIAL",
        determinedBy: [{ kind: "qualifying flag", detail: "PROFILE NOT CONFIRMED on the valuation path" }],
      },
    };

    const verdict = deriveVerdict(withFlag);

    expect(verdict.status).toBe("INCOMPLETE");
    expect(verdict.reason).toContain("PROFILE NOT CONFIRMED");
    expect(verdict.reason).not.toContain("Verdict synthesis policy v1");
  });

  it("does not raise PROFILE NOT CONFIRMED for an unrelated qualifying flag — this branch fails if the check ever removed", () => {
    // Regression guard for the branch itself: an MSFT-style qualifying flag
    // (e.g. MARGIN AT HISTORICAL HIGH) must not be mistaken for PROFILE NOT
    // CONFIRMED, and removing the new branch would fall through to the
    // V1-synthesis reason instead of the profile-specific one.
    const result = assembleAnalysisResult(MSFT_FIXTURE);
    const verdict = deriveVerdict(withValuation(result, baseRange(), new Decimal(499.7), new Decimal(283.31)));

    expect(verdict.status).toBe("SELL");
    expect(verdict.reason).not.toContain("PROFILE NOT CONFIRMED");
  });

  it("is INCOMPLETE for the pre-revenue distribution shape, honestly rather than reusing the range rule", () => {
    const result = assembleAnalysisResult(OKLO_FIXTURE);
    expect(result.fairValueRange.kind).toBe("pre-revenue-distribution");

    const verdict = deriveVerdict(result);

    expect(verdict.status).toBe("INCOMPLETE");
    expect(verdict.reason).toContain("pre-revenue");
  });
});
