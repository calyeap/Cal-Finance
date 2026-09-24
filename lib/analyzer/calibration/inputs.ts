import Decimal from "decimal.js";
import { annualSeries, latestAnnualFiscalYear, type AnnualSeries } from "../acquisition/history";
import { TAG_MAP } from "../acquisition/tagMap";
import type { CompanyFactsDocument } from "../acquisition/secClient";
import type { AchievedGrowth, ComparatorWindow, RawInput, ReverseDcfCell } from "../types";

// ---------------------------------------------------------------------------
// M8-c — the two deterministic inputs behind the valuation position, computed
// as RAW VALUES on a company, or reported as blocked.
//
// §10.6.2 names exactly two inputs and this module computes exactly those two:
//
//   A. Price location within the scenario range     (§10.2 section G)
//   B. The required-versus-achieved growth gap      (M7's implied growth read
//      against the company's own achieved history on a consistent accounting
//      basis, §3.7)
//
// IT CLASSIFIES NOTHING. There is no band, no cut-point and no CHEAP / FAIR /
// EXPENSIVE anywhere in this file, deliberately: the classification is what
// thresholds produce, and the thresholds are Calvin's to rule. A future
// session adding a comparison operator here has moved the decision out of the
// ruling and into the code, which is the Appendix B failure repeating.
//
// It also never fills a missing input. Every "blocked" path below records WHY
// and returns nothing — a calibration observation invented to keep a company
// in the set is worth less than an honest gap, because the gap can be fixed
// and a fabricated observation silently cannot.
// ---------------------------------------------------------------------------

function blocked<T>(...reasons: string[]): RawInput<T> {
  return { value: null, blockedBy: reasons };
}

function present<T>(value: T): RawInput<T> {
  return { value, blockedBy: [] };
}

// --- Input A — price location within the scenario range --------------------

export interface PriceLocationInputs {
  /** Step 7's three scenario values, per share. Null where no analyst has authored them. */
  scenarioValues: { bear: Decimal; base: Decimal; bull: Decimal } | null;
  currentPrice: Decimal | null;
  /**
   * §10.6.3 — the position renders only where a range exists. A suppressed
   * range yields NO price-location input, however arithmetically computable
   * `(price - bear) / (bull - bear)` happens to be from the raw scenario
   * numbers. Carrying the arithmetic past a suppressed range is how a figure
   * the run refused to publish gets calibrated on anyway.
   */
  rangeSuppressedBy: string | null;
}

/**
 * Price's position between the bottom and the top of the scenario range, as a
 * fraction. 0 is the bear value, 1 is the bull value; below 0 and above 1 are
 * real answers, not errors — a price above the top of the range is the case
 * §10.6 has no fixture for.
 */
export function priceLocationWithinRange(input: PriceLocationInputs): RawInput<Decimal> {
  const reasons: string[] = [];
  if (input.rangeSuppressedBy !== null) {
    reasons.push(`range suppressed - ${input.rangeSuppressedBy} (§10.6.3: no range, no position)`);
  }
  if (input.scenarioValues === null) {
    reasons.push("no Step 7 scenarios - the three scenario values are analyst input and were never acquired");
  }
  if (input.currentPrice === null) {
    reasons.push("no price");
  }
  if (reasons.length > 0) return blocked(...reasons);

  const { bear, bull } = input.scenarioValues as { bear: Decimal; base: Decimal; bull: Decimal };
  const span = bull.minus(bear);
  if (span.isZero()) {
    return blocked("scenario range has zero width - bear equals bull, so there is no location to be in");
  }
  return present((input.currentPrice as Decimal).minus(bear).dividedBy(span));
}

// --- Input B — the required-versus-achieved growth gap ---------------------

/**
 * How far this filer has actually reported, and whether the mapping already
 * holds a live series the chosen one was picked over.
 *
 * Read off the filings by `comparatorRecency`, never asserted by a caller.
 */
export interface WindowRecency {
  currentFiscalYear: number;
  /**
   * A candidate ALREADY IN the mapping whose own series reaches
   * `currentFiscalYear`, where the chosen series does not. Null when the
   * chosen series is current, or when nothing else reaches further.
   *
   * This is what separates a shortened window from a wrong one. It is a
   * question about the mapping, not a change to it.
   */
  reachedBy: { tag: string; throughFiscalYear: number; observations: number } | null;
}

/**
 * `recency` is REQUIRED, and that is the fix's load-bearing part.
 *
 * A comparator cannot be obtained without saying what period the company has
 * actually reported. Before defect D the question was never asked, so the
 * answer could never be wrong — the figure came back bare and looked healthy.
 */
