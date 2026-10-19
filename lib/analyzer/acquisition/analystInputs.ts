import Decimal from "decimal.js";
import type { AnalystInputs } from "./companyInputs";
import type { AnalystSuppliedRange } from "../modules/sensitivity";
import { acquireCompany, type AcquiredCompany } from "./provider";
import { secClientFromEnv, type SecClient } from "./secClient";
import { analystCallIfConfigured, ANALYST_MODEL } from "../ai/anthropicCall";
import { writeAnalystLog, type AnalystCall } from "../ai/analystCall";
import { draftAssumptionSheet } from "./aiProposedBundle";
import { bundleFromSheet, type AssumptionSheet } from "../sheets/sheet";
import { appendSheet, sheetInForce } from "../sheets/sheetStore";

// ---------------------------------------------------------------------------
// The inputs that are NOT facts — Step 7's scenarios, the moat class and the
// policy constants a company's run needs — and the one resolver for them.
//
// CF-AR6-ANY-TICKER-DRAFTS-01 (product-decisions item 30, D5; frozen spec
// §14.9 AR0-6). They come from one place now: the company's assumption sheet
// (sheets/, migration 014), append-only and versioned.
//
//   - A ticker with a sheet resolves to the sheet in force: its latest
//     ADOPTED version, else its latest DRAFT.
//   - A ticker with none gets one drafted, once, and stored: a price-blind
//     AI draft from its filings and filed history (aiProposedBundle.ts), or,
//     where no operating history exists to draft from, a sheet recording
//     that the valuation cannot be concluded. The report, valuation and
//     verdict zone then appear with no migration and no PR; the final
//     verdict waits for Calvin's adoption.
//
// DELETED here (issue #454 DO 6, "delete the fixture path"): the committed
// M5/M7 validation fixtures (MSFT_FIXTURE, OKLO_FIXTURE) no longer reach a
// real run — their synthetic scenarios and OKLO's synthetic pre-revenue unit
// economics were never anyone's view of the company. Also replaced: the
// recorded-bundle store (one row per ticker, corrected in place — migration
// 006; its rows are migration 014's version 1 drafts) and the per-run pin of
// an AI-proposed bundle (migration 009): a sheet is durable per ticker and a
// run's stored output records the sheet version it was valued on.
// ---------------------------------------------------------------------------

export interface AnalystInputBundle {
  inputs: Omit<
    AnalystInputs,
    "nonOperatingInvestments" | "gate0" | "fiftyTwoWeek" | "epsTrailing" | "epsForward" | "trustInputs"
  >;
  /** Rendered to the analyst. Not a comment — a disclosure. */
  note: string;
}

// ---------------------------------------------------------------------------
// CF-STEP4-MSFT-RANGE-CAPTURE-01 — the minimum AnalystSuppliedRange capture
// CALVIN RULING — A authorised: MSFT only, growth and operating-margin axes
// only (PR #323 comment 5830507368). These three points per axis are analyst
// assumptions, cited by hand, never derived by a module (sensitivity.ts).
// ---------------------------------------------------------------------------
const MSFT_GROWTH_RANGE: AnalystSuppliedRange = {
  values: [new Decimal("0.10"), new Decimal("0.137"), new Decimal("0.185")],
  rationale:
    "MSFT's own bear/base/bull scenario growth assumptions already authored for this run: 10.0% " +
    "(trigger-A slowdown, margin reverts toward the ten-year median), 13.7% (ten-year CAGR consistent " +
    "with the price-implied path), 18.5% (five-year implied path sustained). Cited from the scenarios " +
    "above as the analyst's own already-recorded anchors, not re-derived from policy or history.",
};

const MSFT_OPERATING_MARGIN_RANGE: AnalystSuppliedRange = {
  values: [new Decimal("0.38"), new Decimal("0.418"), new Decimal("0.468")],
  rationale:
    "38.0% is MSFT's own already-configured stress margin level (configuredConstants.stressMarginLevel), " +
    "41.8% is the already-acquired M3 median margin (reverseDcf.medianMargin, equal to the bear scenario's " +
    "own operating margin), and 46.8% is the already-acquired M3 current margin (reverseDcf.currentMargin, " +
    "equal to the base/bull scenarios' own operating margin) — the company's ten-year margin cyclicality " +
    "(marginHistory.cyclicality.tenYearMarginRange, 21.4pp) is the historical context these three already-" +
    "recorded figures sit inside, cited, not computed into a range.",
};

export interface SensitivityRangeBundle {
  growth: AnalystSuppliedRange;
  operatingMargin: AnalystSuppliedRange;
}

const SENSITIVITY_RANGES: Record<string, SensitivityRangeBundle> = {
  MSFT: { growth: MSFT_GROWTH_RANGE, operatingMargin: MSFT_OPERATING_MARGIN_RANGE },
};

