import Decimal from "decimal.js";
import type { AssetClass } from "./assetClass";
import { computeAllocation, type AllocationInput } from "./allocation";
import type { PriceStatus } from "./portfolio";

// PORTFOLIO REVIEW — first bounded implementation (CF-PORTFOLIO-REVIEW-FIRST-OUTCOME-01).
// Read-only. Describes, never prescribes (DESIGN.md:39-41; docs/product-decisions.md
// item 4 — "REVIEW ≠ automatic action"). No BUY/HOLD/SELL, score, ranking, or
// cross-company synthesized judgement of any kind belongs in this module or in
// anything it computes.

// The one existing approved cap this repo can honestly check today: a
// position's own weight against the mature-position cap
// (docs/frozen/calfinance-methodology-v2.md:403-404,410, SETTLED HARD,
// approved by Calvin 14 Sep 2026). Consumed, never widened or invented
// (docs/product-decisions.md item 14 — INVESTING owns this figure).
export const MATURE_POSITION_CAP_PERCENT = 10;

// The two named caps this first implementation cannot honestly check: no
// sector/theme or speculative-sleeve classification exists anywhere in this
// repo for a position (issue #352 SCOPE 4). Named once, here, so the page and
// its tests share one source of truth instead of each inventing its own
// wording. AssetClass ("equity" | "etf" | "crypto", lib/assetClass.ts) is an
// asset class, not a sector or theme, and is never substituted for one.
export interface UncheckableCap {
  label: string;
  limitText: string;
  reason: string;
}

export const UNCHECKABLE_CAPS: readonly UncheckableCap[] = [
  {
    label: "Sector / tightly related theme cap",
    limitText:
      "maximum deliberate sector or tightly related theme exposure: 25% (docs/frozen/calfinance-methodology-v2.md:405)",
    reason:
      "not checkable — no sector or theme classification exists in this repo. A holding's asset class (equity / ETF / crypto) is not a sector or theme and is not used as one.",
  },
  {
    label: "Speculative sleeve limits",
    limitText:
      "speculative sleeve 5–10% of stock portfolio, hard ceiling 10%; individual speculative position maximum 3% (docs/frozen/calfinance-methodology-v2.md:407-408)",
    reason: "not checkable — no speculative designation exists for any position in this repo.",
  },
] as const;

// Sizing/construction figures that constrain a NEW or increased position, not
// a current holding's weight — shown as context only; this view claims no
// check against either (issue #352 SCOPE 4).
export interface ContextOnlyPolicyFigure {
  label: string;
  text: string;
}

export const CONTEXT_ONLY_POLICY_FIGURES: readonly ContextOnlyPolicyFigure[] = [
  {
    label: "Normal portfolio guideline",
    text: "approximately 12–20 stocks (docs/frozen/calfinance-methodology-v2.md:401)",
  },
  {
    label: "Maximum normal initial position",
    text: "5% (docs/frozen/calfinance-methodology-v2.md:402)",
  },
] as const;

export interface PortfolioReviewPositionInput {
  symbol: string;
  assetClass: AssetClass;
  marketValueUsd: Decimal | null;
  priceStatus: PriceStatus;
}

// What a caller already knows about a symbol's most recent Analyzer run —
// lib/analyzer/runStore.ts's getLatestRunsForTickers is the sole, scoped
// source of this map; it is never looked up beyond the caller's own
// currently-held symbols.
export interface AnalyzerRunLink {
  runId: string;
  createdAt: string;
}

export interface PortfolioReviewEntry {
  symbol: string;
  assetClass: AssetClass;
  // Both null together exactly when this holding has no usable market value
  // (PriceStatus "unavailable") — the same "no usable price" case
  // lib/allocation.ts already excludes from an allocation entry.
  marketValueUsd: string | null;
  weightPercent: string | null;
  // True only when the weight is honestly computed against a non-floor
  // denominator AND exceeds the mature-position cap. Never true merely
  // because a weight could not be computed.
  matureCapReview: boolean;
  priceStatus: PriceStatus;
  analyzerRun: AnalyzerRunLink | null;
}

export interface PortfolioReviewView {
  entries: PortfolioReviewEntry[];
  // The exact denominator every weight above was computed against — the
  // same priced-total computeAllocation already uses (lib/allocation.ts),
  // never a second total.
  denominatorUsd: string;
  // True when one or more holdings carry no price at all, which makes
  // denominatorUsd a FLOOR (lib/portfolio.ts:48-67) rather than the true
  // portfolio value. While true, no entry's matureCapReview may be true:
  // dividing by a floor inflates every weight, so a breach the data shows
  // is not one the data can honestly support.
  isDenominatorFloor: boolean;
  excludedSymbols: string[];
  matureCapPercent: number;
}

// Builds the PORTFOLIO REVIEW view from data lib/portfolio.ts and
// lib/allocation.ts already compute. Deliberately re-derives no weight of
// its own: `computeAllocation` is called exactly once, with the same inputs
// AllocationDonut already passes it, and this function only reads its
// output back out. `positions` and `allocation`'s filtered/priced subset
// stay in the same relative order (computeAllocation preserves input order
// and only ever drops unpriced rows), so walking both together — advancing
// the allocation cursor only on a priced position — reattaches the right
// entry to the right position without keying by symbol, which would
// misattribute a weight whenever the same symbol is held in more than one
// account (getPortfolioView's own granularity is per account+asset, and nothing
// here aggregates across accounts, matching AllocationDonut's own "by holding"
// treatment of the same case).
export function buildPortfolioReview(
  positions: readonly PortfolioReviewPositionInput[],
  totalMarketValueUsd: Decimal,
  excludedFromTotalSymbols: readonly string[],
  analyzerRunsBySymbol: ReadonlyMap<string, AnalyzerRunLink>
): PortfolioReviewView {
  const allocationInputs: AllocationInput[] = positions.map((p) => ({
    symbol: p.symbol,
    marketValueUsd: p.marketValueUsd,
  }));
  const allocation = computeAllocation(allocationInputs, totalMarketValueUsd);
  const isDenominatorFloor = excludedFromTotalSymbols.length > 0;

  let allocIdx = 0;
  const entries: PortfolioReviewEntry[] = positions.map((p) => {
    const allocationEntry = p.marketValueUsd !== null ? allocation.entries[allocIdx++] : undefined;

    const matureCapReview =
      !isDenominatorFloor &&
      allocationEntry !== undefined &&
      allocationEntry.percentNumber > MATURE_POSITION_CAP_PERCENT;

    return {
      symbol: p.symbol,
      assetClass: p.assetClass,
      marketValueUsd: allocationEntry ? allocationEntry.marketValueUsd : null,
      weightPercent: allocationEntry ? allocationEntry.percent : null,
      matureCapReview,
      priceStatus: p.priceStatus,
      analyzerRun: analyzerRunsBySymbol.get(p.symbol) ?? null,
    };
  });

  return {
    entries,
    denominatorUsd: allocation.totalUsd,
    isDenominatorFloor,
    excludedSymbols: [...excludedFromTotalSymbols],
    matureCapPercent: MATURE_POSITION_CAP_PERCENT,
  };
}
