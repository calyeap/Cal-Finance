import { describe, it, expect } from "vitest";
import { acquireCompany } from "../acquisition/provider";
import type { SecClient, SubmissionsDocument } from "../acquisition/secClient";
import { historyFrom, recentEarningsReleases, redactMarketPrice, researchFor } from "./research";

// ---------------------------------------------------------------------------
// CF-AR6-ANY-TICKER-DRAFTS-01 — the research pack (issue #454 DO 1 and 2):
// full history from the filed facts, cited filing text, nothing about the
// price. Real MSFT capture; the SEC client is a test double.
// ---------------------------------------------------------------------------

describe("historyFrom — the full filed history the draft is written from", () => {
  it("reads revenue, margin, capex, D&A, cash flow, returns and the latest quarter off MSFT's real filings", async () => {
    const acquired = await acquireCompany("MSFT", { price: null, source: "CAPTURE" });
    const { measures } = historyFrom(acquired.companyFacts);
    const latest = measures.years[measures.years.length - 1];
    // FY2026 revenue, as filed (the same figure the run base reads).
    expect(latest.revenue?.toString()).toBe("331839000000");
    expect(latest.operatingIncome).not.toBeNull();
    expect(latest.capex).not.toBeNull();
    expect(latest.depreciationAndAmortisation).not.toBeNull();
    expect(latest.operatingCashFlow).not.toBeNull();
    expect(latest.nopat).not.toBeNull();
    expect(measures.years.length).toBeGreaterThanOrEqual(8);
    expect(measures.revenueCagr?.value.greaterThan(0)).toBe(true);
    expect(measures.operatingMarginRange?.high.greaterThan(measures.operatingMarginRange.low)).toBe(true);
    expect(measures.roicRange).not.toBeNull();
    expect(measures.latestQuarter?.periodEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("redactMarketPrice — the draft never sees the price", () => {
  it("drops every sentence about the stock's price or market value and keeps the rest", () => {
    const text =
      "Revenue grew 18% to $76.4 billion. Our closing stock price on June 30 was $499.70. " +
      "Backlog reached $368 billion. Market capitalization exceeded $3.7 trillion. Guidance: up low double digits.";
    const out = redactMarketPrice(text);
    expect(out).toContain("Revenue grew 18%");
    expect(out).toContain("Backlog reached $368 billion.");
    expect(out).toContain("Guidance");
    expect(out).not.toMatch(/499\.70|stock price|capitalization/);
  });
});

describe("recentEarningsReleases — 8-Ks announcing results (item 2.02), newest first", () => {
  it("keeps only current reports carrying item 2.02", () => {
    const subs: SubmissionsDocument = {
      cik: "1",
      name: "X",
      filings: {
        recent: {
          form: ["4", "8-K", "10-Q", "8-K", "8-K"],
          accessionNumber: ["a", "b", "c", "d", "e"],
          filingDate: ["2026-08-01", "2026-07-30", "2026-07-29", "2026-05-01", "2026-04-30"],
          items: ["", "2.02,9.01", "", "5.07", "2.02,9.01"],
        },
      },
    };
    expect(recentEarningsReleases(subs).map((r) => r.accession)).toEqual(["b", "e"]);
  });
});

describe("researchFor — every source cited by id, with its accession and URL", () => {
  it("adds each earnings release's exhibit 99 text as a cited source, price sentences removed", async () => {
    const acquired = await acquireCompany("MSFT", { price: null, source: "CAPTURE" });
    const client = {
      submissions: async () => ({
        cik: acquired.acquisition.cik,
        name: "MSFT",
        filings: { recent: { form: ["8-K"], accessionNumber: ["0000950170-26-000001"], filingDate: ["2026-07-29"], items: ["2.02,9.01"] } },
      }),
      getJson: async () => ({ directory: { item: [{ name: "R1.htm" }, { name: "msft-ex99_1.htm" }] } }),
      filingDocument: async () => "<p>Revenue was $76.4 billion. The stock price closed at $499.70.</p><p>Microsoft Cloud revenue grew 27%.</p>",
    } as unknown as SecClient;
    const pack = await researchFor(acquired, client);
    const e1 = pack.sources.find((s) => s.id === "E1");
    expect(e1?.kind).toBe("EARNINGS RELEASE");
    expect(e1?.accession).toBe("0000950170-26-000001");
    expect(e1?.url).toMatch(/\/000095017026000001\/msft-ex99_1\.htm$/);
    expect(e1?.excerpt).toContain("Microsoft Cloud revenue grew 27%");
    expect(e1?.excerpt).not.toContain("499.70");
    // The capture carries no Item 1 text; its absence is recorded, never filled.
    expect(pack.gaps.join()).toMatch(/no 10-K Item 1/);
  });

  it("offline (no client), records the absence of filing text rather than inventing it", async () => {
    const acquired = await acquireCompany("MSFT", { price: null, source: "CAPTURE" });
    const pack = await researchFor(acquired, null);
    expect(pack.sources.every((s) => s.kind === "HISTORY")).toBe(true);
    expect(pack.gaps.join()).toMatch(/no earnings releases/);
  });
});
