import { listAccounts } from "@/lib/accounts";
import { getPortfolioView } from "@/lib/portfolio";
import { CANDIDATE_UNIVERSE_TICKERS, buildScreenCandidates } from "@/lib/screen";
import { getLatestRunForCandidateTicker, type LatestRunSummary } from "@/lib/analyzer/runStore";
import { screenVerdictDisplay } from "./verdictDisplay";
import { ScreenTable } from "../components/ScreenTable";

// SCREEN — first bounded outcome (CF-SCREEN-FIRST-OUTCOME-01, issue #379).
// One new, read-only route, distinct from Dashboard/Holdings/Portfolio
// Review/Analyzer — none of those routes/components are modified by this
// outcome (DO 7). Like Portfolio Review's own first outcome, this surface's
// design contract is open (DESIGN.md:3-10 governs only the Portfolio-era
// surfaces it names), so it reuses only the original shared foundation
// (`.page-shell`, `.editor-table`, app/globals.css's unscoped rules) rather
// than either redesigned surface's own look. AI DEFAULT: route name, layout,
// and this reuse choice — reversible by a later, separately authorised
// design pass.
//
// AI DEFAULT: no nav link is added anywhere, same posture Portfolio Review's
// first outcome took — this route is URL-reachable only for this first
// bounded outcome.
//
// Always render dynamically — reads live DB state (holdings, and each
// candidate's own latest run) on every request, same reasoning as
// app/portfolio-review/page.tsx.
export const dynamic = "force-dynamic";

export default async function ScreenPage() {
  const accounts = await listAccounts();
  const heldSymbols = new Set<string>();
  if (accounts.length > 0) {
    const portfolio = await getPortfolioView();
    for (const position of portfolio.positions) {
      heldSymbols.add(position.symbol);
    }
  }

  const notHeldUniverseTickers = CANDIDATE_UNIVERSE_TICKERS.filter(
    (ticker) => !heldSymbols.has(ticker)
  );
  const lookups = await Promise.all(
    notHeldUniverseTickers.map(async (ticker): Promise<[string, LatestRunSummary | null]> => [
      ticker,
      await getLatestRunForCandidateTicker(ticker),
    ])
  );
  const runsByTicker = new Map(lookups);
  const candidates = await Promise.all(
    buildScreenCandidates(heldSymbols, runsByTicker).map(async (candidate) => ({
      ...candidate,
      verdict: await screenVerdictDisplay(candidate.analyzerRun.runId),
    }))
  );

  return (
    <main className="page-shell">
      <h1>Screen</h1>
      <p className="status-msg status-neutral">
        A read-only, pre-portfolio candidate view. It lists companies with an existing Analyzer
        report that Cal Finance does not currently hold, and links each to that existing report —
        it makes no recommendation of any kind, orders nothing by priority, and suggests no
        action. The list below is every eligible candidate, once each, not a quality-ordered list.
      </p>

      {candidates.length === 0 ? (
        <section>
          <p>
            No candidates right now — none of the companies this repo can currently evaluate has
            an existing Analyzer report while also not being a current holding.
          </p>
        </section>
      ) : (
        <section>
          <h2>Candidates</h2>
          <ScreenTable candidates={candidates} />
        </section>
      )}
    </main>
  );
}
