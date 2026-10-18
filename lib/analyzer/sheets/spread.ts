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
      basePerShare: base.isFinite() ? base : null,
      cause: base.isFinite() ? null : result.fairValueRange.kind === "suppressed" ? result.fairValueRange.cause : "no Base value",
      base: {
        growth: outcome.content.scenarios.base.revenueGrowthOrPath,
        margin: outcome.content.scenarios.base.operatingMargin,
        returnOnNewInvestment: outcome.content.scenarios.base.returnOnNewInvestment ?? null,
      },
      moatClass: outcome.content.moatClass,
    });
  }
  const spread = valueSpread(drafts.map((d) => d.basePerShare));
  return { ticker, drafts, spread, withinThreshold: spread === null ? null : spread.lessThanOrEqualTo(SPREAD_THRESHOLD) };
}

/**
 * Whether a spread run met the bar. Fails closed: a company with no measured
 * spread (null — fewer than two drafts valued, e.g. every call refused) fails
 * exactly like one wider than the bar, and so does a run with no companies.
 */
export function spreadRunPasses(reports: SpreadReport[]): boolean {
  return reports.length > 0 && reports.every((r) => r.withinThreshold === true);
}

export function formatSpreadReport(reports: SpreadReport[]): string {
  const lines = ["| Ticker | Draft | Base growth | Base margin | Base RONIC | Moat | Base $/share | Spread |", "|---|---|---|---|---|---|---|---|"];
  for (const r of reports) {
    r.drafts.forEach((d, i) => {
      lines.push(
        `| ${i === 0 ? r.ticker : ""} | ${i + 1} | ${d.base.growth ?? "—"} | ${d.base.margin ?? "—"} | ${d.base.returnOnNewInvestment ?? "—"} | ${d.moatClass ?? "—"} | ${
          d.basePerShare === null ? `— (${d.cause ?? "no value"})` : d.basePerShare.toFixed(2)
        } | ${i === 0 ? (r.spread === null ? "n/a" : `${r.spread.mul(100).toFixed(1)}%${r.withinThreshold ? "" : " — WIDER THAN 10%"}`) : ""} |`
      );
    });
  }
  return lines.join("\n");
}
