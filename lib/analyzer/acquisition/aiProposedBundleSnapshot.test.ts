import { describe, it, expect, afterAll } from "vitest";
import Decimal from "decimal.js";
import { getPool } from "../../db";
import { createRun } from "../runStore";
import { getAiProposedBundleSnapshot, saveAiProposedBundleSnapshot } from "./aiProposedBundleSnapshot";
import type { AnalystInputBundle } from "./analystInputs";

// ---------------------------------------------------------------------------
// A5 (CF-ANALYZER-INTEGRITY-PHASE-A-01) — migration
// 009_ai_proposed_bundle_snapshot.sql's own persistence, proved directly
// against the real table rather than only through analystInputsFor's own
// (mocked-AI-call) test.
// ---------------------------------------------------------------------------

function driver(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    revenueGrowthOrPath: new Decimal("0.08"),
    operatingMargin: new Decimal("0.2"),
    reinvestmentCapitalIntensity: new Decimal("0.05"),
    shareCount: new Decimal("100"),
    writtenAnchor: "test anchor",
    ...overrides,
  };
}

function sampleBundle(): AnalystInputBundle {
  return {
    inputs: {
      profile: {
        recommended: "MATURE_PROFITABLE_STABLE_FCF",
        confirmedOrOverridden: "MATURE_PROFITABLE_STABLE_FCF",
        override: null,
        classificationInputs: {
          revenueScale: "large",
          fcfCharacter: "positive_stable",
          revenueGrowthBand: "<10%",
          capitalIntensity: new Decimal("0.03"),
          cyclicality: { tenYearMarginRange: new Decimal("0.1"), worstSingleYearChange: new Decimal("0.05") },
          balanceSheetNature: "asset-light",
        },
      },
      scenarios: { bear: driver(), base: driver(), bull: driver() },
      scenarioValues: null,
      scenarioValuesAreFixtureCarried: false,
      revalueBaseCaseAtRate: null,
      configuredConstants: {
        nopatTaxRate: new Decimal("0.21"),
        stressMarginLevel: new Decimal("0.1"),
        preRevenueUnleveredRate: null,
        projectDebtCost: null,
      },
      preRevenue: null,
    } as unknown as AnalystInputBundle["inputs"],
    note: "test bundle",
  };
}

describe("aiProposedBundleSnapshot — A5's run-scoped pin", () => {
  afterAll(async () => {
    await getPool().end();
  });

  it("returns null for a run with no pinned bundle", async () => {
    const runId = await createRun("ZZZTEST1", "Test Co 1");
    expect(await getAiProposedBundleSnapshot(runId)).toBeNull();
  });

  it("round-trips a bundle byte-for-byte, Decimals included", async () => {
    const runId = await createRun("ZZZTEST2", "Test Co 2");
    const bundle = sampleBundle();

    await saveAiProposedBundleSnapshot(runId, bundle);
    const reread = await getAiProposedBundleSnapshot(runId);

    expect(reread).toEqual(bundle);
  });

  it("never overwrites an already-pinned bundle — the first resolution wins, forever", async () => {
    const runId = await createRun("ZZZTEST3", "Test Co 3");
    const first = sampleBundle();
    const second = { ...sampleBundle(), note: "a different, later proposal" };

    await saveAiProposedBundleSnapshot(runId, first);
    await saveAiProposedBundleSnapshot(runId, second);

    const reread = await getAiProposedBundleSnapshot(runId);
    expect(reread!.note).toBe("test bundle");
    expect(reread).toEqual(first);
  });

  it("is scoped to one run — a second run for the same ticker pins independently", async () => {
    const runA = await createRun("ZZZTEST4", "Test Co 4");
    const runB = await createRun("ZZZTEST4", "Test Co 4");
    const bundleA = sampleBundle();
    const bundleB = { ...sampleBundle(), note: "run B's own proposal" };

    await saveAiProposedBundleSnapshot(runA, bundleA);
    await saveAiProposedBundleSnapshot(runB, bundleB);

    expect((await getAiProposedBundleSnapshot(runA))!.note).toBe("test bundle");
    expect((await getAiProposedBundleSnapshot(runB))!.note).toBe("run B's own proposal");
  });
});