export function achievedRevenueCagr(
  series: AnnualSeries | null,
  horizonYears: number,
  recency: WindowRecency
): RawInput<AchievedGrowth> {
  if (series === null) {
    return blocked("no single-tag annual revenue series - §3.7 refuses a series assembled from more than one tag");
  }
  const observations = series.observations;
  const toFiscalYear = observations[observations.length - 1]?.fiscalYear ?? recency.currentFiscalYear;
  const yearsStale = Math.max(0, recency.currentFiscalYear - toFiscalYear);

  // Checked before the horizon, and it returns alone when it fires.
  //
  // A superseded series is the wrong series, so "only 6 annual observations"
  // would be a true statement about a tag nobody should be reading and would
  // land in the report as a finding about the company's history — which, on
  // the series that was skipped, is eighteen years long.
  if (yearsStale > 0 && recency.reachedBy !== null) {
    return blocked(
      `comparator window ends FY${toFiscalYear}, ${yearsStale} fiscal ${yearsStale === 1 ? "year" : "years"} ` +
        `before FY${recency.currentFiscalYear}, the latest annual period this filer has reported - and ` +
        `${recency.reachedBy.tag} carries ${recency.reachedBy.observations} annual years through ` +
        `FY${recency.reachedBy.throughFiscalYear} in the same mapping entry. The figure is WRONG, not stale: ` +
        `${series.tag} was taken because it resolved first, not because it was current. Correcting which ` +
        `candidate resolves re-resolves every previously acquired fact (§3.8.1) and belongs to the ` +
        `acquisition pass, so the comparator refuses here rather than re-choosing`
    );
  }

  if (observations.length === 0) {
    return blocked(`${series.tag} carries no annual observations at all`);
  }

  // THE FAR ENDPOINT IS A FISCAL YEAR, NOT A POSITION.
  //
  // `observations[length - 1 - horizonYears]` is the same thing as FY(to - N)
  // only on a series with no gaps, and a real series can have one: NVIDIA
  // tagged FY2019 revenue solely under the ASC 606 element, so us-gaap:Revenues
  // — eighteen years long and the right series to read — simply has no FY2019
  // row. Counting back ten positions from FY2026 landed on FY2015 and
  // compounded ELEVEN years of growth under a ten-year label. The window
  // travelled with the figure and said FY2015→FY2026, so it was visible rather
  // than hidden, but a reader had to do the subtraction to catch it.
  //
  // A gap INSIDE the window is not a defect and is not treated as one: a CAGR
  // is a function of its two endpoints and nothing between them. §3.7's concern
  // is that the window sit on ONE accounting basis, which a single-tag series
  // already guarantees.
  //
  // A gap AT the endpoint is a defect, and refusing is the same rule as the
  // too-short case with a different cause: §10.6.2 requires the achieved figure
  // to be on the same horizon as the implied one "or it is not compared at
  // all", and the nearest available year under a ten-year label is precisely
  // the mismatch that forbids.
  const to = observations[observations.length - 1];
  const fromFiscalYear = to.fiscalYear - horizonYears;
  const from = observations.find((o) => o.fiscalYear === fromFiscalYear);

  if (from === undefined) {
    return blocked(
      `${series.tag} carries no FY${fromFiscalYear} observation; a ${horizonYears}-year CAGR ending FY${to.fiscalYear} ` +
        `needs ${horizonYears + 1} annual years, FY${fromFiscalYear} through FY${to.fiscalYear}`
    );
  }

  const fromValue = new Decimal(from.value);
  const toValue = new Decimal(to.value);
  // A CAGR across a sign change or from a zero base is not a growth rate - it
  // is a number the formula still produces. Refused rather than reported.
  if (fromValue.lessThanOrEqualTo(0) || toValue.lessThanOrEqualTo(0)) {
    return blocked(
      `${series.tag} is non-positive at an endpoint (${from.fiscalYear}: ${from.value}, ${to.fiscalYear}: ${to.value}) - no CAGR exists`
    );
  }

  const window: ComparatorWindow = {
    tag: series.tag,
    horizonYears,
    fromFiscalYear: from.fiscalYear,
    toFiscalYear: to.fiscalYear,
    currentFiscalYear: recency.currentFiscalYear,
    yearsStale,
  };

  return present({
    tag: series.tag,
    horizonYears,
    fromValue,
    toValue,
    cagr: toValue.dividedBy(fromValue).pow(new Decimal(1).dividedBy(horizonYears)).minus(1),
    window,
    staleWindowDisclosure: yearsStale === 0 ? null : disclosureFor(window),
  });
}

/**
 * The sentence a stale figure may not be shown without.
 *
 * Written as prose rather than a code, because the surfaces that will carry it
 * — the action clause (§10.6.4) among them — state figures in sentences, and a
 * flag rendered as `STALE` beside a number is the second all-caps token
 * §10.6.4 forbids.
 */
function disclosureFor(window: ComparatorWindow): string {
  const years = window.yearsStale === 1 ? "year" : "years";
  return (
    `measured to FY${window.toFiscalYear}, ${window.yearsStale} fiscal ${years} before FY${window.currentFiscalYear}, ` +
    `the latest annual period this filer has reported. ${window.tag} carries nothing later, and no other ` +
    `candidate in the mapping reaches further, so the window is shortened rather than wrong (§3.7) - ` +
    `it is recorded here because a shortened window and a full one give different answers`
  );
}

