import { describe, it, expect, beforeEach } from "vitest";
import Decimal from "decimal.js";
import type { AnalystCall, AnalystCallRequest } from "../ai/analystCall";
import type { AcquiredCompany } from "./provider";
import { buildFallbackReport } from "./fallback";
import type { FactRecord } from "../types";
import { aiProposedAnalystInputBundle, __resetAiProposedBundleCache } from "./aiProposedBundle";

// ---------------------------------------------------------------------------
// Mocks the AI transport and the acquisition result only; makes no live/paid
// AI call and touches no network — same contract scenarioProposal.test.ts
// already states for the underlying call this module wraps.
// ---------------------------------------------------------------------------

function fact(id: string, value: Decimal | string | null): FactRecord {
  return {
    id,
    name: id,
    type: "FACT",
    value,
    source: "test",
    sourceUrl: null,
    sourceClass: "PRIMARY",
    extractionType: "DETERMINISTIC/STRUCTURED",
    verificationState: "SPOT-CHECK PENDING",
    asOfDate: "2026-06-30",
    retrievalTimestamp: "2026-10-03T00:00:00Z",
    supersedesFactId: null,
    tagMappingVersion: "test-v1",
    derivedFromFactIds: null,
    derivedFrom: null,
    verificationOrigin: null,
    verificationReasonCode: null,
  } as unknown as FactRecord;
}

function acquiredCompanyFor(ticker: string, overrides: Partial<AcquiredCompany> = {}): AcquiredCompany {
  return {
    acquisition: {
      ticker,
      cik: "0000000000",
      companyName: `${ticker} Test Co`,
      acquiredAt: "2026-10-03T00:00:00Z",
      tagMappingVersion: "test-v1",
      facts: [
        fact("current-revenue", new Decimal("254000000000")),
        fact("shares-outstanding", new Decimal("440000000")),
        fact("treasury-method-dilution", new Decimal("2000000")),
      ],
      crossCheckFacts: [],
      fallbackReport: buildFallbackReport(ticker, "test-v1", "2026-10-03T00:00:00Z", [], 3),
      candidateNonOperatingInvestments: [],
    },
    companyFacts: { facts: {}, entityName: `${ticker} Test Co`, cik: 0 } as never,
    crossChecks: { ticker, ranAt: "2026-10-03T00:00:00Z", results: [], failedFactIds: [], inputFactIds: [] },
    crossCheckFailedFactIds: new Set(),
    sic: "5331",
    sicDescription: "RETAIL-VARIETY STORES",
    business: { narrative: { text: "Operates warehouse clubs.", ruleVersion: "v1", filingForm: "10-K", filingDate: "2026-01-01", accessionNumber: "0000000000-26-000001" }, unavailableReason: null },
    latestFiling: null,
    provenanceNote: "test acquisition",
    ...overrides,
  };
}

function wellFormedProposalResponse() {
  const driver = (overrides: Partial<Record<string, string>> = {}) => ({
    revenueGrowthOrPath: "0.08",
    operatingMargin: "0.036",
    reinvestmentCapitalIntensity: "0.05",
    shareCount: "1.0",
    writtenAnchor: "Reflects the company's own supplied facts.",
    ...overrides,
  });
  return {
    bear: driver({ revenueGrowthOrPath: "0.04", operatingMargin: "0.02" }),
    base: driver(),
    bull: driver({ revenueGrowthOrPath: "0.12", operatingMargin: "0.045" }),
    policyConstants: {
      nopatTaxRate: "0.21",
      stressMarginLevel: "0.02",
      writtenAnchor: "Tax rate cites the supplied US federal statutory rate; stress margin cites the company's own current/median operating margin.",
    },
  };
}

function fakeCall(response: unknown, seen?: AnalystCallRequest[]): AnalystCall {
  return async (request) => {
    seen?.push(request);
    return response;
  };
}

beforeEach(() => {
  __resetAiProposedBundleCache();
});

describe("aiProposedAnalystInputBundle", () => {
  it("returns null when no AI call is configured", async () => {
    const bundle = await aiProposedAnalystInputBundle("COST", "Costco Wholesale Corporation", acquiredCompanyFor("COST"), null);
    expect(bundle).toBeNull();
  });

  it("returns null when the company has no acquired current-revenue fact", async () => {
    const acquired = acquiredCompanyFor("COST", {
      acquisition: { ...acquiredCompanyFor("COST").acquisition, facts: [] },
    });
    const bundle = await aiProposedAnalystInputBundle("COST", "Costco Wholesale Corporation", acquired, fakeCall(wellFormedProposalResponse()));
    expect(bundle).toBeNull();
  });

  it("builds a bundle from the AI proposal, grounded in the acquired facts, with scenarioValues left null", async () => {
    const seen: AnalystCallRequest[] = [];
    const bundle = await aiProposedAnalystInputBundle(
      "COST",
      "Costco Wholesale Corporation",
      acquiredCompanyFor("COST"),
      fakeCall(wellFormedProposalResponse(), seen)
    );

    expect(bundle).not.toBeNull();
    expect(bundle!.inputs.scenarioValues).toBeNull();
    expect(bundle!.inputs.configuredConstants.nopatTaxRate?.toString()).toBe("0.21");
    expect(bundle!.inputs.configuredConstants.stressMarginLevel?.toString()).toBe("0.02");
    expect(bundle!.inputs.configuredConstants.preRevenueUnleveredRate).toBeNull();
    expect(bundle!.inputs.scenarios.base.revenueGrowthOrPath?.toString()).toBe("0.08");
    // shareCount converted from the proposed MULTIPLE (1.0 = no change) to
    // the ABSOLUTE diluted share count, the same unit every other bundle in
    // this codebase carries.
    expect(bundle!.inputs.scenarios.base.shareCount.toString()).toBe("442000000");
    expect(bundle!.inputs.profile.confirmedOrOverridden).toBe("MATURE_PROFITABLE_STABLE_FCF");
    expect(bundle!.note).toContain("PROPOSED");
    expect(seen).toHaveLength(1);
    expect(seen[0].user).toContain("Costco Wholesale Corporation");
  });

  it("returns null gracefully when the AI call fails after its own retry", async () => {
    const alwaysBad = async () => ({ bear: {}, base: {}, bull: {}, policyConstants: {} });
    const bundle = await aiProposedAnalystInputBundle(
      "COST",
      "Costco Wholesale Corporation",
      acquiredCompanyFor("COST"),
      alwaysBad
    );
    expect(bundle).toBeNull();
  });

  it("caches the resolved bundle per ticker so a second call within the TTL never re-invokes the AI call", async () => {
    let calls = 0;
    const call: AnalystCall = async () => {
      calls += 1;
      return wellFormedProposalResponse();
    };
    const acquired = acquiredCompanyFor("COST");

    const first = await aiProposedAnalystInputBundle("COST", "Costco Wholesale Corporation", acquired, call);
    const second = await aiProposedAnalystInputBundle("COST", "Costco Wholesale Corporation", acquired, call);

    expect(calls).toBe(1);
    expect(second).toBe(first);
  });
});
