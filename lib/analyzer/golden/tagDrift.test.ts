import { describe, it, expect } from "vitest";
import { detectTagDrift, DEFAULT_STALENESS_THRESHOLD_MONTHS, type TagHistoryRow } from "./tagDrift";

// Real row histories, transcribed verbatim from the fresh, untrimmed SEC
// XBRL companyfacts captures fetched for this harness (data.sec.gov,
// CIK0000021344 for KO, CIK0001045810 for NVDA) — not invented. Only the
// tail of each tag's real row history is reproduced here (the rows around
// and including its genuine last appearance); the full captures are
// multi-megabyte JSON and are not checked into the repo.

// KO us-gaap:LongTermDebtNoncurrent — real rows, period ends 2023-03-31
// through 2024-03-29 (its actual last-ever row). KO's capture's most
// recent filing anywhere (any tag) is 2026-04-30 (a 10-Q).
const KO_LONG_TERM_DEBT_NONCURRENT_ROWS: TagHistoryRow[] = [
  { end: "2023-03-31", val: 36134000000, accn: "0000021344-23-000024", fy: 2023, fp: "Q1", form: "10-Q", filed: "2023-04-26" },
  { end: "2023-06-30", val: 35626000000, accn: "0000021344-23-000048", fy: 2023, fp: "Q2", form: "10-Q", filed: "2023-07-27" },
  { end: "2023-09-29", val: 34176000000, accn: "0000021344-23-000060", fy: 2023, fp: "Q3", form: "10-Q", filed: "2023-10-24" },
  { end: "2023-12-31", val: 35547000000, accn: "0000021344-24-000009", fy: 2023, fp: "FY", form: "10-K", filed: "2024-02-20" },
  { end: "2023-12-31", val: 35547000000, accn: "0000021344-24-000017", fy: 2024, fp: "Q1", form: "10-Q", filed: "2024-05-02" },
  { end: "2024-03-29", val: 35104000000, accn: "0000021344-24-000017", fy: 2024, fp: "Q1", form: "10-Q", filed: "2024-05-02" },
];
const KO_MOST_RECENT_FILED_ANYWHERE = "2026-04-30";

// NVDA us-gaap:MarketableSecuritiesCurrent — real rows, period ends
// 2025-01-26 through 2025-10-26 (its actual last-ever row; it then goes
// absent for 2026-01-25, 2026-04-26 and 2026-07-26, the three periods NVDA
// kept reporting other marketable-securities-family tags for). NVDA's
// capture's most recent filing anywhere (any tag) is 2026-08-26.
const NVDA_MARKETABLE_SECURITIES_CURRENT_ROWS: TagHistoryRow[] = [
  { end: "2025-01-26", val: 34621000000, accn: "0001045810-25-000116", fy: 2026, fp: "Q1", form: "10-Q", filed: "2025-05-28" },
  { end: "2025-01-26", val: 34621000000, accn: "0001045810-25-000209", fy: 2026, fp: "Q2", form: "10-Q", filed: "2025-08-27" },
  { end: "2025-01-26", val: 34621000000, accn: "0001045810-25-000230", fy: 2026, fp: "Q3", form: "10-Q", filed: "2025-11-19" },
  { end: "2025-04-27", val: 38457000000, accn: "0001045810-25-000116", fy: 2026, fp: "Q1", form: "10-Q", filed: "2025-05-28" },
  { end: "2025-07-27", val: 45152000000, accn: "0001045810-25-000209", fy: 2026, fp: "Q2", form: "10-Q", filed: "2025-08-27" },
  { end: "2025-10-26", val: 49122000000, accn: "0001045810-25-000230", fy: 2026, fp: "Q3", form: "10-Q", filed: "2025-11-19" },
];
const NVDA_MOST_RECENT_FILED_ANYWHERE = "2026-08-26";

describe("detectTagDrift — real SEC tag-drift worked examples (DO item 6)", () => {
  it("flags KO's LongTermDebtNoncurrent as stale/dead — last row is period end 2024-03-29, ~24 months behind the capture's most recent filing", () => {
    const result = detectTagDrift("KO", "LongTermDebtNoncurrent", KO_LONG_TERM_DEBT_NONCURRENT_ROWS, KO_MOST_RECENT_FILED_ANYWHERE);
    expect(result.stale).toBe(true);
    expect(result.lastSeenPeriodEnd).toBe("2024-03-29");
    expect(result.monthsStale).not.toBeNull();
    expect(result.monthsStale as number).toBeGreaterThan(DEFAULT_STALENESS_THRESHOLD_MONTHS);
    expect(result.reason).toContain("KO LongTermDebtNoncurrent");
    expect(result.reason).toContain("2024-03-29");
    expect(result.reason).toContain("stale/dead");
  });

  it("flags NVDA's MarketableSecuritiesCurrent as stale/dead — last row is period end 2025-10-26, ~9 months behind the capture's most recent filing (three missed quarters: 2026-01-25, 2026-04-26, 2026-07-26)", () => {
    const result = detectTagDrift(
      "NVDA",
      "MarketableSecuritiesCurrent",
      NVDA_MARKETABLE_SECURITIES_CURRENT_ROWS,
      NVDA_MOST_RECENT_FILED_ANYWHERE
    );
    expect(result.stale).toBe(true);
    expect(result.lastSeenPeriodEnd).toBe("2025-10-26");
    expect(result.monthsStale).not.toBeNull();
    expect(result.monthsStale as number).toBeGreaterThan(DEFAULT_STALENESS_THRESHOLD_MONTHS);
    expect(result.reason).toContain("NVDA MarketableSecuritiesCurrent");
    expect(result.reason).toContain("2025-10-26");
  });

  it("does NOT flag a tag whose last row is recent relative to the capture's own anchor (negative control)", () => {
    const freshRows: TagHistoryRow[] = [
      { end: "2026-07-26", val: 1000, accn: "0001045810-26-000099", fy: 2027, fp: "Q2", form: "10-Q", filed: "2026-08-26" },
    ];
    const result = detectTagDrift("NVDA", "SomeStillLiveTag", freshRows, "2026-08-26");
    expect(result.stale).toBe(false);
  });

  it("flags an absent tag (zero rows) outright, with a distinct reason naming absence rather than staleness", () => {
    const result = detectTagDrift("X", "SomeTag", [], "2026-01-01");
    expect(result.stale).toBe(true);
    expect(result.reason).toContain("absent");
  });

  it("is not anchored to wall-clock time — passing the SAME capture-internal anchor always gives the same verdict regardless of when the test runs", () => {
    const a = detectTagDrift("KO", "LongTermDebtNoncurrent", KO_LONG_TERM_DEBT_NONCURRENT_ROWS, KO_MOST_RECENT_FILED_ANYWHERE);
    const b = detectTagDrift("KO", "LongTermDebtNoncurrent", KO_LONG_TERM_DEBT_NONCURRENT_ROWS, KO_MOST_RECENT_FILED_ANYWHERE);
    expect(a).toEqual(b);
  });
});
