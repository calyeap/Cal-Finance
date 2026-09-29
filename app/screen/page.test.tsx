// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import Decimal from "decimal.js";
import type { PortfolioView, PositionView } from "@/lib/portfolio";
import { listAccounts } from "@/lib/accounts";
import { getPortfolioView } from "@/lib/portfolio";
import { getLatestRunForCandidateTicker } from "@/lib/analyzer/runStore";
import { CANDIDATE_UNIVERSE_TICKERS } from "@/lib/screen";

vi.mock("@/lib/accounts", () => ({ listAccounts: vi.fn() }));
vi.mock("@/lib/portfolio", () => ({ getPortfolioView: vi.fn() }));
vi.mock("@/lib/analyzer/runStore", () => ({ getLatestRunForCandidateTicker: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const listAccountsMock = vi.mocked(listAccounts);
const getPortfolioViewMock = vi.mocked(getPortfolioView);
const getLatestRunForCandidateTickerMock = vi.mocked(getLatestRunForCandidateTicker);

// Re-import after mocks are registered — same pattern as
// app/portfolio-review/page.test.tsx.
const { default: ScreenPage } = await import("./page");

afterEach(cleanup);

beforeEach(() => {
  listAccountsMock.mockReset();
  getPortfolioViewMock.mockReset();
  getLatestRunForCandidateTickerMock.mockReset();
  listAccountsMock.mockResolvedValue([{ id: 1, name: "My Portfolio", custodian: null }]);
  getLatestRunForCandidateTickerMock.mockResolvedValue(null);
});

function position(over: Partial<PositionView> & Pick<PositionView, "symbol">): PositionView {
  return {
    accountId: over.accountId ?? 1,
    accountName: over.accountName ?? "My Portfolio",
    assetId: over.assetId ?? over.symbol,
    symbol: over.symbol,
    assetName: over.assetName ?? over.symbol,
    assetClass: over.assetClass ?? "equity",
    quantity: over.quantity ?? new Decimal("1"),
    avgCostUsd: "avgCostUsd" in over ? over.avgCostUsd! : new Decimal("100"),
    costBasisUsd: over.costBasisUsd ?? new Decimal("100"),
    latestPriceUsd: "latestPriceUsd" in over ? over.latestPriceUsd! : new Decimal("100"),
    rawLatestPriceUsd: "latestPriceUsd" in over ? over.latestPriceUsd! : new Decimal("100"),
    priceDate: over.priceDate ?? "2026-09-01",
    priceSourceId: 1,
    priceStatus: over.priceStatus ?? "current",
    marketValueUsd: "marketValueUsd" in over ? over.marketValueUsd! : new Decimal("100"),
    unrealisedPlUsd: over.unrealisedPlUsd ?? new Decimal("0"),
  };
}

function portfolio(positions: PositionView[]): PortfolioView {
  const totalMarketValueUsd = positions.reduce(
    (s, p) => (p.marketValueUsd ? s.add(p.marketValueUsd) : s),
    new Decimal(0)
  );
  return {
    positions,
    totalCashUsd: new Decimal(0),
    totalMarketValueUsd,
    totalPortfolioValueUsd: totalMarketValueUsd,
    excludedFromTotalSymbols: [],
    totalUnrealisedPlUsd: new Decimal(0),
    totalUnrealisedPlPct: null,
  };
}

describe("Screen page — empty states", () => {
  it("no accounts: still runs the candidate check (no holdings to exclude) and can render an empty state", async () => {
    listAccountsMock.mockResolvedValue([]);
    render(await ScreenPage());

    expect(getPortfolioViewMock).not.toHaveBeenCalled();
    expect(screen.getByText(/no candidates right now/i)).toBeInTheDocument();
  });

  it("holdings exist but no candidate has an existing Analyzer report: clear empty state, no error", async () => {
    getPortfolioViewMock.mockResolvedValue(portfolio([position({ symbol: "AAPL" })]));
    getLatestRunForCandidateTickerMock.mockResolvedValue(null);

    render(await ScreenPage());
    expect(screen.getByText(/no candidates right now/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("Screen page — populated state (VERIFY)", () => {
  it("a company with an existing Analyzer report and no current holding appears", async () => {
    getPortfolioViewMock.mockResolvedValue(portfolio([position({ symbol: "AAPL" })]));
    getLatestRunForCandidateTickerMock.mockImplementation(async (ticker: string) =>
      ticker === "MSFT"
        ? { runId: "11111111-1111-1111-1111-111111111111", resolvedCompanyName: "Microsoft Corporation" }
        : null
    );

    render(await ScreenPage());
    const table = screen.getByRole("table");
    expect(table.textContent).toContain("MSFT");
    expect(screen.getByRole("link", { name: /microsoft corporation/i })).toHaveAttribute(
      "href",
      "/analyzer/11111111-1111-1111-1111-111111111111"
    );
  });

  it("a currently-held symbol with an Analyzer report does NOT appear", async () => {
    getPortfolioViewMock.mockResolvedValue(portfolio([position({ symbol: "MSFT" })]));
    // Only MSFT (held) would carry this report; it must never be looked up,
    // so the not-held OKLO/NVDA lookups fall back to the default null mock.
    getLatestRunForCandidateTickerMock.mockImplementation(async (ticker: string) =>
      ticker === "MSFT"
        ? { runId: "11111111-1111-1111-1111-111111111111", resolvedCompanyName: "Microsoft Corporation" }
        : null
    );

    render(await ScreenPage());
    // MSFT is held, so it must never even be looked up as a candidate.
    expect(getLatestRunForCandidateTickerMock).not.toHaveBeenCalledWith("MSFT");
    expect(screen.queryByText("Microsoft Corporation")).not.toBeInTheDocument();
  });

  it("candidate ordering is deterministic and matches the fixed universe order, not a quality ranking", async () => {
    getPortfolioViewMock.mockResolvedValue(portfolio([]));
    getLatestRunForCandidateTickerMock.mockImplementation(async (ticker: string) => ({
      runId: `${ticker}-run-id-00000000-0000-0000-0000-000000000000`.slice(0, 36),
      resolvedCompanyName: ticker,
    }));

    render(await ScreenPage());
    const table = screen.getByRole("table");
    const rows = within(table)
      .getAllByRole("row")
      .filter((r) => r.textContent && CANDIDATE_UNIVERSE_TICKERS.some((t) => r.textContent!.includes(t)));
    const order = rows.map((r) => CANDIDATE_UNIVERSE_TICKERS.find((t) => r.textContent!.includes(t)));
    expect(order).toEqual(CANDIDATE_UNIVERSE_TICKERS);
  });

  it("never renders any BUY/HOLD/SELL, verdict, score, or ranking content anywhere on the page", async () => {
    getPortfolioViewMock.mockResolvedValue(portfolio([]));
    getLatestRunForCandidateTickerMock.mockResolvedValue({
      runId: "11111111-1111-1111-1111-111111111111",
      resolvedCompanyName: "Microsoft Corporation",
    });

    const { container } = render(await ScreenPage());
    const text = (container.textContent ?? "").toUpperCase();
    for (const forbidden of ["BUY", "SELL", " HOLD ", "VERDICT", "SCORE", "RANKING"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("only looks up an Analyzer run for not-held universe tickers", async () => {
    getPortfolioViewMock.mockResolvedValue(portfolio([position({ symbol: "MSFT" })]));

    render(await ScreenPage());
    expect(getLatestRunForCandidateTickerMock).toHaveBeenCalledTimes(
      CANDIDATE_UNIVERSE_TICKERS.length - 1
    );
    expect(getLatestRunForCandidateTickerMock).not.toHaveBeenCalledWith("MSFT");
    expect(getLatestRunForCandidateTickerMock).toHaveBeenCalledWith("OKLO");
    expect(getLatestRunForCandidateTickerMock).toHaveBeenCalledWith("NVDA");
  });
});
