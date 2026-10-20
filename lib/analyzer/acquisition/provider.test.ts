import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { acquireCompany, __resetAcquisitionCache } from "./provider";

// ---------------------------------------------------------------------------
// CF-ANALYZER-USABLE-REPORT-REPAIR-01 — the live-EDGAR acquisition path
// (fromEdgar, inside provider.ts) has no coverage anywhere else in this
// suite: ANALYZER_OFFLINE=1 is forced globally (vitest.setup.ts), so every
// other test exercises fromCapture instead. These tests drive fromEdgar
// directly, against an injected global fetch — never the live network — the
// same discipline secClient.test.ts already uses for SecClient itself.
//
// What they prove: the two performance fixes this outcome made to the
// EDGAR path.
//
//  1. The ticker->CIK directory (company_tickers.json — the same multi-MB
//     document for every company) is fetched once per process and reused,
//     not refetched on every acquisition.
//  2. companyFacts and submissions, which depend only on the CIK and not on
//     each other, are requested concurrently rather than one after the
//     other's full round trip.
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const TICKER_DIRECTORY = {
  "0": { cik_str: 789019, ticker: "MSFT", title: "Microsoft Corporation" },
  "1": { cik_str: 1045810, ticker: "NVDA", title: "NVIDIA Corporation" },
};

function minimalCompanyFacts(cik: number) {
  return { cik, entityName: "Test Co", facts: { "us-gaap": {} } };
}

function minimalSubmissions() {
  return {
    cik: "789019",
    sic: "7372",
    sicDescription: "Services-Prepackaged Software",
    filings: { recent: { form: [], filingDate: [], accessionNumber: [], primaryDocument: [] } },
  };
}

describe("fromEdgar (via acquireCompany) — the live EDGAR path's own performance fixes", () => {
  beforeEach(() => {
    process.env.SEC_USER_AGENT = "CalFinanceTest/1.0 (test@example.com)";
    __resetAcquisitionCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SEC_USER_AGENT;
    __resetAcquisitionCache();
  });

  it("fetches the SEC ticker directory once and reuses it across a second company in the same process", async () => {
    let tickerDirectoryCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("company_tickers.json")) {
        tickerDirectoryCalls += 1;
        return jsonResponse(TICKER_DIRECTORY);
      }
      if (url.includes("/api/xbrl/companyfacts/")) return jsonResponse(minimalCompanyFacts(789019));
      if (url.includes("/submissions/")) return jsonResponse(minimalSubmissions());
      // Market-data fallback for the business summary — not under test here;
      // acquireCompany degrades to "not available either" on any rejection.
      throw new Error(`unrelated URL ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await acquireCompany("MSFT", { price: null });
    await acquireCompany("NVDA", { price: null });

    expect(tickerDirectoryCalls).toBe(1);
  });

  it("requests companyFacts and submissions concurrently — submissions does not wait on companyFacts' full round trip", async () => {
    let companyFactsRelease!: () => void;
    const companyFactsGate = new Promise<void>((resolve) => {
      companyFactsRelease = resolve;
    });
    let submissionsRequested = false;

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("company_tickers.json")) return jsonResponse(TICKER_DIRECTORY);
      if (url.includes("/api/xbrl/companyfacts/")) {
        // Held open deliberately. The old, sequential code could not reach
        // submissions until this resolved; Promise.all must not need to.
        await companyFactsGate;
        return jsonResponse(minimalCompanyFacts(789019));
      }
      if (url.includes("/submissions/")) {
        submissionsRequested = true;
        return jsonResponse(minimalSubmissions());
      }
      throw new Error(`unrelated URL ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const acquiring = acquireCompany("MSFT", { price: null });

    // SecClient's own rate limiter (secClient.ts, minIntervalMs) still
    // serialises REQUEST STARTS ~150ms apart even when the caller issues
    // both concurrently — so this waits comfortably past that, with the
    // companyFacts request still deliberately unresolved, and checks that
    // submissions was requested anyway.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(submissionsRequested).toBe(true);

    companyFactsRelease();
    await acquiring;
  });
});
