import type { ReactNode } from "react";
import Decimal from "decimal.js";
import type { AnalysisResult, FiledFigure, FinancialHistoryLine, Figure } from "@/lib/analyzer/types";
import type { AiLayerReport } from "@/lib/analyzer/reportAnalysis";
import type { VerdictResult } from "@/lib/analyzer/verdict";
import { CHECK_RATES, UNCERTAINTY_LEVELS, type CheckRate } from "@/lib/analyzer/verdictSynthesisV1";
import { incompleteVerdictExplanation } from "@/lib/analyzer/trustCopy";
import { profileNotConfirmedFor } from "@/lib/analyzer/trust";
import {
  notComputedLine,
  overviewTextViolations,
  CHANGE_TRIGGER_UNAVAILABLE_LINE,
} from "@/lib/analyzer/overviewCopy";
import { largestSwingDriver, type TornadoRowResult, type TwoWayTableResult } from "@/lib/analyzer/modules/sensitivity";
import { selectChallengerPoint } from "@/lib/analyzer/ai/challengerSelection";
import { formatCompactUsd, formatUsd } from "@/lib/formatUsd";
import { DRIVER_KEYS, SCENARIO_KEYS, type AssumptionSheet, type DriverKey, type SheetSource } from "@/lib/analyzer/sheets/sheet";
import { humanizeCause } from "./AnalyzerReport";

// ---------------------------------------------------------------------------
// CF-AR7-REPORT-CONTENT-01 (issue #456) — the report content Calvin reviewed
// and accepted as the AR7 prototype (#455; docs/evidence/ar7-prototype/),
// built into the one Analyzer shell's tab bodies.
//
// WHAT THIS FILE DOES NOT DO. It computes no finance: every figure is read
// from the stored AnalysisResult, the verdict check (verdict.ts) or the
// assumption sheet the output was valued on, and only formatted here. The
// one piece of arithmetic is restating a policy band as a price (Base at the
// rate × the band's ratio), which is the band itself said in dollars.
//
// EVERY NUMBER LINKS TO ITS SOURCE. A filed figure links to the SEC filing it
// was read from; a driver links to the sources its anchor cites (Evidence
// tab ledger, which links to the filing); a computed figure links to the
// section that shows how it was computed.
// ---------------------------------------------------------------------------

function pct(value: Decimal | null | undefined, dp = 1): string {
  return value === null || value === undefined ? "—" : `${value.mul(100).toFixed(dp)}%`;
}

function times(value: Decimal | null | undefined, dp = 2): string {
  return value === null || value === undefined ? "—" : `${value.toFixed(dp)}×`;
}

function money(value: Decimal | null | undefined): string {
  return value === null || value === undefined ? "—" : `$${formatUsd(value)}`;
}

