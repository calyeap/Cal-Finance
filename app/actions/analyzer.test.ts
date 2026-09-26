import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// CF-UPDATE-FIRST-OUTCOME-01 — beginUpdateRunAction, the UPDATE entry point.
//
// Every dependency that would otherwise touch the network (identity
// resolution) or the database (runStore, autoRun) is mocked here, so this
// file proves the ACTION'S OWN CONTROL FLOW in isolation: what it reads,
// what it calls, and in what order — not the pipeline behind it, which
// lib/analyzer/updateRunOnRealRun.test.ts proves against the real store and
// the real committed fixtures.
//
// The property under test throughout: the new run's identity comes ONLY from
// the prior run's own server-held ticker (getRun), never from anything the
// client posts — the same property beginAnalysisAction already holds for a
// client-typed ticker, applied here to an entry point that has none.
// ---------------------------------------------------------------------------

const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
const notFound = vi.fn(() => {
  throw new Error("NOT_FOUND");
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  notFound: () => notFound(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const resolveAnalyzerIdentity = vi.fn();
const mayBeginAnalysis = vi.fn();
vi.mock("@/lib/analyzer/identity", () => ({
  resolveAnalyzerIdentity: (...args: unknown[]) => resolveAnalyzerIdentity(...args),
  mayBeginAnalysis: (...args: unknown[]) => mayBeginAnalysis(...args),
}));

const getRun = vi.fn();
const createRun = vi.fn();
vi.mock("@/lib/analyzer/runStore", () => ({
  getRun: (...args: unknown[]) => getRun(...args),
  createRun: (...args: unknown[]) => createRun(...args),
  recordFactDecision: vi.fn(),
  recordJudgment: vi.fn(),
  recordProfileDecision: vi.fn(),
  REASON_CODES: ["CONTRADICTED BY SOURCE", "NOT LOCATED"],
  JUDGMENT_KEYS: [
    "ACCOUNTING-BASIS WINDOW",
    "NON-OPERATING INVESTMENTS",
    "MEDIAN-MARGIN NOPAT WINDOW",
  ],
}));

const fixtureForTicker = vi.fn();
vi.mock("@/lib/analyzer/gate", () => ({
  fixtureForTicker: (...args: unknown[]) => fixtureForTicker(...args),
}));

const advanceRunAutomatically = vi.fn();
vi.mock("@/lib/analyzer/autoRun", () => ({
  advanceRunAutomatically: (...args: unknown[]) => advanceRunAutomatically(...args),
}));

vi.mock("@/lib/analyzer/snapshotAnalysis", () => ({ createDeepSnapshot: vi.fn() }));

vi.mock("@/lib/marketdata", () => ({ activeProvider: () => "TEST_PROVIDER" }));

const { beginUpdateRunAction, beginAnalysisAction } = await import("./analyzer");

function formDataWith(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("beginUpdateRunAction (CF-UPDATE-FIRST-OUTCOME-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses with notFound() when the prior run does not exist, without ever resolving an identity", async () => {
    getRun.mockResolvedValue(null);

    await expect(
      beginUpdateRunAction(formDataWith({ runId: "does-not-exist" }))
    ).rejects.toThrow("NOT_FOUND");

    expect(getRun).toHaveBeenCalledWith("does-not-exist");
    expect(resolveAnalyzerIdentity).not.toHaveBeenCalled();
  });

  it("derives the ticker from the prior run's OWN stored record, ignoring any ticker or company name the client also posted", async () => {
    getRun.mockResolvedValue({ runId: "prior-1", ticker: "MSFT", resolvedCompanyName: "Microsoft Corporation" });
    resolveAnalyzerIdentity.mockResolvedValue({
      outcome: "RESOLVED",
      ticker: "MSFT",
      companyName: "Microsoft Corporation",
      resolvedAt: "2026-09-26T00:00:00.000Z",
    });
    mayBeginAnalysis.mockReturnValue(true);
    fixtureForTicker.mockResolvedValue({ ticker: "MSFT" });
    createRun.mockResolvedValue("new-run-2");
    advanceRunAutomatically.mockResolvedValue(undefined);

    // A tampered client posting an unrelated ticker/company name alongside
    // the real prior-run id — this must have no effect on what gets resolved.
    const formData = formDataWith({
      runId: "prior-1",
      ticker: "OKLO",
      companyName: "Oklo Inc.",
    });

    await expect(beginUpdateRunAction(formData)).rejects.toThrow("REDIRECT:/analyzer/new-run-2");

    expect(getRun).toHaveBeenCalledWith("prior-1");
    // The only identity ever resolved is the PRIOR RUN'S OWN ticker.
    expect(resolveAnalyzerIdentity).toHaveBeenCalledTimes(1);
    expect(resolveAnalyzerIdentity).toHaveBeenCalledWith("MSFT", "TEST_PROVIDER");
    expect(resolveAnalyzerIdentity).not.toHaveBeenCalledWith("OKLO", expect.anything());
  });

  it("commits a brand-new run and advances it automatically before redirecting to it — same pipeline as a first run", async () => {
    getRun.mockResolvedValue({ runId: "prior-1", ticker: "MSFT", resolvedCompanyName: "Microsoft Corporation" });
    resolveAnalyzerIdentity.mockResolvedValue({
      outcome: "RESOLVED",
      ticker: "MSFT",
      companyName: "Microsoft Corporation",
      resolvedAt: "2026-09-26T00:00:00.000Z",
    });
    mayBeginAnalysis.mockReturnValue(true);
    fixtureForTicker.mockResolvedValue({ ticker: "MSFT" });
    createRun.mockResolvedValue("new-run-2");
    advanceRunAutomatically.mockResolvedValue(undefined);

    await expect(
      beginUpdateRunAction(formDataWith({ runId: "prior-1" }))
    ).rejects.toThrow("REDIRECT:/analyzer/new-run-2");

    expect(createRun).toHaveBeenCalledWith("MSFT", "Microsoft Corporation");
    expect(advanceRunAutomatically).toHaveBeenCalledWith("new-run-2");
    // Ordering: create before advance before redirect.
    const createOrder = createRun.mock.invocationCallOrder[0];
    const advanceOrder = advanceRunAutomatically.mock.invocationCallOrder[0];
    const redirectOrder = redirect.mock.invocationCallOrder[0];
    expect(createOrder).toBeLessThan(advanceOrder);
    expect(advanceOrder).toBeLessThan(redirectOrder);
  });

  it("refuses exactly like Screen 1 (redirects to /analyzer, creates nothing) when the prior run's ticker no longer resolves", async () => {
    getRun.mockResolvedValue({ runId: "prior-1", ticker: "DELISTED", resolvedCompanyName: "Formerly Real Co." });
    resolveAnalyzerIdentity.mockResolvedValue({ outcome: "UNKNOWN", ticker: "DELISTED" });
    mayBeginAnalysis.mockReturnValue(false);

    await expect(
      beginUpdateRunAction(formDataWith({ runId: "prior-1" }))
    ).rejects.toThrow("REDIRECT:/analyzer");

    expect(createRun).not.toHaveBeenCalled();
    expect(advanceRunAutomatically).not.toHaveBeenCalled();
  });

  it("shares the exact same refusal path as beginAnalysisAction — both redirect to /analyzer on a non-RESOLVED identity", async () => {
    resolveAnalyzerIdentity.mockResolvedValue({ outcome: "UNSUPPORTED", ticker: "SPY", instrumentDescription: "a fund or index" });
    mayBeginAnalysis.mockReturnValue(false);

    await expect(
      beginAnalysisAction(formDataWith({ ticker: "SPY" }))
    ).rejects.toThrow("REDIRECT:/analyzer");
    expect(createRun).not.toHaveBeenCalled();
  });
});
