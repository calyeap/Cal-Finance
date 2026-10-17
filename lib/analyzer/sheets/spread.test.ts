import { describe, it, expect, beforeEach } from "vitest";
import Decimal from "decimal.js";
import { acquireCompany, __resetAcquisitionCache } from "../acquisition/provider";
import { draftRate } from "../acquisition/aiProposedBundle";
import { historyFrom } from "./research";
import { draftSpread, formatSpreadReport, valueSpread, SPREAD_THRESHOLD } from "./spread";
import { stubDraftCall } from "./testSupport";
import type { AnalystCall } from "../ai/analystCall";

// ---------------------------------------------------------------------------
// CF-AR6-ANY-TICKER-DRAFTS-01 — the three-draft spread harness (issue #454
// DO 4), on MSFT's real capture with the model replaced by a test double.
// The live spread for the golden companies is scripts/analyzer/draft-spread.ts.
// ---------------------------------------------------------------------------

const PRICE = { value: new Decimal("499.70"), timestamp: "2026-09-04", source: "recorded capture" };
const NONE = { tags: [], value: new Decimal(0), errorDirection: null };

describe("valueSpread", () => {
  it("is (max − min) ÷ median, ignoring absent values", () => {
    expect(valueSpread([new Decimal(90), new Decimal(100), new Decimal(110)])!.toString()).toBe("0.2");
    expect(valueSpread([new Decimal(100), null, new Decimal(105)])!.toFixed(4)).toBe("0.0488");
    expect(valueSpread([new Decimal(100), null])).toBeNull();
  });
});

describe("draftSpread", () => {
  beforeEach(() => __resetAcquisitionCache());

  async function setUp() {
    const acquired = await acquireCompany("MSFT", { price: null, source: "CAPTURE" });
    const { measures } = historyFrom(acquired.companyFacts);
    const rate = draftRate(acquired, measures, "MATURE_PROFITABLE_STABLE_FCF", "2026-09-04").rate;
    return { acquired, measures, rate };
  }

  it("values three identical drafts through the engine: zero spread, inside the bar", async () => {
    const { acquired, measures, rate } = await setUp();
    const { call } = stubDraftCall(measures, rate);
    const report = await draftSpread("MSFT", { call, client: null, acquired, price: PRICE, nonOperatingInvestments: NONE, source: "CAPTURE" });
    expect(report.drafts).toHaveLength(3);
    for (const d of report.drafts) expect(d.basePerShare?.isFinite()).toBe(true);
    expect(report.spread?.toString()).toBe("0");
    expect(report.withinThreshold).toBe(true);
    expect(formatSpreadReport([report])).toContain("| MSFT | 1 |");
  });

  it("reports a spread wider than the bar when the drafts disagree", async () => {
    const { acquired, measures, rate } = await setUp();
    let n = 0;
    const margins = ["0.30", "0.38", "0.46"];
    const varying: AnalystCall = async (request) => {
      const i = n++;
      const { call } = stubDraftCall(measures, rate, (raw) => {
        raw.base.operatingMargin.value = margins[i];
        raw.bull.operatingMargin.value = margins[i];
        raw.bear.operatingMargin.value = "0.30";
      });
      return call(request);
    };
    const report = await draftSpread("MSFT", { call: varying, client: null, acquired, price: PRICE, nonOperatingInvestments: NONE, source: "CAPTURE" });
    expect(report.spread!.greaterThan(SPREAD_THRESHOLD)).toBe(true);
    expect(report.withinThreshold).toBe(false);
    expect(formatSpreadReport([report])).toMatch(/WIDER THAN 10%/);
  });

  it("records a refused draft with its cause and no value", async () => {
    const { acquired } = await setUp();
    const refusing: AnalystCall = async () => ({});
    const report = await draftSpread("MSFT", { call: refusing, client: null, acquired, price: PRICE, nonOperatingInvestments: NONE, source: "CAPTURE", runs: 2 });
    expect(report.drafts.every((d) => d.basePerShare === null && d.cause !== null)).toBe(true);
    expect(report.spread).toBeNull();
    expect(report.withinThreshold).toBeNull();
  });
});
