import { describe, it, expect } from "vitest";
import { latestMaterialFiling, withProviderBusinessSummary } from "./provider";
import type { SubmissionsDocument } from "./secClient";
import type { BusinessSectionContent } from "../types";

// ---------------------------------------------------------------------------
// CF-ANALYZER-V1-SETTLE-01 — the two acquisition-side fixes from the 7 Oct
// 2026 live proof (run 37566908890) on PR #399:
//   - MSFT's business description was missing on the live path; the
//     approved fallback (CALVIN RULING, comment 5952716764: "provider summary
//     fallback if needed") fills it, carrying the 10-K path's own reason;
//   - the "latest material development" was a Form 4 insider transaction.
// ---------------------------------------------------------------------------

const TEN_K_REASON =
  'The Item 1 extraction rule (item1-2026-10-1) could not locate the section in the filing: no standalone "Item 1. Business" heading line was found.';

const NO_NARRATIVE: BusinessSectionContent = { narrative: null, unavailableReason: TEN_K_REASON };

const SUMMARY =
  "Microsoft Corporation develops and supports software, services, devices and solutions worldwide, across productivity, cloud computing and personal computing.";

describe("withProviderBusinessSummary — the approved business-description fallback", () => {
  it("leaves a real 10-K Item 1 excerpt untouched and never calls the provider", async () => {
    const primary: BusinessSectionContent = {
      narrative: {
        text: "We are a technology company.",
        ruleVersion: "item1-2026-10-1",
        filingForm: "10-K",
        filingDate: "2026-07-30",
        accessionNumber: "0000950170-26-000001",
      },
      unavailableReason: null,
    };
    let called = false;
    const result = await withProviderBusinessSummary("MSFT", primary, async () => {
      called = true;
      return { text: SUMMARY, provider: "YAHOO" };
    });

    expect(result).toBe(primary);
    expect(called).toBe(false);
  });

  it("uses the provider summary where the 10-K excerpt is missing — labelled, dated, and carrying the 10-K path's own reason verbatim", async () => {
    const result = await withProviderBusinessSummary(
      "MSFT",
      NO_NARRATIVE,
      async () => ({ text: SUMMARY, provider: "YAHOO" }),
      () => new Date("2026-10-07T03:30:00.000Z")
    );

    expect(result).toEqual({
      narrative: {
        source: "MARKET-DATA PROVIDER SUMMARY",
        text: SUMMARY,
        provider: "YAHOO",
        retrievedAt: "2026-10-07T03:30:00.000Z",
        primaryUnavailableReason: TEN_K_REASON,
      },
      unavailableReason: null,
    });
  });

  it("keeps the honest unavailable reason, extended, when the provider has nothing or fails", async () => {
    for (const fetch of [async () => null, async () => Promise.reject(new Error("network")), async () => ({ text: "  ", provider: "YAHOO" })]) {
      const result = await withProviderBusinessSummary("MSFT", NO_NARRATIVE, fetch);
      expect(result.narrative).toBeNull();
      expect(result.unavailableReason).toBe(
        `${TEN_K_REASON} The market-data provider's company summary was not available either.`
      );
    }
  });
});

function submissions(rows: Array<{ form: string; filingDate: string }>): SubmissionsDocument {
  return {
    cik: "0000789019",
    name: "MICROSOFT CORP",
    filings: {
      recent: {
        form: rows.map((r) => r.form),
        filingDate: rows.map((r) => r.filingDate),
        accessionNumber: rows.map((_, i) => `acc-${i}`),
        primaryDocument: rows.map((_, i) => `doc-${i}.htm`),
      },
    },
  };
}

describe("latestMaterialFiling — the Overview's 'latest material development'", () => {
  it("skips insider, ownership and registration forms to the most recent periodic or current report (the live MSFT case)", () => {
    const doc = submissions([
      { form: "4", filingDate: "2026-09-17" },
      { form: "4", filingDate: "2026-09-12" },
      { form: "SC 13G/A", filingDate: "2026-09-02" },
      { form: "S-8", filingDate: "2026-08-20" },
      { form: "8-K", filingDate: "2026-08-14" },
      { form: "10-K", filingDate: "2026-07-30" },
    ]);

    expect(latestMaterialFiling(doc)).toEqual({ form: "8-K", filingDate: "2026-08-14" });
  });

  it("accepts amended and foreign-filer periodic reports", () => {
    expect(latestMaterialFiling(submissions([{ form: "10-Q/A", filingDate: "2026-09-01" }]))).toEqual({
      form: "10-Q/A",
      filingDate: "2026-09-01",
    });
    expect(latestMaterialFiling(submissions([{ form: "6-K", filingDate: "2026-09-01" }]))).toEqual({
      form: "6-K",
      filingDate: "2026-09-01",
    });
  });

  it("returns null rather than a non-material filing when no material one is listed", () => {
    expect(latestMaterialFiling(submissions([{ form: "4", filingDate: "2026-09-17" }]))).toBeNull();
    expect(latestMaterialFiling({ cik: "1", name: "X" })).toBeNull();
  });
});
