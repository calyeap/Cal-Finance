import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { MalformedAnalystResponseError, type AnalystCall, type AnalystCallRequest } from "./analystCall";
import { buildDraftMessage, interpretDraft, runScenarioProposal, RESPONSE_SCHEMA, type DraftFacts } from "./scenarioProposal";
import { toDraftWire } from "../sheets/testSupport";
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
    const p = interpretDraft(toDraftWire(good()), FACTS);
    expect(p.scenarios.base.revenueGrowthOrPath.value.toString()).toBe("0.08");
    expect(p.scenarios.base.returnOnNewInvestment.anchor.cites).toEqual(["H:returns"]);
    expect(p.moatClass).toBe("narrow");
    expect(p.constantsAnchor.cites).toEqual(["STATUTORY"]);
  });

  it("refuses an anchor citing a source that was not supplied", () => {
    const raw = good();
    raw.base.operatingMargin.cites = ["MEMORY"];
    expect(() => interpretDraft(toDraftWire(raw), FACTS)).toThrow(/cites MEMORY, which no supplied source carries/);
  });

  it("refuses a driver with no citation at all", () => {
    const raw = good();
    raw.bull.returnOnNewInvestment.cites = [];
    expect(() => interpretDraft(toDraftWire(raw), FACTS)).toThrow(/cites no source/);
  });

  it("refuses a missing driver, a non-decimal and an implausible value", () => {
    const missing = good();
    delete missing.bear.returnOnNewInvestment;
    expect(() => interpretDraft(toDraftWire(missing), FACTS)).toThrow(/bear\.returnOnNewInvestment is missing/);
    const nan = good();
    nan.base.revenueGrowth.value = "eight percent";
    expect(() => interpretDraft(toDraftWire(nan), FACTS)).toThrow(/not a finite decimal/);
    const wild = good();
    wild.bull.revenueGrowth.value = "3.5";
    expect(() => interpretDraft(toDraftWire(wild), FACTS)).toThrow(/outside the plausible band/);
  });

  it("refuses a stress margin above the current or median margin, and an unknown moat class", () => {
    const stress = good();
    stress.policyConstants.stressMarginLevel = "0.35";
    expect(() => interpretDraft(toDraftWire(stress), FACTS)).toThrow(/stressMarginLevel/);
    const moat = good();
    moat.moat.class = "very wide";
    expect(() => interpretDraft(toDraftWire(moat), FACTS)).toThrow(/moat\.class/);
  });
});

describe("the response schema stays small enough for the API to compile (REVIEW CORRECT on #466)", () => {
  // The nested shape — 3 scenarios × 5 strict driver objects plus the rest,
  // 21 object schemas — was refused live by the API ("The compiled grammar is
  // too large") on every call. These pins hold the flat shape that replaced it.
  function objectSchemas(node: unknown): number {
    if (node === null || typeof node !== "object") return 0;
    const own = (node as Record<string, unknown>).type === "object" ? 1 : 0;
    return own + Object.values(node as Record<string, unknown>).reduce<number>((n, v) => n + objectSchemas(v), 0);
  }

  it("is one flat driver list plus three small objects — five object schemas in all", () => {
    expect(Object.keys((RESPONSE_SCHEMA as any).properties)).toEqual(["stories", "drivers", "moat", "policyConstants"]);
    expect(objectSchemas(RESPONSE_SCHEMA)).toBe(5);
    const drivers = (RESPONSE_SCHEMA as any).properties.drivers;
    expect(drivers.type).toBe("array");
    expect(drivers.items.properties.scenario.enum).toEqual(["bear", "base", "bull"]);
    expect(drivers.items.required).toEqual(["scenario", "driver", "value", "anchor", "cites"]);
    for (const k of ["bear", "base", "bull"]) expect((RESPONSE_SCHEMA as any).properties.stories.properties[k]).toEqual({ type: "string" });
    expect(JSON.stringify(RESPONSE_SCHEMA).length).toBeLessThanOrEqual(1500);
  });

  it("is the schema the drafting call sends", async () => {
    const { call, requests } = scripted(toDraftWire(good()));
    await runScenarioProposal(FACTS, call);
    expect(requests[0].responseSchema).toBe(RESPONSE_SCHEMA);
  });

  it("refuses a driver given twice, an unknown driver, and a missing story", () => {
    const twice = toDraftWire(good()) as any;
    twice.drivers.push({ ...twice.drivers[0] });
    expect(() => interpretDraft(twice, FACTS)).toThrow(/bear\.revenueGrowth appears more than once/);
    const unknown = toDraftWire(good()) as any;
    unknown.drivers.push({ scenario: "base", driver: "priceTarget", value: "1", anchor: "x", cites: ["H:revenue"] });
    expect(() => interpretDraft(unknown, FACTS)).toThrow(/unknown scenario or driver/);
    const noStory = toDraftWire(good()) as any;
    delete noStory.stories.bull;
    expect(() => interpretDraft(noStory, FACTS)).toThrow(/"bull" is missing or has no story/);
  });
});

describe("runScenarioProposal — one regeneration, then the refusal stands", () => {
  it("passes on the first well-formed answer", async () => {
    const { call, requests } = scripted(toDraftWire(good()));
    const p = await runScenarioProposal(FACTS, call);
    expect(requests).toHaveLength(1);
    expect(requests[0].label).toBe("scenarioProposal");
    expect(p.scenarios.bull.operatingMargin.value.toString()).toBe("0.32");
  });

  it("names the validator's defect to the model and recovers on the second answer", async () => {
    const { call, requests } = scripted(toDraftWire(good()), toDraftWire(good()));
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
    const { call, requests } = scripted(toDraftWire(bad), toDraftWire(bad));
    await expect(runScenarioProposal(FACTS, call)).rejects.toBeInstanceOf(MalformedAnalystResponseError);
    expect(requests).toHaveLength(2);
  });
});
