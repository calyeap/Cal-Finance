import { AnalyzerShell } from "@/app/components/AnalyzerShell";
import { AnalyzerTopBar } from "@/app/components/AnalyzerTopBar";

// M9-NONM9-CHROME-01 — the nearest loading boundary for the `/analyzer`
// entry screen, its own sibling segment rather than a child of `[runId]`
// (no run exists yet at this route, so `app/analyzer/[runId]/loading.tsx`
// cannot resolve for it). Same reason as that file (PR #171):
// AnalyzerEntryPage is an async server component that awaits `searchParams`
// before returning any markup, and this segment previously had no
// loading.tsx of its own, so Next fell through to showing the previous page
// until it resolved.
//
// Reuses PR #171's `[runId]` pattern exactly, including its `variant`
// choice and `.layout routestate` container — a route-level state page is
// its own generic surface, not a restatement of the screen's own content
// container (AnalyzerEntry's `.cb-steps .wrap`).
//
// DESIGN.md is explicit: no spinners or overlays, no skeleton shimmer.
// In-place text naming what is happening, the same .state/.name/.cause
// mechanism as every other state on this page.
export default function AnalyzerEntryLoading() {
  return (
    <AnalyzerShell>
      <AnalyzerTopBar variant="overview" />
      <div className="layout routestate">
        <main>
          <div className="state">
            <span className="name">Loading</span>
            <span className="cause">Preparing Stock Analyzer.</span>
          </div>
        </main>
      </div>
    </AnalyzerShell>
  );
}
