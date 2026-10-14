import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { evaluateVerdictBlockers } from "./verdictBlockers";
import type { TrustResult, UndefinedPolicyConstants } from "./types";

// ---------------------------------------------------------------------------
// Pure, synthetic coverage of the §10.6.2 verdict-blocker classification
// (verdictBlockers.ts). Real-company coverage (MSFT/NVDA/OKLO) is
// growthLicenceOnRealRun.test.ts, which this mirrors for the
// already-approved rate-grid/RONIC-ladder pattern of that file's own
// synthetic/real split.
// ---------------------------------------------------------------------------

const CLEAN_TRUST: TrustResult = { status: "CLEAN", determinedBy: [] };

const ALL_CONFIGURED: UndefinedPolicyConstants = {
  nopatTaxRate: new Decimal("0.21"),
  stressMarginLevel: new Decimal("0.3"),
  preRevenueUnleveredRate: new Decimal("0.1"),
  projectDebtCost: new Decimal("0.08"),
};

const NONE_CONFIGURED: UndefinedPolicyConstants = {
  nopatTaxRate: null,
  stressMarginLevel: null,
  preRevenueUnleveredRate: null,
  projectDebtCost: null,
};

describe("evaluateVerdictBlockers", () => {
  it("always reports Step 3 and Step 4/5 as OPEN POLICY, for every company, even a fully CLEAN/configured run", () => {
    const blockers = evaluateVerdictBlockers({ trust: CLEAN_TRUST, undefinedConstants: ALL_CONFIGURED });

    expect(blockers.some((b) => b.step === "Step 1")).toBe(false);
    expect(blockers.some((b) => b.step === "policy constants")).toBe(false);

    const step3 = blockers.find((b) => b.step === "Step 3");
    expect(step3?.kind).toBe("OPEN POLICY");
    const step45 = blockers.find((b) => b.step === "Step 4/5");
    expect(step45?.kind).toBe("OPEN POLICY");
    expect(step45?.cause).toContain("waiting for policy");
    expect(step45?.cause).not.toContain("HOLD");
  });

  it("adds a Step 1 blocker, first in order, carrying trust's own determinedBy cause verbatim — never re-derived", () => {
    const trust: TrustResult = {
      status: "UNUSABLE",
      determinedBy: [{ kind: "suppressing state", detail: "LEVERAGE UNSUPPORTED IN v1 — inputs missing" }],
    };
    const blockers = evaluateVerdictBlockers({ trust, undefinedConstants: ALL_CONFIGURED });

    expect(blockers[0].step).toBe("Step 1");
    expect(blockers[0].kind).toBe("DATA");
    expect(blockers[0].cause).toBe("LEVERAGE UNSUPPORTED IN v1 — inputs missing");
  });

  it("never adds a Step 1 blocker when trust is PARTIAL or CLEAN — Step 1 is specifically §9.6 rule 1 (UNUSABLE)", () => {
    const partial: TrustResult = { status: "PARTIAL", determinedBy: [{ kind: "qualifying flag", detail: "SHORT HISTORY" }] };
    expect(evaluateVerdictBlockers({ trust: partial, undefinedConstants: ALL_CONFIGURED }).some((b) => b.step === "Step 1")).toBe(
      false
    );
    expect(evaluateVerdictBlockers({ trust: CLEAN_TRUST, undefinedConstants: ALL_CONFIGURED }).some((b) => b.step === "Step 1")).toBe(
      false
    );
  });

  it("names every still-null UNDEFINED_POLICY_CONSTANTS field in one blocker, and omits fields this run already configured", () => {
    const blockers = evaluateVerdictBlockers({
      trust: CLEAN_TRUST,
      undefinedConstants: { ...ALL_CONFIGURED, stressMarginLevel: null, projectDebtCost: null },
    });

    const policyConstants = blockers.find((b) => b.step === "policy constants");
    expect(policyConstants?.kind).toBe("DATA");
    expect(policyConstants?.cause).toContain("stressMarginLevel");
    expect(policyConstants?.cause).toContain("projectDebtCost");
    expect(policyConstants?.cause).not.toContain("nopatTaxRate");
    expect(policyConstants?.cause).not.toContain("preRevenueUnleveredRate");
  });

  it("omits the policy-constants blocker entirely once every UNDEFINED_POLICY_CONSTANTS field is configured", () => {
    const blockers = evaluateVerdictBlockers({ trust: CLEAN_TRUST, undefinedConstants: ALL_CONFIGURED });
    expect(blockers.some((b) => b.step === "policy constants")).toBe(false);
  });

  it("reports all four entries, in order, on the worst case — UNUSABLE trust and nothing configured", () => {
    const trust: TrustResult = {
      status: "UNUSABLE",
      determinedBy: [{ kind: "suppressing state", detail: "UNSUPPORTED PROFILE — CLASSIFICATION UNAVAILABLE — no sector classification" }],
    };
    const blockers = evaluateVerdictBlockers({ trust, undefinedConstants: NONE_CONFIGURED });

    expect(blockers.map((b) => b.step)).toEqual(["Step 1", "Step 3", "Step 4/5", "policy constants"]);
    expect(blockers.find((b) => b.step === "policy constants")?.cause).toContain("nopatTaxRate");
  });

  it("never names the Step 7 reverse-DCF comparator as a Step 5 blocker (Ruling B)", () => {
    const blockers = evaluateVerdictBlockers({ trust: CLEAN_TRUST, undefinedConstants: NONE_CONFIGURED });
    for (const blocker of blockers) {
      expect(blocker.cause).not.toContain("reverse-DCF comparator");
      expect(blocker.cause).not.toContain("Step 7");
    }
  });
});
