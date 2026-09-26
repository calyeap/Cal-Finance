// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PrivacyProvider } from "./PrivacyContext";
import { PortfolioReviewTable } from "./PortfolioReviewTable";
import type { PortfolioReviewView } from "@/lib/portfolioReview";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

afterEach(cleanup);

function renderTable(review: PortfolioReviewView) {
  return render(
    <PrivacyProvider>
      <PortfolioReviewTable review={review} />
    </PrivacyProvider>
  );
}

const baseEntry = {
  symbol: "AAA",
  assetClass: "equity" as const,
  marketValueUsd: "1,000.00",
  weightPercent: "5.00",
  matureCapReview: false,
  priceStatus: "current" as const,
  analyzerRun: null,
};

describe("PortfolioReviewTable", () => {
  it("names a REVIEW state for a holding above the mature-position cap, and links its Analyzer report", () => {
    renderTable({
      entries: [
        {
          ...baseEntry,
          symbol: "OVER",
          weightPercent: "12.00",
          matureCapReview: true,
          analyzerRun: { runId: "11111111-1111-4111-8111-111111111111", createdAt: "2026-09-01T00:00:00Z" },
        },
      ],
      denominatorUsd: "20,000.00",
      isDenominatorFloor: false,
      excludedSymbols: [],
      matureCapPercent: 10,
    });

    expect(screen.getByText(/REVIEW — above 10%/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view report/i })).toHaveAttribute(
      "href",
      "/analyzer/11111111-1111-4111-8111-111111111111"
    );
  });

  it("says a holding has no Analyzer report yet when none exists", () => {
    renderTable({
      entries: [{ ...baseEntry }],
      denominatorUsd: "20,000.00",
      isDenominatorFloor: false,
      excludedSymbols: [],
      matureCapPercent: 10,
    });
    expect(screen.getByText(/no analyzer report yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /view report/i })).not.toBeInTheDocument();
  });

  it("discloses the floor-total caveat and asserts no REVIEW state while it holds", () => {
    renderTable({
      entries: [{ ...baseEntry, weightPercent: null, marketValueUsd: null, matureCapReview: false }],
      denominatorUsd: "20,000.00",
      isDenominatorFloor: true,
      excludedSymbols: ["NOPX"],
      matureCapPercent: 10,
    });
    expect(screen.getByText(/it is a floor, not the true portfolio value/i)).toBeInTheDocument();
    expect(screen.getByText(/NOPX/)).toBeInTheDocument();
    expect(screen.queryByText(/REVIEW —/)).not.toBeInTheDocument();
  });

  it("names the sector/theme and speculative-sleeve caps as not yet checkable, and does not substitute asset class for either", () => {
    renderTable({
      entries: [baseEntry],
      denominatorUsd: "20,000.00",
      isDenominatorFloor: false,
      excludedSymbols: [],
      matureCapPercent: 10,
    });
    expect(screen.getByText(/sector \/ tightly related theme cap/i)).toBeInTheDocument();
    expect(screen.getByText(/speculative sleeve limits/i)).toBeInTheDocument();
    expect(screen.getAllByText(/not checkable/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/is not a sector or theme/i)).toBeInTheDocument();
  });

  it("carries zero BUY/HOLD/SELL, verdict, score, or ranking content anywhere on the surface", () => {
    const { container } = renderTable({
      entries: [
        { ...baseEntry, matureCapReview: true, weightPercent: "15.00" },
        { ...baseEntry, symbol: "BBB" },
      ],
      denominatorUsd: "20,000.00",
      isDenominatorFloor: false,
      excludedSymbols: [],
      matureCapPercent: 10,
    });
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\bBUY\b|\bSELL\b|\bHOLD\b|verdict|ranking|\bscore\b|recommend/i);
  });
});
