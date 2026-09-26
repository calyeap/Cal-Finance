import Link from "next/link";
import { listAccounts } from "@/lib/accounts";
import { getPortfolioView } from "@/lib/portfolio";
import { getLatestRunsForTickers } from "@/lib/analyzer/runStore";
import { buildPortfolioReview } from "@/lib/portfolioReview";
import { PortfolioReviewShell } from "../components/PortfolioReviewShell";
import { PortfolioReviewTopBar } from "../components/PortfolioReviewTopBar";
import { PortfolioReviewTable } from "../components/PortfolioReviewTable";

// Always render dynamically — reads live DB state on every request, same
// rationale as app/page.tsx and app/holdings/page.tsx. This route has no
// mutating action of its own, so nothing needs to revalidatePath("/portfolio-review"),
// but a stale cached snapshot of someone else's live holdings/review state
// would be exactly the honesty failure this outcome exists to avoid.
export const dynamic = "force-dynamic";

// PORTFOLIO REVIEW — first bounded implementation (CF-PORTFOLIO-REVIEW-FIRST-OUTCOME-01,
// issue #352). One new, read-only route. It does not modify `/`, `/holdings`
// or `/accounts/new`, their components, or their behaviour (HARD BOUNDS 9),
// and nothing on this page writes anything — no server action, no mutation
// of holdings, positions, accounts, prices, runs or Analyzer data (HARD
// BOUNDS 1).
export default async function PortfolioReviewPage() {
  const accounts = await listAccounts();
  const portfolio = accounts.length > 0 ? await getPortfolioView() : null;
  const hasHoldings = portfolio !== null && portfolio.positions.length > 0;

  // Analyzer-report lookup is scoped to exactly the symbols already held —
  // never a general listing (lib/analyzer/runStore.ts's own header and issue
  // #352 SCOPE 6).
  const heldSymbols = hasHoldings ? Array.from(new Set(portfolio!.positions.map((p) => p.symbol))) : [];
  const analyzerRuns = await getLatestRunsForTickers(heldSymbols);

  const review = hasHoldings
    ? buildPortfolioReview(
        portfolio!.positions.map((p) => ({
          symbol: p.symbol,
          assetClass: p.assetClass,
          marketValueUsd: p.marketValueUsd,
          priceStatus: p.priceStatus,
        })),
        portfolio!.totalMarketValueUsd,
        portfolio!.excludedFromTotalSymbols,
        analyzerRuns
      )
    : null;

  return (
    <PortfolioReviewShell>
      <PortfolioReviewTopBar />
      <main>
        {!hasHoldings ? (
          <section className="dashboard-section">
            <p>No holdings yet.</p>
            <Link href="/accounts/new" className="button-link">
              Add your holdings
            </Link>
          </section>
        ) : (
          <PortfolioReviewTable review={review!} />
        )}
      </main>
    </PortfolioReviewShell>
  );
}
