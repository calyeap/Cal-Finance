import { AnalyzerShell } from "@/app/components/AnalyzerShell";
import { AnalyzerTopBar } from "@/app/components/AnalyzerTopBar";
import { AnalystBundleForm } from "@/app/components/AnalystBundleForm";
import { getRecordedAnalystBundleInput } from "@/lib/analyzer/acquisition/recordedBundles";
import { TICKERS_WITH_ANALYST_INPUTS } from "@/lib/analyzer/acquisition/analystInputs";

// CF-ANALYST-INPUT-ENTRY-01 — the entry/review screen for one ticker. A
// SEPARATE authoring surface (SCOPE item 3): reached only by typing a
// ticker here, never from the normal ticker -> analyze -> report path, and
// an already-recorded bundle can be reviewed and corrected on the same
// route rather than through a second form.

export default async function AnalystInputsTickerPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { ticker: rawTicker } = await params;
  const { saved } = await searchParams;
  const ticker = decodeURIComponent(rawTicker).trim().toUpperCase();
  const isCommitted = TICKERS_WITH_ANALYST_INPUTS.includes(ticker);
  const recorded = isCommitted ? null : await getRecordedAnalystBundleInput(ticker);

  return (
    <AnalyzerShell>
      <AnalyzerTopBar variant="steps" />
      <div className="cb-steps">
        <div className="wrap">
          <div className="sechead">
            <h2>Analyst inputs — {ticker}</h2>
            <span className="screenlabel">Separate authoring surface — not a step in the normal path</span>
          </div>
          <hr className="rule" />

          {isCommitted ? (
            <div className="state">
              <span className="name">{ticker} already has a committed bundle</span>
              <span className="cause">
                {ticker}&rsquo;s analyst inputs ship committed in code
                (lib/analyzer/acquisition/analystInputs.ts), not recorded through this entry path.
                This screen edits only recorded bundles.
              </span>
            </div>
          ) : (
            <>
              {saved === "1" && (
                <div className="ack">
                  <span className="name">Recorded</span>
                  <p>
                    {ticker}&rsquo;s analyst inputs are saved and readable by analystInputsFor.{" "}
                    {ticker} can now open a run.
                  </p>
                </div>
              )}
              <p className="why">
                {recorded === null
                  ? `${ticker} has no recorded bundle yet — it still cannot open a run.`
                  : `${ticker} has a recorded bundle, entered ` +
                    `${new Date(recorded.meta.recordedAt).toISOString().slice(0, 10)}` +
                    (recorded.meta.updatedAt !== recorded.meta.recordedAt
                      ? `, last corrected ${new Date(recorded.meta.updatedAt).toISOString().slice(0, 10)}.`
                      : ".") +
                  ` Saving below replaces it.`}
              </p>
              <p className="why">
                Every field left blank is recorded and returned as absent — never a zero, never a
                default — and reports INCOMPLETE at exactly that field. These values are entered by
                an analyst on this system, not acquired from filings, and render distinguished from
                this run&rsquo;s acquired facts.
              </p>
              <AnalystBundleForm ticker={ticker} existing={recorded?.input ?? null} />
            </>
          )}
        </div>
      </div>
    </AnalyzerShell>
  );
}
