import { adoptSheetAction, redraftSheetAction } from "@/app/actions/analystInputs";
import type { ValidatorFinding } from "@/lib/analyzer/sheets/validators";
import { DRIVER_KEYS, DRIVER_LABELS, SCENARIO_KEYS, type AssumptionSheet, type DriverAnchor, type SheetSource } from "@/lib/analyzer/sheets/sheet";

// ---------------------------------------------------------------------------
// CF-AR6-ANY-TICKER-DRAFTS-01 — one assumption sheet, its anchors and
// sources, its validator findings, and the adopt / adjust form (product-
// decisions item 30). Built from the existing step-screen vocabulary
// (`.cb-steps`, `.judgment`, `.fieldlabel`, `.inset`, `.act`, `.state`, `table.t`) — no
// new CSS class; this is not a report tab and no verdict renders here.
// ---------------------------------------------------------------------------

const SCENARIO_LABEL = { bear: "Bear", base: "Base", bull: "Bull" } as const;
const PERCENT_DRIVERS = new Set(["revenueGrowthOrPath", "operatingMargin", "returnOnNewInvestment", "reinvestmentCapitalIntensity"]);

function shown(driver: string, raw: string | null | undefined): string {
  if (raw === null || raw === undefined || raw.trim() === "") return "not set";
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return PERCENT_DRIVERS.has(driver) ? `${(n * 100).toFixed(1)}%` : n.toLocaleString("en-US");
}

function Cites({ anchor }: { anchor: DriverAnchor | null | undefined }) {
  if (anchor === null || anchor === undefined) return <span className="lab">no anchor recorded</span>;
  return (
    <>
      {anchor.text}{" "}
      {anchor.cites.length > 0 && (
        <span className="lab">
          [
          {anchor.cites.map((c, i) => (
            <span key={c}>
              {i > 0 && ", "}
              <a href={`#source-${c}`}>{c}</a>
            </span>
          ))}
          ]
        </span>
      )}
    </>
  );
}

export function SheetFindings({ findings }: { findings: ValidatorFinding[] }) {
  if (findings.length === 0) return <p className="note">Every validator passes on this sheet.</p>;
  return (
    <ul className="note" data-role="sheet-findings">
      {findings.map((f, i) => (
        <li key={i} data-severity={f.severity}>
          <b>{f.severity === "ERROR" ? "Must fix" : "Check"}</b> ({f.check.toLowerCase()}): {f.message}
        </li>
      ))}
    </ul>
  );
}

function Sources({ sources }: { sources: SheetSource[] }) {
  if (sources.length === 0) return null;
  return (
    <section aria-label="Sources">
      <div className="sechead" style={{ marginTop: 32 }}>
        <h3>Sources</h3>
        <span className="screenlabel">Every anchor cites these</span>
      </div>
      {sources.map((s) => (
        <details key={s.id} id={`source-${s.id}`} className="judgment">
          <summary>
            <b>{s.id}</b> — {s.label}
            {s.accession && <span className="lab"> · accession {s.accession}</span>}
            {s.url && (
              <>
                {" "}
                · <a href={s.url}>filing</a>
              </>
            )}
          </summary>
          <p className="why">{s.excerpt}</p>
        </details>
      ))}
    </section>
  );
}

