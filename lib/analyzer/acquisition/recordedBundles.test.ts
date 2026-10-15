import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../../db";
import {
  recordAnalystBundle,
  hasRecordedAnalystBundle,
  getRecordedAnalystBundleInput,
  recordedAnalystInputBundle,
  type RecordedAnalystBundleInput,
} from "./recordedBundles";

// ---------------------------------------------------------------------------
// CF-ANALYST-INPUT-ENTRY-01 — the store's own contract: validation, honest
// absence, and the round trip back into an AnalystInputBundle. The real-run
// acceptance pass (recordedAnalystInputEntryOnRealRun.test.tsx) proves this
// against a live gated run; this file proves the store in isolation.
// ---------------------------------------------------------------------------

const TICKER = "ZZZTEST";

function validInput(overrides: Partial<RecordedAnalystBundleInput> = {}): RecordedAnalystBundleInput {
  const driver = (anchor: string) => ({
    revenueGrowthOrPath: "0.1",
    operatingMargin: "0.2",
    reinvestmentCapitalIntensity: "0.15",
    shareCount: "10",
    writtenAnchor: anchor,
  });
  return {
    profile: "MATURE_PROFITABLE_STABLE_FCF",
    classificationInputs: {
      revenueScale: "large",
      fcfCharacter: "positive_stable",
      revenueGrowthBand: "10-30%",
      capitalIntensity: "0.1",
      cyclicality: { tenYearMarginRange: "0.1", worstSingleYearChange: "0.02" },
      balanceSheetNature: "asset-light",
    },
    scenarios: {
      bear: driver("bear anchor"),
      base: driver("base anchor"),
      bull: driver("bull anchor"),
    },
    scenarioValues: { bear: "10", base: "20", bull: "30" },
    configuredConstants: {
      nopatTaxRate: "0.2",
      stressMarginLevel: null,
      preRevenueUnleveredRate: null,
      projectDebtCost: null,
    },
    ...overrides,
  };
}

