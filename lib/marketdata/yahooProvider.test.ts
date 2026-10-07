import { describe, it, expect, vi, beforeEach } from "vitest";

// yahoo-finance2 is instantiated at module load (`new YahooFinance()`), so
// the mock must be a constructor exposing the same methods. All provider
// calls funnel through these spies so tests can assert the exact symbol
// string the adapter sent to Yahoo.
const { mockChart, mockQuote, mockQuoteSummary } = vi.hoisted(() => ({
  mockChart: vi.fn(),
  mockQuote: vi.fn(),
  mockQuoteSummary: vi.fn(),
}));
vi.mock("yahoo-finance2", () => ({
  default: class {
    chart = mockChart;
    quote = mockQuote;
    quoteSummary = mockQuoteSummary;
  },
}));

import { yahooProvider } from "./yahooProvider";

function chartResponse(rows: Array<{ date: string; close: number }>) {
  return {
    quotes: rows.map((r) => ({ date: new Date(`${r.date}T00:00:00Z`), close: r.close, adjclose: r.close })),
  };
}

// Bare "BTC" on Yahoo is the Grayscale Bitcoin Mini Trust ETF (~$35/share),
// NOT Bitcoin — this is the exact instrument the M1.1 bug resolved. Bitcoin
// is the "BTC-USD" pair (~$79k). NOW / NVDA are the equity regression anchors.
const GRAYSCALE_BTC_ETF_CLOSE = 35.34;
const BITCOIN_USD_CLOSE = 79805.13;

beforeEach(() => {
  mockChart.mockReset();
  mockQuote.mockReset();
  mockQuoteSummary.mockReset();
  mockChart.mockImplementation(async (symbol: string) => {
    switch (symbol) {
      case "BTC-USD":
        return chartResponse([{ date: "2026-08-28", close: BITCOIN_USD_CLOSE }]);
      case "BTC":
        return chartResponse([{ date: "2026-08-28", close: GRAYSCALE_BTC_ETF_CLOSE }]);
      case "NVDA":
        return chartResponse([{ date: "2026-08-28", close: 180.5 }]);
      case "NOW":
        return chartResponse([{ date: "2026-08-28", close: 900.1 }]);
      default:
        throw new Error("No data found, symbol may be delisted");
    }
  });
});

describe("yahooProvider — asset-type-aware symbol resolution", () => {
  it("REGRESSION: Crypto + BTC prices Bitcoin (BTC-USD), never the bare-ticker Grayscale ETF", async () => {
    const point = await yahooProvider.fetchLatestEod("BTC", "crypto");

    // The adapter must qualify the crypto ticker before hitting Yahoo.
    expect(mockChart).toHaveBeenCalledWith("BTC-USD", expect.anything());
    expect(mockChart).not.toHaveBeenCalledWith("BTC", expect.anything());
    // And the price must be Bitcoin's, not a ~$35 ETF share price.
    expect(point.close).toBe(BITCOIN_USD_CLOSE);
  });

  it("maps a lowercase crypto ticker to the verified USD pair too", async () => {
    await yahooProvider.fetchLatestEod("btc", "crypto");
    expect(mockChart).toHaveBeenCalledWith("BTC-USD", expect.anything());
  });

  it("rejects an unverified crypto ticker instead of guessing a pair or falling back", async () => {
    await expect(yahooProvider.fetchLatestEod("NOTACOIN", "crypto")).rejects.toThrow(
      /not a supported cryptocurrency/i
    );
    // It must not have attempted ANY Yahoo lookup for an unsupported crypto.
    expect(mockChart).not.toHaveBeenCalled();
  });

  it("crypto historical data also uses the verified USD pair", async () => {
    mockChart.mockResolvedValueOnce(
      chartResponse([
        { date: "2026-08-27", close: 78000 },
        { date: "2026-08-28", close: BITCOIN_USD_CLOSE },
      ])
    );
    const points = await yahooProvider.fetchHistoricalEod("BTC", "crypto", "2026-08-27", "2026-08-28");
    expect(mockChart).toHaveBeenCalledWith("BTC-USD", expect.objectContaining({ period1: "2026-08-27" }));
    expect(points).toHaveLength(2);
  });

  it("EQUITY REGRESSION: NOW and NVDA still resolve by their bare ticker, unchanged", async () => {
    const now = await yahooProvider.fetchLatestEod("now", "equity");
    const nvda = await yahooProvider.fetchLatestEod("NVDA", "equity");

    expect(mockChart).toHaveBeenCalledWith("NOW", expect.anything());
    expect(mockChart).toHaveBeenCalledWith("NVDA", expect.anything());
    expect(now.close).toBe(900.1);
    expect(nvda.close).toBe(180.5);
  });

  it("ETF lookups are unchanged: the bare ticker is used as-is", async () => {
    // Asking for BTC *as an ETF* is a different instrument from the crypto —
    // asset class must not cross. The bare-ticker path still reaches the ETF.
    const point = await yahooProvider.fetchLatestEod("BTC", "etf");
    expect(mockChart).toHaveBeenCalledWith("BTC", expect.anything());
    expect(point.close).toBe(GRAYSCALE_BTC_ETF_CLOSE);
  });
});

