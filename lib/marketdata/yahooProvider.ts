import YahooFinance from "yahoo-finance2";
import type {
  MarketDataProvider,
  EodPricePoint,
  EquityFundamentals,
  InstrumentResolution,
  NonOperatingInvestmentsFigure,
  BusinessSummary,
} from "./provider";
import type { AssetClass } from "../assets";
import { lookupCrypto, UnsupportedCryptoError } from "./cryptoSymbols";

// A company-profile summary shorter than this is a stub, not a description
// of what the business does — refused rather than shown as one.
const MIN_BUSINESS_SUMMARY_LENGTH = 80;

// yahoo-finance2 v4 (installed: see package.json) exports the class itself as
// the default export rather than a ready-made singleton (v2 API assumed by
// an earlier draft of this file). Instantiating here is the corrected pattern
// confirmed working against live Yahoo data in Task 7's spike
// (scripts/spike-yahoo.ts).
const yahooFinance = new YahooFinance();

// Resolve the caller's (ticker, assetClass) to the exact symbol Yahoo needs.
//
// Equities and ETFs use their bare ticker, exactly as before — Yahoo's plain
// US-ticker convention (NOW, NVDA, …) is unchanged.
//
// A cryptocurrency is NEVER looked up by its bare ticker: Yahoo lists "BTC"
// as the Grayscale Bitcoin Mini Trust ETF, not Bitcoin. It is resolved only
// through the verified crypto registry (BTC -> "BTC-USD"); anything not in
// that registry is rejected outright rather than guessed at or silently
// falling through to a colliding instrument.
function toYahooSymbol(ticker: string, assetClass: AssetClass): string {
  if (assetClass === "crypto") {
    const instrument = lookupCrypto(ticker);
    if (!instrument) {
      throw new UnsupportedCryptoError(ticker);
    }
    return instrument.yahooSymbol;
  }
  return ticker.toUpperCase();
}

