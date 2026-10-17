import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { MalformedAnalystResponseError, type AnalystCall, type AnalystCallRequest } from "./analystCall";
import { buildDraftMessage, interpretDraft, runScenarioProposal, type DraftFacts } from "./scenarioProposal";
import type { SheetSource } from "../sheets/sheet";

// ---------------------------------------------------------------------------
// CF-AR6-ANY-TICKER-DRAFTS-01 — the price-blind drafting call, unit level.
// The transport is a test double; no live or paid call is made.
// ---------------------------------------------------------------------------

const SOURCES: SheetSource[] = [
  { id: "H:revenue", kind: "HISTORY", label: "Revenue", form: null, accession: null, filed: null, url: null, excerpt: "FY2025 100m; FY2026 110m." },
  { id: "H:margin", kind: "HISTORY", label: "Margin", form: null, accession: null, filed: null, url: null, excerpt: "FY2026 30.0%." },
  { id: "H:returns", kind: "HISTORY", label: "Returns", form: null, accession: null, filed: null, url: null, excerpt: "ROIC 25%." },
  { id: "E1", kind: "EARNINGS RELEASE", label: "Release", form: "8-K", accession: "0000-26-1", filed: "2026-07-30", url: null, excerpt: "Guidance: revenue up low double digits." },
];

const FACTS: DraftFacts = {
  ticker: "TEST",
  companyName: "Test Co",
  sicDescription: "SERVICES-PREPACKAGED SOFTWARE",
  sources: SOURCES,
  rate: new Decimal("0.09"),
  rateBasis: "stable",
  currentOperatingMargin: new Decimal("0.30"),
  medianOperatingMargin: new Decimal("0.28"),
};

function driver(value: string, cites: string[] = ["H:revenue"]) {
  return { value, anchor: "Because the filed history says so.", cites };
}

function scenario(g: string, m: string, r: string) {
  return {
    story: "A scenario.",
    revenueGrowth: driver(g),
    operatingMargin: driver(m, ["H:margin"]),
    returnOnNewInvestment: driver(r, ["H:returns"]),
    reinvestmentShare: driver("0.05", ["H:revenue"]),
    shareCountMultiple: driver("1.0", ["H:revenue"]),
  };
}

function good(): Record<string, any> {
  return {
    bear: scenario("0.04", "0.25", "0.12"),
    base: scenario("0.08", "0.29", "0.18"),
    bull: scenario("0.12", "0.32", "0.22"),
    moat: { class: "narrow", mechanism: "Switching costs.", cites: ["H:returns"] },
    policyConstants: { nopatTaxRate: "0.21", stressMarginLevel: "0.20", anchor: "Statutory.", cites: ["STATUTORY"] },
  };
}

function scripted(...responses: unknown[]): { call: AnalystCall; requests: AnalystCallRequest[] } {
  const requests: AnalystCallRequest[] = [];
  let i = 0;
  return {
    requests,
    call: async (request) => {
      requests.push(request);
      return responses[Math.min(i++, responses.length - 1)];
    },
  };
}

describe("the drafting call's message is price-blind and names every citable source", () => {
  it("carries the sources by id and the policy rate, and no price field of any kind", () => {
    const message = buildDraftMessage(FACTS);
    for (const s of SOURCES) expect(message).toContain(`[${s.id}]`);
    expect(message).toContain("Discount rate in use: 9.0%");
    expect(message).not.toMatch(/share price|stock price|market cap|price per share|closing price/i);
    // DraftFacts has no price member: the type is the guarantee, this is its witness.
    expect(Object.keys(FACTS).some((k) => /price/i.test(k))).toBe(false);
  });
});

describe("interpretDraft — structural checks, refused whole", () => {
  it("accepts a well-formed draft and keeps each anchor with its cites", () => {
    const p = interpretDraft(good(), FACTS);
    expect(p.scenarios.base.revenueGrowthOrPath.value.toString()).toBe("0.08");
    expect(p.scenarios.base.returnOnNewInvestment.anchor.cites).toEqual(["H:returns"]);
    expect(p.moatClass).toBe("narrow");
    expect(p.constantsAnchor.cites).toEqual(["STATUTORY"]);
  });

  it("refuses an anchor citing a source that was not supplied", () => {
    const raw = good();
    raw.base.operatingMargin.cites = ["MEMORY"];
    expect(() => interpretDraft(raw, FACTS)).toThrow(/cites MEMORY, which no supplied source carries/);
  });

  it("refuses a driver with no citation at all", () => {
    const raw = good();
    raw.bull.returnOnNewInvestment.cites = [];
    expect(() => interpretDraft(raw, FACTS)).toThrow(/cites no source/);
  });

  it("refuses a missing driver, a non-decimal and an implausible value", () => {
    const missing = good();
    delete missing.bear.returnOnNewInvestment;
    expect(() => interpretDraft(missing, FACTS)).toThrow(/bear\.returnOnNewInvestment is missing/);
    const nan = good();
    nan.base.revenueGrowth.value = "eight percent";
    expect(() => interpretDraft(nan, FACTS)).toThrow(/not a finite decimal/);
    const wild = good();
    wild.bull.revenueGrowth.value = "3.5";
    expect(() => interpretDraft(wild, FACTS)).toThrow(/outside the plausible band/);
  });

  it("refuses a stress margin above the current or median margin, and an unknown moat class", () => {
    const stress = good();
    stress.policyConstants.stressMarginLevel = "0.35";
    expect(() => interpretDraft(stress, FACTS)).toThrow(/stressMarginLevel/);
    const moat = good();
    moat.moat.class = "very wide";
    expect(() => interpretDraft(moat, FACTS)).toThrow(/moat\.class/);
  });
});

describe("runScenarioProposal — one regeneration, then the refusal stands", () => {
  it("passes on the first well-formed answer", async () => {
    const { call, requests } = scripted(good());
    const p = await runScenarioProposal(FACTS, call);
    expect(requests).toHaveLength(1);
    expect(requests[0].label).toBe("scenarioProposal");
    expect(p.scenarios.bull.operatingMargin.value.toString()).toBe("0.32");
  });

  it("names the validator's defect to the model and recovers on the second answer", async () => {
    const { call, requests } = scripted(good(), good());
    let first = true;
    const p = await runScenarioProposal(FACTS, call, () => {
      if (first) {
        first = false;
        return ["RONIC PATH: base return on new investment is below its terminal return"];
      }
      return [];
    });
    expect(p).toBeDefined();
    expect(requests).toHaveLength(2);
    expect(requests[1].user).toContain("RONIC PATH: base return on new investment is below its terminal return");
    expect(requests[1].user).toContain("Every driver must again cite its anchor");
    expect(requests[1].user).not.toContain("slot reference");
  });

  it("refuses after two failures", async () => {
    const bad = good();
    bad.base.revenueGrowth.cites = ["NOWHERE"];
    const { call, requests } = scripted(bad, bad);
    await expect(runScenarioProposal(FACTS, call)).rejects.toBeInstanceOf(MalformedAnalystResponseError);
    expect(requests).toHaveLength(2);
  });
});
