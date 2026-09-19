"use client";

import Link from "next/link";
import { DashboardShell } from "./components/DashboardShell";
import { DashboardTopBar } from "./components/DashboardTopBar";

// M9-NONM9-CHROME-01 — the global fallback error boundary (Next.js requires
// this file to be a Client Component). `app/` has never had one, so an
// unhandled error anywhere outside `app/analyzer/**` — the Dashboard at `/`,
// `/holdings`, `/accounts/new`, and `/analyzer` itself before its own
// error.tsx (this outcome, sibling file) intercepts it first — fell through
// to Next's built-in default page, carrying none of this product's chrome,
// tokens or wording. This is deliberately the family's own shell and
// state treatment (DashboardShell/.cb-dash, DashboardTopBar, the
// `.dashboard-section`/`.status-msg`/`.status-danger` mechanism app/page.tsx
// already uses for its own feedback lines), not the Analyzer-scoped
// `.state`/`.name`/`.cause` mechanism — this boundary is not an Analyzer
// screen.
//
// Per HARD BOUNDS, neither error.message nor a stack is ever rendered;
// error.digest may be shown as an opaque reference only.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <DashboardShell>
      <DashboardTopBar />
      <main>
        <section className="dashboard-section">
          <p className="status-msg status-danger" role="alert">
            This page could not be loaded. Something went wrong while rendering it.
            {error.digest ? ` Reference: ${error.digest}.` : null}
          </p>
          <button type="button" className="button-link" onClick={() => reset()}>
            Try again
          </button>{" "}
          <Link href="/" className="button-link">
            Return to Dashboard
          </Link>
        </section>
      </main>
    </DashboardShell>
  );
}