/**
 * How far the filer has reported, and whether a live series sat unread beside
 * the chosen one.
 *
 * Reads the mapping's OWN candidate list and asks each one how far it runs.
 * That is a question about the mapping, not a change to it: no candidate is
 * added, removed or reordered, `TAG_MAPPING_VERSION` is untouched, and no
 * previously acquired fact re-resolves. Which candidate ACQUISITION picks is
 * deliberately left exactly as it was.
 */
export function comparatorRecency(doc: CompanyFactsDocument, series: AnnualSeries): WindowRecency {
  // Never null in practice: the series' own rows are annual rows of this same
  // document, so the latest annual year is at least the series' own end. The
  // fallback keeps a filer whose facts carry no full year at all from being
  // reported stale against a year that does not exist.
  const currentFiscalYear =
    latestAnnualFiscalYear(doc) ?? series.observations[series.observations.length - 1]?.fiscalYear ?? 0;

  const chosenEnd = series.observations[series.observations.length - 1]?.fiscalYear ?? 0;
  if (chosenEnd >= currentFiscalYear) return { currentFiscalYear, reachedBy: null };

  for (const candidate of revenueTagCandidates()) {
    const alternative = annualSeries(doc, [candidate]);
    if (alternative === null || alternative.tag === series.tag) continue;
    const end = alternative.observations[alternative.observations.length - 1]?.fiscalYear ?? 0;
    if (end < currentFiscalYear) continue;
    return {
      currentFiscalYear,
      reachedBy: {
        tag: alternative.tag,
        throughFiscalYear: end,
        observations: alternative.observations.length,
      },
    };
  }

  return { currentFiscalYear, reachedBy: null };
}

/** One solved reverse-DCF cell's required growth, kept raw. */
export interface RequiredGrowthCell {
  marginLevel: string;
  rate: number;
  fiveYearGrowth: Decimal;
  tenYearCagr: Decimal;
}

/**
 * The required side, read off M7's grid.
 *
 * ALL NINE CELLS ARE RETURNED, unreduced. Which cell the position's "required"
 * figure comes from - which margin level, which discount rate - is NOT settled
 * by §10.6.2, which names "M7's implied growth" without choosing among the
 * nine. Picking one here would be making that ruling silently, so the harness
 * reports the whole grid and leaves the choice visible.
 */
export function requiredGrowthCells(grid: readonly ReverseDcfCell[]): RawInput<RequiredGrowthCell[]> {
  const solved: RequiredGrowthCell[] = [];
  const causes = new Set<string>();

  for (const cell of grid) {
    if (cell.fiveYearGrowth.suppressed) {
      causes.add(`${cell.fiveYearGrowth.state} - ${cell.fiveYearGrowth.cause}`);
      continue;
    }
    if (cell.tenYearCagr.suppressed) {
      causes.add(`${cell.tenYearCagr.state} - ${cell.tenYearCagr.cause}`);
      continue;
    }
    solved.push({
      marginLevel: cell.marginLevel,
      rate: cell.rate,
      fiveYearGrowth: cell.fiveYearGrowth.value,
      tenYearCagr: cell.tenYearCagr.value,
    });
  }

  if (solved.length === 0) {
    return blocked(...[...causes].map((c) => `all ${grid.length} reverse-DCF cells suppressed: ${c}`));
  }
  return present(solved);
}

/**
 * The gap itself, in growth points, on a matched horizon.
 *
 * Positive means the price requires MORE growth than the company has
 * delivered. Negative means it requires less. The sign convention is stated
 * because the action clause (§10.6.4) reads it aloud and a flipped sign would
 * invert the sentence without changing a number.
 */
export function gapPoints(requiredTenYearCagr: Decimal, achieved: AchievedGrowth): Decimal {
  return requiredTenYearCagr.minus(achieved.cagr);
}

// --- one company's whole observation ---------------------------------------

export interface CalibrationObservation {
  ticker: string;
  shape: string;
  priceLocation: RawInput<Decimal>;
  achievedTenYear: RawInput<AchievedGrowth>;
  achievedFiveYear: RawInput<AchievedGrowth>;
  required: RawInput<RequiredGrowthCell[]>;
  /** Usable only where BOTH §10.6.2 inputs are present. One is not enough. */
  usable: boolean;
}

export function isUsable(observation: Omit<CalibrationObservation, "usable">): boolean {
  return (
    observation.priceLocation.value !== null &&
    observation.required.value !== null &&
    observation.achievedTenYear.value !== null
  );
}

/** The revenue tag candidates the achieved series is read from - one place. */
export function revenueTagCandidates() {
  const entry = TAG_MAP.find((e) => e.factId === "current-revenue");
  if (entry === undefined) throw new Error("current-revenue is missing from the tag mapping");
  return entry.candidates;
}

export function revenueSeries(doc: CompanyFactsDocument): AnnualSeries | null {
  return annualSeries(doc, revenueTagCandidates());
}
