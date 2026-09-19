import Decimal from "decimal.js";
import { roundMoney } from "../money";
import type { EodPricePoint } from "../marketdata/provider";

// ---------------------------------------------------------------------------
// M9-FIFTYTWOWEEK-01 — the small deterministic helper §7.2 M3's range is
// missing.
//
// `MarketDataProvider.fetchHistoricalEod` serves CLOSES, not intraday
// extremes (lib/marketdata/provider.ts's own EodPricePoint has `close` and
// `adjustedClose`, nothing else). What this derives is therefore a
// CLOSING-PRICE 52-week range — a real figure, honestly narrower than an
// intraday high/low — and callers are responsible for labelling it as such at
// the surface rather than presenting it as an intraday range.
//
// Returns null, never a partial answer, whenever the series cannot honestly
// support a range: empty, or covering less than the minimum window below.
// §3.4/§5.1: a missing input is a reportable state, not a gap to estimate
// past.
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;
const TRAILING_DAYS = 52 * 7; // 364 — the trailing window this derives.

// The minimum span the series must actually cover, measured from its
// earliest point in the window to the as-of date, before a range is reported
// at all. A company listed four months ago has closes for four months, not
// fifty-two weeks, and reporting that shorter window as if it were the full
// one is exactly the "approximate" price state §3.4 forbids.
//
// 300 days is the same lower bound history.ts's ANNUAL_DAYS uses to recognise
// a filed period as a full year rather than something shorter — reused here,
// against trading days rather than filing periods, for the same reason: it
// tolerates the ordinary gap between a calendar window's start and the
// nearest trading day (weekends, holidays, a provider's own retention edge)
// without accepting a window that is materially short of 52 weeks.
const MIN_COVERAGE_DAYS = 300;

export interface FiftyTwoWeekRange {
  low: Decimal;
  high: Decimal;
}

/**
 * The trailing 52-week range of CLOSING prices, ending at `asOfDate`.
 *
 * `points` may arrive in any order (the provider contract says so
 * explicitly) — sorted here rather than trusted, because the coverage check
 * below reads the chronologically first point in the window and an unsorted
 * array would make that read the wrong one.
 *
 * Cent-rounded through `lib/money.ts`'s one money policy, exactly as
 * `latestPrice` rounds the single quote it reads from the same kind of feed.
 */
export function fiftyTwoWeekRangeFrom(
  points: readonly EodPricePoint[],
  asOfDate: string
): FiftyTwoWeekRange | null {
  if (points.length === 0) return null;

  const asOf = Date.parse(asOfDate);
  const windowStart = asOf - TRAILING_DAYS * MS_PER_DAY;

  const inWindow = points
    .filter((p) => {
      const t = Date.parse(p.date);
      return t >= windowStart && t <= asOf;
    })
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  if (inWindow.length === 0) return null;

  const earliest = Date.parse(inWindow[0].date);
  if (asOf - earliest < MIN_COVERAGE_DAYS * MS_PER_DAY) return null;

  const closes = inWindow.map((p) => new Decimal(p.close));
  return {
    low: roundMoney(Decimal.min(...closes)),
    high: roundMoney(Decimal.max(...closes)),
  };
}
