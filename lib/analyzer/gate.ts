import { readFileSync } from "node:fs";
import { join } from "node:path";
import Decimal from "decimal.js";
import { assembleAnalysisResult, type CompanyFixture } from "./assemble";
import type { AnalysisResult } from "./types";
import { isSpotCheckComplete, queuedFacts, undecidedFacts, applyDecisions } from "./spotCheck";
import { getRun, getFactDecisions, getJudgments, getCompanyJudgmentOverride, type AnalyzerRun } from "./runStore";
import { buildAcquiredRun, type AcquiredRunInputs } from "./acquiredRun";
import { constrainedAndPassedFactIds } from "./crosschecks/run";
import type { DerivedExemptionEvidence } from "./spotCheck";
import { analystInputsFor } from "./acquisition/analystInputs";
import { selectionToNonOperatingInvestments } from "./acquisition/nonOperatingJudgment";
import { activeProvider } from "../marketdata";
import { roundMoney } from "../money";
import { fiftyTwoWeekRangeFrom, type FiftyTwoWeekRange } from "./fiftyTwoWeekRange";

// ---------------------------------------------------------------------------
// §2's ordering rule: no calculation module may execute before Step 2 has
// been completed. The software must enforce this, not merely recommend it.
// Design §104: the gate is server-side, and no calculation module may be
// reachable by any route, refresh, deep link or API call until every material
// fact carries a decision.
//
// CF-ANALYZER-AUTORUN-01 — Calvin's CALVIN RULING of 22 September 2026
// 04:28:04Z amended WHO completes Step 2 in the normal path: "Acquisition,
// validation, calculation and routine verification should execute
// automatically behind the scenes." §2 Step 2, §3.8's completion rule and
// criterion A1 are amended to match (docs/frozen/calboard-stock-analyzer-
// v1-spec.md §14.8). THE GATE BELOW IS NOT AMENDED AND DOES NOT MOVE. It still
// refuses before any calculation module when a queued fact carries no
// decision; what changed is that lib/analyzer/autoRun.ts can now answer the
// queue without a human, so the normal path reaches verification-complete on
// its own. A reader tempted to relax the check below because "the automatic
// pass will have run" is removing the only thing that makes that claim
// checkable.
//
// This module is the ONLY route from a runId to an AnalysisResult. It is a
// chokepoint by construction: computeAnalysisForRun is the single exported
// function that calls assembleAnalysisResult, and it checks the gate before
// doing so. A route that wants a report must come through here.
//
// The check is not "has the UI shown Step 2". It reads the decisions out of
// the database on every request, because a client-held run cannot be gated by
// the server (R7) and a route guard in the UI layer is a recommendation.
// ---------------------------------------------------------------------------

// M8-a: a run's FACTS come from SEC filings, acquired per run through the
// fixed, versioned tag mapping. The ANALYST side — Step 7's scenarios, the
// moat class and the policy constants a run needs — is the company's
// assumption sheet (CF-AR6-ANY-TICKER-DRAFTS-01, acquisition/analystInputs.ts).
//
// Any ticker gets a sheet: the one in force, or a price-blind draft written
// on first use. A company for which none exists and none can be drafted (no
// model configured, the filings cannot be read) cannot open a run. That is a
// refusal, not a gap to be filled with invented numbers.

/**
 * Whether a ticker can open a run — whether it has, or can be given, an
 * assumption sheet. analystInputsFor is the one resolver, so this defers to
 * it rather than re-deriving the answer a second way.
 */
export async function isSupportedTicker(ticker: string): Promise<boolean> {
  return (await analystInputsFor(ticker)) !== null;
}

/**
 * Offline mode: acquire from the committed SEC captures and the recorded
 * quotes beside them, calling nothing.
 *
 * Explicit configuration, never a fallback. The test suite runs here so it
 * neither depends on EDGAR being up nor spends the published rate budget on
 * every `npm test`, and a developer can work on a train. What it must not
 * become is a silent default when a live fetch fails — a stale fact set that
 * looks fresh is the §3.4 staleness question answered wrongly, so
 * `acquireCompany` still raises on a live failure rather than dropping back
 * here, and the run's disclosures name which source was used either way.
 */