describe("recordedBundles.ts", () => {
  beforeEach(async () => {
    await getPool().query("DELETE FROM analyzer_recorded_analyst_bundles WHERE ticker = $1", [TICKER]);
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("round-trips a fully-supplied bundle", async () => {
    await recordAnalystBundle(TICKER, validInput());
    expect(await hasRecordedAnalystBundle(TICKER)).toBe(true);

    const bundle = await recordedAnalystInputBundle(TICKER);
    expect(bundle).not.toBeNull();
    expect(bundle?.inputs.scenarioValues?.base.toString()).toBe("20");
    expect(bundle?.inputs.scenarios.bear.writtenAnchor).toBe("bear anchor");
    expect(bundle?.inputs.configuredConstants.nopatTaxRate?.toString()).toBe("0.2");
    expect(bundle?.inputs.configuredConstants.stressMarginLevel).toBeNull();
    // Never synthesised — SCOPE item 6 / HARD BOUNDS.
    expect(bundle?.inputs.revalueBaseCaseAtRate).toBeNull();
    expect(bundle?.inputs.preRevenue).toBeNull();
  });

  it("records a driver left blank as absent, never a zero", async () => {
    const input = validInput();
    input.scenarios.bear.operatingMargin = null;
    input.scenarios.bear.revenueGrowthOrPath = "  ";
    await recordAnalystBundle(TICKER, input);

    const bundle = await recordedAnalystInputBundle(TICKER);
    expect(bundle?.inputs.scenarios.bear.operatingMargin).toBeNull();
    expect(bundle?.inputs.scenarios.bear.revenueGrowthOrPath).toBeNull();
    // Untouched driver on the same scenario still comes back as authored.
    expect(bundle?.inputs.scenarios.bear.reinvestmentCapitalIntensity?.toString()).toBe("0.15");
  });

  it("refuses an empty written anchor (design §5.4)", async () => {
    const input = validInput();
    input.scenarios.base.writtenAnchor = "   ";
    await expect(recordAnalystBundle(TICKER, input)).rejects.toThrow(/written anchor/i);
    expect(await hasRecordedAnalystBundle(TICKER)).toBe(false);
  });

  it("refuses a missing scenario value — unlike drivers, scenario values are not nullable", async () => {
    const input = validInput();
    input.scenarioValues.bull = "";
    await expect(recordAnalystBundle(TICKER, input)).rejects.toThrow(/scenario value/i);
    expect(await hasRecordedAnalystBundle(TICKER)).toBe(false);
  });

  it("refuses a non-numeric driver rather than storing unparsed text", async () => {
    const input = validInput();
    input.scenarios.bull.operatingMargin = "not-a-number";
    await expect(recordAnalystBundle(TICKER, input)).rejects.toThrow();
    expect(await hasRecordedAnalystBundle(TICKER)).toBe(false);
  });

  it("correcting an existing bundle replaces it in place — one row per ticker", async () => {
    await recordAnalystBundle(TICKER, validInput());
    await recordAnalystBundle(TICKER, validInput({ scenarioValues: { bear: "11", base: "21", bull: "31" } }));

    const bundle = await recordedAnalystInputBundle(TICKER);
    expect(bundle?.inputs.scenarioValues?.bear.toString()).toBe("11");

    const { rows } = await getPool().query(
      "SELECT count(*)::int AS n FROM analyzer_recorded_analyst_bundles WHERE ticker = $1",
      [TICKER]
    );
    expect(rows[0].n).toBe(1);
  });

  it("returns null for a ticker with no recorded bundle", async () => {
    expect(await hasRecordedAnalystBundle("NO-SUCH-TICKER")).toBe(false);
    expect(await recordedAnalystInputBundle("NO-SUCH-TICKER")).toBeNull();
    expect(await getRecordedAnalystBundleInput("NO-SUCH-TICKER")).toBeNull();
  });

  it("normalises ticker case, matching analystInputsFor's own uppercase keying", async () => {
    await recordAnalystBundle("zzztest", validInput());
    expect(await hasRecordedAnalystBundle(TICKER)).toBe(true);
    expect(await hasRecordedAnalystBundle("ZzzTest")).toBe(true);
  });

  describe("terminalRoic (CF-MSFT-STAGE2-REAL-VALUATION-PROOF-01) — optional, independent of the three nullable drivers", () => {
    it("round-trips an authored terminalRoic alongside the three drivers", async () => {
      const input = validInput();
      input.scenarios.bull.terminalRoic = "0.125";
      await recordAnalystBundle(TICKER, input);

      const bundle = await recordedAnalystInputBundle(TICKER);
      expect(bundle?.inputs.scenarios.bull.terminalRoic?.toString()).toBe("0.125");
      // Untouched scenarios never acquire one — absent, not 0.
      expect(bundle?.inputs.scenarios.bear.terminalRoic).toBeNull();
      expect(bundle?.inputs.scenarios.base.terminalRoic).toBeNull();
    });

    it("a bundle recorded before this field existed — no terminalRoic key on any scenario at all — still round-trips exactly as before", async () => {
      // Simulates NVDA's own migration-008 seed row shape: no `terminalRoic`
      // property on the stored scenario object, not even `null`.
      const input = validInput();
      await recordAnalystBundle(TICKER, input);

      const bundle = await recordedAnalystInputBundle(TICKER);
      expect(bundle?.inputs.scenarios.bear.terminalRoic).toBeNull();
      expect(bundle?.inputs.scenarios.base.terminalRoic).toBeNull();
      expect(bundle?.inputs.scenarios.bull.terminalRoic).toBeNull();
      // recordedScenarioValuesComputeFromDrivers is gated on the three
      // original drivers only — terminalRoic's absence must never block it.
      expect(bundle?.inputs.recordedScenarioValuesComputeFromDrivers).toBe(true);
    });

    it("refuses a non-numeric terminalRoic rather than storing unparsed text", async () => {
      const input = validInput();
      input.scenarios.bear.terminalRoic = "not-a-number";
      await expect(recordAnalystBundle(TICKER, input)).rejects.toThrow();
      expect(await hasRecordedAnalystBundle(TICKER)).toBe(false);
    });

    it("refuses a non-positive terminalRoic (REVIEW-38751207194-1 — division-safety guard, G/terminalRoic is otherwise Infinity at 0)", async () => {
      const zero = validInput();
      zero.scenarios.base.terminalRoic = "0";
      await expect(recordAnalystBundle(TICKER, zero)).rejects.toThrow(/terminalRoic must be positive/);
      expect(await hasRecordedAnalystBundle(TICKER)).toBe(false);

      const negative = validInput();
      negative.scenarios.bull.terminalRoic = "-0.05";
      await expect(recordAnalystBundle(TICKER, negative)).rejects.toThrow(/terminalRoic must be positive/);
      expect(await hasRecordedAnalystBundle(TICKER)).toBe(false);
    });

    it("leaving terminalRoic blank on one scenario does not block recordedScenarioValuesComputeFromDrivers for the others", async () => {
      const input = validInput();
      input.scenarios.base.terminalRoic = "0.11";
      input.scenarios.bull.terminalRoic = "0.125";
      // bear.terminalRoic left absent entirely.
      await recordAnalystBundle(TICKER, input);

      const bundle = await recordedAnalystInputBundle(TICKER);
      expect(bundle?.inputs.recordedScenarioValuesComputeFromDrivers).toBe(true);
      expect(bundle?.inputs.scenarios.bear.terminalRoic).toBeNull();
      expect(bundle?.inputs.scenarios.base.terminalRoic?.toString()).toBe("0.11");
    });
  });
});
