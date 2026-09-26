import Link from "next/link";
import { listAccounts } from "@/lib/accounts";
import { getPortfolioView } from "@/lib/portfolio";
import { buildPortfolioReviewView, MATURE_POSITION_CAP_PERCENT } from "@/lib/portfolioReview";
import { getLatestRunForHeldTicker, type LatestRunSummary } from "@/lib/analyzer/runStore";
import { PortfolioReviewTable } from "../components/PortfolioReviewTable";
import { MaskableValue } from "../components/MaskableValue";

// PORTFOLIO REVIEW — first bounded outcome (CF-PORTFOLIO-REVIEW-FIRST-OUTCOME-01,
// issue #352). One new, read-only route. Distinct from, not built on top of,
// Dashboard/Holdings/the setup wizard (reconciliation §3): it reads the same
// `getPortfolioView()` position data those routes already read, but does not
// import DashboardShell/HoldingsShell or either of their scoped token
// systems — this surface's own design contract is open (reconciliation §3;
// DESIGN.md:3-10), so it reuses only the ORIGINAL shared foundation
// (`.page-shell`, `app/globals.css`'s unscoped rules) that `/accounts/new`
// still uses today, per the same "no approved contract yet" default rather
// than borrowing either redesigned surface's own look. AI DEFAULT: route
// name, layout and this reuse choice — reversible by a later, separately
// authorised design pass; nothing here claims design authority (SCOPE 7).
//
// AI DEFAULT: no nav link is added anywhere (SCOPE 8, DECISION HORIZON) —
// this route is URL-reachable only for this first bounded outcome. Where
// PORTFOLIO REVIEW belongs in navigation is left open.
//
// Always render dynamically — reads live DB state on every request, same
// reasoning as app/page.tsx and app/holdings/page.tsx.
export const dynamic = "force-dynamic";

export default async function PortfolioReviewPage() {
  const accounts = await listAccounts();
  const portfolio = accounts.length > 0 ? await getPortfolioView() : null;
  const hasHoldings = portfolio !== null && portfolio.positions.length > 0;

  const view = hasHoldings
    ? await buildView(portfolio!)
    : null;

  return (
    <main className="page-shell">
      <h1>Portfolio Review</h1>
      <p className="status-msg status-neutral">
        A read-only, cross-holding concentration review. It states what is true about each
        current holding's weight against the existing approved allocation policy and links any
        existing Analyzer report — it makes no recommendation of any kind, orders nothing by
        priority, and never trims or resolves a review state it names.
      </p>

      {!hasHoldings ? (
        <section>
          <p>No holdings yet.</p>
          <Link href="/accounts/new" className="button-link">
            Add your holdings
          </Link>
        </section>
      ) : (
        <>
          <section>
            <h2>What this weight is computed against</h2>
            <p className="status-msg status-neutral">
              Each holding&apos;s weight below is its market value ÷ US$
              <MaskableValue>{view!.totalPricedMarketValueUsd}</MaskableValue>, the portfolio&apos;s
              total priced market value — the same total computeAllocation and the Dashboard&apos;s
              allocation view already use. No second total is computed here.
            </p>
            {view!.excludedFromTotalSymbols.length > 0 && (
              <p className="status-msg status-warning">
                That total excludes {view!.excludedFromTotalSymbols.length} holding
                {view!.excludedFromTotalSymbols.length === 1 ? "" : "s"} with no price yet (
                {view!.excludedFromTotalSymbols.join(", ")}) — it is a floor, not the true total, and
                no weight or cap conclusion is asserted for {view!.excludedFromTotalSymbols.length === 1 ? "that holding" : "those holdings"}.
              </p>
            )}
          </section>

          <section>
            <h2>Which caps this view can honestly check</h2>
            <p className="status-msg status-neutral">
              The {MATURE_POSITION_CAP_PERCENT}% mature-position cap is checked below, per position.
            </p>
            <p className="status-msg status-neutral">
              The 25% sector / tightly-related-theme cap and the speculative-sleeve limits (5–10% of
              the stock portfolio, 10% ceiling, 3% individual speculative position) are named by the
              approved allocation policy but are <strong>not checked anywhere on this page</strong>:
              no sector, theme, or speculative classification exists in this repo, and this view does
              not invent one. These figures are cited from
              docs/frozen/calfinance-methodology-v2.md:399-408, and INVESTING, not Cal Finance, owns
              them.
            </p>
            <p className="status-msg status-neutral">
              Context only, not a check: the approved policy also names a 5% maximum initial position
              and a normal 12–20-stock guideline. Both constrain sizing a position when it is opened,
              not a current weight, so neither is evaluated here. This portfolio currently holds{" "}
              {view!.rows.length} position{view!.rows.length === 1 ? "" : "s"}.
            </p>
          </section>

          <section>
            <h2>Holdings</h2>
            <PortfolioReviewTable rows={view!.rows} />
          </section>
        </>
      )}
    </main>
  );
}

async function buildView(portfolio: NonNullable<Awaited<ReturnType<typeof getPortfolioView>>>) {
  const symbols = Array.from(new Set(portfolio.positions.map((p) => p.symbol)));
  const lookups = await Promise.all(
    symbols.map(async (symbol): Promise<[string, LatestRunSummary | null]> => [
      symbol,
      await getLatestRunForHeldTicker(symbol),
    ])
  );
  const analyzerRunsBySymbol = new Map(lookups);

  return buildPortfolioReviewView(
    portfolio.positions,
    portfolio.totalMarketValueUsd,
    portfolio.excludedFromTotalSymbols,
    analyzerRunsBySymbol
  );
}
