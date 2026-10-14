import { describe, it, expect, afterAll } from "vitest";
import Decimal from "decimal.js";
import { getPool } from "../../db";
import { createRun } from "../runStore";
import { analystInputsFor } from "./analystInputs";
import { saveAiProposedBundleSnapshot, getAiProposedBundleSnapshot } from "./aiProposedBundleSnapshot";
import type { AnalystInputBundle } from "./analystInputs";

// ---------------------------------------------------------------------------
// A5 (CF-ANALYZER-INTEGRITY-PHASE-A-01) — analystInputsFor's own pin-read
// precedence. ANALYZER_OFFLINE=1 (vitest.setup.ts, global) means this suite
// cannot exercise a FRESH AI proposal end-to-end (no live model call in this
// environment, same disclosed limitation PR #421's own EVIDENCE section
// records) — that write path is otherwise exactly
// aiProposedBundleSnapshot.test.ts's "never overwrites" case, called from
// analystInputsFor instead of directly. What IS provable offline, and is
// this file's own claim: a pin, once it exists, is read back before
// analystInputsFor would ever reach the offline/no-call refusal — the exact
// seam that makes a reopened run reproducible — and the committed/recorded
// sources still take precedence over it, unchanged.
// ---------------------------------------------------------------------------

function pinnedBundleWithNote(note: string): AnalystInputBundle {
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

describe("analystInputsFor — A5's pin-read precedence", () => {
  afterAll(async () => {
    await getPool().end();
  });

  it("reads a run's own pinned bundle back, reproducing it exactly, with no fresh call attempted", async () => {
    const runId = await createRun("ZZZPIN1", "Pin Test Co");
    const pinned = pinnedBundleWithNote("the original proposal this run opened with");
    await saveAiProposedBundleSnapshot(runId, pinned);

    // Two calls, simulating a reopen after the ticker-global cache would
    // have expired (or the process restarted) — both read the SAME pin.
    const first = await analystInputsFor("ZZZPIN1", runId);
    const second = await analystInputsFor("ZZZPIN1", runId);

    expect(first).toEqual(pinned);
    expect(second).toEqual(pinned);
  });

  it("without a runId, never reaches a pin even if one exists for some other run of the same ticker", async () => {
    const runId = await createRun("ZZZPIN2", "Pin Test Co 2");
    await saveAiProposedBundleSnapshot(runId, pinnedBundleWithNote("pinned to one specific run"));

    // ANALYZER_OFFLINE=1 makes the no-runId path refuse immediately once it
    // falls through committed/recorded with nothing left to try — exactly
    // today's existing behaviour for an unsupported ticker, proving this
    // call never silently reads a pin it was not given the run id for.
    expect(await analystInputsFor("ZZZPIN2")).toBeNull();
  });

  it("a committed bundle still wins over a pin, even on the exact run that holds one", async () => {
    const runId = await createRun("MSFT", "Microsoft Corporation");
    await saveAiProposedBundleSnapshot(runId, pinnedBundleWithNote("should never be read — MSFT is committed"));

    const result = await analystInputsFor("MSFT", runId);
    expect(result!.note).not.toContain("should never be read");
    expect(result!.inputs.profile.recommended).toBe("MATURE_PROFITABLE_STABLE_FCF");

    // The pin is untouched — committed-bundle precedence does not consume
    // or invalidate it.
    expect((await getAiProposedBundleSnapshot(runId))!.note).toContain("should never be read");
  });
});
