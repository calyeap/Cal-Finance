import Decimal from "decimal.js";
import { MSFT_FIXTURE } from "../fixtures/msft";
import { OKLO_FIXTURE } from "../fixtures/oklo";
import type { AnalystInputs } from "./companyInputs";
import { recordedAnalystInputBundle } from "./recordedBundles";
import type { AnalystSuppliedRange } from "../modules/sensitivity";

// ---------------------------------------------------------------------------
// The inputs that are NOT facts, and were never acquired from anything.
//
// Read this before reading anything else in this file: **the values below are
// not filing data and must never be presented as though they were.**
//
// M8-a replaces the fixtures as the source of FACTS. It does not, and is not
// meant to, replace them as the source of the ANALYST's inputs — the three
// scenarios with their drivers and written anchors (Step 7), the scenario
// values they produce, and the four §7.1 policy constants Command Center has
// not defined. Those come from a human, Step 7's interface is not built, and
// M8-a's scope explicitly excludes building it.
//
// So they are carried from the M5/M7 validation fixtures, and this file is the
// single place that happens, so that a reader can see the whole of the
// not-acquired surface in one screen rather than discovering it a field at a
// time. Every FACT-derived input is built from real filings in
// companyInputs.ts; nothing here touches one.
//
// The consequence to keep in view when reading a real run's report: the
// scenario block and the fair-value range it feeds are still fixture-derived.
// Everything upstream of them — the fact set, the gates, the margin history,
// the EV bridge inputs, the FCF components — is acquired.
// ---------------------------------------------------------------------------

export interface AnalystInputBundle {
  inputs: Omit<AnalystInputs, "nonOperatingInvestments" | "gate0" | "fiftyTwoWeek" | "trustInputs">;
  /** Rendered to the analyst. Not a comment — a disclosure. */
  note: string;
}

const NOTE =
  "The three scenarios, the values they produce and four unset policy constants " +
  "on this run were NOT acquired. They are carried from the validation set, " +
  "because the screen where you enter scenarios is not built yet. Every fact, " +
  "gate and margin figure on this run comes from SEC filings.";

function bundleFrom(fixture: typeof MSFT_FIXTURE): AnalystInputBundle {
  return {
    inputs: {
      profile: fixture.profile,
      scenarios: fixture.scenarios,
      scenarioValues: fixture.scenarioValues,
      revalueBaseCaseAtRate: fixture.revalueBaseCaseAtRate,
      configuredConstants: fixture.configuredConstants,
      preRevenue: fixture.preRevenue,
    },
    note: NOTE,
  };
}

// ---------------------------------------------------------------------------
// CF-STEP4-MSFT-RANGE-CAPTURE-01 — the minimum AnalystSuppliedRange capture
// CALVIN RULING — A authorised: MSFT only, growth and operating-margin axes
// only (PR #323 comment 5830507368). Kept beside the rest of this file's
// not-acquired surface, not in `lib/`'s deterministic modules — these three
// points per axis are analyst assumptions, exactly like the scenarios above,
// and sensitivity.ts's own rule (`sensitivity.ts:53-65`) forbids a module
// deriving a range from POLICY or a historical calculation; this file may
// only CITE one when authoring the range by hand, never compute one.
//
// Growth: the three values already authored for MSFT's own bear/base/bull
// scenarios above (`scenarios.bear/base/bull.revenueGrowthOrPath`), cited
// here as the analyst's own already-recorded growth anchors — not re-read
// from `scenarios` at runtime, and never a substitute for Step 5's scenario
// range (ruling A / ruling C: no Step 1/Step 5 reuse) since this capture
// feeds a structurally different mechanism (M14's tornado/two-way tables),
// not Step 4's forecast-dispersion measure itself.
//
// Operating margin: MSFT's own already-configured stress margin
// (`configuredConstants.stressMarginLevel`, 38.0%) as the downside anchor,
// and the M3 margin diagnostics already acquired for this company
// (`reverseDcf.medianMargin` 41.8% / `reverseDcf.currentMargin` 46.8%,
// `marginHistory.cyclicality.tenYearMarginRange` 21.4pp — cited for context,
// not read into a formula) for the mid/high anchors.
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

/**
 * MSFT only (ruling A). Null for every other ticker — including OKLO, whose
 * growth/margin scenario drivers are themselves unauthored (`okloBundle`
 * below) — so their M14 tornado rows and growth x margin table stay
 * `available: false` exactly as before this capture.
 */