function isOffline(): boolean {
  return process.env.ANALYZER_OFFLINE === "1";
}

/**
 * Whether a ticker can open a run.
 *
 * Kept under its old name so existing callers are unaffected, but it no longer
 * returns a hand-written fact set — there is no longer one to return.
 */
export async function fixtureForTicker(ticker: string): Promise<{ ticker: string } | null> {
  return (await isSupportedTicker(ticker)) ? { ticker: ticker.toUpperCase() } : null;
}

interface CapturedPriceRow {
  close: number;
  date: string;
  source: string;
}

/**
 * The recorded quote for a ticker, for offline runs only.
 *
 * Read lazily and never cached across calls to keep this out of the live path
 * entirely: an online run does not touch this file.
 */
function capturedPrice(
  ticker: string
): { value: Decimal; timestamp: string; source: string } | null {
  try {
    const path = join(
      process.cwd(),
      "lib",
      "analyzer",
      "acquisition",
      "captures",
      "prices.json"
    );
    const rows = JSON.parse(readFileSync(path, "utf8")) as Record<string, CapturedPriceRow>;
    const row = rows[ticker.toUpperCase()];
    if (row === undefined) return null;
    return {
      value: roundMoney(new Decimal(row.close)),
      timestamp: row.date,
      source: row.source,
    };
  } catch {
    return null;
  }
}

/**
 * The latest close, with its timestamp (§3.4).
 *
 * THE ONE PLACE A RUN GETS A PRICE, and the single guard separating a recorded
 * quote from a live one. `prices.json` is read only by `capturedPrice`, which
 * is called only from the `isOffline()` branch below — one reader, one call
 * site, one branch. Command Center's 8 September condition, that a capture can
 * never be served to a real run, is satisfied by that branch and not by
 * anything else, so it must not be softened into a fallback: `?? capturedPrice`
 * on the live path would serve a stale price exactly when the network is
 * having a bad day.
 *
 * Exported so priceCapture.test.ts can pin it. It is a seam for that test, not
 * an invitation to call it from elsewhere — loadGateState is the only caller.
 *
 * A failure returns null rather than throwing. Price is one input among many:
 * losing it must return INCOMPLETE for price-dependent outputs (§5.2), not
 * take down a run whose filing facts were acquired perfectly well. It is never
 * estimated, carried forward or interpolated (§5.1), and there is no
 * "approximate" price state anywhere (§3.4).
 */
export async function latestPrice(
  ticker: string
): Promise<{ value: Decimal; timestamp: string; source: string } | null> {
  // Offline mode reads a RECORDED quote rather than calling the provider — the
  // same treatment the filing facts get, and for the same reason: real data,
  // taken once, labelled as a capture rather than passed off as live.
  //
  // It exists so an offline run has the same fact-set SHAPE as a live one.
  // Without it the price fact is simply absent, which quietly shrinks the Step
  // 2 queue and left the gate's own integration tests unable to reach a
  // partly-decided queue at all. A test environment that cannot reach the
  // state under test is the failure mode this project keeps finding.
  //
  // Absent from the capture file, this returns null and price-dependent
  // outputs are INCOMPLETE — never a stale or stand-in figure, which §3.4 and
  // §5.1 both forbid.
  if (isOffline()) return capturedPrice(ticker);

  try {
    const provider = activeProvider();
    const point = await provider.fetchLatestEod(ticker, "equity");
    return {
      // Cent-rounded through the app's one money policy, exactly as the
      // portfolio side does. Providers serve prices as JS floats — Yahoo
      // returns Microsoft's 499.70 close as 499.70001220703125 — and
      // lib/money.ts's opening comment records why that is rounded once, at a
      // known point, rather than wherever each display path happens to do it.
      //
      // This is a rounding of the acquired figure, not an estimate of it
      // (§5.1): the cent is the unit the price is quoted in, and the trailing
      // binary noise is an artefact of the transport rather than information
      // from the source. Not doing it would put a sixteen-digit price on the
      // fact card and let the analyzer disagree with /holdings about the same
      // instrument on the same day — the divergence money.ts exists to end.
      value: roundMoney(new Decimal(point.close)),
      timestamp: point.date,
      source: `${provider.sourceName} latest close`,
    };
  } catch {
    return null;
  }
}

