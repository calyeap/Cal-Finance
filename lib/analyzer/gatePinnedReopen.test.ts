import { describe, it, expect, afterAll, beforeEach, vi } from "vitest";
import Decimal from "decimal.js";
import { getPool } from "../db";
import { createRun } from "./runStore";
import { loadGateState, RunNotFoundError } from "./gate";
import { saveAiProposedBundleSnapshot } from "./acquisition/aiProposedBundleSnapshot";
import { aiProposedAnalystInputBundle } from "./acquisition/aiProposedBundle";
import type { AnalystInputBundle } from "./acquisition/analystInputs";

// ---------------------------------------------------------------------------
// CF-LEG2-PINNED-REOPEN-01 (issue #483) — a run whose analyst inputs are
// pinned (A5, aiProposedBundleSnapshot.ts) must reopen from that pin through
// loadGateState, never through a fresh model call. The gate's support check
// used to resolve the bundle by ticker alone, so it skipped the pin: online,
// every reopen after the cache expired called the model again; offline, or
// whenever that call came back empty, the pinned run threw RunNotFoundError.
//
// NVDA is used because it is the one ticker with a committed SEC capture (so
// an offline run acquires) and no committed bundle. Its RECORDED bundle
// (migration 008) is hidden below, which leaves it exactly the case the
// defect needs: no committed or recorded bundle, only this run's pin.
// ---------------------------------------------------------------------------

vi.mock("./acquisition/recordedBundles", async (importOriginal) => {
  const original = await importOriginal<typeof import("./acquisition/recordedBundles")>();
  return {
    ...original,
    recordedAnalystInputBundle: async (ticker: string) =>
      ticker.toUpperCase() === "NVDA" ? null : original.recordedAnalystInputBundle(ticker),
  };
});

vi.mock("./acquisition/aiProposedBundle", async (importOriginal) => {
  const original = await importOriginal<typeof import("./acquisition/aiProposedBundle")>();
  return { ...original, aiProposedAnalystInputBundle: vi.fn(original.aiProposedAnalystInputBundle) };
});

function pinnedBundle(note: string): AnalystInputBundle {
  return {
    inputs: {
      profile: {
        recommended: "HIGH_GROWTH_PROFITABLE_UNCERTAIN_DURABILITY",
        confirmedOrOverridden: "HIGH_GROWTH_PROFITABLE_UNCERTAIN_DURABILITY",
        override: null,
        classificationInputs: {
          revenueScale: "large",
          fcfCharacter: "positive_volatile",
          revenueGrowthBand: ">30%",
          capitalIntensity: new Decimal("0.03"),
          cyclicality: { tenYearMarginRange: new Decimal("0.2"), worstSingleYearChange: new Decimal("0.1") },
          balanceSheetNature: "asset-light",
        },
      },
      scenarios: {
        bear: {
          revenueGrowthOrPath: new Decimal("0.05"),
          operatingMargin: new Decimal("0.1"),
          reinvestmentCapitalIntensity: new Decimal("0.03"),
          shareCount: new Decimal("50"),
          writtenAnchor: "bear",
        },
        base: {
          revenueGrowthOrPath: new Decimal("0.15"),
          operatingMargin: new Decimal("0.2"),
          reinvestmentCapitalIntensity: new Decimal("0.04"),
          shareCount: new Decimal("50"),
          writtenAnchor: "base",
        },
        bull: {
          revenueGrowthOrPath: new Decimal("0.25"),
          operatingMargin: new Decimal("0.3"),
          reinvestmentCapitalIntensity: new Decimal("0.05"),
          shareCount: new Decimal("50"),
          writtenAnchor: "bull",
        },
      },
      scenarioValues: null,
      scenarioValuesAreFixtureCarried: false,
      revalueBaseCaseAtRate: null,
      configuredConstants: {
        nopatTaxRate: new Decimal("0.21"),
        stressMarginLevel: new Decimal("0.15"),
        preRevenueUnleveredRate: null,
        projectDebtCost: null,
      },
      preRevenue: null,
    } as unknown as AnalystInputBundle["inputs"],
    note,
  };
}

describe("loadGateState — a pinned run reopens from its pin (CF-LEG2-PINNED-REOPEN-01)", () => {
  beforeEach(() => {
    vi.mocked(aiProposedAnalystInputBundle).mockClear();
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("opens a pinned run offline, on a ticker with no committed or recorded bundle, without calling the AI resolver", async () => {
    expect(process.env.ANALYZER_OFFLINE).toBe("1");
    const runId = await createRun("NVDA", "NVIDIA Corporation");
    await saveAiProposedBundleSnapshot(runId, pinnedBundle("the proposal this run was pinned with"));

    const state = await loadGateState(runId);

    expect(state.run.runId).toBe(runId);
    expect(aiProposedAnalystInputBundle).not.toHaveBeenCalled();
  });

  it("still fails closed for a run with no pin and no bundle at all", async () => {
    const runId = await createRun("NVDA", "NVIDIA Corporation");

    await expect(loadGateState(runId)).rejects.toBeInstanceOf(RunNotFoundError);
    expect(aiProposedAnalystInputBundle).not.toHaveBeenCalled();
  });
});
