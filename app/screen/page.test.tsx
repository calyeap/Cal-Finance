// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import Decimal from "decimal.js";
import type { PortfolioView, PositionView } from "@/lib/portfolio";
import { listAccounts } from "@/lib/accounts";
import { getPortfolioView } from "@/lib/portfolio";
import { getLatestRunForCandidateTicker } from "@/lib/analyzer/runStore";
import { CANDIDATE_UNIVERSE_TICKERS } from "@/lib/screen";
import { screenVerdictDisplay } from "./verdictDisplay";

vi.mock("@/lib/accounts", () => ({ listAccounts: vi.fn() }));
vi.mock("@/lib/portfolio", () => ({ getPortfolioView: vi.fn() }));
vi.mock("@/lib/analyzer/runStore", () => ({ getLatestRunForCandidateTicker: vi.fn() }));
vi.mock("./verdictDisplay", () => ({
  screenVerdictDisplay: vi.fn(),
  gateIncompleteReason: (outstandingFactIds: string[]) =>
    `mock-gate-incomplete-reason: ${outstandingFactIds.join(", ")}`,
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const listAccountsMock = vi.mocked(listAccounts);
const getPortfolioViewMock = vi.mocked(getPortfolioView);
const getLatestRunForCandidateTickerMock = vi.mocked(getLatestRunForCandidateTicker);
const screenVerdictDisplayMock = vi.mocked(screenVerdictDisplay);

// Re-import after mocks are registered — same pattern as
// app/portfolio-review/page.test.tsx.
const { default: ScreenPage } = await import("./page");

afterEach(cleanup);

beforeEach(() => {
  listAccountsMock.mockReset();
  getPortfolioViewMock.mockReset();
  getLatestRunForCandidateTickerMock.mockReset();
  screenVerdictDisplayMock.mockReset();
  listAccountsMock.mockResolvedValue([{ id: 1, name: "My Portfolio", custodian: null }]);
  getLatestRunForCandidateTickerMock.mockResolvedValue(null);
  // The realistic default (lib/analyzer/verdict.ts's deriveVerdict returns
  // INCOMPLETE for every run today — the M8 comparator gap) — tests that
  // care about a specific status/reason override this explicitly.
  screenVerdictDisplayMock.mockResolvedValue({
    kind: "verdict",
    status: "INCOMPLETE",
    reason: "Decision-critical analysis is incomplete — default test reason.",
  });
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

  it("an existing INCOMPLETE Analyzer verdict is surfaced honestly, its reason shown word for word", async () => {
    getPortfolioViewMock.mockResolvedValue(portfolio([]));
    getLatestRunForCandidateTickerMock.mockImplementation(async (ticker: string) =>
      ticker === "MSFT"
        ? { runId: "11111111-1111-1111-1111-111111111111", resolvedCompanyName: "Microsoft Corporation" }
        : null
    );
    const reason =
      "Decision-critical analysis is incomplete — a fair-value range alone cannot determine " +
      "BUY / HOLD / SELL.";
    screenVerdictDisplayMock.mockImplementation(async (runId: string) =>
      runId === "11111111-1111-1111-1111-111111111111"
        ? { kind: "verdict", status: "INCOMPLETE", reason }
        : { kind: "verdict", status: "INCOMPLETE", reason: "unused" }
    );

    render(await ScreenPage());
    const table = screen.getByRole("table");
    expect(table.textContent).toContain("INCOMPLETE");
    expect(table.textContent).toContain(reason);
  });

  it("never renders a verdict SCREEN itself would make up — no synthetic VERDICT/SCORE/RANKING text — while allowing the existing report's own BUY/HOLD/SELL state through", async () => {
    getPortfolioViewMock.mockResolvedValue(portfolio([]));
    getLatestRunForCandidateTickerMock.mockResolvedValue({
      runId: "11111111-1111-1111-1111-111111111111",
      resolvedCompanyName: "Microsoft Corporation",
    });
    // A non-INCOMPLETE status is a legitimate value deriveVerdict can return
    // (lib/analyzer/verdict.ts's VerdictStatus) — it is the existing report's
    // own already-computed state, not something SCREEN synthesises, so it is
    // allowed through even though it says "BUY".
    screenVerdictDisplayMock.mockResolvedValue({
      kind: "verdict",
      status: "BUY",
      reason: "existing report reason",
    });

    const { container } = render(await ScreenPage());
    const text = (container.textContent ?? "").toUpperCase();
    expect(text).toContain("BUY");
    for (const forbidden of ["VERDICT", "SCORE", "RANKING"]) {
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
