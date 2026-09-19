"use client";

import Link from "next/link";
import { AnalyzerShell } from "@/app/components/AnalyzerShell";
import { AnalyzerTopBar } from "@/app/components/AnalyzerTopBar";

// M9-NONM9-CHROME-01 — the nearest error boundary for the `/analyzer` entry
// screen (Next.js requires this file to be a Client Component). `/analyzer`
// is a sibling segment of `[runId]`, not a child of it, so
// `app/analyzer/[runId]/error.tsx` never resolves for a failure here — this
// is what an analyst now sees instead of Next's default error page outside
// the chrome.
//
// Reuses PR #171's `[runId]` pattern exactly (variant, `.layout routestate`
// container, role="alert", the .state/.name/.cause mechanism). Per HARD
// BOUNDS, neither error.message nor a stack is ever rendered; error.digest
// may be shown as an opaque reference only. Recovery goes to Dashboard, not
// back to `/analyzer` itself — this boundary IS `/analyzer`, so `reset()` is
// the "try the same page again" action and the link offers a different,
// known-working destination.
export default function AnalyzerEntryError({
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
            <span className="name">Stock Analyzer could not be loaded</span>
            <span className="cause">
              Something went wrong while preparing this screen.
              {error.digest ? ` Reference: ${error.digest}.` : null}
            </span>
          </div>
          <div className="actions">
            <button type="button" className="act" onClick={() => reset()}>
              Try again
            </button>
            <Link href="/" className="act">
              Return to Dashboard
            </Link>
          </div>
        </main>
      </div>
    </AnalyzerShell>
  );
}
