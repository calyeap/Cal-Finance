import Decimal from "decimal.js";
import type { AcquiredCompany } from "../acquisition/provider";
import type { SecClient } from "../acquisition/secClient";
import type { AnalystCall } from "../ai/analystCall";
import { draftAssumptionSheet } from "../acquisition/aiProposedBundle";
import { buildAcquiredRun } from "../acquiredRun";
import { assembleAnalysisResult } from "../assemble";
import type { NonOperatingInvestmentSelection } from "../acquisition/companyInputs";
import { bundleFromSheet, type AssumptionSheet, type SheetContent } from "./sheet";

// ---------------------------------------------------------------------------
// CF-AR6-ANY-TICKER-DRAFTS-01 — draft stability (issue #454 DO 4): three
// independent drafts per company, each valued by the engine exactly as a run
// would value it, and the spread of their Base fair values reported. A spread
// wider than SPREAD_THRESHOLD means the validators must tighten before
// shipping (ESCALATE ONLY IF: the bar cannot be met inside the approved
// rules).
//
// The drafts are never stored: each is valued as an unadopted DRAFT sheet
// through buildAcquiredRun's `bundle` seam. The draft itself stays price-
// blind (draftAssumptionSheet reads no price); the price is used only after,
// to bridge each draft's enterprise value to a per-share value — the same
// for all three, so it moves no draft against another.
// ---------------------------------------------------------------------------

/** The approved bar for draft stability (issue #454 DO 4). */
export const SPREAD_THRESHOLD = new Decimal("0.10");

/** (max − min) ÷ median of the values; null for fewer than two finite positive values. */
export function valueSpread(values: (Decimal | null)[]): Decimal | null {
  const v = values.filter((x): x is Decimal => x !== null && x.isFinite() && x.greaterThan(0)).sort((a, b) => a.comparedTo(b));
  if (v.length < 2) return null;
  const mid = Math.floor(v.length / 2);
  const median = v.length % 2 === 1 ? v[mid] : v[mid - 1].plus(v[mid]).dividedBy(2);
  return v[v.length - 1].minus(v[0]).dividedBy(median);
}

export interface DraftValuation {
  /** Whether the drafting call produced a valid, validator-passing draft. */
  drafted: boolean;
  /** Base fair value per share, where the run's bridge allows one. */
  basePerShare: Decimal | null;
  /** Why there is no value, where there is none. */
  cause: string | null;
  base: { growth: string | null; margin: string | null; returnOnNewInvestment: string | null };
  moatClass: string | null;
}

export interface SpreadReport {
  ticker: string;
  drafts: DraftValuation[];
  spread: Decimal | null;
  withinThreshold: boolean | null;
  /** Whether the run had a price to bridge each draft to a per-share value. */
  priced: boolean;
}

export interface SpreadDependencies {
  call: AnalystCall;
  client: SecClient | null;
  acquired: AcquiredCompany;
  price: { value: Decimal; timestamp: string; source: string } | null;
  nonOperatingInvestments: NonOperatingInvestmentSelection | null;
  source?: "EDGAR" | "CAPTURE";
  runs?: number;
}

function asDraftSheet(ticker: string, content: SheetContent, n: number): AssumptionSheet {
  return { id: -n, ticker, version: n, status: "DRAFT", origin: "AI DRAFT", content, adoptedFrom: null, model: null, recordedAt: new Date().toISOString() };
}

