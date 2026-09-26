import Decimal from "decimal.js";
import type { PositionView, PriceStatus } from "./portfolio";
import { computeAllocation } from "./allocation";
import { formatUsd } from "./formatUsd";

// PORTFOLIO REVIEW — first bounded outcome (CF-PORTFOLIO-REVIEW-FIRST-OUTCOME-01).
//
// Pure, framework-free, like lib/allocation.ts beside it: this module only
// shapes data an existing accessor already computed. It never queries a
// database and never invents a weight calculation of its own — every
// percentage here comes from computeAllocation, unchanged, the same call
// AllocationDonut.tsx already makes for the Dashboard (SCOPE 2).
//
// GOVERNING ALLOCATION POLICY, approved by Calvin 14 Sep 2026
// (docs/frozen/calfinance-methodology-v2.md:399-408) is SETTLED HARD: this
// repo may calculate, check and warn within these exact limits, and may not
// widen them or invent adjacent thresholds. Of the figures on that list,
// exactly one is checkable against data this repo has today — see the two
// AI DEFAULT notes below for why the rest are not.

// The one cap this repo can honestly check today: a per-position weight
// against the existing per-position priced-market-value total.
// docs/frozen/calfinance-methodology-v2.md:403-404: "normal deliberate
// mature-position cap: 10%; appreciation above 10%: mandatory concentration
// review, not automatic trim." "Above" is exclusive — a position sitting
// exactly at 10.00% has not breached the cap.
export const MATURE_POSITION_CAP_PERCENT = 10;

// AI DEFAULT: the 25% sector/tightly-related-theme cap and the speculative-
// sleeve limits (5-10% sleeve, 10% ceiling, 3% individual speculative
// position — calfinance-methodology-v2.md:405-408) are named but never
// checked anywhere in this module. Rationale: PositionView carries an
// assetClass (equity/etf/crypto — lib/assetClass.ts), which is an asset
// class, not a sector, theme, or speculative designation; no such
// classification exists anywhere in this repo's schema or code (grepped:
// no sector/theme/speculative column or field). Substituting assetClass for
// either would be inventing a grouping to check a cap against, which SCOPE 4
// and HARD BOUNDS 8 both forbid outright. Reversal: adding a real
// sector/theme or speculative classification is new data capture and a
// genuine Calvin gate (issue #352 DECISION HORIZON) — never a default a
// later pass may take silently.
export type UncheckableCapId = "SECTOR_THEME_25PCT" | "SPECULATIVE_SLEEVE";

export type MatureCapState = "REVIEW" | "WITHIN_CAP" | "NOT_CHECKABLE";

export interface AnalyzerLinkSummary {
  runId: string;
  resolvedCompanyName: string;
}

export interface PortfolioReviewRow {
  // The symbol IS the row key: getPortfolioView returns one row per
  // (account, asset), but a cap is a portfolio-level concentration concern —
  // a symbol held across two accounts is one position, not two, and checking
  // each account's own share separately would silently clear a real breach
  // (e.g. two 6% holdings of the same symbol are one 12% position). So this
  // module aggregates priced market value per symbol BEFORE the cap check.
  key: string;
  symbol: string;
  assetName: string;
  priceStatus: PriceStatus;
  // The EOD close date the weight/cap conclusion is drawn from, so a stale
  // price can be disclosed alongside it (SCOPE 5(b)) — same field
  // Dashboard/Holdings already disclose from (lib/portfolio.ts).
  priceDate: string | null;
  marketValueUsd: string | null;
  weightPercent: string | null;
  weightNumber: number | null;
  matureCapState: MatureCapState;
  matureCapNote: string;
  analyzerRun: AnalyzerLinkSummary | null;
}

// Aggregates positions by symbol, summing priced market value across
// accounts — the same shape `groupByAssetClass` (lib/allocation.ts:76-87)
// already establishes for grouping-then-computeAllocation: "the same
// AllocationInput shape computeAllocation already accepts, so the view
// reuses that one calculation unchanged — only the grouping is new." priced
// and staled positions for one symbol carry the same priceStatus/priceDate
// (both are looked up per-asset, not per-account, in getPortfolioView), so
// taking the first position's values for the group is not a second,
// divergent read of that state.
interface SymbolAggregate {
  symbol: string;
  assetName: string;
  priceStatus: PriceStatus;
  priceDate: string | null;
  marketValueUsd: Decimal | null;
}

function aggregateBySymbol(positions: readonly PositionView[]): SymbolAggregate[] {
  const order: string[] = [];
  const bySymbol = new Map<string, SymbolAggregate>();
  for (const p of positions) {
    let agg = bySymbol.get(p.symbol);
    if (!agg) {
      agg = {
        symbol: p.symbol,
        assetName: p.assetName,
        priceStatus: p.priceStatus,
        priceDate: p.priceDate,
        marketValueUsd: null,
      };
      bySymbol.set(p.symbol, agg);
      order.push(p.symbol);
    }
    if (p.marketValueUsd !== null) {
      agg.marketValueUsd = (agg.marketValueUsd ?? new Decimal(0)).add(p.marketValueUsd);
    }
  }
  return order.map((symbol) => bySymbol.get(symbol)!);
}

