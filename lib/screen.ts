import type { LatestRunSummary } from "./analyzer/runStore";

// SCREEN — first bounded outcome (CF-SCREEN-FIRST-OUTCOME-01, issue #379).
//
// Pure, framework-free, like lib/portfolioReview.ts beside it: this module
// only computes a set difference and shapes data an existing accessor
// (getLatestRunForCandidateTicker) already returns. It never queries a
// database itself and adds no score, rank, or synthesised judgement of any
// kind (product-decisions.md items 5, 17; the CALVIN RULING's own exclusion
// list, docs/screen-workflow-mode-reconciliation.md §1).
//
// CANDIDATE_UNIVERSE_TICKERS — the current data-reality bound, not a
// screening policy. docs/screen-workflow-mode-reconciliation.md §4: "the
// acquire → verify → compute pipeline... support[s] real runs only for
// MSFT, OKLO, and NVDA today. There is no general 'run any ticker'
// capability." SCREEN's job is to find companies with an EXISTING,
// already-computed report — not to acquire new ones — so this list is
// fixed to exactly the companies current authority documents as
// fixture-backed, never derived by guessing or by widening it. Extending
// this list is new provider/acquisition breadth, which the ruling reserves
// as "a separate explicit gate" (reconciliation §1) — it must not be
// silently expanded here as data reality changes; that is a later, equally
// small, separately reviewed change.
export const CANDIDATE_UNIVERSE_TICKERS: readonly string[] = ["MSFT", "OKLO", "NVDA"];

export interface ScreenCandidate {
  symbol: string;
  analyzerRun: LatestRunSummary;
}

/**
 * The deterministic set difference: CANDIDATE_UNIVERSE_TICKERS minus
 * currently-held symbols, in CANDIDATE_UNIVERSE_TICKERS's own fixed order.
 * Not a ranking of any kind — there is no quality signal here to rank by,
 * only membership.
 */
export function candidateTickers(heldSymbols: ReadonlySet<string>): string[] {
  return CANDIDATE_UNIVERSE_TICKERS.filter((ticker) => !heldSymbols.has(ticker));
}

/**
 * Builds the candidate list: a not-held ticker only appears here if it also
 * has an existing Analyzer report (`runsByTicker.get(ticker)` is non-null) —
 * "companies with an existing, already-computed Analyzer report" (DO 1), not
 * every ticker this repo could theoretically run. `runsByTicker` is looked
 * up by the caller ONLY for tickers already in `candidateTickers`'s own
 * output — never a general search (mirrors lib/portfolioReview.ts's own
 * `analyzerRunsBySymbol` contract).
 */
export function buildScreenCandidates(
  heldSymbols: ReadonlySet<string>,
  runsByTicker: ReadonlyMap<string, LatestRunSummary | null>
): ScreenCandidate[] {
  const candidates: ScreenCandidate[] = [];
  for (const symbol of candidateTickers(heldSymbols)) {
    const analyzerRun = runsByTicker.get(symbol) ?? null;
    if (analyzerRun !== null) {
      candidates.push({ symbol, analyzerRun });
    }
  }
  return candidates;
}
