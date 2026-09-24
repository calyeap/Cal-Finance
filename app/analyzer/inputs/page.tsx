import { redirect } from "next/navigation";
import { AnalyzerShell } from "@/app/components/AnalyzerShell";
import { AnalyzerTopBar } from "@/app/components/AnalyzerTopBar";

// CF-ANALYST-INPUT-ENTRY-01 — the recorded analyst-input entry path's own
// index. A SEPARATE authoring surface (SCOPE item 3), not a step inserted
// into the normal ticker -> analyze -> report path (frozen §14.8): nothing
// here is reachable from AnalyzerEntry's begin-analysis action, and a
// company that already has a bundle never passes through this route.

export default async function AnalystInputsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ ticker?: string }>;
}) {
  const { ticker } = await searchParams;
  const trimmed = (ticker ?? "").trim();
  if (trimmed !== "") {
    redirect(`/analyzer/inputs/${encodeURIComponent(trimmed.toUpperCase())}`);
  }

  return (
    <AnalyzerShell>
      <AnalyzerTopBar variant="steps" />
      <div className="cb-steps">
        <div className="wrap">
          <div className="sechead">
            <h2>Analyst input entry</h2>
            <span className="screenlabel">Separate authoring surface — not a step in the normal path</span>
          </div>
          <hr className="rule" />
          <p className="why">
            Enter or review the Step 7 analyst inputs for one ticker: the three scenarios with
            their drivers and written anchors, the three scenario values, and the four §7.1
            constants. A ticker with no recorded bundle still has no scenarios and still cannot
            open a run — recording one here is what changes that, for this ticker only.
          </p>

          <form method="GET">
            <label className="fieldlabel" htmlFor="ticker">
              Ticker
            </label>
            <input
              className="inset"
              id="ticker"
              name="ticker"
              autoComplete="off"
              spellCheck={false}
              placeholder="e.g. NVDA"
              required
            />
            <div className="continue" style={{ marginTop: 20 }}>
              <button className="act" type="submit">
                Continue
              </button>
            </div>
          </form>
        </div>
      </div>
    </AnalyzerShell>
  );
}