export async function draftSpread(ticker: string, deps: SpreadDependencies): Promise<SpreadReport> {
  const drafts: DraftValuation[] = [];
  for (let n = 1; n <= (deps.runs ?? 3); n++) {
    const outcome = await draftAssumptionSheet(ticker, deps.acquired, deps.call, deps.client);
    if (outcome.kind !== "DRAFTED") {
      drafts.push({
        drafted: false,
        basePerShare: null,
        cause: outcome.kind === "REFUSED" ? outcome.cause : outcome.content.cannotConclude ?? null,
        base: { growth: null, margin: null, returnOnNewInvestment: null },
        moatClass: null,
      });
      continue;
    }
    const run = await buildAcquiredRun({
      ticker,
      bundle: bundleFromSheet(asDraftSheet(ticker, outcome.content, n)),
      price: deps.price,
      source: deps.source,
      nonOperatingInvestments: deps.nonOperatingInvestments,
      profileHumanConfirmed: true,
    });
    const result = assembleAnalysisResult(run.fixture);
    const base = result.scenarioOutputs.values.base;
    drafts.push({
      drafted: true,
      basePerShare: base.isFinite() ? base : null,
      // The root cause where the bridge itself is INCOMPLETE (e.g. a missing
      // REQUIRED input), else the fair-value range's own cause.
      cause: base.isFinite()
        ? null
        : result.diagnostics.enterpriseValue.suppressed
          ? `enterprise value ${result.diagnostics.enterpriseValue.state}: ${result.diagnostics.enterpriseValue.cause}`
          : result.fairValueRange.kind === "suppressed"
            ? result.fairValueRange.cause
            : "no Base value",
      base: {
        growth: outcome.content.scenarios.base.revenueGrowthOrPath,
        margin: outcome.content.scenarios.base.operatingMargin,
        returnOnNewInvestment: outcome.content.scenarios.base.returnOnNewInvestment ?? null,
      },
      moatClass: outcome.content.moatClass,
    });
    // The bridge reads facts and the price, never the sheet: where it is
    // INCOMPLETE no draft can be valued, so one valid sheet proves the company
    // drafts and further paid sheets would measure nothing.
    if (result.diagnostics.enterpriseValue.suppressed) break;
  }
  const spread = valueSpread(drafts.map((d) => d.basePerShare));
  return {
    ticker,
    drafts,
    spread,
    withinThreshold: spread === null ? null : spread.lessThanOrEqualTo(SPREAD_THRESHOLD),
    priced: deps.price !== null,
  };
}

/**
 * One company's result against #454's acceptance as amended by Calvin
 * (recorded ruling, 19 Oct 2026 — #454 comment 6268684236): every golden
 * company must draft validly; every company the approved rules can value
 * must show a measured spread inside the bar; a company the engine does not
 * value at all — outside the §6.5 / D1 net-debt domain, or INCOMPLETE on an
 * exact cause — is RECORDED with that cause, never counted as a pass.
 *
 * Fails closed: a refused draft, an unpriced run, a spread wider than the
 * bar, or a company valued on some drafts but not others is FAIL.
 */
export function spreadOutcome(r: SpreadReport): "WITHIN BAR" | "NOT VALUED — RECORDED" | "FAIL" {
  if (r.drafts.length === 0 || r.drafts.some((d) => !d.drafted)) return "FAIL";
  if (r.withinThreshold === true) return "WITHIN BAR";
  if (r.withinThreshold === false) return "FAIL";
  return r.priced && r.drafts.every((d) => d.basePerShare === null && d.cause !== null) ? "NOT VALUED — RECORDED" : "FAIL";
}

/**
 * Whether a spread run met the amended bar: no company FAILs and at least
 * one was measured inside it. A run with no companies, or nothing measured,
 * fails.
 */
export function spreadRunPasses(reports: SpreadReport[]): boolean {
  const outcomes = reports.map(spreadOutcome);
  return outcomes.length > 0 && !outcomes.includes("FAIL") && outcomes.includes("WITHIN BAR");
}

export function formatSpreadReport(reports: SpreadReport[]): string {
  const lines = ["| Ticker | Draft | Base growth | Base margin | Base RONIC | Moat | Base $/share | Spread |", "|---|---|---|---|---|---|---|---|"];
  for (const r of reports) {
    r.drafts.forEach((d, i) => {
      lines.push(
        `| ${i === 0 ? r.ticker : ""} | ${i + 1} | ${d.base.growth ?? "—"} | ${d.base.margin ?? "—"} | ${d.base.returnOnNewInvestment ?? "—"} | ${d.moatClass ?? "—"} | ${
          d.basePerShare === null ? `— (${d.cause ?? "no value"})` : d.basePerShare.toFixed(2)
        } | ${i === 0 ? `${r.spread === null ? "n/a" : `${r.spread.mul(100).toFixed(1)}%${r.withinThreshold ? "" : " — WIDER THAN 10%"}`} · ${spreadOutcome(r)}` : ""} |`
      );
    });
  }
  return lines.join("\n");
}