interface Fundamentals {
  epsTrailing: Decimal | null;
  epsForward: Decimal | null;
}

/**
 * Trailing/forward EPS, off the same feed `latestPrice` reads — a provider
 * field, not a filing tag (§4.4's mapping version never gained one; see
 * companyInputs.ts). Feeds P/E only; nothing else in this run depends on it.
 *
 * Same shape as `latestPrice`/`fiftyTwoWeekRange`: offline mode never calls
 * the provider (there is no committed EPS capture, so an offline run keeps
 * P/E INCOMPLETE, same as it already keeps M3 INCOMPLETE), and a provider
 * failure or a provider with no fundamentals surface returns null rather than
 * throwing — losing EPS must return INCOMPLETE for P/E (§5.2), never take
 * down a run whose filing facts acquired fine.
 */
export async function fundamentals(ticker: string): Promise<Fundamentals | null> {
  if (isOffline()) return null;

  try {
    const provider = activeProvider();
    const result = (await provider.fetchFundamentals?.(ticker)) ?? null;
    if (result === null) return null;
    return {
      epsTrailing: result.epsTrailing === null ? null : new Decimal(result.epsTrailing),
      epsForward: result.epsForward === null ? null : new Decimal(result.epsForward),
    };
  } catch {
    return null;
  }
}

const MS_PER_DAY = 86_400_000;
// Comfortably more than the 364-day window fiftyTwoWeekRangeFrom actually
// uses. The extra slack costs nothing — the pure helper filters to its own
// window and applies its own coverage rule — and it means a `from` date that
// lands on a closed market day never trims a real trading day off either end.
const HISTORICAL_FETCH_DAYS = 380;

function isoDateOnly(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 10);
}

/**
 * The trailing 52-week range of CLOSING prices (§7.2 M3), ending at the run's
 * own price as-of date — never an intraday high/low, since
 * `fetchHistoricalEod` serves closes.
 *
 * Keyed to `priceAsOfDate` rather than to "now" so the range and the price
 * shown beside it describe the same day. Where there is no price as-of date
 * (§3.4's price failure — see `latestPrice`), there is nothing to key the
 * window to, so this is never called and the range is null (below) — the
 * same fail-closed shape `latestPrice` itself already gives a fetch failure,
 * applied one step earlier.
 *
 * Offline mode never calls the provider, for the same reason `latestPrice`
 * does not: `ANALYZER_OFFLINE` stays the single switch it already is, and
 * this outcome adds no second one or fallback path. An offline run keeps
 * today's M3 INCOMPLETE.
 *
 * A failure — provider error, empty series, or a series too short for
 * fiftyTwoWeekRangeFrom's own coverage rule — returns null rather than
 * throwing: losing the range must return INCOMPLETE for M3 (§5.2), never take
 * down a run whose filing facts acquired fine.
 */
export async function fiftyTwoWeekRange(
  ticker: string,
  priceAsOfDate: string
): Promise<FiftyTwoWeekRange | null> {
  if (isOffline()) return null;

  try {
    const provider = activeProvider();
    const to = isoDateOnly(Date.parse(priceAsOfDate));
    const from = isoDateOnly(Date.parse(to) - HISTORICAL_FETCH_DAYS * MS_PER_DAY);
    const points = await provider.fetchHistoricalEod(ticker, "equity", from, to);
    return fiftyTwoWeekRangeFrom(points, priceAsOfDate);
  } catch {
    return null;
  }
}

