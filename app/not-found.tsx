import Link from "next/link";
import { DashboardShell } from "./components/DashboardShell";
import { DashboardTopBar } from "./components/DashboardTopBar";

// M9-NONM9-CHROME-01 — the global fallback not-found boundary. `app/` has
// never had one, so a notFound() call or an unmatched route anywhere outside
// `app/analyzer/**` fell through to Next's built-in default 404, carrying
// none of this product's chrome, tokens or wording. This is deliberately
// the family's own shell and state treatment (DashboardShell/.cb-dash,
// DashboardTopBar, the `.dashboard-section`/`.status-msg` mechanism
// app/page.tsx already uses), not the Analyzer-scoped `.state`/`.name`/
// `.cause` mechanism — this boundary is not an Analyzer screen.
export default function RootNotFound() {
  return (
    <DashboardShell>
      <DashboardTopBar />
      <main>
        <section className="dashboard-section">
          <p className="status-msg status-neutral">This page does not exist.</p>
          <Link href="/" className="button-link">
            Return to Dashboard
          </Link>
        </section>
      </main>
    </DashboardShell>
  );
}
