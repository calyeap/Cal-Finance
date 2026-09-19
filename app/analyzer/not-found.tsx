import Link from "next/link";
import { AnalyzerShell } from "@/app/components/AnalyzerShell";
import { AnalyzerTopBar } from "@/app/components/AnalyzerTopBar";

// M9-NONM9-CHROME-01 — the nearest not-found boundary for the `/analyzer`
// entry screen. `/analyzer` is a sibling segment of `[runId]`, not a child
// of it, so `app/analyzer/[runId]/not-found.tsx` never resolves for a
// notFound() call here.
//
// Reuses PR #171's `[runId]` pattern exactly (variant, `.layout routestate`
// container, the .state/.name/.cause mechanism, one recovery action). The
// action goes to Dashboard rather than back to `/analyzer` — this boundary
// IS `/analyzer`, so pointing the recovery link at the same route would not
// offer a way forward.
export default function AnalyzerEntryNotFound() {
  return (
    <AnalyzerShell>
      <AnalyzerTopBar variant="overview" />
      <div className="layout routestate">
        <main>
          <div className="state">
            <span className="name">Page not found</span>
            <span className="cause">This page does not exist.</span>
          </div>
          <div className="actions">
            <Link href="/" className="act">
              Return to Dashboard
            </Link>
          </div>
        </main>
      </div>
    </AnalyzerShell>
  );
}