/**
 * Raised when a calculation is attempted before Step 2 is complete.
 *
 * This is a refusal, not an error state to be rendered as a broken page. It
 * carries the outstanding fact ids so the caller can say what remains rather
 * than only that something does.
 *
 * CF-ANALYZER-AUTORUN-01 — the routes no longer answer it by sending the
 * analyst to Screen 2. The normal path answers the queue automatically before
 * a report is asked for (lib/analyzer/autoRun.ts), so reaching this from a
 * route means the automatic pass could not complete, and what the analyst gets
 * is an INCOMPLETE report naming what is outstanding — never an operator
 * workflow (Calvin, 22 September 2026 04:28:04Z).
 */
export class SpotCheckIncompleteError extends Error {
  readonly runId: string;
  readonly outstandingFactIds: string[];

  constructor(runId: string, outstandingFactIds: string[]) {
    super(
      `Spot-check incomplete for run ${runId}: ${outstandingFactIds.length} queued fact(s) carry no decision. ` +
        `No calculation module may execute before Step 2 is complete (§2).`
    );
    this.name = "SpotCheckIncompleteError";
    this.runId = runId;
    this.outstandingFactIds = outstandingFactIds;
  }
}

export class RunNotFoundError extends Error {
  constructor(runId: string) {
    super(`No run ${runId}`);
    this.name = "RunNotFoundError";
  }
}

export interface GateState {
  run: AnalyzerRun;
  fixture: CompanyFixture;
  decidedFactIds: Set<string>;
  queuedCount: number;
  outstandingFactIds: string[];
  spotCheckComplete: boolean;
  /**
   * The whole acquisition, so the screens can show where each figure came
   * from, what the §3.8.2 suite found, and what on this run was not acquired.
   * §3.8.2 is explicit that unreported cross-check results are not a control,
   * so the outcomes travel to the screen rather than to a log.
   */
  acquired: AcquiredRunInputs;
  /** Forced into the queue by a failed §3.8.2 cross-check, whatever their path. */
  crossCheckFailedFactIds: Set<string>;
  /**
   * Evidence for the derived-fact queue exemption on THIS run. Carried on the
   * state so every screen reads the same queue the gate enforced, rather than
   * recomputing it from a different set of facts.
   */
  derivedExemption: DerivedExemptionEvidence;
  /** The market data this state was built on — fetched, or the run's pinned snapshot. */
  market: MarketSnapshot;
}

/**
 * The market data a run is valued on: its price and the provider figures read
 * beside it. CF-AR3-REPRODUCIBLE-RUNS-01 — fetched once, when the run is first
 * computed, then stored with that output (snapshotStore.ts saveRunOutput) and handed back
 * here on every later computation of the same run, so a run stays valued at
 * its own price date instead of whatever the market says on the day it is
 * reopened.
 */
export interface MarketSnapshot {
  price: { value: Decimal; timestamp: string; source: string } | null;
  fiftyTwoWeek: FiftyTwoWeekRange | null;
  epsTrailing: Decimal | null;
  epsForward: Decimal | null;
}

export interface LoadGateStateOptions {
  /** This run's pinned market data. Omitted, it is fetched (the run's first computation). */
  market?: MarketSnapshot;
}

/**
 * Loads everything the gate needs and says whether Step 2 is complete.
 * Read-only: it computes no valuation and calls no calculation module. Screens
 * use it to decide what to render; computeAnalysisForRun uses it to decide
 * whether to compute at all.
 */
