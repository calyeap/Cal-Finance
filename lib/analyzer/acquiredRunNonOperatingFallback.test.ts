import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// CF-ANALYZER-V1-SETTLE-01 — the market-data fallback candidate for §4.4's
// non-operating-investments judgment, consulted only when the SEC tag
// mapping itself surfaced none (see acquiredRun.ts's own header comment on
// nonOperatingInvestmentsFallbackCandidate). Mocks the provider only; makes
// no live/paid network call.
// ---------------------------------------------------------------------------

const { mockActiveProvider } = vi.hoisted(() => ({ mockActiveProvider: vi.fn() }));
vi.mock("../marketdata", () => ({ activeProvider: mockActiveProvider }));

import { nonOperatingInvestmentsFallbackCandidate } from "./acquiredRun";

beforeEach(() => {
  mockActiveProvider.mockReset();
});

describe("nonOperatingInvestmentsFallbackCandidate", () => {
  it("returns a candidate carrying the provider's value, as-of date and a disclosed source", async () => {
    const fetchNonOperatingInvestments = vi.fn().mockResolvedValue({
      value: 2_500_000_000,
      asOfDate: "2026-06-30",
    });
    mockActiveProvider.mockReturnValue({ sourceName: "YAHOO", fetchNonOperatingInvestments });

    const candidate = await nonOperatingInvestmentsFallbackCandidate("COST", undefined);

    expect(fetchNonOperatingInvestments).toHaveBeenCalledWith("COST");
    expect(candidate).not.toBeNull();
    expect(candidate!.value.toString()).toBe("2500000000");
    expect(candidate!.asOfDate).toBe("2026-06-30");
    expect(candidate!.form).toMatch(/YAHOO/);
    expect(candidate!.form).toMatch(/fallback/i);
    expect(candidate!.tag).toMatch(/fallback/i);
  });

  it("never calls the provider for an offline (CAPTURE) run", async () => {
    const fetchNonOperatingInvestments = vi.fn();
    mockActiveProvider.mockReturnValue({ sourceName: "YAHOO", fetchNonOperatingInvestments });

    const candidate = await nonOperatingInvestmentsFallbackCandidate("COST", "CAPTURE");

    expect(candidate).toBeNull();
    expect(mockActiveProvider).not.toHaveBeenCalled();
    expect(fetchNonOperatingInvestments).not.toHaveBeenCalled();
  });

  it("is null when the provider has nothing to offer", async () => {
    const fetchNonOperatingInvestments = vi.fn().mockResolvedValue(null);
    mockActiveProvider.mockReturnValue({ sourceName: "YAHOO", fetchNonOperatingInvestments });

    const candidate = await nonOperatingInvestmentsFallbackCandidate("COST", undefined);

    expect(candidate).toBeNull();
  });

  it("is null when the active provider has no balance-sheet method at all", async () => {
    mockActiveProvider.mockReturnValue({ sourceName: "EODHD" });

    const candidate = await nonOperatingInvestmentsFallbackCandidate("COST", undefined);

    expect(candidate).toBeNull();
  });
});
