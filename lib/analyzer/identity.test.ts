import { describe, it, expect } from "vitest";
import {
  resolveAnalyzerIdentity,
  mayBeginAnalysis,
  offersTryAgain,
  disabledReason,
} from "./identity";
import type { InstrumentResolution, MarketDataProvider } from "../marketdata/provider";
import type { FilingHistoryCheck } from "./filingHistoryCheck";

// Every test that expects RESOLVED must stub the filing-history check: the
// real one calls EDGAR (via SEC_USER_AGENT, unset in this suite) and would
// otherwise answer UNAVAILABLE, silently turning every RESOLVED test into a
// test of the wrong thing.
const filingsPresent = async (): Promise<FilingHistoryCheck> => "PRESENT";
const filingsAbsent = async (): Promise<FilingHistoryCheck> => "ABSENT";
const filingsUnavailable = async (): Promise<FilingHistoryCheck> => "UNAVAILABLE";

function providerReturning(resolution: InstrumentResolution): MarketDataProvider {
  return {
    sourceName: "TEST",
    resolveInstrument: async () => resolution,
    fetchLatestEod: async () => {
      throw new Error("not used");
    },
    fetchHistoricalEod: async () => {
      throw new Error("not used");
    },
  };
}

function providerThrowing(err: unknown): MarketDataProvider {
  return {
    ...providerReturning({ outcome: "unknown" }),
    resolveInstrument: async () => {
      throw err;
    },
  };
}

const RESOLVED_MSFT: InstrumentResolution = {
  outcome: "resolved",
  symbol: "MSFT",
  assetClass: "equity",
  name: "Microsoft Corporation",
};

