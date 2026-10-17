import { describe, it, expect } from "vitest";
import { assembleAnalysisResult } from "../assemble";
import { MSFT_FIXTURE } from "../fixtures/msft";
import { withStatedD2Inputs } from "../fixtures/statedD2Inputs";
import type { AnalystCallRequest } from "./analystCall";
import { interpretUncertaintyResponse, runUncertaintyProposal, uncertaintyFactsFor } from "./uncertaintyProposal";

// ---------------------------------------------------------------------------
// CF-AR5-VERDICT-CONSOLIDATION-01 — the AI uncertainty proposal (Methodology
// v2.1 D3; frozen spec §14.9 Reading AR0-c). The call is a parameter, so the
// request is an object these tests read: price-blind, outcome-blind, every
// evidence line cited, no figure, no verdict wording.
// ---------------------------------------------------------------------------

const RESULT = assembleAnalysisResult({ ...withStatedD2Inputs(MSFT_FIXTURE), scenarioValues: null });
const FACTS = uncertaintyFactsFor(RESULT);

describe("the proposal's payload", () => {
  it("carries no price and no statement of which level gives which verdict", async () => {
    let seen: AnalystCallRequest | null = null;
    await runUncertaintyProposal(RESULT, async (request) => {
      seen = request;
      return { level: "Medium", evidence: [{ factKey: "dispersion", statement: "The bear-to-bull spread is wide relative to the base case." }] };
    });
    const text = `${seen!.system}\n${seen!.user}`;
    expect(seen!.label).toBe("uncertaintyProposal");
    expect(text).not.toContain(RESULT.price.value.toFixed(2));
    expect(seen!.user).not.toMatch(/\b(BUY|HOLD|SELL)\b/);
    expect(seen!.user).not.toMatch(/price/i);
  });

  it("offers the Methodology's uncertainty factors as computed facts", () => {
    const keys = FACTS.map((f) => f.key);
    for (const key of ["rateBand", "leverage", "triggerB", "dispersion"]) expect(keys).toContain(key);
  });
});

describe("interpretUncertaintyResponse — a refusal is whole", () => {
  const ok = { level: "High", evidence: [{ factKey: "leverage", statement: "Leverage is inside the gate, so financing does not widen the range." }] };

  it("accepts a level with cited evidence and attaches the cited fact's own value", () => {
    const proposal = interpretUncertaintyResponse(ok, FACTS);
    expect(proposal.level).toBe("High");
    expect(proposal.evidence[0].fact.key).toBe("leverage");
    expect(proposal.evidence[0].fact.value).toBe(RESULT.gates.leverage.result);
  });

  it.each([
    ["an unknown level", { ...ok, level: "Extreme" }],
    ["no evidence", { ...ok, evidence: [] }],
    ["an uncited line", { ...ok, evidence: [{ factKey: "morningstar", statement: "Rated medium elsewhere." }] }],
    ["a digit", { ...ok, evidence: [{ factKey: "leverage", statement: "Net debt is 3% of value." }] }],
    ["a verdict word", { ...ok, evidence: [{ factKey: "leverage", statement: "Low leverage makes this a hold." }] }],
    ["a position word", { ...ok, evidence: [{ factKey: "leverage", statement: "The shares look CHEAP." }] }],
  ])("refuses %s", (_label, raw) => {
    expect(() => interpretUncertaintyResponse(raw, FACTS)).toThrow();
  });
});
