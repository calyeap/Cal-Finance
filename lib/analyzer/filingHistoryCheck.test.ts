import { describe, it, expect, beforeEach } from "vitest";
import { checkAnnualFilingHistory, __resetFilingHistoryCache } from "./filingHistoryCheck";
import type { FilingHistoryDeps } from "./filingHistoryCheck";
import type { CompanyTickerDirectory, SubmissionsDocument } from "./acquisition/secClient";

// ---------------------------------------------------------------------------
// Tested against injected deps, never the live network or SEC_USER_AGENT —
// same reasoning as secClient.test.ts: a test that hit EDGAR would test the
// SEC's availability, not this module.
// ---------------------------------------------------------------------------

const DIRECTORY: CompanyTickerDirectory = {
  "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." },
};

function submissionsWithForms(forms: string[]): SubmissionsDocument {
  return {
    cik: "0000320193",
    name: "Apple Inc.",
    filings: { recent: { form: forms } },
  };
}

function deps(overrides: Partial<FilingHistoryDeps> = {}): FilingHistoryDeps {
  return {
    companyTickers: async () => DIRECTORY,
    submissions: async () => submissionsWithForms(["10-K", "8-K", "10-Q"]),
    ...overrides,
  };
}

beforeEach(() => {
  __resetFilingHistoryCache();
});

describe("checkAnnualFilingHistory", () => {
  it("PRESENT when the submissions index carries an annual form", async () => {
    const result = await checkAnnualFilingHistory("AAPL", deps());
    expect(result).toBe("PRESENT");
  });

  it.each(["10-K", "10-K/A", "20-F", "40-F"])("PRESENT for annual form %s", async (form) => {
    const result = await checkAnnualFilingHistory(
      "AAPL",
      deps({ submissions: async () => submissionsWithForms([form, "8-K"]) })
    );
    expect(result).toBe("PRESENT");
  });

  it("ABSENT when the registrant has filed only non-annual forms", async () => {
    const result = await checkAnnualFilingHistory(
      "AAPL",
      deps({ submissions: async () => submissionsWithForms(["8-K", "10-Q", "S-1"]) })
    );
    expect(result).toBe("ABSENT");
  });

  // Calboard does not follow succession to a predecessor registrant — a
  // ticker with no CIK at all is refused the same as one with a CIK and zero
  // annual filings, per spec §2 rule 1a.
  it("ABSENT when the ticker has no CIK in the SEC directory at all", async () => {
    const result = await checkAnnualFilingHistory(
      "VNTC",
      deps({ companyTickers: async () => ({}) })
    );
    expect(result).toBe("ABSENT");
  });

  it("UNAVAILABLE when the ticker directory fetch fails", async () => {
    const result = await checkAnnualFilingHistory(
      "AAPL",
      deps({
        companyTickers: async () => {
          throw new Error("network error");
        },
      })
    );
    expect(result).toBe("UNAVAILABLE");
  });

  it("UNAVAILABLE when the submissions fetch fails", async () => {
    const result = await checkAnnualFilingHistory(
      "AAPL",
      deps({
        submissions: async () => {
          throw new Error("429 rate limited");
        },
      })
    );
    expect(result).toBe("UNAVAILABLE");
  });

  it("UNAVAILABLE, not ABSENT, when the submissions document carries no filings list", async () => {
    const result = await checkAnnualFilingHistory(
      "AAPL",
      deps({ submissions: async () => ({ cik: "0000320193", name: "Apple Inc." }) })
    );
    expect(result).toBe("UNAVAILABLE");
  });

  it("fails closed to UNAVAILABLE when no deps are injected and SEC_USER_AGENT is unset", async () => {
    // No test in this suite sets SEC_USER_AGENT (vitest.setup.ts does not),
    // so the production default path exercises the same fail-closed branch a
    // real missing-configuration deployment would hit.
    const result = await checkAnnualFilingHistory("AAPL");
    expect(result).toBe("UNAVAILABLE");
  });

  it("caches the result per ticker, without a second lookup", async () => {
    let calls = 0;
    const trackedDeps = deps({
      companyTickers: async () => {
        calls += 1;
        return DIRECTORY;
      },
    });

    const first = await checkAnnualFilingHistory("AAPL", trackedDeps);
    const second = await checkAnnualFilingHistory("AAPL", trackedDeps);

    expect(first).toBe("PRESENT");
    expect(second).toBe("PRESENT");
    expect(calls).toBe(1);
  });

  it("caches independently per ticker", async () => {
    const absent = await checkAnnualFilingHistory(
      "VNTC",
      deps({ companyTickers: async () => ({}) })
    );
    const present = await checkAnnualFilingHistory("AAPL", deps());

    expect(absent).toBe("ABSENT");
    expect(present).toBe("PRESENT");
  });

  it("normalises the ticker before looking up and caching", async () => {
    const result = await checkAnnualFilingHistory("  aapl  ", deps());
    expect(result).toBe("PRESENT");
  });
});
