import { describe, it, expect, beforeEach } from "vitest";
import Decimal from "decimal.js";
import type { AnalystCall } from "../ai/analystCall";
import { acquireCompany, __resetAcquisitionCache } from "./provider";
import { draftAssumptionSheet, draftRate } from "./aiProposedBundle";
import { historyFrom } from "../sheets/research";
import { validateSheet, errorsIn } from "../sheets/validators";
import { stubDraftCall } from "../sheets/testSupport";

// ---------------------------------------------------------------------------
// CF-AR6-ANY-TICKER-DRAFTS-01 — drafting a sheet from a real capture (MSFT's
// and OKLO's committed SEC company facts). The model is a test double; no
// live or paid call, no network.
// ---------------------------------------------------------------------------

const PRICE = { value: new Decimal("499.70"), timestamp: "2026-09-04", source: "recorded capture" };

async function msft(withPrice = false) {
  return acquireCompany("MSFT", { price: withPrice ? PRICE : null, source: "CAPTURE" });
}

async function stubFor(acquired: Awaited<ReturnType<typeof msft>>, tweak?: (raw: Record<string, any>) => void) {
  const { measures } = historyFrom(acquired.companyFacts);
  const rate = draftRate(acquired, measures, "MATURE_PROFITABLE_STABLE_FCF", "2026-09-04").rate;
  return { ...stubDraftCall(measures, rate, tweak), measures, rate };
}

describe("draftAssumptionSheet", () => {
  beforeEach(() => __resetAcquisitionCache());

  it("drafts a complete sheet whose every driver cites a source it carries, and which passes every validator", async () => {
    const acquired = await msft();
    const { call, measures, rate } = await stubFor(acquired);
    const outcome = await draftAssumptionSheet("MSFT", acquired, call, null, "2026-09-04");
    expect(outcome.kind).toBe("DRAFTED");
    if (outcome.kind !== "DRAFTED") return;
    const c = outcome.content;
    expect(c.sources?.map((s) => s.id)).toEqual(expect.arrayContaining(["H:revenue", "H:margin", "H:capex", "H:cashflow", "H:returns", "STATUTORY"]));
    expect(errorsIn(validateSheet(c, { measures, rate, requireAnchors: true }))).toEqual([]);
    // Share counts are absolute: the multiple times this run's diluted count.
    expect(new Decimal(c.scenarios.base.shareCount).dividedBy(new Decimal(c.basis!.dilutedShares!)).toFixed(4)).toBe("1.0000");
    expect(c.basis?.latestQuarterEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(c.cannotConclude).toBeNull();
  });

  it("is price-blind: an acquisition carrying a price changes nothing the model sees", async () => {
    const without = await stubFor(await msft(false));
    await draftAssumptionSheet("MSFT", await msft(false), without.call, null, "2026-09-04");
    __resetAcquisitionCache();
    const priced = await msft(true);
    expect(priced.acquisition.facts.some((f) => f.id === "price")).toBe(true);
    const withPrice = await stubFor(priced);
    await draftAssumptionSheet("MSFT", priced, withPrice.call, null, "2026-09-04");

    expect(withPrice.requests[0].user).toBe(without.requests[0].user);
    expect(withPrice.requests[0].user).not.toContain("499.7");
    expect(withPrice.requests[0].user).not.toMatch(/share price|stock price|market cap|price per share/i);
  });

  it("refuses a draft that leans on the price or a reverse DCF, after the one regeneration", async () => {
    const acquired = await msft();
    const { call, requests } = await stubFor(acquired, (raw) => {
      raw.base.revenueGrowth.anchor = "Matches the growth the reverse DCF says the market has priced in.";
    });
    const outcome = await draftAssumptionSheet("MSFT", acquired, call, null, "2026-09-04");
    expect(outcome.kind).toBe("REFUSED");
    expect(requests).toHaveLength(2);
    expect(requests[1].user).toMatch(/NOT FROM REVERSE DCF/);
  });

  it("refuses a draft whose base return on new investment sits below its terminal return (RONIC path)", async () => {
    const acquired = await msft();
    const { call } = await stubFor(acquired, (raw) => {
      raw.base.returnOnNewInvestment.value = "0.05";
      raw.bear.returnOnNewInvestment.value = "0.04";
    });
    const outcome = await draftAssumptionSheet("MSFT", acquired, call, null, "2026-09-04");
    expect(outcome.kind).toBe("REFUSED");
    if (outcome.kind === "REFUSED") expect(outcome.cause).toMatch(/RONIC PATH/);
  });

  it("with no model configured, refuses a revenue-generating company with that cause", async () => {
    const outcome = await draftAssumptionSheet("MSFT", await msft(), null, null, "2026-09-04");
    expect(outcome).toEqual({ kind: "REFUSED", cause: expect.stringMatching(/no model is configured/) });
  });

  it("records that a pre-revenue company cannot be concluded — no call, no invented driver", async () => {
    let calls = 0;
    const counting: AnalystCall = async () => {
      calls++;
      return {};
    };
    const oklo = await acquireCompany("OKLO", { price: null, source: "CAPTURE" });
    const outcome = await draftAssumptionSheet("OKLO", oklo, counting, null, "2026-09-04");
    expect(calls).toBe(0);
    expect(outcome.kind).toBe("CANNOT CONCLUDE");
    if (outcome.kind !== "CANNOT CONCLUDE") return;
    expect(outcome.content.cannotConclude).toMatch(/report no revenue/);
    expect(outcome.content.profile).toBe("PRE_REVENUE_UNPROFITABLE");
    for (const k of ["bear", "base", "bull"] as const) {
      expect(outcome.content.scenarios[k].revenueGrowthOrPath).toBeNull();
      expect(outcome.content.scenarios[k].returnOnNewInvestment).toBeNull();
    }
    expect(outcome.content.moatClass).toBeNull();
  });
});
