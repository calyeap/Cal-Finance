import { redirect } from "next/navigation";
import { AnalyzerShell } from "@/app/components/AnalyzerShell";
import { AnalyzerTopBar } from "@/app/components/AnalyzerTopBar";

// CF-AR6-ANY-TICKER-DRAFTS-01 — the assumption-sheet index: pick a ticker to
// review, adjust and adopt its sheet (app/analyzer/inputs/[ticker]). Not a
// step in the ticker -> analyze -> report path (frozen §14.8): a new ticker's
// draft is written automatically, and the report links here when its verdict
// waits for adoption.

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
            <h2>Assumption sheets</h2>
            <span className="screenlabel">Review, adjust and adopt</span>
          </div>
          <hr className="rule" />
          <p className="why">
            Each company&rsquo;s scenarios, moat class and policy constants live on its assumption
            sheet: a price-blind draft from its filings, every driver citing its anchor, until you
            adopt it — as drafted or adjusted. Adoption is what lets the final verdict issue.
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