export async function loadGateState(runId: string, options: LoadGateStateOptions = {}): Promise<GateState> {
  const run = await getRun(runId);
  if (run === null) throw new RunNotFoundError(runId);

  // CF-LEG2-PINNED-REOPEN-01 (issue #483) — run-aware, so a run whose
  // analyst inputs are pinned (A5) is supported by its own pin. Through the
  // ticker-only isSupportedTicker the pin was skipped: every reopen after the
  // cache expired called the model again, and offline (or on an empty reply)
  // a pinned run became unopenable. Still the one resolver, still failing
  // closed when no bundle exists from any source.
  if ((await analystInputsFor(run.ticker, runId)) === null) {
    // A run exists for a ticker with no analyst-input bundle. Fail closed: a
    // run whose scenarios cannot exist must not be computable.
    throw new RunNotFoundError(runId);
  }

  const [decisions, judgments, nonOperatingOverride, market] = await Promise.all([
    getFactDecisions(runId),
    getJudgments(runId),
    // CF-ANALYZER-V1-SETTLE-01 — Calvin ruling 2: a durable company-level
    // override, consulted only as a fallback below when this run has no
    // per-run judgment of its own (migration 007).
    getCompanyJudgmentOverride(run.ticker, "NON-OPERATING INVESTMENTS"),
    options.market ?? fetchMarketSnapshot(run.ticker),
  ]);
  const { price, fiftyTwoWeek, epsTrailing, epsForward } = market;

  // Acquire once to learn the candidate investment line items, then resolve
  // §4.4's judgment against them. Enterprise value depends on the outcome:
  // with no judgment recorded the non-operating figure is null and every
  // EV-based output is INCOMPLETE. That is the correct state — no tag says
  // which of a company's investments are non-operating.
  const source = isOffline() ? ("CAPTURE" as const) : undefined;
  const withoutJudgment = await buildAcquiredRun({
    ticker: run.ticker,
    runId,
    price,
    fiftyTwoWeek,
    epsTrailing,
    epsForward,
    source,
  });
  // Per-run selection wins when an analyst has actually decided this run;
  // the durable company-level override (Calvin ruling 2, CF-ANALYZER-V1-
  // SETTLE-01) is a fallback for a fresh run that has not been asked yet —
  // never a second vote against a choice this run already made.
  const nonOperatingSelection =
    judgments.find((j) => j.judgmentKey === "NON-OPERATING INVESTMENTS")?.selection ??
    nonOperatingOverride?.selection;
  const nonOperatingInvestments = selectionToNonOperatingInvestments(
    nonOperatingSelection,
    withoutJudgment.acquired.acquisition.candidateNonOperatingInvestments
  );

  // The queue is the ACQUISITION-TIME fact set's: which facts need a decision
  // is decided before any decision exists.
  const acquiredFacts = withoutJudgment.fixture.facts;
  const crossCheckFailedFactIds = withoutJudgment.acquired.crossCheckFailedFactIds;

  // The evidence the derived-fact exemption rests on (Command Center, 8
  // September 2026): which facts a §3.8.2 cross-check actually constrained
  // against other facts and passed. Derived here, from this run's own report,
  // so a stale or absent report cannot exempt anything.
  const derivedExemption = {
    crossCheckConstrainedFactIds: constrainedAndPassedFactIds(withoutJudgment.acquired.crossChecks),
  };

  const decidedFactIds = new Set(decisions.map((d) => d.factId));
  const outstanding = undecidedFacts(
    acquiredFacts,
    decidedFactIds,
    crossCheckFailedFactIds,
    derivedExemption
  ).map((f) => f.id);

  // Every fact leaves this function carrying the verification state THIS run
  // gives it, derived from the decisions AND the cross-check outcomes — never
  // the acquisition-time label. Done once, here, because this is the single
  // place a run's facts are loaded: the screens, the Analysis Result and the
  // report's provenance tokens all read what this produces, and none of them
  // re-derives it. A second derivation downstream is how the screen and the
  // data came to disagree.
  const facts = applyDecisions(
    acquiredFacts,
    // CF-ANALYZER-AUTORUN-01 — the whole stored decision now, not only its
    // decision half: the origin and the §3.8.4 code travel onto the fact so
    // every surface reads the same record, and none of them has to ask the
    // store a second question to find out who decided.
    new Map(
      decisions.map((d) => [
        d.factId,
        { decision: d.decision, origin: d.origin, reasonCode: d.reasonCode },
      ])
    ),
    crossCheckFailedFactIds,
    derivedExemption
  );

  // CF-AR3-REPRODUCIBLE-RUNS-01 — the calculation inputs are built from THESE
  // facts, not the acquisition-time ones. Before, only `fixture.facts` was
  // replaced: every module input kept its acquisition-time provenance, so a
  // fact this run decided NOT CONFIRMED still fed enterprise value, H3's cash
  // basis needed a second derivation here to catch up, and a confirmed fact
  // still reported "spot-check pending" in its figures. Building the inputs
  // once from the decided facts gates every dependent output on the decision
  // (figures.ts computedValue) through the one mechanism. The second
  // acquisition is served from the acquisition cache, and the market data is
  // the SAME snapshot used above — no second EDGAR or market-data request.
  const decidedById = new Map(facts.map((f) => [f.id, f]));
  const acquired = await buildAcquiredRun({
    ticker: run.ticker,
    runId,
    price,
    fiftyTwoWeek,
    epsTrailing,
    epsForward,
    nonOperatingInvestments,
    source,
    decideFacts: (acquisitionFacts) => acquisitionFacts.map((f) => decidedById.get(f.id) ?? f),
  });
  const fixture = acquired.fixture;

  return {
    run,
    // §9.6's two run-level inputs are set HERE, for the reason the comment
    // above gives about the facts: this is the single place a run is loaded,
    // and a second derivation downstream is how the screen and the data came
    // to disagree. `buildAcquiredRun` defaults profileHumanConfirmed to false
    // because it cannot see the database; this is where the recorded answer
    // and this run's own cross-check outcomes replace that default.
    fixture: {
      ...fixture,
      trustInputs: {
        profileHumanConfirmed: run.profileHumanConfirmed,
        crossCheckFailedFactIds: [...crossCheckFailedFactIds],
        profileAutoResolved: run.profileAutoResolved,
      },
    },
    decidedFactIds,
    queuedCount: queuedFacts(acquiredFacts, crossCheckFailedFactIds, derivedExemption).length,
    outstandingFactIds: outstanding,
    spotCheckComplete: isSpotCheckComplete(
      acquiredFacts,
      decidedFactIds,
      crossCheckFailedFactIds,
      derivedExemption
    ),
    acquired,
    crossCheckFailedFactIds,
    derivedExemption,
    market,
  };
}

