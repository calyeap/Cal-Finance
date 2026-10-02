import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import type { AnalystCall, AnalystCallRequest } from "./analystCall";
import { runScenarioProposal, type ScenarioProposalFacts } from "./scenarioProposal";

// ---------------------------------------------------------------------------
// Mocks the transport only; makes no live/paid AI call — the same contract
// interpretation.test.ts and challenger.test.ts already state for the other
// two calls.
// ---------------------------------------------------------------------------

function fakeCall(response: unknown, seen?: AnalystCallRequest[]): AnalystCall {
  return async (request) => {
    seen?.push(request);
    return response;
  };
}

function driver(overrides: Partial<Record<string, string>> = {}) {
  return {
    revenueGrowthOrPath: "0.08",
    operatingMargin: "0.20",
    reinvestmentCapitalIntensity: "0.10",
    shareCount: "1.0",
    writtenAnchor: "Reflects the company's own achieved revenue CAGR and current operating margin, supplied below.",
    ...overrides,
  };
}

function wellFormedResponse(overrides: Partial<Record<"bear" | "base" | "bull", Record<string, string>>> = {}) {
  return {
    bear: driver({ revenueGrowthOrPath: "0.04", operatingMargin: "0.15", ...overrides.bear }),
    base: driver({ revenueGrowthOrPath: "0.08", operatingMargin: "0.20", ...overrides.base }),
    bull: driver({ revenueGrowthOrPath: "0.14", operatingMargin: "0.24", ...overrides.bull }),
  };
}

const FACTS: ScenarioProposalFacts = {
  ticker: "COST",
  companyName: "Costco Wholesale Corporation",
  businessNarrative: "Operates membership warehouse clubs.",
  sicDescription: "RETAIL-VARIETY STORES",
  currentRevenue: new Decimal("254000000000"),
  historicalRevenueCagr: new Decimal("0.09"),
  currentOperatingMargin: new Decimal("0.036"),
  medianOperatingMargin: new Decimal("0.032"),
};

describe("runScenarioProposal", () => {
  it("returns three ordered, bounded driver sets on a well-formed response", async () => {
    const seen: AnalystCallRequest[] = [];
    const result = await runScenarioProposal(FACTS, fakeCall(wellFormedResponse(), seen));

    expect(result.bear.revenueGrowthOrPath.toString()).toBe("0.04");
    expect(result.base.revenueGrowthOrPath.toString()).toBe("0.08");
    expect(result.bull.revenueGrowthOrPath.toString()).toBe("0.14");
    expect(result.bear.writtenAnchor).toContain("achieved revenue CAGR");

    expect(seen).toHaveLength(1);
    expect(seen[0].label).toBe("scenarioProposal");
    // Only the supplied facts are in the prompt — never a remembered base
    // rate the model might otherwise cite.
    expect(seen[0].user).toContain("Costco Wholesale Corporation");
    expect(seen[0].user).toContain("9.0%"); // historicalRevenueCagr
  });

  it("names a fact as unavailable rather than omitting it silently, so the model cannot cite it from memory", async () => {
    const seen: AnalystCallRequest[] = [];
    await runScenarioProposal({ ...FACTS, historicalRevenueCagr: null }, fakeCall(wellFormedResponse(), seen));

    expect(seen[0].user).toContain("Historical achieved revenue CAGR: not available — do not cite this");
  });

  it("refuses a response with a missing driver field", async () => {
    const bad = wellFormedResponse();
    delete (bad.bear as Partial<typeof bad.bear>).writtenAnchor;

    await expect(runScenarioProposal(FACTS, fakeCall(bad))).rejects.toThrow(/missing one of its five drivers/);
  });

  it("refuses a non-numeric decimal rather than coercing it", async () => {
    const bad = wellFormedResponse({ base: { revenueGrowthOrPath: "about eight percent" } });
    await expect(runScenarioProposal(FACTS, fakeCall(bad))).rejects.toThrow(/not a finite decimal/);
  });

  it("refuses an implausible growth rate outside the band", async () => {
    const bad = wellFormedResponse({ bull: { revenueGrowthOrPath: "5.0" } });
    await expect(runScenarioProposal(FACTS, fakeCall(bad))).rejects.toThrow(/outside the plausible band/);
  });

  it("refuses when bear's growth exceeds base's — the ordering rule, not a style note", async () => {
    const bad = wellFormedResponse({ bear: { revenueGrowthOrPath: "0.20" } });
    await expect(runScenarioProposal(FACTS, fakeCall(bad))).rejects.toThrow(
      /growth is not ordered bear <= base <= bull/
    );
  });

  it("refuses when bear's margin exceeds bull's", async () => {
    const bad = wellFormedResponse({ bear: { operatingMargin: "0.50" } });
    await expect(runScenarioProposal(FACTS, fakeCall(bad))).rejects.toThrow(
      /operating margin is not ordered bear <= base <= bull/
    );
  });

  it("refuses an empty written anchor", async () => {
    const bad = wellFormedResponse({ base: { writtenAnchor: "   " } });
    await expect(runScenarioProposal(FACTS, fakeCall(bad))).rejects.toThrow(/writtenAnchor is empty/);
  });

  it("regenerates once on a refused response and succeeds if the second attempt is clean", async () => {
    let calls = 0;
    const call: AnalystCall = async () => {
      calls += 1;
      return calls === 1 ? wellFormedResponse({ bull: { revenueGrowthOrPath: "5.0" } }) : wellFormedResponse();
    };

    const result = await runScenarioProposal(FACTS, call);

    expect(calls).toBe(2);
    expect(result.bull.revenueGrowthOrPath.toString()).toBe("0.14");
  });

  it("gives up after a second refusal rather than looping", async () => {
    let calls = 0;
    const call: AnalystCall = async () => {
      calls += 1;
      return wellFormedResponse({ bull: { revenueGrowthOrPath: "5.0" } });
    };

    await expect(runScenarioProposal(FACTS, call)).rejects.toThrow(/outside the plausible band/);
    expect(calls).toBe(2);
  });
});
