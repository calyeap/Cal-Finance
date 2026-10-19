import { describe, it, expect, beforeEach } from "vitest";
import Decimal from "decimal.js";
import type { AnalystCall } from "../ai/analystCall";
import { acquireCompany, __resetAcquisitionCache } from "./provider";
import { combineDrafts, draftAssumptionSheet, draftRate, DRAFTS_PER_SHEET } from "./aiProposedBundle";
import { interpretDraft, type DraftProposal } from "../ai/scenarioProposal";
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
    // Every one of the sheet's independent drafts is refused after its one
    // regeneration (CALVIN RULING — A on #454: a sheet is drawn from
    // DRAFTS_PER_SHEET drafts; was a single draft's 2 requests).
    expect(requests).toHaveLength(2 * DRAFTS_PER_SHEET);
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

// ---------------------------------------------------------------------------
// CALVIN RULING — A on #454 (19 Oct 2026, comment 6270467028): draft
// stability. A drafted sheet is the per-driver median of DRAFTS_PER_SHEET
// independent, price-blind drafts; each driver keeps the anchor and
// citations of the draft that supplied its value.
// ---------------------------------------------------------------------------

describe("draftAssumptionSheet — the per-driver median of independent drafts", () => {
  beforeEach(() => __resetAcquisitionCache());

  it("makes three identical price-blind requests and takes each driver's median, with the supplying draft's own anchor", async () => {
    const acquired = await msft();
    const { measures, rate } = await stubFor(acquired);
    const baseMargins = ["0.42", "0.38", "0.40"];
    let n = 0;
    const users: string[] = [];
    const call: AnalystCall = async (request) => {
      const i = n++;
      users.push(request.user);
      const { call: one } = stubDraftCall(measures, rate, (raw) => {
        raw.base.operatingMargin.value = baseMargins[i];
        raw.base.operatingMargin.anchor = `Draft ${i + 1}: within the filed operating-margin range.`;
      });
      return one(request);
    };
    const outcome = await draftAssumptionSheet("MSFT", acquired, call, null, "2026-09-04");
    expect(DRAFTS_PER_SHEET).toBe(3);
    expect(users).toHaveLength(3);
    expect(new Set(users).size).toBe(1);
    expect(outcome.kind).toBe("DRAFTED");
    if (outcome.kind !== "DRAFTED") return;
    expect(outcome.content.scenarios.base.operatingMargin).toBe("0.4");
    expect(outcome.content.scenarios.base.anchors?.operatingMargin?.text).toBe("Draft 3: within the filed operating-margin range.");
    expect(outcome.content.drafting).toMatch(/per-driver median of 3 drafts/);
    expect(errorsIn(validateSheet(outcome.content, { measures, rate, requireAnchors: true }))).toEqual([]);
  });

  it("leaves a refused draft out and draws the sheet from the drafts that remain", async () => {
    const acquired = await msft();
    const { measures, rate } = await stubFor(acquired);
    let n = 0;
    const call: AnalystCall = async (request) => {
      const i = n++;
      // Raw calls 2 and 3 are the second draft and its one regeneration.
      if (i === 1 || i === 2) return {};
      return stubDraftCall(measures, rate).call(request);
    };
    const outcome = await draftAssumptionSheet("MSFT", acquired, call, null, "2026-09-04");
    expect(n).toBe(4);
    expect(outcome.kind).toBe("DRAFTED");
    if (outcome.kind === "DRAFTED") expect(outcome.content.drafting).toMatch(/2 of 3 drafts/);
  });
});

describe("combineDrafts", () => {
  async function proposals(): Promise<DraftProposal[]> {
    __resetAcquisitionCache();
    const acquired = await msft();
    const { measures, rate } = await stubFor(acquired);
    const sources = ["H:revenue", "H:margin", "H:returns", "H:capex", "H:cashflow", "STATUTORY"].map((id) => ({ id }));
    const facts = { ticker: "MSFT", companyName: "MSFT", sicDescription: null, sources, rate, rateBasis: "", currentOperatingMargin: null, medianOperatingMargin: null };
    return Promise.all(
      ["0.08", "0.12", "0.10"].map(async (g) => {
        const raw = await stubDraftCall(measures, rate, (r) => {
          r.base.revenueGrowth.value = g;
        }).call({ label: "test", system: "", user: "" } as never);
        return interpretDraft(raw, facts as never);
      })
    );
  }

  it("takes each driver's median value", async () => {
    const ps = await proposals();
    const { proposal, method } = combineDrafts(ps, () => []);
    expect(proposal.scenarios.base.revenueGrowthOrPath.value.toString()).toBe("0.1");
    expect(method).toMatch(/per-driver median of 3 drafts/);
  });

  it("falls back to the lead draft, and says why, when the median combination fails a validator", async () => {
    const ps = await proposals();
    const { proposal, method } = combineDrafts(ps, (p) => (ps.includes(p) ? [] : ["TEST CHECK: the combination is refused"]));
    expect(ps).toContain(proposal);
    expect(method).toMatch(/median combination failed: TEST CHECK/);
  });
});
