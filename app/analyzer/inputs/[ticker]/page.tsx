import { AnalyzerShell } from "@/app/components/AnalyzerShell";
import { AnalyzerTopBar } from "@/app/components/AnalyzerTopBar";
import { AssumptionSheetPanel, RedraftForm } from "@/app/components/AssumptionSheetPanel";
import { sheetHistory } from "@/lib/analyzer/sheets/sheetStore";
import { validationContextFor } from "@/lib/analyzer/sheets/adopt";
import { validateSheet, type ValidatorFinding } from "@/lib/analyzer/sheets/validators";
import type { AssumptionSheet } from "@/lib/analyzer/sheets/sheet";

// CF-AR6-ANY-TICKER-DRAFTS-01 — one ticker's assumption sheet (product-
// decisions item 30, D5): the sheet in force, the latest draft where it
// differs, each driver with its anchor and sources, the validators, adopt /
// adjust, and a fresh draft. Reached from a report whose verdict waits for
// adoption, or by ticker. Nothing here computes a valuation or a verdict.

async function findingsFor(ticker: string, sheet: AssumptionSheet): Promise<ValidatorFinding[]> {
  if (sheet.content.cannotConclude) return [];
  try {
    const ctx = await validationContextFor(ticker, sheet.content);
    const requireAnchors = sheet.origin === "AI DRAFT";
    return [...validateSheet(sheet.content, { ...ctx, requireAnchors, forAdoption: sheet.status === "ADOPTED" }), ...ctx.stale];
  } catch (err) {
    return [
      {
        check: "STALE",
        severity: "WARNING",
        message: `the company's filed history could not be read to check this sheet (${err instanceof Error ? err.message : String(err)})`,
      },
    ];
  }
}

export default async function AssumptionSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ run?: string; adopted?: string; drafted?: string; refused?: string }>;
}) {
  const { ticker: rawTicker } = await params;
  const { run, adopted, drafted, refused } = await searchParams;
  const ticker = decodeURIComponent(rawTicker).trim().toUpperCase();
  const runId = run ?? null;
  const history = await sheetHistory(ticker);
  const latestAdopted = [...history].reverse().find((s) => s.status === "ADOPTED") ?? null;
  const latestDraft = [...history].reverse().find((s) => s.status === "DRAFT") ?? null;
  const inForce = latestAdopted ?? latestDraft;
  const pendingDraft = latestDraft !== null && (latestAdopted === null || latestDraft.version > latestAdopted.version) ? latestDraft : null;

  const panels: { sheet: AssumptionSheet; adoptable: boolean; findings: ValidatorFinding[] }[] = [];
  if (pendingDraft !== null) panels.push({ sheet: pendingDraft, adoptable: true, findings: await findingsFor(ticker, pendingDraft) });
  if (latestAdopted !== null) panels.push({ sheet: latestAdopted, adoptable: pendingDraft === null, findings: await findingsFor(ticker, latestAdopted) });
  const stale = panels.some((p) => p.findings.some((f) => f.check === "STALE"));

  return (
    <AnalyzerShell>
      <AnalyzerTopBar variant="steps" />
      <div className="cb-steps">
        <div className="wrap">
          <div className="sechead">
            <h2>Assumption sheet — {ticker}</h2>
            <span className="screenlabel">Price-blind draft · your adoption finalises the verdict</span>
          </div>
          <hr className="rule" />

          {adopted && (
            <div className="ack">
              <span className="name">Adopted</span>
              <p>
                Version {adopted} is now {ticker}&rsquo;s sheet in force.{" "}
                {runId !== null && <a href={`/analyzer/${encodeURIComponent(runId)}`}>Back to the report</a>}
              </p>
            </div>
          )}
          {drafted && (
            <div className="ack">
              <span className="name">Drafted</span>
              <p>Version {drafted} is a new draft, waiting for your adoption.</p>
            </div>
          )}
          {refused && (
            <div className="state">
              <span className="name">Not done</span>
              <span className="cause">{refused}</span>
            </div>
          )}

          {inForce === null ? (
            <p className="why">
              {ticker} has no assumption sheet yet. One is drafted the first time {ticker} is analysed, or now, below.
            </p>
          ) : (
            <p className="why">
              In force: version {inForce.version} ({inForce.status === "ADOPTED" ? "adopted" : "draft — the final verdict waits for your adoption"}).
              {pendingDraft !== null && latestAdopted !== null && ` A newer draft, version ${pendingDraft.version}, waits for your adoption; version ${latestAdopted.version} stays in force until then.`}
            </p>
          )}

          {panels.map((p) => (
            <AssumptionSheetPanel key={p.sheet.id} sheet={p.sheet} findings={p.findings} runId={runId} adoptable={p.adoptable} />
          ))}

          <RedraftForm
            ticker={ticker}
            runId={runId}
            why={
              stale
                ? "This sheet reads stale against the latest filings (see the checks above). A fresh draft is a new version; your adopted sheet stays in force until you adopt it."
                : "A fresh price-blind draft from the latest filings, as a new version. Your adopted sheet, if any, stays in force until you adopt the new one."
            }
          />

          {history.length > 0 && (
            <section aria-label="Versions">
              <div className="sechead" style={{ marginTop: 32 }}>
                <h3>Versions</h3>
                <span className="screenlabel">Append-only</span>
              </div>
              <ul className="note">
                {history.map((s) => (
                  <li key={s.id}>
                    Version {s.version} — {s.status.toLowerCase()}, {s.origin.toLowerCase()}, {s.recordedAt.slice(0, 10)}
                    {s.adoptedFrom !== null && ` (from version ${history.find((h) => h.id === s.adoptedFrom)?.version ?? "?"})`}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </AnalyzerShell>
  );
}
