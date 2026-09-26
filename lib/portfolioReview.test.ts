import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import type { PositionView } from "./portfolio";
import {
  buildPortfolioReviewRows,
  buildPortfolioReviewView,
  MATURE_POSITION_CAP_PERCENT,
  type AnalyzerLinkSummary,
} from "./portfolioReview";

function position(over: Partial<PositionView> & Pick<PositionView, "symbol">): PositionView {
  const quantity = over.quantity ?? new Decimal("1");
  return {
    accountId: over.accountId ?? 1,
    accountName: over.accountName ?? "Demo",
    assetId: over.assetId ?? over.symbol,
    symbol: over.symbol,
    assetName: over.assetName ?? over.symbol,
    assetClass: over.assetClass ?? "equity",
    quantity,
    avgCostUsd: "avgCostUsd" in over ? over.avgCostUsd! : new Decimal("100"),
    costBasisUsd: over.costBasisUsd ?? new Decimal("100"),
    latestPriceUsd: "latestPriceUsd" in over ? over.latestPriceUsd! : new Decimal("100"),
    rawLatestPriceUsd: "latestPriceUsd" in over ? over.latestPriceUsd! : new Decimal("100"),
    priceDate: over.priceDate ?? "2026-09-01",
    priceSourceId: over.priceSourceId ?? 1,
    priceStatus: over.priceStatus ?? "current",
    marketValueUsd: "marketValueUsd" in over ? over.marketValueUsd! : new Decimal("100"),
    unrealisedPlUsd: over.unrealisedPlUsd ?? new Decimal("0"),
  };
}

const NO_RUNS = new Map<string, AnalyzerLinkSummary | null>();

describe("buildPortfolioReviewRows — mature-position cap boundary (SCOPE 9)", () => {
  it("a weight exactly at 10% is WITHIN_CAP — 'above' is exclusive", () => {
    const positions = [
      position({ symbol: "AT10", marketValueUsd: new Decimal("100") }),
      position({ symbol: "REST", marketValueUsd: new Decimal("900") }),
    ];
    const rows = buildPortfolioReviewRows(positions, new Decimal("1000"), NO_RUNS);
    const row = rows.find((r) => r.symbol === "AT10")!;
    expect(row.weightPercent).toBe("10.00");
    expect(row.matureCapState).toBe("WITHIN_CAP");
    expect(row.matureCapNote).not.toContain("REVIEW");
  });

  it("a weight just below 10% is WITHIN_CAP", () => {
    const positions = [
      position({ symbol: "BELOW", marketValueUsd: new Decimal("99") }),
      position({ symbol: "REST", marketValueUsd: new Decimal("901") }),
    ];
    const rows = buildPortfolioReviewRows(positions, new Decimal("1000"), NO_RUNS);
    const row = rows.find((r) => r.symbol === "BELOW")!;
    expect(row.weightPercent).toBe("9.90");
    expect(row.matureCapState).toBe("WITHIN_CAP");
  });

  it("a weight just above 10% is REVIEW — never an automatic trim", () => {
    const positions = [
      position({ symbol: "ABOVE", marketValueUsd: new Decimal("101") }),
      position({ symbol: "REST", marketValueUsd: new Decimal("899") }),
    ];
    const rows = buildPortfolioReviewRows(positions, new Decimal("1000"), NO_RUNS);
    const row = rows.find((r) => r.symbol === "ABOVE")!;
    expect(row.weightPercent).toBe("10.10");
    expect(row.matureCapState).toBe("REVIEW");
    expect(row.matureCapNote).toContain("REVIEW");
    expect(row.matureCapNote).toContain("not a trim");
  });

  it(`MATURE_POSITION_CAP_PERCENT is exactly ${10}, cited from the frozen policy`, () => {
    expect(MATURE_POSITION_CAP_PERCENT).toBe(10);
  });
});

