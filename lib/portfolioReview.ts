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
  // accountId+assetId, not just symbol: getPortfolioView returns one row per
  // (account, asset) — the same granularity Dashboard/Holdings already
  // render — and this view does not aggregate across accounts, so it needs
  // no second calculation to disagree with the first (SCOPE 2).
  key: string;
  symbol: string;
  assetName: string;
  priceStatus: PriceStatus;
  marketValueUsd: string | null;
  weightPercent: string | null;
  weightNumber: number | null;
  matureCapState: MatureCapState;
  matureCapNote: string;
  analyzerRun: AnalyzerLinkSummary | null;
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

// Builds one row per current position (SCOPE 3), reusing computeAllocation's
// existing weight calculation unchanged. `analyzerRunsBySymbol` is looked up
// by the caller ONLY for symbols already present in `positions` — never a
// general search (SCOPE 6, HARD BOUNDS 13).
export function buildPortfolioReviewRows(
  positions: readonly PositionView[],
  totalMarketValueUsd: Decimal,
  analyzerRunsBySymbol: ReadonlyMap<string, AnalyzerLinkSummary | null>
): PortfolioReviewRow[] {
  const allocation = computeAllocation(
    positions.map((p) => ({ symbol: p.symbol, marketValueUsd: p.marketValueUsd })),
    totalMarketValueUsd
  );

  // computeAllocation's entries are exactly the priced subset of `positions`,
  // in the same relative order (lib/allocation.ts:52) — zip them back
  // positionally rather than by symbol, since two positions (different
  // accounts) may legitimately share one symbol.
  const pricedPositions = positions.filter((p) => p.marketValueUsd !== null);
  const entryByPosition = new Map<PositionView, (typeof allocation.entries)[number]>();
  pricedPositions.forEach((p, i) => entryByPosition.set(p, allocation.entries[i]));

  const rows = positions.map((p) => {
    const entry = entryByPosition.get(p) ?? null;
    const weightNumber = entry ? entry.percentNumber : null;
    const { state, note } = matureCapFor(weightNumber, p.priceStatus);

    return {
      key: `${p.accountId}-${p.assetId}`,
      symbol: p.symbol,
      assetName: p.assetName,
      priceStatus: p.priceStatus,
      marketValueUsd: p.marketValueUsd ? formatUsd(p.marketValueUsd) : null,
      weightPercent: entry ? entry.percent : null,
      weightNumber,
      matureCapState: state,
      matureCapNote: note,
      analyzerRun: analyzerRunsBySymbol.get(p.symbol) ?? null,
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
