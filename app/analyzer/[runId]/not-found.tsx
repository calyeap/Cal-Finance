import Link from "next/link";
import { AnalyzerShell } from "@/app/components/AnalyzerShell";
import { AnalyzerTopBar } from "@/app/components/AnalyzerTopBar";

// M9-STATE-HANDLING-01 — the boundary every notFound() call in this segment
// (page.tsx, report/page.tsx, and the pre-existing facts/profile screens)
// already throws on RunNotFoundError, previously caught by nothing: Next
// rendered its own bare 404, outside AnalyzerShell, with none of the chrome
// PR #169 shipped. This file is the nearest not-found boundary for the
// whole [runId] subtree (Next resolves notFound() up the segment tree to
// the nearest not-found.tsx; neither report/ nor facts/ nor profile/
// declares its own), so it renders inside the shell for all of them —
// see AnalyzerRunNotFound.test.tsx for the placement proof this outcome's
// DONE WHEN requires.
//
// DESIGN.md's Empty row: "a short line stating the situation plus one
// primary action" — realised with the Analyzer's own already-shipped
// .state/.name/.cause mechanism (contract §7: extend the existing
// structural pattern, not a new one) and its existing action treatment,
// not the Dashboard/Holdings-global .button-link.
export default function AnalyzerRunNotFound() {
  return (
    <AnalyzerShell>
      <AnalyzerTopBar variant="overview" />
      <div className="layout routestate">
        <main>
          <div className="state">
            <span className="name">Run not found</span>
            <span className="cause">This analysis run does not exist.</span>
          </div>
          <div className="actions">
            <Link href="/analyzer" className="act">
              Return to Stock Analyzer
            </Link>
          </div>
        </main>
      </div>
    </AnalyzerShell>
  );
}