describe("buildPortfolioReviewRows — unpriced positions (SCOPE 9: floor total, no asserted breach)", () => {
  it("an unpriced position gets NOT_CHECKABLE, never REVIEW or WITHIN_CAP, regardless of the floor total", () => {
    const positions = [
      position({
        symbol: "NOPX",
        priceStatus: "unavailable",
        latestPriceUsd: null,
        marketValueUsd: null,
        unrealisedPlUsd: null,
      }),
      position({ symbol: "PRICED", marketValueUsd: new Decimal("50") }),
    ];
    // Floor total — only the priced position's value, per getPortfolioView's
    // own definition (lib/portfolio.ts).
    const rows = buildPortfolioReviewRows(positions, new Decimal("50"), NO_RUNS);
    const unpriced = rows.find((r) => r.symbol === "NOPX")!;

    expect(unpriced.weightPercent).toBeNull();
    expect(unpriced.weightNumber).toBeNull();
    expect(unpriced.marketValueUsd).toBeNull();
    expect(unpriced.matureCapState).toBe("NOT_CHECKABLE");
    expect(unpriced.matureCapNote).not.toContain("REVIEW");
    expect(unpriced.matureCapNote).not.toContain("WITHIN_CAP".toLowerCase());
    expect(unpriced.matureCapNote.toLowerCase()).toContain("not checkable");

    // The priced holding is honestly 100% of the floor total (its only
    // usable denominator) and is correctly checked and flagged REVIEW — an
    // unpriced sibling being excluded from the denominator does not silently
    // suppress a real breach on the holding that IS priced.
    const priced = rows.find((r) => r.symbol === "PRICED")!;
    expect(priced.weightPercent).toBe("100.00");
    expect(priced.matureCapState).toBe("REVIEW");
  });

  it("a stale-but-priced position IS checked against the cap — stale is not treated as unpriced", () => {
    const positions = [
      position({
        symbol: "STALE",
        priceStatus: "stale",
        marketValueUsd: new Decimal("200"),
      }),
      position({ symbol: "REST", marketValueUsd: new Decimal("800") }),
    ];
    const rows = buildPortfolioReviewRows(positions, new Decimal("1000"), NO_RUNS);
    const stale = rows.find((r) => r.symbol === "STALE")!;
    expect(stale.weightPercent).toBe("20.00");
    expect(stale.matureCapState).toBe("REVIEW");
  });
});

describe("buildPortfolioReviewRows — Analyzer report linkage (SCOPE 6, 9)", () => {
  it("a holding with an existing Analyzer run carries it through; one without carries null", () => {
    const positions = [position({ symbol: "MSFT" }), position({ symbol: "OKLO" })];
    const runs = new Map<string, AnalyzerLinkSummary | null>([
      ["MSFT", { runId: "11111111-1111-1111-1111-111111111111", resolvedCompanyName: "Microsoft Corporation" }],
      ["OKLO", null],
    ]);
    const rows = buildPortfolioReviewRows(positions, new Decimal("200"), runs);

    const msft = rows.find((r) => r.symbol === "MSFT")!;
    expect(msft.analyzerRun).toEqual({
      runId: "11111111-1111-1111-1111-111111111111",
      resolvedCompanyName: "Microsoft Corporation",
    });

    const oklo = rows.find((r) => r.symbol === "OKLO")!;
    expect(oklo.analyzerRun).toBeNull();
  });

  it("never renders or carries any verdict, score, or BUY/HOLD/SELL content — only a runId and a company name", () => {
    const positions = [position({ symbol: "MSFT" })];
    const runs = new Map<string, AnalyzerLinkSummary | null>([
      ["MSFT", { runId: "11111111-1111-1111-1111-111111111111", resolvedCompanyName: "Microsoft Corporation" }],
    ]);
    const rows = buildPortfolioReviewRows(positions, new Decimal("100"), runs);
    const row = rows[0];

    expect(Object.keys(row.analyzerRun!).sort()).toEqual(["resolvedCompanyName", "runId"]);
    const serialised = JSON.stringify(row);
    for (const forbidden of ["BUY", "SELL", "HOLD", "verdict", "INCOMPLETE", "score", "ranking"]) {
      expect(serialised.toUpperCase()).not.toContain(forbidden.toUpperCase());
    }
  });
});

describe("buildPortfolioReviewRows — ordering", () => {
  it("stable descending weight order, not-checkable rows last (mirrors app/page.tsx's own sort)", () => {
    const positions = [
      position({ symbol: "SMALL", marketValueUsd: new Decimal("10") }),
      position({
        symbol: "NOPX",
        priceStatus: "unavailable",
        latestPriceUsd: null,
        marketValueUsd: null,
        unrealisedPlUsd: null,
      }),
      position({ symbol: "BIG", marketValueUsd: new Decimal("90") }),
    ];
    const rows = buildPortfolioReviewRows(positions, new Decimal("100"), NO_RUNS);
    expect(rows.map((r) => r.symbol)).toEqual(["BIG", "SMALL", "NOPX"]);
  });
});

describe("buildPortfolioReviewView — denominator disclosure", () => {
  it("discloses the exact priced total and the excluded symbols floor list", () => {
    const positions = [
      position({ symbol: "AAA", marketValueUsd: new Decimal("300") }),
      position({
        symbol: "NOPX",
        priceStatus: "unavailable",
        latestPriceUsd: null,
        marketValueUsd: null,
        unrealisedPlUsd: null,
      }),
    ];
    const view = buildPortfolioReviewView(positions, new Decimal("300"), ["NOPX"], NO_RUNS);
    expect(view.totalPricedMarketValueUsd).toBe("300.00");
    expect(view.excludedFromTotalSymbols).toEqual(["NOPX"]);
    expect(view.rows).toHaveLength(2);
  });
});