describe("yahooProvider.resolveInstrument — identity resolution, independent of price", () => {
  it("resolves a known equity: canonical symbol, assetClass equity, non-empty name", async () => {
    mockQuote.mockResolvedValue({
      symbol: "NVDA",
      quoteType: "EQUITY",
      longName: "NVIDIA Corporation",
    });

    const result = await yahooProvider.resolveInstrument("nvda");

    expect(mockQuote).toHaveBeenCalledWith("NVDA");
    expect(result).toEqual({
      outcome: "resolved",
      symbol: "NVDA",
      assetClass: "equity",
      name: "NVIDIA Corporation",
    });
  });

  it("resolves a known ETF: canonical symbol, assetClass etf, non-empty name", async () => {
    mockQuote.mockResolvedValue({
      symbol: "SPY",
      quoteType: "ETF",
      longName: "SPDR S&P 500 ETF Trust",
    });

    const result = await yahooProvider.resolveInstrument("SPY");

    expect(result).toEqual({
      outcome: "resolved",
      symbol: "SPY",
      assetClass: "etf",
      name: "SPDR S&P 500 ETF Trust",
    });
  });

  it("falls back to shortName when longName is absent", async () => {
    mockQuote.mockResolvedValue({ symbol: "NVDA", quoteType: "EQUITY", shortName: "NVIDIA" });
    const result = await yahooProvider.resolveInstrument("NVDA");
    expect(result).toEqual({ outcome: "resolved", symbol: "NVDA", assetClass: "equity", name: "NVIDIA" });
  });

  it("returns unknown when Yahoo has no quote for the symbol", async () => {
    mockQuote.mockResolvedValue(undefined);
    const result = await yahooProvider.resolveInstrument("DSADASD");
    expect(result).toEqual({ outcome: "unknown" });
  });

  it("returns unsupported when the resolved instrument type is neither EQUITY nor ETF", async () => {
    mockQuote.mockResolvedValue({ symbol: "BTC-USD", quoteType: "CRYPTOCURRENCY", longName: "Bitcoin USD" });
    const result = await yahooProvider.resolveInstrument("BTC-USD");
    expect(result).toEqual({ outcome: "unsupported" });
  });

  it("returns unknown when the resolved instrument has no display name", async () => {
    mockQuote.mockResolvedValue({ symbol: "NVDA", quoteType: "EQUITY" });
    const result = await yahooProvider.resolveInstrument("NVDA");
    expect(result).toEqual({ outcome: "unknown" });
  });

  it("returns unavailable, never unknown, on a network/timeout failure — a failure is not proof of invalidity", async () => {
    mockQuote.mockRejectedValue(new Error("network timeout"));
    const result = await yahooProvider.resolveInstrument("NVDA");
    expect(result).toEqual({ outcome: "unavailable" });
  });

  it("returns unavailable on an HTTP error from Yahoo (e.g. 429/5xx)", async () => {
    mockQuote.mockRejectedValue(new Error("HTTP 429: Too Many Requests"));
    const result = await yahooProvider.resolveInstrument("NVDA");
    expect(result).toEqual({ outcome: "unavailable" });
  });

  it("returns unavailable on an unclassified thrown error", async () => {
    mockQuote.mockRejectedValue("not even an Error instance");
    const result = await yahooProvider.resolveInstrument("NVDA");
    expect(result).toEqual({ outcome: "unavailable" });
  });

  it("canonicalises whitespace and casing before calling Yahoo", async () => {
    mockQuote.mockResolvedValue({ symbol: "NVDA", quoteType: "EQUITY", longName: "NVIDIA Corporation" });
    await yahooProvider.resolveInstrument("  nvda  ");
    expect(mockQuote).toHaveBeenCalledWith("NVDA");
  });
});

