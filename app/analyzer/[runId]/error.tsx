"use client";

import Link from "next/link";
import { AnalyzerShell } from "@/app/components/AnalyzerShell";
import { AnalyzerTopBar } from "@/app/components/AnalyzerTopBar";

// M9-STATE-HANDLING-01 — the nearest error boundary for the whole [runId]
// subtree (Next.js requires this file to be a Client Component). Both M9
// routes rethrow every error that is neither RunNotFoundError (→ notFound(),
// caught by not-found.tsx) nor SpotCheckIncompleteError (→ redirect to
// facts); this boundary is what an analyst now sees for that remaining,
// unexpected-failure case, instead of Next's default error page outside the
// chrome.
//
// DESIGN.md's Error row: role="alert", wording that names the specific
// problem — here, the level the boundary can honestly diagnose ("the
// analysis could not be completed"), not a guessed cause. Per HARD BOUNDS,
// neither error.message nor a stack is ever rendered; error.digest may be
// shown as an opaque reference only.
export default function AnalyzerRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AnalyzerShell>
      <AnalyzerTopBar variant="overview" />
      <div className="layout routestate">
        <main>
          <div className="state" role="alert">
            <span className="name">Analysis could not be completed</span>
            <span className="cause">
              Something went wrong while preparing this analysis.
              {error.digest ? ` Reference: ${error.digest}.` : null}
            </span>
          </div>
          <div className="actions">
            <button type="button" className="act" onClick={() => reset()}>
              Try again
            </button>
            <Link href="/analyzer" className="act">
              Return to Stock Analyzer
            </Link>
          </div>
        </main>
      </div>
    </AnalyzerShell>
  );
}