export function AssumptionSheetPanel({
  sheet,
  findings,
  runId,
  adoptable,
}: {
  sheet: AssumptionSheet;
  findings: ValidatorFinding[];
  runId: string | null;
  adoptable: boolean;
}) {
  const c = sheet.content;
  return (
    <section aria-label={`Assumption sheet version ${sheet.version}`} data-sheet-version={sheet.version} data-sheet-status={sheet.status}>
      <div className="sechead" style={{ marginTop: 24 }}>
        <h3>
          Version {sheet.version} — {sheet.status === "ADOPTED" ? "adopted" : "draft"}
        </h3>
        <span className="screenlabel">
          {sheet.origin.toLowerCase()} · {sheet.recordedAt.slice(0, 10)}
          {sheet.model ? ` · drafted by ${sheet.model}` : ""}
        </span>
      </div>

      {c.cannotConclude ? (
        <div className="state">
          <span className="name">Can&rsquo;t conclude</span>
          <span className="cause">{c.cannotConclude}</span>
        </div>
      ) : (
        <>
          <SheetFindings findings={findings} />
          <div style={{ overflowX: "auto" }}>
          <table className="t">
            <thead>
              <tr>
                <th>Driver</th>
                {SCENARIO_KEYS.map((k) => (
                  <th key={k}>{SCENARIO_LABEL[k]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DRIVER_KEYS.map((d) => (
                <tr key={d}>
                  <td>{DRIVER_LABELS[d]}</td>
                  {SCENARIO_KEYS.map((k) => (
                    <td key={k}>
                      <b>{shown(d, c.scenarios[k][d] ?? null)}</b>
                      <div className="lab">
                        <Cites anchor={c.scenarios[k].anchors?.[d]} />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td>Story</td>
                {SCENARIO_KEYS.map((k) => (
                  <td key={k}>{c.scenarios[k].writtenAnchor}</td>
                ))}
              </tr>
            </tbody>
          </table>
          </div>
          <p className="why">
            <b>Moat class: {c.moatClass ?? "not set"}.</b> <Cites anchor={c.moatAnchor} />
          </p>
          <p className="why">
            <b>
              NOPAT tax rate {shown("returnOnNewInvestment", c.configuredConstants.nopatTaxRate)}; stress margin{" "}
              {shown("operatingMargin", c.configuredConstants.stressMarginLevel)}.
            </b>{" "}
            <Cites anchor={c.constantsAnchor} />
          </p>
        </>
      )}

      {adoptable && !c.cannotConclude && (
        <form action={adoptSheetAction} className="judgment" data-role="adopt-sheet" style={{ marginTop: 24 }}>
          <input type="hidden" name="ticker" value={sheet.ticker} />
          <input type="hidden" name="sheetId" value={sheet.id} />
          {runId !== null && <input type="hidden" name="runId" value={runId} />}
          <h3>Adopt this sheet</h3>
          <p className="why">
            Adopting makes these scenarios yours (product-decisions item 19) and lets the final verdict issue. Change any
            driver first if you want — the draft is kept, and your adoption is a new version that records each change.
            Decimals: 0.08 is 8%. Share counts are absolute.
          </p>
          {SCENARIO_KEYS.map((k) => (
            <fieldset key={k} className="judgment">
              <legend>{SCENARIO_LABEL[k]}</legend>
              {DRIVER_KEYS.map((d) => (
                <div key={d}>
                  <label className="fieldlabel" htmlFor={`${k}.${d}`}>
                    {DRIVER_LABELS[d]}
                  </label>
                  <input className="inset" id={`${k}.${d}`} name={`${k}.${d}`} inputMode="decimal" defaultValue={c.scenarios[k][d] ?? ""} />
                </div>
              ))}
            </fieldset>
          ))}
          <label className="fieldlabel" htmlFor="moatClass">
            Moat class
          </label>
          <select className="inset" id="moatClass" name="moatClass" defaultValue={c.moatClass ?? ""} required>
            <option value="" disabled>
              Choose
            </option>
            <option value="none">none</option>
            <option value="narrow">narrow</option>
            <option value="wide">wide</option>
          </select>
          <label className="fieldlabel" htmlFor="nopatTaxRate">
            NOPAT tax rate
          </label>
          <input className="inset" id="nopatTaxRate" name="nopatTaxRate" inputMode="decimal" defaultValue={c.configuredConstants.nopatTaxRate ?? ""} />
          <label className="fieldlabel" htmlFor="stressMarginLevel">
            Stress margin
          </label>
          <input className="inset" id="stressMarginLevel" name="stressMarginLevel" inputMode="decimal" defaultValue={c.configuredConstants.stressMarginLevel ?? ""} />
          <label className="fieldlabel" htmlFor="note">
            Your reason for any change (optional)
          </label>
          <textarea className="inset" id="note" name="note" rows={2} />
          <div className="continue">
            <button className="act" type="submit">
              Adopt
            </button>
          </div>
        </form>
      )}

      <Sources sources={c.sources ?? []} />
    </section>
  );
}

export function RedraftForm({ ticker, runId, why }: { ticker: string; runId: string | null; why: string }) {
  return (
    <form action={redraftSheetAction} className="judgment" data-role="redraft-sheet" style={{ marginTop: 24 }}>
      <input type="hidden" name="ticker" value={ticker} />
      {runId !== null && <input type="hidden" name="runId" value={runId} />}
      <h3>Draft a fresh sheet</h3>
      <p className="why">{why}</p>
      <div className="continue">
        <button className="act" type="submit">
          Draft from the latest filings
        </button>
      </div>
    </form>
  );
}