export interface PortfolioReviewView {
  rows: PortfolioReviewRow[];
  totalPricedMarketValueUsd: string;
  excludedFromTotalSymbols: string[];
}

function matureCapFor(weightNumber: number | null, priceStatus: PriceStatus): {
  state: MatureCapState;
  note: string;
} {
  if (weightNumber === null) {
    // AI DEFAULT: an unpriced holding's weight cannot be computed at all
    // (computeAllocation excludes it), so no cap conclusion is asserted —
    // "not checkable," not a silent pass. A stale-but-priced holding's
    // weight IS computed (lib/allocation.ts already treats a stale price as
    // usable, same as the Dashboard/Holdings totals it feeds) and IS
    // checked against the cap; it is not given the same "not checkable"
    // treatment as unpriced, since doing so would invent a second, stricter
    // definition of "usable" than the one this repo's existing allocation
    // math already applies (SCOPE 2's "do not add a second weight
    // calculation").
    return {
      state: "NOT_CHECKABLE",
      note:
        priceStatus === "unavailable"
          ? `Not checkable — this holding has no price, so no weight can be computed against the ${MATURE_POSITION_CAP_PERCENT}% mature-position cap.`
          : "Not checkable — no weight is available for this holding.",
    };
  }
  if (weightNumber > MATURE_POSITION_CAP_PERCENT) {
    return {
      state: "REVIEW",
      note: `REVIEW — this weight exceeds the approved ${MATURE_POSITION_CAP_PERCENT}% mature-position cap. This names a review state; it is not a trim, and it is not by itself a trim candidate.`,
    };
  }
  return {
    state: "WITHIN_CAP",
    note: `Within the approved ${MATURE_POSITION_CAP_PERCENT}% mature-position cap.`,
  };
}

// Builds one row per held symbol (SCOPE 3), reusing computeAllocation's
// existing weight calculation unchanged over the per-symbol aggregate — no
// second weight calculation, only a new grouping in front of the same one
// (SCOPE 2; see aggregateBySymbol above). `analyzerRunsBySymbol` is looked up
// by the caller ONLY for symbols already present in `positions` — never a
// general search (SCOPE 6, HARD BOUNDS 13).
export function buildPortfolioReviewRows(
  positions: readonly PositionView[],
  totalMarketValueUsd: Decimal,
  analyzerRunsBySymbol: ReadonlyMap<string, AnalyzerLinkSummary | null>
): PortfolioReviewRow[] {
  const aggregates = aggregateBySymbol(positions);

  const allocation = computeAllocation(
    aggregates.map((a) => ({ symbol: a.symbol, marketValueUsd: a.marketValueUsd })),
    totalMarketValueUsd
  );

  // computeAllocation's entries are exactly the priced subset of `aggregates`,
  // in the same relative order (lib/allocation.ts:52) — zip them back
  // positionally; symbols are already unique after aggregation.
  const pricedAggregates = aggregates.filter((a) => a.marketValueUsd !== null);
  const entryByAggregate = new Map<SymbolAggregate, (typeof allocation.entries)[number]>();
  pricedAggregates.forEach((a, i) => entryByAggregate.set(a, allocation.entries[i]));

  const rows = aggregates.map((a) => {
    const entry = entryByAggregate.get(a) ?? null;
    const weightNumber = entry ? entry.percentNumber : null;
    const { state, note } = matureCapFor(weightNumber, a.priceStatus);

    return {
      key: a.symbol,
      symbol: a.symbol,
      assetName: a.assetName,
      priceStatus: a.priceStatus,
      priceDate: a.priceDate,
      marketValueUsd: a.marketValueUsd ? formatUsd(a.marketValueUsd) : null,
      weightPercent: entry ? entry.percent : null,
      weightNumber,
      matureCapState: state,
      matureCapNote: note,
      analyzerRun: analyzerRunsBySymbol.get(a.symbol) ?? null,
    };
  });

  // A stable sort by weight, descending — the same "obvious stable sort"
  // Dashboard already applies to its own holdings table (app/page.tsx), not
  // a ranking or priority ordering (SCOPE 3). Not-checkable rows (null
  // weight) sort last, mirroring app/page.tsx's `?? -1` treatment.
  return [...rows].sort((a, b) => (b.weightNumber ?? -1) - (a.weightNumber ?? -1));
}

export function buildPortfolioReviewView(
  positions: readonly PositionView[],
  totalMarketValueUsd: Decimal,
  excludedFromTotalSymbols: readonly string[],
  analyzerRunsBySymbol: ReadonlyMap<string, AnalyzerLinkSummary | null>
): PortfolioReviewView {
  return {
    rows: buildPortfolioReviewRows(positions, totalMarketValueUsd, analyzerRunsBySymbol),
    totalPricedMarketValueUsd: formatUsd(totalMarketValueUsd),
    excludedFromTotalSymbols: [...excludedFromTotalSymbols],
  };
}
