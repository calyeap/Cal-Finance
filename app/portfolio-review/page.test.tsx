// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
import Decimal from "decimal.js";
import type { PortfolioView, PositionView } from "@/lib/portfolio";
import { listAccounts } from "@/lib/accounts";
import { getPortfolioView } from "@/lib/portfolio";
import { getLatestRunForHeldTicker } from "@/lib/analyzer/runStore";
import { PrivacyProvider, usePrivacy } from "@/app/components/PrivacyContext";

// This page renders no top bar / privacy toggle of its own (SCOPE 8: no nav
// added). The real toggle button lives in DashboardTopBar/HoldingsTopBar,
// mounted elsewhere in the layout — this local stand-in exercises the same
// PrivacyContext this page's own MaskableValue reads.
function TestToggleButton() {
  const { toggle } = usePrivacy();
  return (
    <button type="button" onClick={toggle}>
      toggle privacy
    </button>
  );
}

vi.mock("@/lib/accounts", () => ({ listAccounts: vi.fn() }));
vi.mock("@/lib/portfolio", () => ({ getPortfolioView: vi.fn() }));
vi.mock("@/lib/analyzer/runStore", () => ({ getLatestRunForHeldTicker: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const listAccountsMock = vi.mocked(listAccounts);
const getPortfolioViewMock = vi.mocked(getPortfolioView);
const getLatestRunForHeldTickerMock = vi.mocked(getLatestRunForHeldTicker);

// Re-import after mocks are registered — same pattern as app/page.test.tsx.
const { default: PortfolioReviewPage } = await import("./page");

afterEach(cleanup);

beforeEach(() => {
  listAccountsMock.mockReset();
  getPortfolioViewMock.mockReset();
  getLatestRunForHeldTickerMock.mockReset();
  listAccountsMock.mockResolvedValue([{ id: 1, name: "My Portfolio", custodian: null }]);
  getLatestRunForHeldTickerMock.mockResolvedValue(null);
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
    excludedFromTotalSymbols: positions.filter((p) => p.priceStatus === "unavailable").map((p) => p.symbol),
    totalUnrealisedPlUsd: new Decimal(0),
    totalUnrealisedPlPct: null,
  };
}

describe("Portfolio Review page — empty state", () => {
  it("no accounts: shows the same 'no holdings yet' CTA as Dashboard/Holdings", async () => {
    listAccountsMock.mockResolvedValue([]);
    render(await PortfolioReviewPage());

    expect(screen.getByText(/no holdings yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /add your holdings/i })).toHaveAttribute(
      "href",
      "/accounts/new"
    );
    expect(getPortfolioViewMock).not.toHaveBeenCalled();
  });
});

describe("Portfolio Review page — populated state", () => {
  it("renders each holding's weight and market value", async () => {
    getPortfolioViewMock.mockResolvedValue(
      portfolio([
        position({ symbol: "AAPL", marketValueUsd: new Decimal("300") }),
        position({ symbol: "MSFT", marketValueUsd: new Decimal("100") }),
      ])
    );

    render(await PortfolioReviewPage());
    const table = screen.getByRole("table");
    expect(table.textContent).toContain("AAPL");
    expect(table.textContent).toContain("75.00%");
    expect(table.textContent).toContain("300.00");
    expect(table.textContent).toContain("MSFT");
    expect(table.textContent).toContain("25.00%");
  });

  it("discloses the priced denominator and, when a position is unpriced, the floor disclosure — asserting no breach for it", async () => {
    getPortfolioViewMock.mockResolvedValue(
      portfolio([
        position({ symbol: "AAPL", marketValueUsd: new Decimal("100") }),
        position({
          symbol: "NOPX",
          priceStatus: "unavailable",
          latestPriceUsd: null,
          marketValueUsd: null,
          unrealisedPlUsd: null,
        }),
      ])
    );

    render(await PortfolioReviewPage());
    expect(screen.getByText(/total.*priced.*market value/i)).toBeInTheDocument();
    expect(
      screen.getByText(/excludes 1 holding with no price yet \(NOPX\)/i)
    ).toBeInTheDocument();

    const table = screen.getByRole("table");
    const nopxRow = within(table)
      .getAllByRole("row")
      .find((r) => r.textContent?.includes("NOPX"))!;
    expect(nopxRow.textContent).toMatch(/not checkable/i);
    expect(nopxRow.textContent).not.toMatch(/review/i);
  });

  it("a weight above the 10% cap names a REVIEW state, never a trim", async () => {
    getPortfolioViewMock.mockResolvedValue(
      portfolio([
        position({ symbol: "BIG", marketValueUsd: new Decimal("150") }),
        position({ symbol: "REST", marketValueUsd: new Decimal("850") }),
      ])
    );

    render(await PortfolioReviewPage());
    const table = screen.getByRole("table");
    const bigRow = within(table)
      .getAllByRole("row")
      .find((r) => r.textContent?.includes("BIG"))!;
    expect(bigRow.textContent).toMatch(/review/i);
    expect(bigRow.textContent).toMatch(/not a trim/i);
  });

  it("names, but states as not-checkable, the sector/theme and speculative-sleeve caps — never inventing a classification", async () => {
    getPortfolioViewMock.mockResolvedValue(portfolio([position({ symbol: "AAPL" })]));

    render(await PortfolioReviewPage());
    expect(screen.getByText(/25% sector/i)).toBeInTheDocument();
    expect(screen.getByText(/not checked anywhere on this page/i)).toBeInTheDocument();
    expect(screen.getByText(/speculative-sleeve limits/i)).toBeInTheDocument();
  });

  it("links an existing Analyzer report by company name; says so plainly when none exists", async () => {
    getPortfolioViewMock.mockResolvedValue(
      portfolio([position({ symbol: "MSFT" }), position({ symbol: "OKLO" })])
    );
    getLatestRunForHeldTickerMock.mockImplementation(async (ticker: string) =>
      ticker === "MSFT"
        ? { runId: "11111111-1111-1111-1111-111111111111", resolvedCompanyName: "Microsoft Corporation" }
        : null
    );

    render(await PortfolioReviewPage());
    const link = screen.getByRole("link", { name: /microsoft corporation/i });
    expect(link).toHaveAttribute("href", "/analyzer/11111111-1111-1111-1111-111111111111");

    const table = screen.getByRole("table");
    const okloRow = within(table)
      .getAllByRole("row")
      .find((r) => r.textContent?.includes("OKLO"))!;
    expect(okloRow.textContent).toMatch(/no existing analyzer report/i);
  });

  it("never renders any BUY/HOLD/SELL, verdict, score, or ranking content anywhere on the page", async () => {
    getPortfolioViewMock.mockResolvedValue(
      portfolio([position({ symbol: "MSFT" }), position({ symbol: "OKLO" })])
    );
    getLatestRunForHeldTickerMock.mockImplementation(async (ticker: string) =>
      ticker === "MSFT"
        ? { runId: "11111111-1111-1111-1111-111111111111", resolvedCompanyName: "Microsoft Corporation" }
        : null
    );

    const { container } = render(await PortfolioReviewPage());
    const text = (container.textContent ?? "").toUpperCase();
    for (const forbidden of ["BUY", "SELL", " HOLD ", "VERDICT", "INCOMPLETE", "SCORE", "RANKING"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("only looks up an Analyzer run for symbols already held — one call per distinct held symbol", async () => {
    getPortfolioViewMock.mockResolvedValue(
      portfolio([
        position({ symbol: "AAPL", marketValueUsd: new Decimal("100") }),
        position({ symbol: "AAPL", accountId: 2, marketValueUsd: new Decimal("50") }),
      ])
    );

    render(await PortfolioReviewPage());
    expect(getLatestRunForHeldTickerMock).toHaveBeenCalledTimes(1);
    expect(getLatestRunForHeldTickerMock).toHaveBeenCalledWith("AAPL");
  });

  it("hides the priced-total denominator figure behind the privacy toggle, same as Dashboard's headline value", async () => {
    getPortfolioViewMock.mockResolvedValue(
      portfolio([position({ symbol: "AAPL", marketValueUsd: new Decimal("21500") })])
    );

    const page = await PortfolioReviewPage();
    const { container } = render(
      <PrivacyProvider>
        <TestToggleButton />
        {page}
      </PrivacyProvider>
    );
    expect(container.textContent).toContain("21,500.00");

    fireEvent.click(screen.getByRole("button", { name: /toggle privacy/i }));
    expect(container.textContent).not.toContain("21,500.00");
    // The denominator sentence itself, and the weight percentage, stay visible.
    expect(screen.getByText(/total.*priced.*market value/i)).toBeInTheDocument();
    expect(container.textContent).toContain("100.00%");
  });
});
