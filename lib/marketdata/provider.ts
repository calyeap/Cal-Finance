import type { AssetClass } from "../assets";

export interface EodPricePoint {
  date: string; // YYYY-MM-DD
  close: number;
  adjustedClose: number;
}

// Equity/ETF identity resolution, independent of price availability. A
// provider/network failure (timeout, HTTP error, quota, or anything
// unclassified) must resolve to "unavailable" — never "unknown" — because a
// failure to reach the provider is not proof the symbol is invalid.
export type InstrumentResolution =
  | { outcome: "resolved"; symbol: string; assetClass: "equity" | "etf"; name: string }
  | { outcome: "unknown" }
  | { outcome: "unsupported" }
  | { outcome: "unavailable" };

// Trailing/forward EPS off the same feed as the identity quote — a provider
// field, not a filing tag. Either half may be null where the provider does
// not carry it for this instrument; that is not the same as the provider
// call failing (which returns null for the whole record instead).
export interface EquityFundamentals {
  epsTrailing: number | null;
  epsForward: number | null;
}

// CF-ANALYZER-V1-SETTLE-01 — a FALLBACK source for §4.4's non-operating-
// investments candidates, consulted only where a filer's own SEC tags
// surface none (acquire.ts's candidateNonOperatingInvestments comes back
// empty). It is never a filing fact and never overrides one — the acquired
// SEC candidates always win when they exist (see acquiredRun.ts). asOfDate
// is the provider's own balance-sheet period end, so the figure keeps a
// real as-of date rather than borrowing the price quote's.
export interface NonOperatingInvestmentsFigure {
  value: number;
  asOfDate: string; // YYYY-MM-DD
}

export interface MarketDataProvider {
  readonly sourceName: string; // must match a row in the `sources` table
  // Crypto is never resolved here — lib/marketdata/cryptoSymbols.ts is the
  // sole authority for crypto identity, unchanged by this method.
  resolveInstrument(ticker: string): Promise<InstrumentResolution>;
  fetchLatestEod(ticker: string, assetClass: AssetClass): Promise<EodPricePoint>;
  // from/to are inclusive "YYYY-MM-DD" bounds. Returned points may be in any
  // order — callers that need chronological order must sort explicitly.
  fetchHistoricalEod(
    ticker: string,
    assetClass: AssetClass,
    from: string,
    to: string
  ): Promise<EodPricePoint[]>;
  // Optional: a provider whose plan has no fundamentals surface (EODHD's
  // /eod-only endpoints) simply omits this method. Callers must treat a
  // missing method exactly like a null result — never a reason to fail the
  // run — since this is a "nice to have when available" input, not a
  // REQUIRED one any provider must supply.
  fetchFundamentals?(ticker: string): Promise<EquityFundamentals | null>;
  // Optional, same contract as fetchFundamentals: omit where the provider
  // has no balance-sheet surface; callers treat a missing method exactly
  // like a null result.
  fetchNonOperatingInvestments?(ticker: string): Promise<NonOperatingInvestmentsFigure | null>;
}