/** MSFT only (ruling A). Null for every other ticker. */
export function sensitivityRangesFor(ticker: string): SensitivityRangeBundle | null {
  return SENSITIVITY_RANGES[ticker.toUpperCase()] ?? null;
}

// Same switch gate.ts's own isOffline() reads: offline runs call no live
// endpoint — no EDGAR request and no model call.
function isOfflineAnalyzerRun(): boolean {
  return process.env.ANALYZER_OFFLINE === "1";
}

export interface DraftDependencies {
  call?: AnalystCall | null;
  client?: SecClient | null;
  acquire?: (ticker: string) => Promise<AcquiredCompany>;
}

function defaultAcquire(ticker: string): Promise<AcquiredCompany> {
  // Made with no price: the draft never sees one.
  return acquireCompany(ticker, { price: null, source: isOfflineAnalyzerRun() ? "CAPTURE" : undefined });
}

/**
 * Drafts and appends a new DRAFT version for a ticker, whatever it already
 * has — the first draft for a new ticker, and the redraft that refreshes a
 * stale sheet (NVDA's, issue #454 DO 6). Null, with the cause logged, where
 * no draft can be made.
 */
export async function draftNewSheet(ticker: string, deps: DraftDependencies = {}): Promise<{ sheet: AssumptionSheet | null; cause: string | null }> {
  const symbol = ticker.trim().toUpperCase();
  const call = deps.call !== undefined ? deps.call : isOfflineAnalyzerRun() ? null : analystCallIfConfigured();
  let client: SecClient | null = null;
  if (deps.client !== undefined) client = deps.client;
  else if (!isOfflineAnalyzerRun()) {
    try {
      client = secClientFromEnv();
    } catch {
      client = null;
    }
  }

  let acquired: AcquiredCompany;
  try {
    acquired = await (deps.acquire ?? defaultAcquire)(symbol);
  } catch (err) {
    const cause = `acquiring the company to draft its sheet failed — ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`;
    writeAnalystLog(`no assumption sheet for ${symbol}: ${cause}`);
    return { sheet: null, cause };
  }

  const outcome = await draftAssumptionSheet(symbol, acquired, call, client);
  if (outcome.kind === "REFUSED") {
    writeAnalystLog(`no assumption sheet for ${symbol}: ${outcome.cause}`);
    return { sheet: null, cause: outcome.cause };
  }
  const sheet = await appendSheet({
    ticker: symbol,
    status: "DRAFT",
    origin: outcome.kind === "DRAFTED" ? "AI DRAFT" : "CANNOT CONCLUDE",
    content: outcome.content,
    model: outcome.kind === "DRAFTED" ? ANALYST_MODEL : null,
  });
  return { sheet, cause: null };
}

// One draft at a time per ticker, and a refused draft is not retried for a
// while: one page view asks for the bundle more than once (gate.ts), and a
// paid model call must not run twice for the same answer. In-process only —
// the durable record is the sheet store.
const inFlight = new Map<string, Promise<AssumptionSheet | null>>();
const REFUSAL_TTL_MS = 15 * 60 * 1000;
const refusedAt = new Map<string, number>();

/** Test seam. Never called by application code. */
export function __resetSheetResolution(): void {
  inFlight.clear();
  refusedAt.clear();
}

/** The sheet in force for a ticker, drafting the first one where none exists. */
export async function resolveSheet(ticker: string, deps: DraftDependencies = {}): Promise<AssumptionSheet | null> {
  const symbol = ticker.trim().toUpperCase();
  if (symbol === "") return null;
  const existing = await sheetInForce(symbol);
  if (existing !== null) return existing;

  const refused = refusedAt.get(symbol);
  if (refused !== undefined && Date.now() - refused < REFUSAL_TTL_MS) return null;

  const running = inFlight.get(symbol);
  if (running !== undefined) return running;
  const started = (async () => {
    // Another process may have drafted meanwhile; the store is the record.
    const raced = await sheetInForce(symbol);
    if (raced !== null) return raced;
    const { sheet } = await draftNewSheet(symbol, deps);
    if (sheet === null) refusedAt.set(symbol, Date.now());
    return sheet;
  })();
  inFlight.set(symbol, started);
  const forget = () => {
    if (inFlight.get(symbol) === started) inFlight.delete(symbol);
  };
  void started.then(forget, forget);
  return started;
}

/**
 * The one resolver: the bundle a run of this ticker is valued on, or null
 * where no sheet exists and none can be drafted — that company cannot open
 * a run, and the log names why.
 */
export async function analystInputsFor(ticker: string, deps: DraftDependencies = {}): Promise<AnalystInputBundle | null> {
  const sheet = await resolveSheet(ticker, deps);
  return sheet === null ? null : bundleFromSheet(sheet);
}
