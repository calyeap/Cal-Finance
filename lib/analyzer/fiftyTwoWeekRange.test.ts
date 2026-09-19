import { describe, it, expect } from "vitest";
import { fiftyTwoWeekRangeFrom } from "./fiftyTwoWeekRange";
import type { EodPricePoint } from "../marketdata/provider";

const AS_OF = "2026-09-04";

function point(daysBeforeAsOf: number, close: number): EodPricePoint {
  const date = new Date(Date.parse(AS_OF) - daysBeforeAsOf * 86_400_000).toISOString().slice(0, 10);
  return { date, close, adjustedClose: close };
}

describe("fiftyTwoWeekRangeFrom", () => {
  it("returns null for an empty series", () => {
    expect(fiftyTwoWeekRangeFrom([], AS_OF)).toBeNull();
  });

  it("returns null when the covered window falls short of the coverage rule", () => {
    // All points land within the last 60 days — real closes, but nowhere near
    // 52 weeks of them. Reporting their min/max as a 52-week range would be
    // exactly the "approximate" price state §3.4 forbids.
    const points = [point(60, 100), point(30, 110), point(0, 105)];
    expect(fiftyTwoWeekRangeFrom(points, AS_OF)).toBeNull();
  });

  it("computes the correct low/high, cent-rounded, over a normal series", () => {
    // Floating noise exactly like the comment in lib/money.ts describes a
    // real provider serving — a 703.41 close arriving as 703.409973 — must
    // round to the cent, not carry the transport artefact into the range.
    const points = [
      point(364, 703.409973),
      point(200, 80532.578125),
      point(100, 650.0),
      point(0, 690.12345),
    ];

    const result = fiftyTwoWeekRangeFrom(points, AS_OF);
    expect(result).not.toBeNull();
    expect(result!.low.toString()).toBe("650");
    expect(result!.high.toString()).toBe("80532.58");
  });

  it("sorts unordered input explicitly before applying the coverage rule", () => {
    // The provider contract says points may come back in any order. Placed
    // first in this ARRAY is a recent point; the chronologically earliest
    // point (which is what actually satisfies the coverage rule) sits later
    // in the array. An implementation that trusted array order rather than
    // sorting would read the recent point as "the earliest in the window",
    // find a short apparent span, and wrongly return null.
    const points = [point(10, 120), point(340, 90), point(180, 140)];

    const result = fiftyTwoWeekRangeFrom(points, AS_OF);
    expect(result).not.toBeNull();
    expect(result!.low.toString()).toBe("90");
    expect(result!.high.toString()).toBe("140");
  });

  it("includes a point exactly at the trailing-window boundary (364 days back)", () => {
    const points = [point(364, 100), point(0, 150)];
    const result = fiftyTwoWeekRangeFrom(points, AS_OF);
    expect(result).not.toBeNull();
    expect(result!.low.toString()).toBe("100");
    expect(result!.high.toString()).toBe("150");
  });

  it("excludes a point one day beyond the trailing-window boundary (365 days back)", () => {
    // Without the exclusion this outlier would win the low; with it, the
    // window's own earliest point (364 days back) sets the coverage and the
    // low instead.
    const points = [point(365, 1), point(364, 100), point(0, 150)];
    const result = fiftyTwoWeekRangeFrom(points, AS_OF);
    expect(result).not.toBeNull();
    expect(result!.low.toString()).toBe("100");
    expect(result!.high.toString()).toBe("150");
  });

  it("excludes a point after the as-of date", () => {
    const points = [point(300, 100), point(-5, 999)];
    const result = fiftyTwoWeekRangeFrom(points, AS_OF);
    expect(result).not.toBeNull();
    expect(result!.high.toString()).toBe("100");
  });

  it("returns null when the unadjusted-close series spans a split between two adjacent trading days", () => {
    // REVIEW on #184: `close` is unadjusted, and a raw min/max over a window
    // containing a split publishes a range that was never actually traded.
    // A 10:1 forward split lands between two literally consecutive trading
    // days (200 and 199 days back) — exactly the shape a real split shows up
    // as in a daily series.
    const points = [point(360, 1150), point(200, 1200), point(199, 118), point(0, 125)];
    expect(fiftyTwoWeekRangeFrom(points, AS_OF)).toBeNull();
  });

  it("does not false-positive on ordinary volatility spread across the window, even at a coincidental split ratio", () => {
    // 100 -> 150 is exactly the 2/3 ratio `matchesCommonSplitRatio` matches
    // (the reciprocal of 1.5x), but these two points are 364 days apart, not
    // adjacent trading days — a year of ordinary price movement, not a split.
    const points = [point(300, 100), point(150, 115), point(0, 108)];
    const result = fiftyTwoWeekRangeFrom(points, AS_OF);
    expect(result).not.toBeNull();
    expect(result!.low.toString()).toBe("100");
    expect(result!.high.toString()).toBe("115");
  });

  it("does not false-positive on a same-day-adjacent ratio that isn't a common split multiple", () => {
    const points = [point(300, 100), point(298, 115), point(0, 108)];
    const result = fiftyTwoWeekRangeFrom(points, AS_OF);
    expect(result).not.toBeNull();
    expect(result!.low.toString()).toBe("100");
    expect(result!.high.toString()).toBe("115");
  });
});
