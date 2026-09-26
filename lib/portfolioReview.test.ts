import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import {
  buildPortfolioReview,
  MATURE_POSITION_CAP_PERCENT,
  type PortfolioReviewPositionInput,
} from "./portfolioReview";

const position = (
  symbol: string,
  marketValueUsd: string | null,
  overrides: Partial<PortfolioReviewPositionInput> = {}
): PortfolioReviewPositionInput => ({
  symbol,
  assetClass: "equity",
  marketValueUsd: marketValueUsd === null ? null : new Decimal(marketValueUsd),
  priceStatus: marketValueUsd === null ? "unavailable" : "current",
  ...overrides,
});

describe("buildPortfolioReview", () => {
  it("names no REVIEW state for a weight just below the mature-position cap", () => {
    // 9.99 / 100 = 9.99%
    const total = new Decimal("100");
    const view = buildPortfolioReview([position("AAA", "9.99")], total, [], new Map());
    expect(view.entries[0].weightPercent).toBe("9.99");
    expect(view.entries[0].matureCapReview).toBe(false);
  });

  it("names no REVIEW state for a weight exactly at the mature-position cap (boundary is 'above', not 'at')", () => {
    const total = new Decimal("100");
    const view = buildPortfolioReview([position("AAA", "10")], total, [], new Map());
    expect(view.entries[0].weightPercent).toBe("10.00");
    expect(view.entries[0].matureCapReview).toBe(false);
  });

  it("names a REVIEW state for a weight above the mature-position cap", () => {
    const total = new Decimal("100");
    const view = buildPortfolioReview([position("AAA", "10.01")], total, [], new Map());
    expect(view.entries[0].weightPercent).toBe("10.01");
    expect(view.entries[0].matureCapReview).toBe(true);
    expect(view.matureCapPercent).toBe(MATURE_POSITION_CAP_PERCENT);
  });

  it("asserts no breach at all when the denominator is a floor (an unpriced position exists)", () => {
    // AAA alone would be 60% of the priced total — well above the cap — but
    // BBB has no price, so the total is a floor and no breach may be asserted.
    const total = new Decimal("60");
    const view = buildPortfolioReview(
      [position("AAA", "60"), position("BBB", null)],
      total,
      ["BBB"],
      new Map()
    );
    expect(view.isDenominatorFloor).toBe(true);
    expect(view.excludedSymbols).toEqual(["BBB"]);
    const aaa = view.entries.find((e) => e.symbol === "AAA")!;
    expect(aaa.weightPercent).toBe("100.00"); // still disclosed — just never asserted as a breach
    expect(aaa.matureCapReview).toBe(false);
    const bbb = view.entries.find((e) => e.symbol === "BBB")!;
    expect(bbb.marketValueUsd).toBeNull();
    expect(bbb.weightPercent).toBeNull();
    expect(bbb.matureCapReview).toBe(false);
  });

  it("links a holding with an existing Analyzer run, and leaves one without unlinked", () => {
    const total = new Decimal("100");
    const runs = new Map([["AAA", { runId: "11111111-1111-4111-8111-111111111111", createdAt: "2026-09-01T00:00:00Z" }]]);
    const view = buildPortfolioReview(
      [position("AAA", "50"), position("BBB", "50")],
      total,
      [],
      runs
    );
    const aaa = view.entries.find((e) => e.symbol === "AAA")!;
    const bbb = view.entries.find((e) => e.symbol === "BBB")!;
    expect(aaa.analyzerRun).toEqual({ runId: "11111111-1111-4111-8111-111111111111", createdAt: "2026-09-01T00:00:00Z" });
    expect(bbb.analyzerRun).toBeNull();
  });

  it("reattaches the correct weight per position even when the same symbol is held in two positions", () => {
    // Same symbol twice (e.g. two accounts) — computeAllocation treats each
    // position row independently; the index-based zip must not cross-attach.
    const total = new Decimal("100");
    const view = buildPortfolioReview(
      [position("AAA", "20"), position("AAA", "5")],
      total,
      [],
      new Map()
    );
    expect(view.entries[0].weightPercent).toBe("20.00");
    expect(view.entries[1].weightPercent).toBe("5.00");
  });

  it("discloses the exact denominator computeAllocation used", () => {
    const total = new Decimal("250.00");
    const view = buildPortfolioReview([position("AAA", "250")], total, [], new Map());
    expect(view.denominatorUsd).toBe("250.00");
  });
});
