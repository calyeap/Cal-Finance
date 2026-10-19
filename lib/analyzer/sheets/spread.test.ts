import { describe, it, expect, beforeEach } from "vitest";
import Decimal from "decimal.js";
import { acquireCompany, __resetAcquisitionCache } from "../acquisition/provider";
import { draftRate, DRAFTS_PER_SHEET } from "../acquisition/aiProposedBundle";
import { historyFrom } from "./research";
import { draftSpread, formatSpreadReport, spreadOutcome, spreadRunPasses, valueSpread, SPREAD_THRESHOLD, type DraftValuation, type SpreadReport } from "./spread";
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
    // One margin per sheet: each sheet is drawn from DRAFTS_PER_SHEET calls
    // (CALVIN RULING — A on #454), so the drafts within a sheet agree and the
    // three sheets disagree.
    const varying: AnalystCall = async (request) => {
      const i = Math.floor(n++ / DRAFTS_PER_SHEET);
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
    // Nothing measured is a failed run, not a pass (draft-spread.ts exits 1 on it).
    expect(spreadRunPasses([report])).toBe(false);
  });

  // #454's acceptance as amended by Calvin (recorded ruling, 19 Oct 2026,
  // #454 comment 6268684236). Protected-evaluator change: the run used to
  // fail on ANY unmeasured company; it now records a company the engine does
  // not value at all (with its exact cause) and still fails every other gap.
  it("records a validly drafted company the engine does not value, with the engine's cause", async () => {
    const { acquired, measures, rate } = await setUp();
    const { call, requests } = stubDraftCall(measures, rate);
    // No §4.4 answer: the bridge is INCOMPLETE, so no draft can be valued.
    const report = await draftSpread("MSFT", { call, client: null, acquired, price: PRICE, nonOperatingInvestments: null, source: "CAPTURE" });
    expect(report.drafts.every((d) => d.drafted && d.basePerShare === null && d.cause !== null)).toBe(true);
    // The exact root cause is recorded, and the bridge does not read the
    // sheet, so the harness stops after one sheet (no further paid calls).
    expect(report.drafts[0].cause).toMatch(/^enterprise value INCOMPLETE: missing REQUIRED input\(s\): nonOperatingEquityInvestmentsAtBook/);
    expect(report.drafts).toHaveLength(1);
    expect(requests).toHaveLength(DRAFTS_PER_SHEET);
    expect(report.spread).toBeNull();
    expect(spreadOutcome(report)).toBe("NOT VALUED — RECORDED");
    expect(formatSpreadReport([report])).toContain("NOT VALUED — RECORDED");
  });

  it("passes a run only when nothing fails and at least one company was measured inside the bar", () => {
    const valued = (v: number): DraftValuation => ({ drafted: true, basePerShare: new Decimal(v), cause: null, base: { growth: null, margin: null, returnOnNewInvestment: null }, moatClass: null });
    const unvalued: DraftValuation = { drafted: true, basePerShare: null, cause: "missing REQUIRED input(s): financeLeaseLiabilities", base: { growth: null, margin: null, returnOnNewInvestment: null }, moatClass: null };
    const refused: DraftValuation = { ...unvalued, drafted: false, cause: "the drafting call failed or was refused twice" };
    const report = (drafts: DraftValuation[], withinThreshold: boolean | null, priced = true): SpreadReport => ({
      ticker: "X",
      drafts,
      spread: withinThreshold === null ? null : new Decimal(withinThreshold ? "0.05" : "0.2"),
      withinThreshold,
      priced,
    });
    const within = report([valued(100), valued(102), valued(104)], true);
    const wider = report([valued(90), valued(100), valued(110)], false);
    const recorded = report([unvalued, unvalued, unvalued], null);

    expect(spreadOutcome(within)).toBe("WITHIN BAR");
    expect(spreadOutcome(wider)).toBe("FAIL");
    expect(spreadOutcome(recorded)).toBe("NOT VALUED — RECORDED");
    // Every gap other than "the engine values none of its drafts" still fails.
    expect(spreadOutcome(report([unvalued, unvalued, unvalued], null, false))).toBe("FAIL"); // unpriced
    expect(spreadOutcome(report([refused, unvalued, unvalued], null))).toBe("FAIL"); // a draft refused
    expect(spreadOutcome(report([valued(100), unvalued, unvalued], null))).toBe("FAIL"); // valued on some drafts only
    expect(spreadOutcome(report([], null))).toBe("FAIL");

    expect(spreadRunPasses([within, within])).toBe(true);
    expect(spreadRunPasses([within, recorded])).toBe(true);
    expect(spreadRunPasses([within, wider])).toBe(false);
    expect(spreadRunPasses([recorded, recorded])).toBe(false); // nothing measured
    expect(spreadRunPasses([])).toBe(false);
  });
});