describe("resolveAnalyzerIdentity — the four Screen 1 states", () => {
  it("RESOLVED for a listed operating company, carrying the company name", async () => {
    const identity = await resolveAnalyzerIdentity(
      "msft",
      providerReturning(RESOLVED_MSFT),
      filingsPresent
    );
    expect(identity).toMatchObject({
      outcome: "RESOLVED",
      ticker: "MSFT",
      companyName: "Microsoft Corporation",
    });
  });

  // Screen 1 shows when the provider answered, so the answer carries a
  // timestamp rather than the page read one off the clock at render.
  it("records when resolution happened, as a parseable instant", async () => {
    const before = Date.now();
    const identity = await resolveAnalyzerIdentity(
      "MSFT",
      providerReturning(RESOLVED_MSFT),
      filingsPresent
    );
    const after = Date.now();

    expect(identity.outcome).toBe("RESOLVED");
    if (identity.outcome !== "RESOLVED") return;
    const at = new Date(identity.resolvedAt).getTime();
    expect(Number.isNaN(at)).toBe(false);
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(after);
  });

  it("UNKNOWN for a nonsense symbol", async () => {
    const identity = await resolveAnalyzerIdentity(
      "ZZQQXX",
      providerReturning({ outcome: "unknown" })
    );
    expect(identity.outcome).toBe("UNKNOWN");
  });

  // §1.2, §2, §9.3.1 — the narrowing. This refuses at resolution, not at
  // Step 2, and not as a downstream failure on a fact set that never existed.
  it("UNSUPPORTED for an ETF, which resolves perfectly well as an instrument", async () => {
    const identity = await resolveAnalyzerIdentity(
      "SPY",
      providerReturning({
        outcome: "resolved",
        symbol: "SPY",
        assetClass: "etf",
        name: "SPDR S&P 500 ETF Trust",
      })
    );
    expect(identity.outcome).toBe("UNSUPPORTED");
    expect(identity).toMatchObject({ instrumentDescription: "a fund or index" });
  });

  it("does not consult the provider for a recognised non-company instrument", async () => {
    let providerCalled = false;
    const provider: MarketDataProvider = {
      ...providerReturning({ outcome: "unknown" }),
      resolveInstrument: async () => {
        providerCalled = true;
        return { outcome: "unknown" };
      },
    };
    const identity = await resolveAnalyzerIdentity("BTC-USD", provider);
    expect(identity.outcome).toBe("UNSUPPORTED");
    expect(providerCalled).toBe(false);
  });

  it.each([
    ["BTC", "a cryptocurrency"],
    ["BTC-USD", "a cryptocurrency pair"],
    ["ETH-USD", "a currency or crypto pair"],
    ["EURUSD=X", "a currency pair"],
    ["^GSPC", "an index"],
  ])("UNSUPPORTED for %s, described as %s", async (ticker, description) => {
    const identity = await resolveAnalyzerIdentity(
      ticker,
      providerThrowing(new Error("must not be consulted"))
    );
    expect(identity).toMatchObject({ outcome: "UNSUPPORTED", instrumentDescription: description });
  });

  // The trap in any hyphen-based pair rule: BRK-B is Berkshire Hathaway class
  // B, a listed operating company this analyzer must accept. A "contains a
  // hyphen" test would refuse it.
  it.each([["BRK-B"], ["BRK.B"], ["RDS-A"]])(
    "does not mistake the share-class ticker %s for a currency pair",
    async (ticker) => {
      const identity = await resolveAnalyzerIdentity(
        ticker,
        providerReturning({
          outcome: "resolved",
          symbol: ticker,
          assetClass: "equity",
          name: "A Listed Company",
        }),
        filingsPresent
      );
      expect(identity.outcome).toBe("RESOLVED");
    }
  );

  it("UNSUPPORTED when the provider itself says unsupported", async () => {
    const identity = await resolveAnalyzerIdentity(
      "^GSPC",
      providerReturning({ outcome: "unsupported" })
    );
    expect(identity.outcome).toBe("UNSUPPORTED");
  });

  it("UNAVAILABLE when the provider reports a failure", async () => {
    const identity = await resolveAnalyzerIdentity(
      "MSFT",
      providerReturning({ outcome: "unavailable" })
    );
    expect(identity.outcome).toBe("UNAVAILABLE");
  });

  // provider.ts: "a failure to reach the provider is not proof the symbol is
  // invalid". This is the distinction that must not collapse — a timeout
  // reported as UNKNOWN tells the analyst their ticker is wrong when it is not.
  it.each([
    ["a timeout", new Error("ETIMEDOUT")],
    ["an HTTP error", new Error("503 Service Unavailable")],
    ["a quota rejection", new Error("quota exceeded")],
    ["a non-Error throw", "something unclassified"],
  ])("UNAVAILABLE, never UNKNOWN, when resolution throws: %s", async (_label, thrown) => {
    const identity = await resolveAnalyzerIdentity("MSFT", providerThrowing(thrown));
    expect(identity.outcome).toBe("UNAVAILABLE");
  });

  it("normalises the ticker before resolving", async () => {
    const identity = await resolveAnalyzerIdentity(
      "  msft  ",
      providerReturning(RESOLVED_MSFT),
      filingsPresent
    );
    expect(identity).toMatchObject({ outcome: "RESOLVED", ticker: "MSFT" });
  });

  it("treats an empty entry as UNKNOWN rather than calling the provider", async () => {
    const identity = await resolveAnalyzerIdentity("   ", providerThrowing(new Error("unreached")));
    expect(identity.outcome).toBe("UNKNOWN");
  });
});

