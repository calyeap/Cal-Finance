// CF-AR2-GOLDEN-HARNESS-01, DO item 3 and item 6 ("fail loudly on SEC tag
// drift"). HARNESS-ONLY — not wired into any production acquisition module.
//
// SEC XBRL tags get retired or renamed over a company's filing history (a
// genuine, observed phenomenon — see the two worked examples in
// tagDrift.test.ts: KO's `LongTermDebtNoncurrent`/`LongTermDebt` series,
// dead since period end 2024-03-29; NVDA's `MarketableSecuritiesCurrent`,
// dead since period end 2025-10-26). A consumer that keeps reading a dead
// tag silently uses a stale balance forever — "fail loudly" means this
// check actively flags that, rather than some downstream code trusting a
// 2+-year-old number.
//
// ANCHOR CHOICE — deliberately NOT wall-clock "now". A staleness check
// anchored to `Date.now()` would make a test's pass/fail drift with the
// calendar (the exact trap DO item 3 warns against: "don't hardcode today's
// wall-clock date into the check itself"). Instead this module anchors
// staleness to data WITHIN the same captured company-facts payload: the
// most recent `filed` date seen anywhere else in that company's capture
// (across any tag) stands in for "how fresh is this capture, as of itself".
// A tag whose own last row trails that anchor by more than the configured
// threshold is flagged — a fact about the RELATIONSHIP between two dates
// already present in the data, not about today's date.

export interface TagHistoryRow {
  end: string; // ISO date, e.g. "2024-03-29"
  val: number;
  accn: string;
  filed?: string;
  form?: string;
  fy?: number | string;
  fp?: string;
}

export interface TagDriftResult {
  stale: boolean;
  ticker: string;
  tag: string;
  lastSeenPeriodEnd: string | null;
  lastSeenFiled: string | null;
  mostRecentFiledAnywhereInCapture: string;
  monthsStale: number | null;
  reason: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function monthsBetween(earlier: string, later: string): number {
  const a = new Date(earlier + "T00:00:00Z").getTime();
  const b = new Date(later + "T00:00:00Z").getTime();
  return (b - a) / MS_PER_DAY / 30.44;
}

// Default threshold: ~2 missed quarterly reporting cycles (6 months) plus
// slack for ordinary filing-date jitter, for a tag that is normally
// disclosed every quarter (both 10-Q and 10-K) — the shape of both worked
// examples this harness actually has real data for (KO's long-term-debt
// tags, NVDA's MarketableSecuritiesCurrent; both quarterly-cadence
// balance-sheet items). Documented choice, not derived from a stated
// policy — this harness-level check's own calibration.
//
// CAVEAT a caller must handle, not this module: a tag that is genuinely
// disclosed ONLY in the annual 10-K (never in a 10-Q) will show a normal
// ~9-12 month gap between consecutive appearances even while perfectly
// healthy, if the capture's "most recent filed date anywhere" comes from a
// more frequently-filed tag (a 10-Q). This default is calibrated for
// quarterly-cadence tags; an annual-only tag needs a caller-supplied larger
// threshold (e.g. ~15 months) or its own anchor restricted to other
// annual-only tags, or this check will over-flag it. Neither golden-facts
// worked example below is annual-only, so this gap does not bite either of
// them, but it is a genuine limitation worth stating rather than silently
// leaving a one-size-fits-all default to misfire on a different tag later.
export const DEFAULT_STALENESS_THRESHOLD_MONTHS = 6;

// `rows` is one tag's full row history from a company's captured
// companyfacts JSON (any unit bucket); `mostRecentFiledAnywhereInCapture`
// is a date (ISO) the caller derives from scanning other tags in the SAME
// capture (see tagDrift.test.ts for a real worked derivation against the
// raw KO/NVDA captures) — never from wall-clock "now".
export function detectTagDrift(
  ticker: string,
  tag: string,
  rows: TagHistoryRow[],
  mostRecentFiledAnywhereInCapture: string,
  thresholdMonths: number = DEFAULT_STALENESS_THRESHOLD_MONTHS
): TagDriftResult {
  if (rows.length === 0) {
    return {
      stale: true,
      ticker,
      tag,
      lastSeenPeriodEnd: null,
      lastSeenFiled: null,
      mostRecentFiledAnywhereInCapture,
      monthsStale: null,
      reason: `${ticker} ${tag}: no rows at all in this capture — tag absent, cannot be read.`,
    };
  }

  const sorted = [...rows].sort((a, b) => (a.end < b.end ? -1 : a.end > b.end ? 1 : 0));
  const last = sorted[sorted.length - 1];
  const lastFiled = last.filed ?? last.end;
  const monthsStale = monthsBetween(lastFiled, mostRecentFiledAnywhereInCapture);
  const stale = monthsStale > thresholdMonths;

  return {
    stale,
    ticker,
    tag,
    lastSeenPeriodEnd: last.end,
    lastSeenFiled: last.filed ?? null,
    mostRecentFiledAnywhereInCapture,
    monthsStale: Math.round(monthsStale * 10) / 10,
    reason: stale
      ? `${ticker} ${tag}: last reported for period end ${last.end} (filed ${lastFiled}), ` +
        `${Math.round(monthsStale)} months behind the most recent filing seen anywhere else in this ` +
        `company's capture (${mostRecentFiledAnywhereInCapture}) — this tag has gone stale/dead and must not ` +
        `be read as current.`
      : `${ticker} ${tag}: last reported for period end ${last.end}, ${Math.round(monthsStale)} months behind ` +
        `the capture's most recent filing — within the ${thresholdMonths}-month staleness threshold.`,
  };
}

// Convenience: scan several candidate tags' row histories (e.g. KO's
// LongTermDebtNoncurrent/LongTermDebtCurrent/LongTermDebt, which went dead
// together) and report drift for every one that has any rows at all —
// absent tags are a caller's REQUIRED-input problem, not a drift problem,
// so they're excluded here by design (len 0 handling stays in
// detectTagDrift for a caller that explicitly wants to flag absence too).
export function detectTagDriftForCandidates(
  ticker: string,
  candidates: { tag: string; rows: TagHistoryRow[] }[],
  mostRecentFiledAnywhereInCapture: string,
  thresholdMonths: number = DEFAULT_STALENESS_THRESHOLD_MONTHS
): TagDriftResult[] {
  return candidates
    .filter((c) => c.rows.length > 0)
    .map((c) => detectTagDrift(ticker, c.tag, c.rows, mostRecentFiledAnywhereInCapture, thresholdMonths));
}