export function sensitivityRangesFor(ticker: string): SensitivityRangeBundle | null {
  return SENSITIVITY_RANGES[ticker.toUpperCase()] ?? null;
}

const SENSITIVITY_NOTE =
  " This run also carries two AnalystSuppliedRange captures for M14's sensitivity tornado/two-way " +
  "machinery — three explicit growth points and three explicit operating-margin points, each with a " +
  "recorded rationale (CF-STEP4-MSFT-RANGE-CAPTURE-01, authorised by CALVIN RULING — A). These are " +
  "likewise analyst assumptions, not filing data: they size a sensitivity test, not a forecast, and " +
  "must never be presented as though acquired from a filing.";

function msftBundle(): AnalystInputBundle {
  const bundle = bundleFrom(MSFT_FIXTURE);
  return { ...bundle, note: bundle.note + SENSITIVITY_NOTE };
}

/**
 * OKLO, less the two things its validation set carries but nobody authored.
 *
 * The validation set gives OKLO's three scenarios a written anchor each and
 * NO growth, margin or reinvestment drivers — it carries 0 for all nine, a
 * placeholder the frozen mock (which has no Section F for OKLO) never shows.
 * And it gives no revaluation of the base case at other discount rates — it
 * carries a constant $31 whatever the rate, which the solver then searched
 * and reported as having no solution. A live report printed the first as
 * 0.0% growth, margin and reinvestment (CB-AUDIT-01 H4c) and would state the
 * second as a finding about the company. Supplied here as absent instead, so
 * both report INCOMPLETE. The fixture itself is untouched: it reproduces the
 * mock, and its placeholders are part of what it reproduces against.
 */
function okloBundle(): AnalystInputBundle {
  const bundle = bundleFrom(OKLO_FIXTURE);
  const unauthored = { revenueGrowthOrPath: null, operatingMargin: null, reinvestmentCapitalIntensity: null };
  const s = bundle.inputs.scenarios;
  return {
    inputs: {
      ...bundle.inputs,
      scenarios: {
        bear: { ...s.bear, ...unauthored },
        base: { ...s.base, ...unauthored },
        bull: { ...s.bull, ...unauthored },
      },
      revalueBaseCaseAtRate: null,
    },
    note:
      bundle.note +
      " For OKLO the validation set holds no growth, margin or reinvestment drivers and no revaluation " +
      "of the base case at other discount rates, so those report incomplete rather than carrying placeholders.",
  };
}

const BUNDLES: Record<string, AnalystInputBundle> = {
  MSFT: msftBundle(),
  OKLO: okloBundle(),
};

/**
 * Null for any company without a recorded analyst bundle.
 *
 * Null is the correct answer, not a gap to be filled: a company nobody has
 * supplied scenarios for HAS no scenarios, and inventing three would put
 * numbers with no author into a fair-value range.
 *
 * CF-ANALYST-INPUT-ENTRY-01 — the ONE resolver, reading TWO sources: the two
 * bundles committed above, and — for any other ticker — whatever has been
 * recorded through the entry path (recordedBundles.ts) into
 * analyzer_recorded_analyst_bundles. Async because the second source is a
 * database read; both call sites (acquiredRun.ts, calibrate-position.ts)
 * already run inside an async function and now await this one too, rather
 * than caching around the change (SCOPE item 2). The committed bundles are
 * checked first and returned synchronously-fast, so MSFT and OKLO are
 * unaffected by the database ever being asked.
 */
export async function analystInputsFor(ticker: string): Promise<AnalystInputBundle | null> {
  const committed = BUNDLES[ticker.toUpperCase()];
  if (committed !== undefined) return committed;
  return recordedAnalystInputBundle(ticker);
}

/** The tickers whose analyst inputs are committed in code, never recorded
 * through the entry path. A company with a RECORDED bundle instead is a
 * supported ticker too (gate.ts's isSupportedTicker checks both), but is
 * deliberately not added to this static list — it is the one place this
 * file's own header can point a reader to "every committed bundle at a
 * glance", and a database-backed ticker cannot honestly join a list that is
 * read without an async call. */
export const TICKERS_WITH_ANALYST_INPUTS = Object.keys(BUNDLES);