// §2 rule 1a / acceptance criterion A28, authorised 14 Sep 2026: a registrant
// with no annual filing history is refused here, and a lookup failure must
// never be rendered as that refusal.
describe("resolveAnalyzerIdentity — the Step 1 filing-history check", () => {
  it("NO_FILING_HISTORY for a resolved company with zero annual filings", async () => {
    const identity = await resolveAnalyzerIdentity(
      "VNTC",
      providerReturning({
        outcome: "resolved",
        symbol: "VNTC",
        assetClass: "equity",
        name: "Ventac Holdco",
      }),
      filingsAbsent
    );
    expect(identity).toMatchObject({ outcome: "NO_FILING_HISTORY", ticker: "VNTC" });
  });

  // The load-bearing distinction: "no filings" and "could not check" must not
  // collapse into one outcome, or a transient EDGAR failure would be rendered
  // as a permanent refusal.
  it("UNAVAILABLE, never NO_FILING_HISTORY, when the filing-history check cannot complete", async () => {
    const identity = await resolveAnalyzerIdentity(
      "MSFT",
      providerReturning(RESOLVED_MSFT),
      filingsUnavailable
    );
    expect(identity.outcome).toBe("UNAVAILABLE");
  });

  it("does not run the filing-history check for an ETF", async () => {
    let called = false;
    const identity = await resolveAnalyzerIdentity(
      "SPY",
      providerReturning({
        outcome: "resolved",
        symbol: "SPY",
        assetClass: "etf",
        name: "SPDR S&P 500 ETF Trust",
      }),
      async () => {
        called = true;
        return "PRESENT";
      }
    );
    expect(identity.outcome).toBe("UNSUPPORTED");
    expect(called).toBe(false);
  });

  it.each<["UNKNOWN" | "UNSUPPORTED" | "UNAVAILABLE", InstrumentResolution]>([
    ["UNKNOWN", { outcome: "unknown" }],
    ["UNSUPPORTED", { outcome: "unsupported" }],
    ["UNAVAILABLE", { outcome: "unavailable" }],
  ])("does not run the filing-history check when the provider answers %s", async (expected, resolution) => {
    let called = false;
    const identity = await resolveAnalyzerIdentity("XYZ", providerReturning(resolution), async () => {
      called = true;
      return "PRESENT";
    });
    expect(identity.outcome).toBe(expected);
    expect(called).toBe(false);
  });
});

describe("what Screen 1 does with each state", () => {
  const resolved = {
    outcome: "RESOLVED",
    ticker: "MSFT",
    companyName: "Microsoft",
    resolvedAt: "2026-09-04T21:04:00-04:00",
  } as const;
  const unknown = { outcome: "UNKNOWN", ticker: "ZZQQXX" } as const;
  const unsupported = {
    outcome: "UNSUPPORTED",
    ticker: "SPY",
    instrumentDescription: "a fund or index",
  } as const;
  const unavailable = { outcome: "UNAVAILABLE", ticker: "MSFT" } as const;
  const noFilingHistory = { outcome: "NO_FILING_HISTORY", ticker: "VNTC" } as const;

  it("permits Begin analysis only when resolved", () => {
    expect(mayBeginAnalysis(resolved)).toBe(true);
    expect(mayBeginAnalysis(unknown)).toBe(false);
    expect(mayBeginAnalysis(unsupported)).toBe(false);
    expect(mayBeginAnalysis(unavailable)).toBe(false);
    expect(mayBeginAnalysis(noFilingHistory)).toBe(false);
  });

  // UNAVAILABLE keeps the entry and offers Try again; the rejections do not.
  // NO_FILING_HISTORY is a settled answer like UNSUPPORTED — re-querying the
  // same registrant cannot change it.
  it("offers Try again only on a provider failure", () => {
    expect(offersTryAgain(unavailable)).toBe(true);
    expect(offersTryAgain(unknown)).toBe(false);
    expect(offersTryAgain(unsupported)).toBe(false);
    expect(offersTryAgain(noFilingHistory)).toBe(false);
    expect(offersTryAgain(resolved)).toBe(false);
  });

  it("states a reason for every disabled state, and none when resolved", () => {
    expect(disabledReason(resolved)).toBeNull();
    for (const identity of [unknown, unsupported, unavailable, noFilingHistory]) {
      const reason = disabledReason(identity);
      expect(reason).toBeTruthy();
      expect(reason!.length).toBeGreaterThan(10);
    }
  });

  it("names the instrument class in the UNSUPPORTED reason", () => {
    expect(disabledReason(unsupported)).toMatch(/fund or index/);
    expect(disabledReason(unsupported)).toMatch(/listed operating companies only/);
  });

  // A provider failure says nothing about the ticker, and the wording must not
  // imply it did.
  it("does not blame the ticker when the service could not be reached", () => {
    const reason = disabledReason(unavailable)!;
    expect(reason).toMatch(/could not be reached/);
    expect(reason).not.toMatch(/invalid|not found|does not exist/i);
  });
});
