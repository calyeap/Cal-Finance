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
export default function AnalyzerRouteLoading() {
  const pathname = usePathname();
  const [identity, setIdentity] = useState<AnalyzingIdentity | null>(null);

  useEffect(() => {
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
  }, [pathname]);

  return (
    <AnalyzerShell>
      <AnalyzerTopBar variant="overview" />
      <AnalyzingState identity={identity} />
    </AnalyzerShell>
  );
}
