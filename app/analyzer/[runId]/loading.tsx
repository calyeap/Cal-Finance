import { AnalyzerShell } from "@/app/components/AnalyzerShell";
import { AnalyzerTopBar } from "@/app/components/AnalyzerTopBar";

// M9-STATE-HANDLING-01 — the nearest loading boundary for the whole
// [runId] subtree. Both M9 routes are async server components that do a
// loadGateState DB read and the full gated analysisForReport computation
// before returning any markup; with no loading.tsx, navigation showed the
// previous page until the whole thing resolved. This is what renders in
// the meantime instead.
//
// DESIGN.md is explicit: no spinners or overlays — and by the same rule,
// no skeleton shimmer either. In-place text naming what is happening,
// same .state/.name/.cause mechanism as every other state on this page.
export default function AnalyzerRouteLoading() {
  return (
    <AnalyzerShell>
      <AnalyzerTopBar variant="overview" />
      <div className="layout routestate">
        <main>
          <div className="state">
            <span className="name">Loading</span>
            <span className="cause">Preparing this analysis run.</span>
          </div>
        </main>
      </div>
    </AnalyzerShell>
  );
}