/**
 * This run's market data, fetched: the price, then the 52-week range keyed to
 * the price's own as-of date (fiftyTwoWeekRange's own doc — no price means no
 * date to key the window to, so the range is null rather than anchored to an
 * unrelated "now"), and EPS off the same feed.
 */
async function fetchMarketSnapshot(ticker: string): Promise<MarketSnapshot> {
  const [price, eps] = await Promise.all([latestPrice(ticker), fundamentals(ticker)]);
  const fiftyTwoWeek = price === null ? null : await fiftyTwoWeekRange(ticker, price.timestamp);
  return { price, fiftyTwoWeek, epsTrailing: eps?.epsTrailing ?? null, epsForward: eps?.epsForward ?? null };
}

/**
 * The gated entry to calculation, and the only one.
 *
 * Throws SpotCheckIncompleteError before reaching assembleAnalysisResult when
 * any queued fact lacks a decision. The order of the two statements below is
 * the milestone: the check precedes the call, and nothing computes on the
 * failing path.
 */
export async function computeAnalysisForRun(runId: string): Promise<AnalysisResult> {
  return (await computeRunOutput(runId)).result;
}

/**
 * computeAnalysisForRun, with the inputs it computed from: the engine input
 * (re-assembling it reproduces the result) and the market data it used.
 * CF-AR3-REPRODUCIBLE-RUNS-01 — what the report stores (reportAnalysis.ts).
 * The same gate, in the same order: the check precedes the call.
 */
export async function computeRunOutput(
  runId: string,
  options: LoadGateStateOptions = {}
): Promise<{ result: AnalysisResult; fixture: CompanyFixture; market: MarketSnapshot }> {
  const state = await loadGateState(runId, options);

  if (!state.spotCheckComplete) {
    throw new SpotCheckIncompleteError(runId, state.outstandingFactIds);
  }

  return { result: assembleAnalysisResult(state.fixture), fixture: state.fixture, market: state.market };
}
