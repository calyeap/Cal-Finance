import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { assembleAnalysisResult } from "./assemble";
import { MSFT_FIXTURE } from "./fixtures/msft";
import { withStatedD2Inputs } from "./fixtures/statedD2Inputs";
import { deriveVerdict } from "./verdict";
import { uncertaintyBadge, verdictExplanation } from "./trustCopy";
import { NO_VERDICT_JUDGEMENTS, type VerdictJudgements } from "./verdictJudgements";
import type { AnalysisResult } from "./types";

// ---------------------------------------------------------------------------
// CF-AR5-VERDICT-CONSOLIDATION-01 — the verdict's plain-English copy outside
// Evidence (trustCopy.ts) and the Overview "Uncertainty" badge.
//
// The badge used to relabel evidence completeness (TrustStatus CLEAN /
// PARTIAL / UNUSABLE → Low / Medium / High). It now shows only the D3 level
// Calvin set, or whether the level matters to this verdict.
// ---------------------------------------------------------------------------

const ENGINE = assembleAnalysisResult({ ...withStatedD2Inputs(MSFT_FIXTURE), scenarioValues: null });
const PRICE = new Decimal(1000);

function at(ratio: string, judgements: Partial<VerdictJudgements> = {}, trust?: AnalysisResult["trust"]): AnalysisResult {
  const base = PRICE.dividedBy(ratio);
  return {
    ...ENGINE,
    price: { ...ENGINE.price, value: PRICE },
    trust: trust ?? ENGINE.trust,
    scenarioOutputs: { ...ENGINE.scenarioOutputs, values: { ...ENGINE.scenarioOutputs.values, base } },
    verdictInputs: { ...ENGINE.verdictInputs!, baseAtCheckRates: { lower: base, rate: base, upper: base } },
    verdictJudgements: { ...NO_VERDICT_JUDGEMENTS, ...judgements },
  };
}

const RAW_CODES = /INCOMPLETE|UNUSABLE|PROFILE NOT CONFIRMED|LEVERAGE UNSUPPORTED|CANNOT BOUND VALUE|UNCERTAINTY QUESTION|CLOSE CALL|PENDING/;

describe("uncertaintyBadge", () => {
  it("never reads evidence completeness: the same verdict under CLEAN and UNUSABLE trust gives the same badge", () => {
    const clean = at("1", {}, { status: "CLEAN", determinedBy: [] });
    const partial = at("1", {}, { status: "PARTIAL", determinedBy: [] });
    expect(uncertaintyBadge(deriveVerdict(clean), clean.verdictJudgements)).toEqual(uncertaintyBadge(deriveVerdict(partial), partial.verdictJudgements));
  });

  it("shows Calvin's recorded level, dated", () => {
    const r = at("1.25", { uncertainty: { answer: "Medium", note: null, recordedAt: "2026-10-17T09:00:00.000Z", version: 2 } });
    expect(uncertaintyBadge(deriveVerdict(r), r.verdictJudgements)).toEqual({ level: "Medium", text: "Medium uncertainty — your answer, 2026-10-17" });
  });

  it("otherwise says whether the level matters to this verdict", () => {
    const auto = at("1");
    expect(uncertaintyBadge(deriveVerdict(auto), auto.verdictJudgements)).toEqual({ level: null, text: "Uncertainty — doesn't change this verdict" });
    const question = at("1.25");
    expect(uncertaintyBadge(deriveVerdict(question), question.verdictJudgements)).toEqual({ level: null, text: "Uncertainty — your call" });
    const unsure = at("1.25", { uncertainty: { answer: "not sure", note: null, recordedAt: "2026-10-17T09:00:00.000Z", version: 1 } });
    expect(uncertaintyBadge(deriveVerdict(unsure), unsure.verdictJudgements).text).toBe("Uncertainty — you answered not sure");
  });
});

describe("verdictExplanation", () => {
  it("issued: names the verdict and the ratio across the rate band, from the computed numbers", () => {
    const line = verdictExplanation(deriveVerdict(at("1.6")))!;
    expect(line).toBe("Price is 1.60× the Base fair value across the 8.5%–9.5% rate band: SELL at every rate and uncertainty level.");
  });

  it("the question lists what each level gives; no state code anywhere", () => {
    const line = verdictExplanation(deriveVerdict(at("1.25")))!;
    expect(line).toContain("Low uncertainty → SELL, Medium uncertainty → HOLD, High uncertainty → HOLD");
    expect(line).not.toMatch(RAW_CODES);
  });

  it("a BUY zone that fails the bar says HOLD and why, never a bare HOLD", () => {
    const r = at("0.5");
    const noMoat: AnalysisResult = { ...r, valuationBasis: { ...r.valuationBasis!, d2: { ...r.valuationBasis!.d2, moatClass: "none" } } };
    const line = verdictExplanation(deriveVerdict(noMoat))!;
    expect(line).toContain("in the BUY band");
    expect(line).toContain("so HOLD");
    expect(line).toContain("at least a narrow moat");
  });

  it("is null for INCOMPLETE — the existing plain-English INCOMPLETE line covers it", () => {
    expect(verdictExplanation(deriveVerdict({ ...at("1"), price: { value: new Decimal(0), timestamp: "" } }))).toBeNull();
  });
});