export const yahooProvider: MarketDataProvider = {
  sourceName: "YAHOO",
  // Resolves identity ONLY — a canonical symbol, its EQUITY/ETF type, and a
  // display name — never touching price. Any thrown error (network failure,
  // timeout, Yahoo HTTP error, or anything unclassified) maps to
  // "unavailable", not "unknown": a provider outage is never treated as
  // proof the symbol doesn't exist.
  async resolveInstrument(ticker: string): Promise<InstrumentResolution> {
    const symbol = ticker.trim().toUpperCase();
    let result;
    try {
      result = await yahooFinance.quote(symbol);
    } catch {
      return { outcome: "unavailable" };
    }
    if (!result) {
      return { outcome: "unknown" };
    }
    if (result.quoteType !== "EQUITY" && result.quoteType !== "ETF") {
      return { outcome: "unsupported" };
    }
    const name = result.longName || result.shortName;
    if (!name) {
      return { outcome: "unknown" };
    }
    return {
      outcome: "resolved",
      symbol: (result.symbol || symbol).toUpperCase(),
      assetClass: result.quoteType === "EQUITY" ? "equity" : "etf",
      name,
    };
  },
  async fetchLatestEod(ticker: string, assetClass: AssetClass): Promise<EodPricePoint> {
    const symbol = toYahooSymbol(ticker, assetClass);
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const result = await yahooFinance.chart(symbol, {
      period1: weekAgo.toISOString().slice(0, 10),
      period2: today.toISOString().slice(0, 10),
      interval: "1d",
    });
    const quotes = result.quotes.filter((q) => q.close != null);
    if (!quotes.length) {
      throw new Error(`No EOD data returned for ${symbol} from Yahoo`);
    }
    const latest = quotes[quotes.length - 1];
    return {
      date: new Date(latest.date).toISOString().slice(0, 10),
      close: latest.close!,
      adjustedClose: latest.adjclose ?? latest.close!,
    };
  },
  async fetchHistoricalEod(
    ticker: string,
    assetClass: AssetClass,
    from: string,
    to: string
  ): Promise<EodPricePoint[]> {
    const symbol = toYahooSymbol(ticker, assetClass);
    const result = await yahooFinance.chart(symbol, { period1: from, period2: to, interval: "1d" });
    // Only result.quotes (the close-price series) is read here. Yahoo's chart
    // response can also carry result.events.splits / .dividends — those are
    // never touched by this path: raw vendor split/dividend data must not
    // write directly to transactions, cost basis, or corporate_actions.
    // Splits enter the ledger only through the reviewed corporate-action
    // entry path; this loader only ever observes their effect on price via
    // the TDD §3.1 split-corruption guard.
    return result.quotes
      .filter((q) => q.close != null)
      .map((q) => ({
        date: new Date(q.date).toISOString().slice(0, 10),
        close: q.close!,
        adjustedClose: q.adjclose ?? q.close!,
      }));
  },
  // Same call shape as resolveInstrument's identity quote, read for its
  // trailing/forward EPS fields instead. A missing quote or a thrown error
  // (network, timeout, unknown symbol) returns null for the whole record —
  // never a partial guess — exactly like resolveInstrument's own "unavailable"
  // treatment of a provider failure.
  async fetchFundamentals(ticker: string): Promise<EquityFundamentals | null> {
    const symbol = ticker.trim().toUpperCase();
    let result;
    try {
      result = await yahooFinance.quote(symbol);
    } catch {
      return null;
    }
    if (!result) return null;
    return {
      epsTrailing: result.epsTrailingTwelveMonths ?? null,
      epsForward: result.epsForward ?? null,
    };
  },
  // CF-ANALYZER-V1-SETTLE-01 — §4.4's non-operating-investments judgment has
  // no candidates when a filer's own SEC tags carry none (acquire.ts).
  // yahoo-finance2's balanceSheetHistory module is typed (and, by default,
  // zod-validated) down to only { maxAge, endDate } — its generated schema
  // is additionalProperties:false with no short/long-term-investments field
  // at all (node_modules/yahoo-finance2/esm/src/modules/quoteSummary-
  // iface.schema.js, BalanceSheetStatement) — so the normal typed call can
  // never see those fields even when Yahoo's own response carries them.
  // { validateResult: false } is the library's own documented escape hatch:
  // it skips that strict validation/stripping and returns Yahoo's raw
  // camelCased JSON instead, which is why the fields below are read off an
  // explicit untyped cast rather than the (narrower) generated interface.
  //
  // Same fail-closed contract as fetchFundamentals: any failure — network,
  // an unrecognised shape, a statement with neither field — returns null,
  // never a partial or invented figure. A genuine zero (both fields present
  // and zero) is a real "nothing non-operating" answer, but with no tag to
  // attach it to this returns null too — nonOperatingJudgment.ts's own
  // "None of these are non-operating" option already exists for that case
  // and needs no synthetic candidate to express it.
  async fetchNonOperatingInvestments(ticker: string): Promise<NonOperatingInvestmentsFigure | null> {
    const symbol = ticker.trim().toUpperCase();
    let result: unknown;
    try {
      result = await yahooFinance.quoteSummary(
        symbol,
        { modules: ["balanceSheetHistory"] },
        { validateResult: false }
      );
    } catch {
      return null;
    }

    // Cast once, at the one seam that reads past yahoo-finance2's own
    // narrowed type (see the comment above) — everything below this line
    // reads defensively rather than trusting the cast.
    const balanceSheetStatements = (
      result as { balanceSheetHistory?: { balanceSheetStatements?: unknown[] } } | null | undefined
    )?.balanceSheetHistory?.balanceSheetStatements;
    const statements = balanceSheetStatements as
      | { endDate: string | Date; shortTermInvestments?: unknown; longTermInvestments?: unknown }[]
      | undefined;
    if (!statements || statements.length === 0) return null;

    // Most recent fiscal period end first — sorted explicitly rather than
    // assumed, since validateResult:false also skips whatever ordering
    // guarantee the typed path might otherwise rely on.
    const latest = [...statements].sort(
      (a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
    )[0];

    const asNumber = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
    const shortTerm = asNumber(latest.shortTermInvestments);
    const longTerm = asNumber(latest.longTermInvestments);
    if (shortTerm === null && longTerm === null) return null;

    const value = (shortTerm ?? 0) + (longTerm ?? 0);
    if (value <= 0) return null;

    return { value, asOfDate: new Date(latest.endDate).toISOString().slice(0, 10) };
  },
  // CF-ANALYZER-V1-SETTLE-01 — the approved business-description fallback
  // (PR #399, comment 5952716764: "provider summary fallback if needed"):
  // assetProfile.longBusinessSummary, read with { validateResult: false }
  // for the same reason fetchNonOperatingInvestments above uses it — a
  // strict-schema mismatch on an unrelated assetProfile field must not
  // throw away the one field read here. Fails closed to null on any
  // failure, a missing field, or a stub too short to describe a business.
  async fetchBusinessSummary(ticker: string): Promise<BusinessSummary | null> {
    const symbol = ticker.trim().toUpperCase();
    let result: unknown;
    try {
      result = await yahooFinance.quoteSummary(symbol, { modules: ["assetProfile"] }, { validateResult: false });
    } catch {
      return null;
    }
    const summary = (result as { assetProfile?: { longBusinessSummary?: unknown } } | null | undefined)?.assetProfile
      ?.longBusinessSummary;
    if (typeof summary !== "string") return null;
    const text = summary.replace(/\s+/g, " ").trim();
    if (text.length < MIN_BUSINESS_SUMMARY_LENGTH) return null;
    return { text };
  },
};