describe("yahooProvider.fetchFundamentals — CF-ANALYZER-LEAN-MSFT-PROOF-01's EPS surface", () => {
  it("reads trailing and forward EPS off the same quote() call as identity resolution", async () => {
    mockQuote.mockResolvedValue({
      symbol: "MSFT",
      quoteType: "EQUITY",
      epsTrailingTwelveMonths: 13.11,
      epsForward: 15.42,
    });

    const result = await yahooProvider.fetchFundamentals!("msft");

    expect(mockQuote).toHaveBeenCalledWith("MSFT");
    expect(result).toEqual({ epsTrailing: 13.11, epsForward: 15.42 });
  });

  it("carries a missing half as null rather than inventing a value", async () => {
    mockQuote.mockResolvedValue({ symbol: "MSFT", quoteType: "EQUITY", epsTrailingTwelveMonths: 13.11 });
    const result = await yahooProvider.fetchFundamentals!("MSFT");
    expect(result).toEqual({ epsTrailing: 13.11, epsForward: null });
  });

  it("returns null for the whole record when Yahoo has no quote for the symbol", async () => {
    mockQuote.mockResolvedValue(undefined);
    await expect(yahooProvider.fetchFundamentals!("DSADASD")).resolves.toBeNull();
  });

  it("returns null, never throws, on a network/timeout failure", async () => {
    mockQuote.mockRejectedValue(new Error("network timeout"));
    await expect(yahooProvider.fetchFundamentals!("MSFT")).resolves.toBeNull();
  });
});