function dec(raw: string | null | undefined): Decimal | null {
  if (raw === null || raw === undefined || raw.trim() === "") return null;
  try {
    const d = new Decimal(raw);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

function sentenceCase(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

/** Where a sheet source id is listed with its filing link (Evidence tab ledger). */
export function sourceHref(runId: string, id: string): string {
  return `/analyzer/${runId}?tab=evidence#src-${encodeURIComponent(id)}`;
}

/** A section of another report tab. */
export function tabHref(runId: string, tab: string, anchor: string): string {
  return `/analyzer/${runId}?tab=${tab}#${anchor}`;
}

function Cites({ runId, ids }: { runId: string; ids: readonly string[] }) {
  if (ids.length === 0) return null;
  return (
    <span className="rc-cites">
      {ids.map((id) => (
        <a key={id} href={sourceHref(runId, id)}>
          {id}
        </a>
      ))}
    </span>
  );
}

/** "How this is computed" — the link every computed figure on the Overview carries. */
function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="rc-source" href={href}>
      {children}
    </a>
  );
}

function figureOr<T>(figure: Figure<T>, render: (v: T) => string, leverage: AnalysisResult["gates"]["leverage"]): string {
  return figure.suppressed ? notComputedLine(figure.state, figure.cause, leverage) : render(figure.value);
}

const MOAT_WORDS: Record<string, string> = { none: "No moat", narrow: "Narrow moat", wide: "Wide moat" };

// ---------------------------------------------------------------------------
// Overview — the Quick Read (product-decisions item 20: Quick Read first).
// ---------------------------------------------------------------------------

/** Templated "why" reasons, built from the verdict check's computed numbers only (item 28). */
function verdictReasons(result: AnalysisResult, verdict: VerdictResult): string[] {
  const check = verdict.check;
  const rates = verdict.rates;
  if (check === null || rates === null) return [];
  const sell = result.policy.constants.verdictSynthesisV1Sell;
  const buy = result.policy.constants.verdictSynthesisV1Buy;
  const roic = result.verdictInputs?.roicFloor;
  const reasons = [
    `Price is ${times(check.ratios.rate)} the Base value at ${pct(rates.rate)}. A SELL starts at ${times(sell.low, 2)} / ${times(sell.medium, 2)} / ${times(sell.high, 2)} at Low / Medium / High uncertainty; a BUY needs ${times(buy.low, 2)} / ${times(buy.medium, 2)} / ${times(buy.high, 2)} or less.`,
    `Checked at ${CHECK_RATES.map((r) => pct(rates[r])).join(", ")}, the price is ${CHECK_RATES.map((r) => times(check.ratios[r])).join(" / ")} the Base value.`,
  ];
  if (roic !== undefined && roic.status !== "UNAVAILABLE" && roic.average !== null) {
    reasons.push(
      `The 5-year average return on invested capital (goodwill included) is ${pct(roic.average)}, ${roic.status === "PASS" ? "above" : "not above"} the ${pct(roic.rate)} rate.`
    );
  }
  return reasons;
}

function VerdictGridTable({ verdict }: { verdict: VerdictResult }) {
  const check = verdict.check;
  const rates = verdict.rates;
  if (check === null || rates === null) return null;
  return (
    <div className="rc-scroll">
      <table className="rc-table rc-grid">
        <thead>
          <tr>
            <th scope="col">Rate</th>
            {UNCERTAINTY_LEVELS.map((u) => (
              <th scope="col" key={u}>
                {u}
              </th>
            ))}
            <th scope="col">Price ÷ Base</th>
          </tr>
        </thead>
        <tbody>
          {CHECK_RATES.map((r: CheckRate) => (
            <tr key={r}>
              <th scope="row" className="num">
                {pct(rates[r])}
              </th>
              {UNCERTAINTY_LEVELS.map((u) => (
                <td key={u} className={`rc-zone z-${check.grid[r][u].toLowerCase()}`}>
                  {check.grid[r][u]}
                </td>
              ))}
              <td className="num">{times(check.ratios[r])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The price at which the Medium-uncertainty zone changes, said from the policy band. */
function bandCrossing(result: AnalysisResult, verdict: VerdictResult): string | null {
  const baseAtRate = result.verdictInputs?.baseAtCheckRates?.rate;
  const check = verdict.check;
  if (baseAtRate === undefined || baseAtRate === null || check === null) return null;
  const sell = result.policy.constants.verdictSynthesisV1Sell.medium;
  const buy = result.policy.constants.verdictSynthesisV1Buy.medium;
  const zone = check.grid.rate.Medium;
  const sellPrice = baseAtRate.mul(sell);
  const buyPrice = baseAtRate.mul(buy);
  if (zone === "SELL") {
    return `Under Medium uncertainty the price would have to fall below ${money(sellPrice)} (Base × ${sell.toString()}) to leave the SELL band.`;
  }
  if (zone === "BUY") {
    return `Under Medium uncertainty the price would have to rise above ${money(buyPrice)} (Base × ${buy.toString()}) to leave the BUY band.`;
  }
  return `Under Medium uncertainty the price reaches the SELL band at ${money(sellPrice)} (Base × ${sell.toString()}) and the BUY band at ${money(buyPrice)} (Base × ${buy.toString()}).`;
}

function StrongestArgumentAgainst({ result, aiLayer }: { result: AnalysisResult; aiLayer?: AiLayerReport }) {
  const selection = result.challenger === null ? null : selectChallengerPoint(result.challenger.findings);
  // The challenger's prose is the blind call's own and is never edited here;
  // a point whose wording would bring technical vocabulary onto the Overview
  // stays on the Risks & Thesis tab only.
  if (selection !== null && overviewTextViolations(selection.selected.evidence).length === 0) {
    return <p>{selection.selected.evidence}</p>;
  }
  const why =
    selection !== null
      ? "The independent challenger's points are on the Risks & Thesis tab."
      : aiLayer?.status === "FAILED"
        ? "The independent challenger's output was refused for this analysis, so no argument is shown."
        : "The independent challenger has not run for this analysis, so no argument is shown.";
  return <p className="rc-slot">{why}</p>;
}

export function QuickReadGrid({
  runId,
  result,
  verdict,
  sheet,
  aiLayer,
}: {
  runId: string;
  result: AnalysisResult;
  verdict: VerdictResult;
  sheet: AssumptionSheet | null;
  aiLayer?: AiLayerReport;
}) {
  const leverage = result.gates.leverage;
  // Absent on an output stored before AR4.
  const solve = result.priceImplied.reverseDcf as AnalysisResult["priceImplied"]["reverseDcf"] | undefined;
  const cagr = result.achievedRevenueCagr.value;
  const breakEven = result.scenarioOutputs.rateAtWhichBaseEqualsPrice;
  const rate = result.valuationBasis?.discountRate.rate ?? null;
  const roic = result.verdictInputs?.roicFloor;
  const moatClass = sheet?.content.moatClass ?? result.valuationBasis?.d2.moatClass ?? null;
  const moatAnchor = sheet?.content.moatAnchor ?? null;
  const reasons = verdictReasons(result, verdict);
  const crossing = bandCrossing(result, verdict);
  const changeTrigger = largestSwingDriver((result.diagnostics.sensitivity.tornado ?? []) as TornadoRowResult[]);
  const bear = result.scenarios.bear?.writtenAnchor ?? "";
  const adopted = sheet?.status === "ADOPTED";

  return (
    <section className="rc-qr" aria-label="Quick read">
      <div className="rc-item rc-6" id="qr-price-assumes">
        <h3>What today&apos;s price assumes</h3>
        {solve === undefined ? (
          <p className="rc-slot">This analysis was stored before the one reverse-DCF solve existed, so it carries no implied growth.</p>
        ) : solve.fiveYearGrowth.suppressed ? (
          <p>{notComputedLine(solve.fiveYearGrowth.state, solve.fiveYearGrowth.cause, leverage)}</p>
        ) : (
          <p>
            About <b className="num">{pct(solve.fiveYearGrowth.value)}/yr</b> revenue growth for 5 years
            {solve.heldAt !== null && <> at a {pct(solve.heldAt.operatingMargin)} operating margin</>} (reverse DCF at{" "}
            {pct(solve.rate)}).
          </p>
        )}
        {/* Steady-state value and the growth share are restated in the
            hero's own "what the price assumes" box when computed; where they
            are not, the reason is said here in words. */}
        {result.priceImplied.steadyStateEv.suppressed && (
          <p className="rc-muted">
            Steady-state EV{" "}
            {notComputedLine(result.priceImplied.steadyStateEv.state, result.priceImplied.steadyStateEv.cause, leverage)}
          </p>
        )}
        {result.priceImplied.pvgoShareOfEv.suppressed && (
          <p className="rc-muted">
            PVGO share of EV{" "}
            {notComputedLine(result.priceImplied.pvgoShareOfEv.state, result.priceImplied.pvgoShareOfEv.cause, leverage)}
          </p>
        )}
        {cagr !== null && (
          <p className="rc-muted">
            {result.companyName} grew revenue {pct(cagr.cagr)}/yr over {cagr.horizonYears} years (FY{cagr.window.fromFiscalYear}–FY
            {cagr.window.toFiscalYear}).
          </p>
        )}
        <SourceLink href={tabHref(runId, "valuation", "E")}>How the price is read — Valuation</SourceLink>
      </div>

      <div className="rc-item rc-6" id="qr-base-return">
        <h3>If our Base case happens</h3>
        {breakEven === null ? (
          <p className="rc-slot">No break-even return is computed for this analysis.</p>
        ) : (
          <p>
            You&apos;d earn about <b className="num">{pct(breakEven)}/yr</b>
            {rate !== null && <> — the market rate in use is {pct(rate)}</>}.
          </p>
        )}
        <SourceLink href={tabHref(runId, "valuation", "G")}>Scenario outputs — Valuation</SourceLink>
      </div>

      <div className="rc-item rc-6" id="qr-why">
        <h3>Why this verdict</h3>
        {reasons.length === 0 ? (
          <p>
            {incompleteVerdictExplanation({
              trustStatus: result.trust.status,
              fairValueRange: result.fairValueRange,
              leverage,
              profileNotConfirmed: profileNotConfirmedFor(result),
            })}
          </p>
        ) : (
          <>
            <ul>
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <VerdictGridTable verdict={verdict} />
          </>
        )}
        <SourceLink href={tabHref(runId, "valuation", "assumption-sheet")}>The sheet behind the Base value — Valuation</SourceLink>
      </div>

      <div className="rc-item rc-6" id="qr-quality">
        <h3>Business quality</h3>
        {moatClass === null ? (
          <p className="rc-slot">No moat class is recorded on this analysis&apos;s assumption sheet.</p>
        ) : (
          <p>
            <b>{MOAT_WORDS[moatClass] ?? moatClass}</b>
            {moatAnchor !== null && (
              <>
                {" "}
                — {moatAnchor.text} <Cites runId={runId} ids={moatAnchor.cites} />
              </>
            )}
          </p>
        )}
        {roic !== undefined && roic.status !== "UNAVAILABLE" && roic.average !== null ? (
          <p>
            5-year average return on invested capital {pct(roic.average)}, {roic.status === "PASS" ? "above" : "not above"} the{" "}
            {pct(roic.rate)} rate.
          </p>
        ) : (
          roic !== undefined && <p className="rc-muted">{roic.reason}</p>
        )}
        <SourceLink href={tabHref(runId, "financials", "returns")}>Returns by year — Financials</SourceLink>
      </div>

      <div className="rc-item rc-6" id="qr-against">
        <h3>Strongest argument against</h3>
        <StrongestArgumentAgainst result={result} aiLayer={aiLayer} />
        <SourceLink href={tabHref(runId, "risks", "I2")}>Challenger findings — Risks &amp; Thesis</SourceLink>
      </div>

      <div className="rc-item rc-6" id="qr-risks">
        <h3>Top risks</h3>
        <p className="rc-muted">{adopted ? "The Bear case you adopted:" : "The draft's own Bear case (AI draft, every driver cited):"}</p>
        <p>{bear}</p>
        <SourceLink href={tabHref(runId, "risks", "scenario-stories")}>All three cases — Risks &amp; Thesis</SourceLink>
      </div>

      <div className="rc-item rc-12" id="qr-change">
        <h3>What would change it</h3>
        {breakEven !== null && (
          <p>At a {pct(breakEven)} required return the Base value equals today&apos;s price.</p>
        )}
        {crossing !== null && <p>{crossing}</p>}
        {changeTrigger.available ? (
          <p>
            The single largest driver of this valuation is {humanizeCause(changeTrigger.driver)}, which can move the result by{" "}
            {pct(changeTrigger.fullRangeValueImpact)} across its tested range.
          </p>
        ) : (
          <p className="rc-muted">{CHANGE_TRIGGER_UNAVAILABLE_LINE}</p>
        )}
        <SourceLink href={tabHref(runId, "valuation", "sensitivity")}>Sensitivity — Valuation</SourceLink>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Valuation — the assumption sheet, every driver with its cited anchor.
// ---------------------------------------------------------------------------

const DRIVER_ROWS: Record<DriverKey, { label: string; kind: "pct" | "shares" }> = {
  revenueGrowthOrPath: { label: "Revenue growth, yrs 1–5", kind: "pct" },
  operatingMargin: { label: "Operating margin", kind: "pct" },
  returnOnNewInvestment: { label: "Return on new investment", kind: "pct" },
  reinvestmentCapitalIntensity: { label: "Net reinvestment, share of revenue", kind: "pct" },
  shareCount: { label: "Diluted shares", kind: "shares" },
};

function driverValue(kind: "pct" | "shares", raw: string | null | undefined): string {
  const d = dec(raw ?? null);
  if (d === null) return "—";
  return kind === "pct" ? pct(d) : `${d.dividedBy(1e9).toFixed(2)}B`;
}

const ORIGIN_WORDS: Record<AssumptionSheet["origin"], string> = {
  "AI DRAFT": "AI draft",
  "CANNOT CONCLUDE": "cannot be drafted from history",
  "MIGRATED BUNDLE": "carried over from an earlier recorded sheet",
  "ADOPTED AS DRAFTED": "adopted as drafted",
  "ADOPTED WITH ADJUSTMENTS": "adopted with your adjustments",
};

export function AssumptionSheetSection({
  runId,
  result,
  sheet,
}: {
  runId: string;
  result: AnalysisResult;
  sheet: AssumptionSheet | null;
}) {
  const basis = result.valuationBasis;
  const sheetHref = `/analyzer/inputs/${encodeURIComponent(result.ticker)}?run=${encodeURIComponent(runId)}`;
  return (
    <section id="assumption-sheet" className="rc-section">
      <div className="sechead">
        <h2>Assumption sheet</h2>
        {sheet !== null && (
          <span className="k">
            Version {sheet.version} · {sheet.status === "ADOPTED" ? "adopted" : "draft"} · {ORIGIN_WORDS[sheet.origin]}
          </span>
        )}
      </div>
      <hr />
      {sheet === null ? (
        <p className="rc-slot">The assumption sheet this analysis was valued on is not on record, so its drivers cannot be shown here.</p>
      ) : (
        <>
          {sheet.content.cannotConclude ? (
            <p className="rc-slot">No sheet could be drafted from this company&apos;s filed history: {sheet.content.cannotConclude}</p>
          ) : (
            <p className="rc-muted">
              {sheet.content.drafting ? `${sentenceCase(sheet.content.drafting)}. ` : ""}
              {sheet.origin === "AI DRAFT" && "Price-blind: the draft never saw the share price. "}Every driver cites its source.
            </p>
          )}
          <div className="rc-scroll">
            <table className="rc-table rc-sheet">
              <thead>
                <tr>
                  <th scope="col">Driver</th>
                  {SCENARIO_KEYS.map((s) => (
                    <th scope="col" key={s}>
                      {sentenceCase(s)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DRIVER_KEYS.map((key) => (
                  <tr key={key}>
                    <th scope="row">{DRIVER_ROWS[key].label}</th>
                    {SCENARIO_KEYS.map((s) => {
                      const scenario = sheet.content.scenarios[s];
                      const anchor = scenario.anchors?.[key];
                      return (
                        <td key={s}>
                          <div className="num rc-driver">{driverValue(DRIVER_ROWS[key].kind, scenario[key] ?? null)}</div>
                          {anchor !== undefined && (
                            <div className="rc-anchor">
                              {anchor.text} <Cites runId={runId} ids={anchor.cites} />
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sheet.content.moatClass !== null && (
            <p>
              <b>Moat:</b> {MOAT_WORDS[sheet.content.moatClass] ?? sheet.content.moatClass}
              {sheet.content.moatAnchor && (
                <>
                  {" "}
                  — {sheet.content.moatAnchor.text} <Cites runId={runId} ids={sheet.content.moatAnchor.cites} />
                </>
              )}
            </p>
          )}
        </>
      )}
      {basis !== undefined && (
        <p>
          <b>Discount rate:</b> {pct(basis.discountRate.rate)} — {basis.discountRate.basis}. Dated {basis.discountRate.effectiveFrom}.
        </p>
      )}
      {sheet !== null && (
        <p className="rc-actions">
          <a className="act" href={sheetHref}>
            {sheet.status === "ADOPTED" ? "Review or redraft this sheet" : "Adopt as drafted, or adjust drivers first"}
          </a>
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Business — the research the draft cited.
// ---------------------------------------------------------------------------

function clip(text: string, limit: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= limit ? flat : `${flat.slice(0, limit - 1).trimEnd()}…`;
}

function SourceCard({ source }: { source: SheetSource }) {
  return (
    <div className="rc-card" id={`research-${source.id}`}>
      <h3>
        {source.label} <span className="rc-cites">{source.id}</span>
      </h3>
      <p className="rc-excerpt">{clip(source.excerpt, 700)}</p>
      <p className="rc-muted">
        {source.url !== null ? (
          <a href={source.url}>Read the filing{source.filed ? ` (filed ${source.filed})` : ""}</a>
        ) : (
          source.form ?? "No link recorded"
        )}
      </p>
    </div>
  );
}

export function BusinessResearch({ sheet }: { sheet: AssumptionSheet | null }) {
  const sources = (sheet?.content.sources ?? []).filter((s) => s.kind === "FILING TEXT" || s.kind === "EARNINGS RELEASE");
  return (
    <section id="research" className="rc-section">
      <div className="sechead">
        <h2>Research the drivers cite</h2>
        <span className="k">From the company&apos;s own filings</span>
      </div>
      <hr />
      {sources.length === 0 ? (
        <p className="rc-slot">The assumption sheet behind this analysis cites no filing text.</p>
      ) : (
        <div className="rc-cards">
          {sources.map((s) => (
            <SourceCard key={s.id} source={s} />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Financials — the filed statements, ten years, each figure linked to its filing.
// ---------------------------------------------------------------------------

const STATEMENT_ROWS: { line: FinancialHistoryLine; label: string }[] = [
  { line: "revenue", label: "Revenue" },
  { line: "operatingIncome", label: "Operating income" },
  { line: "operatingCashFlow", label: "Operating cash flow" },
  { line: "capex", label: "Capital expenditure" },
  { line: "depreciationAndAmortisation", label: "Depreciation & amortisation" },
  { line: "stockBasedCompensation", label: "Stock-based compensation" },
  { line: "backlog", label: "Remaining performance obligations" },
];

function FiledCell({ figure }: { figure: FiledFigure | null }) {
  if (figure === null) return <td className="num rc-muted">—</td>;
  const text = `$${formatCompactUsd(figure.value)}`;
  return <td className="num">{figure.url === null ? text : <a href={figure.url}>{text}</a>}</td>;
}

type HistoryYears = NonNullable<AnalysisResult["financialHistory"]>["years"];

function ratioRow(
  label: string,
  years: HistoryYears,
  value: (y: HistoryYears[number], prior: HistoryYears[number] | undefined) => Decimal | null
) {
  const byYear = new Map(years.map((y) => [y.fiscalYear, y]));
  return (
    <tr className="rc-derived">
      <th scope="row">{label}</th>
      {years.map((y) => {
        const v = value(y, byYear.get(y.fiscalYear - 1));
        return (
          <td key={y.fiscalYear} className="num">
            {v === null ? "—" : pct(v)}
          </td>
        );
      })}
    </tr>
  );
}

export function FinancialStatements({ runId, result }: { runId: string; result: AnalysisResult }) {
  const history = result.financialHistory ?? null;
  const roic = result.verdictInputs?.roicFloor;
  // Newest first, so the latest years read without scrolling at narrow widths.
  const years = [...(history?.years ?? [])].reverse();
  return (
    <>
      <section id="statements" className="rc-section">
        <div className="sechead">
          <h2>Filed statements</h2>
          <span className="k">Fiscal years, as the company filed them</span>
        </div>
        <hr />
        {years.length === 0 ? (
          <p className="rc-slot">
            {history === null
              ? "This analysis was stored before the filed statements were kept with it; look at this company again to see them."
              : "No annual figures were found in this company's filings."}
          </p>
        ) : (
          <>
            <div className="rc-scroll">
              <table className="rc-table rc-statements">
                <thead>
                  <tr>
                    <th scope="col">Line</th>
                    {years.map((y) => (
                      <th scope="col" key={y.fiscalYear} className="num">
                        FY{y.fiscalYear}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {STATEMENT_ROWS.map((row) => (
                    <tr key={row.line}>
                      <th scope="row">{row.label}</th>
                      {years.map((y) => (
                        <FiledCell key={y.fiscalYear} figure={y.lines[row.line]} />
                      ))}
                    </tr>
                  ))}
                  {ratioRow("Revenue growth", years, (y, prev) => {
                    const cur = y.lines.revenue?.value;
                    const before = prev?.lines.revenue?.value;
                    return cur && before && before.greaterThan(0) ? cur.dividedBy(before).minus(1) : null;
                  })}
                  {ratioRow("Operating margin", years, (y) => {
                    const rev = y.lines.revenue?.value;
                    const oi = y.lines.operatingIncome?.value;
                    return rev && oi && rev.greaterThan(0) ? oi.dividedBy(rev) : null;
                  })}
                </tbody>
              </table>
            </div>
            <p className="rc-muted">
              Each figure links to the SEC filing it was read from ({history!.source}). Growth and margin are computed from the rows
              above.
            </p>
          </>
        )}
      </section>

      <section id="returns" className="rc-section">
        <div className="sechead">
          <h2>Return on invested capital</h2>
          <span className="k">Goodwill included — the measure the BUY quality bar reads</span>
        </div>
        <hr />
        {roic === undefined || roic.years.length === 0 ? (
          <p className="rc-slot">{roic?.reason ?? "No return on invested capital is computed for this analysis."}</p>
        ) : (
          <>
            <table className="rc-table rc-returns">
              <tbody>
                {roic.years.map((y) => (
                  <tr key={y.fiscalYear}>
                    <th scope="row">FY{y.fiscalYear}</th>
                    <td className="num">{pct(y.roic)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="rc-muted">
              {roic.reason} Computed from the filed operating income, equity, debt and cash on the{" "}
              <a href={tabHref(runId, "evidence", "B")}>fact ledger</a>.
            </p>
          </>
        )}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Risks & Thesis — the three cases as written.
// ---------------------------------------------------------------------------

export function ScenarioStories({ result, sheet }: { result: AnalysisResult; sheet: AssumptionSheet | null }) {
  return (
    <section id="scenario-stories" className="rc-section">
      <div className="sechead">
        <h2>The three cases</h2>
        <span className="k">
          {sheet?.status === "ADOPTED" ? "As you adopted them" : "As drafted, price-blind — the final verdict waits for your adoption"}
        </span>
      </div>
      <hr />
      <div className="rc-cards">
        {SCENARIO_KEYS.map((key) => (
          <div className="rc-card" key={key}>
            <h3>
              {sentenceCase(key)} case <span className="num rc-muted">{money(result.scenarioOutputs.values[key])}</span>
            </h3>
            <p>{result.scenarios[key]?.writtenAnchor ?? "—"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Market Context — what the market is paying, against this run's own figures.
// ---------------------------------------------------------------------------

export function MarketFacts({ runId, result }: { runId: string; result: AnalysisResult }) {
  const leverage = result.gates.leverage;
  const ev = result.diagnostics.enterpriseValue;
  const evToEbit = result.diagnostics.multiples.evToEbit;
  const exit = result.priceImplied.impliedExitMultiple?.value;
  const rows: { label: string; value: string; href: string }[] = [
    {
      label: "Price",
      value: `${money(result.price.value)} (${result.price.timestamp.slice(0, 10)})`,
      href: tabHref(runId, "evidence", "B"),
    },
    {
      label: "Enterprise value",
      value: ev.suppressed ? notComputedLine(ev.state, ev.cause, leverage) : `$${formatCompactUsd(ev.value.enterpriseValue)}`,
      href: tabHref(runId, "financials", "D"),
    },
    { label: "EV / EBIT", value: figureOr(evToEbit, (v) => times(v, 1), leverage), href: tabHref(runId, "financials", "D") },
  ];
  if (exit !== undefined) {
    rows.push({
      label: "Implied exit multiple (year-10 EBIT)",
      value: figureOr(exit, (v) => times(v, 1), leverage),
      href: tabHref(runId, "valuation", "E"),
    });
  }
  return (
    <section id="market-facts" className="rc-section">
      <div className="sechead">
        <h2>What the market is paying</h2>
        <span className="k">Supports, never overrides, the fair value</span>
      </div>
      <hr />
      <table className="rc-table">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td className="num">
                <a href={r.href}>{r.value}</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Evidence — the source ledger every citation on the report points at.
// ---------------------------------------------------------------------------

export function SourceLedger({ runId, sheet }: { runId: string; sheet: AssumptionSheet | null }) {
  const sources = sheet?.content.sources ?? [];
  return (
    <section id="sources" className="rc-section">
      <div className="sechead">
        <h2>Sources the assumption sheet cites</h2>
        <span className="k">Every citation on this report points here</span>
      </div>
      <hr />
      {sources.length === 0 ? (
        <p className="rc-slot">The assumption sheet behind this analysis lists no sources.</p>
      ) : (
        <div className="rc-scroll">
          <table className="rc-table rc-ledger">
            <thead>
              <tr>
                <th scope="col">Id</th>
                <th scope="col">Source</th>
                <th scope="col">Form</th>
                <th scope="col">Accession</th>
                <th scope="col">What the draft saw</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} id={`src-${s.id}`}>
                  <th scope="row">{s.id}</th>
                  <td>
                    {s.url !== null ? (
                      <a href={s.url}>{s.label}</a>
                    ) : s.kind === "HISTORY" ? (
                      // A filed series: each of its figures links to its own filing on the statements.
                      <a href={tabHref(runId, "financials", "statements")}>{s.label}</a>
                    ) : (
                      s.label
                    )}
                  </td>
                  <td>{s.form ?? "—"}</td>
                  <td className="num">{s.accession ?? "—"}</td>
                  <td>
                    <details className="disclose">
                      <summary>
                        <span className="lbl">Show the excerpt</span>
                      </summary>
                      <div className="body">
                        <p className="rc-excerpt">{s.excerpt}</p>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Valuation — sensitivity (M14): how the Base enterprise value moves when one
// driver moves, the others held. Read from the stored result.
// ---------------------------------------------------------------------------

const TORNADO_WORDS: Record<TornadoRowResult["driver"], string> = {
  growth: "Revenue growth",
  operatingMargin: "Operating margin",
  discountRate: "Discount rate (the ±0.5pp check)",
  terminalGrowth: "Terminal growth",
  ronic: "Return on new investment (bear / base / bull)",
  moat: "Moat credit (none / narrow / wide)",
};

function usdCompact(value: Decimal): string {
  return value.isFinite() ? `$${formatCompactUsd(value)}` : "—";
}

export function SensitivitySection({ result }: { result: AnalysisResult }) {
  const rows = (result.diagnostics.sensitivity.tornado ?? []) as TornadoRowResult[];
  const twoWayGrowthMargin = result.diagnostics.sensitivity.twoWayGrowthMargin as TwoWayTableResult | null | undefined;
  return (
    <section id="sensitivity" className="rc-section">
      <div className="sechead">
        <h2>Sensitivity</h2>
        <span className="k">Base enterprise value as one driver moves, the rest held</span>
      </div>
      <hr />
      {rows.length === 0 ? (
        <p className="rc-slot">No sensitivity is computed for this analysis — it needs a valued Base case with a moat class.</p>
      ) : (
        <div className="rc-scroll">
          <table className="rc-table rc-tornado">
            <thead>
              <tr>
                <th scope="col">Driver</th>
                <th scope="col" className="num">
                  Low
                </th>
                <th scope="col" className="num">
                  Middle
                </th>
                <th scope="col" className="num">
                  High
                </th>
                <th scope="col" className="num">
                  Swing
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.driver}>
                  <th scope="row">{TORNADO_WORDS[row.driver]}</th>
                  {row.available ? (
                    <>
                      {row.values.map((v, i) => (
                        <td key={i} className="num">
                          {usdCompact(v)}
                        </td>
                      ))}
                      <td className="num">
                        {pct(row.fullRangeValueImpact)}
                        {!row.displayed && <div className="rc-muted">under the 10% materiality line</div>}
                      </td>
                    </>
                  ) : (
                    <td colSpan={4} className="rc-muted">
                      {/analyst-supplied range/.test(row.cause)
                        ? "Not tested — no range is approved for this driver."
                        : `Not tested — ${humanizeCause(row.cause)}`}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {twoWayGrowthMargin != null && twoWayGrowthMargin.available && (
        <>
          <h3>Growth × margin</h3>
          <div className="rc-scroll">
            <table className="rc-table rc-twoway">
              <thead>
                <tr>
                  <th scope="col">Growth \ margin</th>
                  {twoWayGrowthMargin.columnValues.map((c, j) => (
                    <th scope="col" key={j} className="num">
                      {pct(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {twoWayGrowthMargin.rowValues.map((r, i) => (
                  <tr key={i}>
                    <th scope="row" className="num">
                      {pct(r)}
                    </th>
                    {twoWayGrowthMargin.cells[i].map((cell, j) => (
                      <td key={j} className="num">
                        {usdCompact(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
