"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnalyzerShell } from "@/app/components/AnalyzerShell";
import { AnalyzerTopBar } from "@/app/components/AnalyzerTopBar";
import { AnalyzingState, type AnalyzingIdentity } from "@/app/components/AnalyzingState";

// The Analyzing pre-report state — ANALYZER-V2-PREREPORT-01. Next's
// automatic Suspense fallback for the whole [runId] segment (page.tsx,
// facts/page.tsx, profile/page.tsx — none of them declares its own
// loading.tsx, so this stays their nearest boundary, unchanged from
// M9-STATE-HANDLING-01) while its async await (advanceRunAutomatically +
// analysisForReport, on the report route) resolves.
//
// loading.tsx is always instantiated with an empty props object (Next's own
// create-component-tree.js) — there is no `params` prop to read the runId
// from. This is a Client Component so it can read the runId already in the
// URL itself (usePathname) and fetch the run's own identity from it; see
// AnalyzingState.tsx for exactly what that does and does not let this
// screen honestly claim.
//
// This boundary is shared by five routes: the run root (where
// beginAnalysisAction redirects while an analysis is actually running) plus
// report/, facts/, profile/ and snapshot/[version]/, none of which declares
// its own loading.tsx. Only the run root is ever mid-analysis, so only it
// renders AnalyzingState; the other four keep the same neutral in-place
// text this boundary always used, so opening an already-finished run's
// detail screens never claims a gathering/valuation stage that isn't real.
const RUN_ROOT = /^\/analyzer\/[^/]+$/;

export default function AnalyzerRouteLoading() {
  const pathname = usePathname();
  const isRunRoot = RUN_ROOT.test(pathname);
  const [identity, setIdentity] = useState<AnalyzingIdentity | null>(null);

  useEffect(() => {
    if (!isRunRoot) return;
    const runId = pathname.match(/^\/analyzer\/([^/]+)/)?.[1];
    if (!runId) return;

    let cancelled = false;
    fetch(`/api/analyzer/runs/${runId}/identity`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ticker: string; companyName: string } | null) => {
        if (!cancelled && data) {
          setIdentity({ ticker: data.ticker, companyName: data.companyName });
        }
      })
      .catch(() => {
        // No real state to show, so none is claimed — AnalyzingState
        // already renders the identity-pending shape for a null identity.
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, isRunRoot]);

  return (
    <AnalyzerShell>
      <AnalyzerTopBar variant="overview" />
      {isRunRoot ? (
        <AnalyzingState identity={identity} />
      ) : (
        <div className="layout routestate">
          <main>
            <div className="state">
              <span className="name">Loading</span>
              <span className="cause">Preparing this analysis run.</span>
            </div>
          </main>
        </div>
      )}
    </AnalyzerShell>
  );
}