describe("yahooProvider.fetchNonOperatingInvestments — CF-ANALYZER-V1-SETTLE-01's §4.4 fallback", () => {
  it("calls quoteSummary with validateResult:false, since the typed/validated path strips these fields", async () => {
    mockQuoteSummary.mockResolvedValue({
      balanceSheetHistory: {
        balanceSheetStatements: [
          { endDate: "2026-06-30", shortTermInvestments: 1_000_000, longTermInvestments: 4_000_000 },
        ],
      },
    });

    await yahooProvider.fetchNonOperatingInvestments!("COST");

    expect(mockQuoteSummary).toHaveBeenCalledWith(
      "COST",
      { modules: ["balanceSheetHistory"] },
      { validateResult: false }
    );
  });

  it("sums short- and long-term investments off the most recent statement", async () => {
    mockQuoteSummary.mockResolvedValue({
      balanceSheetHistory: {
        balanceSheetStatements: [
          { endDate: "2025-06-30", shortTermInvestments: 100, longTermInvestments: 200 },
          { endDate: "2026-06-30", shortTermInvestments: 1_000_000, longTermInvestments: 4_000_000 },
        ],
      },
    });

    const result = await yahooProvider.fetchNonOperatingInvestments!("COST");

    expect(result).toEqual({ value: 5_000_000, asOfDate: "2026-06-30" });
  });

  it("carries a missing half as zero, never inventing the other", async () => {
    mockQuoteSummary.mockResolvedValue({
      balanceSheetHistory: {
        balanceSheetStatements: [{ endDate: "2026-06-30", longTermInvestments: 4_000_000 }],
      },
    });

    const result = await yahooProvider.fetchNonOperatingInvestments!("COST");

    expect(result).toEqual({ value: 4_000_000, asOfDate: "2026-06-30" });
  });

  it("returns null when neither field is present (the field this schema normally strips)", async () => {
    mockQuoteSummary.mockResolvedValue({
      balanceSheetHistory: { balanceSheetStatements: [{ endDate: "2026-06-30" }] },
    });

    await expect(yahooProvider.fetchNonOperatingInvestments!("COST")).resolves.toBeNull();
  });

  it("returns null on a genuine zero rather than a synthetic candidate with nothing to classify", async () => {
    mockQuoteSummary.mockResolvedValue({
      balanceSheetHistory: {
        balanceSheetStatements: [{ endDate: "2026-06-30", shortTermInvestments: 0, longTermInvestments: 0 }],
      },
    });

    await expect(yahooProvider.fetchNonOperatingInvestments!("COST")).resolves.toBeNull();
  });

  it("returns null when there is no balance sheet history at all", async () => {
    mockQuoteSummary.mockResolvedValue({});
    await expect(yahooProvider.fetchNonOperatingInvestments!("COST")).resolves.toBeNull();
  });

  it("returns null, never throws, on a network/timeout failure", async () => {
    mockQuoteSummary.mockRejectedValue(new Error("network timeout"));
    await expect(yahooProvider.fetchNonOperatingInvestments!("COST")).resolves.toBeNull();
  });

  it("returns null on an unrecognised response shape rather than throwing", async () => {
    mockQuoteSummary.mockResolvedValue({ balanceSheetHistory: { balanceSheetStatements: "not an array" } });
    await expect(yahooProvider.fetchNonOperatingInvestments!("COST")).resolves.toBeNull();
  });
});

describe("yahooProvider.fetchBusinessSummary — CF-ANALYZER-V1-SETTLE-01's approved business-description fallback", () => {
  const SUMMARY =
    "Microsoft Corporation develops and supports software, services, devices and solutions worldwide, " +
    "across productivity, cloud computing and personal computing.";

  it("reads assetProfile.longBusinessSummary with validateResult:false", async () => {
    mockQuoteSummary.mockResolvedValue({ assetProfile: { longBusinessSummary: SUMMARY } });

    const result = await yahooProvider.fetchBusinessSummary!("msft");

    expect(mockQuoteSummary).toHaveBeenCalledWith("MSFT", { modules: ["assetProfile"] }, { validateResult: false });
    expect(result).toEqual({ text: SUMMARY });
  });

  it("collapses the provider's internal whitespace into single spaces", async () => {
    mockQuoteSummary.mockResolvedValue({ assetProfile: { longBusinessSummary: `  ${SUMMARY.replace(/ /g, "  \n ")}  ` } });

    const result = await yahooProvider.fetchBusinessSummary!("MSFT");

    expect(result).toEqual({ text: SUMMARY });
  });

  it("fails closed to null on a provider error, a missing field or a stub too short to describe a business", async () => {
    mockQuoteSummary.mockRejectedValueOnce(new Error("Invalid Crumb"));
    expect(await yahooProvider.fetchBusinessSummary!("MSFT")).toBeNull();

    mockQuoteSummary.mockResolvedValueOnce({ assetProfile: {} });
    expect(await yahooProvider.fetchBusinessSummary!("MSFT")).toBeNull();

    mockQuoteSummary.mockResolvedValueOnce({ assetProfile: { longBusinessSummary: "Software." } });
    expect(await yahooProvider.fetchBusinessSummary!("MSFT")).toBeNull();

    mockQuoteSummary.mockResolvedValueOnce(null);
    expect(await yahooProvider.fetchBusinessSummary!("MSFT")).toBeNull();
  });
});
