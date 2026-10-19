import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../../db";
import { createRun, recordFactDecision, recordProfileDecision, recordJudgment } from "../runStore";
import { computeAnalysisForRun, loadGateState } from "../gate";
import { analystInputsFor } from "./analystInputs";
import { bundleInForce, resetSheetsToMigrated } from "../sheets/testSupport";

// ---------------------------------------------------------------------------
// CF-MSFT-STAGE2-DURABLE-SEED-01 (issue #442) — proves migration
// 010_msft_recorded_bundle_seed.sql itself, independent of whatever order
// vitest happens to run other files in.
//
// lib/analyzer/acquisition/msftRealValuationUnblock.test.ts and
// msftStage2ValuationProof.test.ts both DELETE then re-insert their own
// transient MSFT row around each of their own tests and never restore a
// durable one afterward — the correct discipline for files proving a
// write path, but it means this file cannot assume CI's one-time `npm run
// migrate` step's MSFT row is still present by the time it runs (unlike
// NVDA's own analogous lib/analyzer/nvdaDurableBundleSeed.test.ts, whose
// sibling NVDA-touching files use a distinct draft ticker or never delete
// the real NVDA row at all). So this file re-applies the migration's own
// SQL directly against the test database in its own setup, proving the
// migration file itself — not merely a value this file typed out a second
// time — produces a bundle that resolves, round-trips and computes
// correctly, regardless of execution order.
//
// CF-AR6-ANY-TICKER-DRAFTS-01 — reviewed evaluator change. The recorded
// store's read path is gone: migration 014 carries this seed into MSFT's
// assumption sheet as its version 1 DRAFT, and that sheet is what a run
// reads. The round trip below is the same approved content, read through
// the sheet (resetSheetsToMigrated re-applies 014 after this seed). The last
// test's committed-fixture fallback is replaced by its opposite: with no
// seed and no sheet, MSFT no longer falls back to MSFT_FIXTURE — the fixture
// path is deleted (issue #454 DO 6).
// ---------------------------------------------------------------------------

const MIGRATION_SQL = readFileSync(
  join(process.cwd(), "migrations", "010_msft_recorded_bundle_seed.sql"),
  "utf-8"
);

async function deleteMsftRecordedBundle(): Promise<void> {
  await getPool().query("DELETE FROM analyzer_recorded_analyst_bundles WHERE ticker = $1", ["MSFT"]);
}

async function applySeedMigration(): Promise<void> {
  await getPool().query(MIGRATION_SQL);
  await resetSheetsToMigrated();
}

async function completeSpotCheck(runId: string): Promise<void> {
  const state = await loadGateState(runId);
  for (const factId of state.outstandingFactIds) {
    await recordFactDecision(runId, factId, "CONFIRMED", null);
  }
}

describe("CF-MSFT-STAGE2-DURABLE-SEED-01 — migration 010's durably recorded MSFT bundle", () => {
  beforeEach(async () => {
    await getPool().query(
      "TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE"
    );
    await deleteMsftRecordedBundle();
    await resetSheetsToMigrated();
  });

  afterAll(async () => {
    // Leave the table as migration 010 itself wants it to end up, for any
    // later file in this same run that exercises a real MSFT run.
    await deleteMsftRecordedBundle();
    await applySeedMigration();
    await getPool().end();
  });

  it("applying the migration file is idempotent — re-applying it twice raises no error", async () => {
    await applySeedMigration();
    await expect(applySeedMigration()).resolves.not.toThrow();
  });

  it("refuses (raises) instead of silently accepting a pre-existing MSFT row that does not match the approved snapshot", async () => {
    await getPool().query(
      `INSERT INTO analyzer_recorded_analyst_bundles
         (ticker, profile, classification_inputs, scenarios, scenario_values, configured_constants)
       VALUES ('MSFT', 'MATURE_PROFITABLE_STABLE_FCF', '{}'::jsonb,
         '{"bear":{"shareCount":"1","writtenAnchor":"x"},"base":{"shareCount":"1","writtenAnchor":"x"},"bull":{"shareCount":"1","writtenAnchor":"x"}}'::jsonb,
         '{"bear":"1","base":"1","bull":"1"}'::jsonb,
         '{"nopatTaxRate":null,"stressMarginLevel":null,"preRevenueUnleveredRate":null,"projectDebtCost":null}'::jsonb)`
    );
    await expect(applySeedMigration()).rejects.toThrow(/does not match the Calvin-approved Stage-2 snapshot/i);
  });

  it("round-trips the exact approved classification, all three scenarios' drivers/shareCount, and the approved snapshot values", async () => {
    await applySeedMigration();
    const stored = await bundleInForce("MSFT");
    expect(stored).not.toBeNull();
    if (stored === null) return;

    const { inputs } = stored;
    expect(inputs.profile.confirmedOrOverridden).toBe("MATURE_PROFITABLE_STABLE_FCF");
    expect(inputs.profile.classificationInputs.fcfCharacter).toBe("positive_volatile");
    expect(inputs.profile.classificationInputs.balanceSheetNature).toBe("asset-heavy");
    expect(inputs.profile.classificationInputs.capitalIntensity.toString()).toBe("0.4236");
    expect(inputs.profile.classificationInputs.cyclicality.tenYearMarginRange.toString()).toBe("0.1673");
    expect(inputs.profile.classificationInputs.cyclicality.worstSingleYearChange.toString()).toBe("0.0028");

    // Every driver is authored for all three scenarios, so the dynamic
    // recomputation path (not the stored snapshot) is what a real run
    // reads — the point of item 3 in issue #442's DO section.
    expect(inputs.recordedScenarioValuesComputeFromDrivers).toBe(true);
    expect(inputs.scenarioValuesAreFixtureCarried).toBe(false);

    const bear = inputs.scenarios.bear;
    const base = inputs.scenarios.base;
    const bull = inputs.scenarios.bull;
    expect(bear.revenueGrowthOrPath?.toString()).toBe("0.08");
    expect(base.revenueGrowthOrPath?.toString()).toBe("0.14");
    expect(bull.revenueGrowthOrPath?.toString()).toBe("0.2");
    expect(bear.operatingMargin?.toString()).toBe("0.4168");
    expect(base.operatingMargin?.toString()).toBe("0.45");
    expect(bull.operatingMargin?.toString()).toBe("0.4678");
    expect(bear.reinvestmentCapitalIntensity?.toString()).toBe("0.07");
    expect(base.reinvestmentCapitalIntensity?.toString()).toBe("0.2");
    expect(bull.reinvestmentCapitalIntensity?.toString()).toBe("0.26");
    // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — the seed's per-scenario
    // `terminalRoic` keys stay in the stored JSON (migrations are never
    // rewritten) but are no longer read: D2 sets the terminal return from
    // the moat class. The seed carries neither D2 input, so it is a sheet
    // pending adoption (product-decisions item 27: MSFT re-adopts once).
    expect(bear.returnOnNewInvestment).toBeNull();
    expect(base.returnOnNewInvestment).toBeNull();
    expect(bull.returnOnNewInvestment).toBeNull();
    expect(inputs.moatClass).toBeNull();
    // The reviewed §4.4 bridge's diluted share count, carried verbatim —
    // never a hardcoded constant reused silently from somewhere else.
    expect(bear.shareCount.toString()).toBe("7449545491");
    expect(base.shareCount.toString()).toBe("7449545491");
    expect(bull.shareCount.toString()).toBe("7449545491");

    // Each written anchor discloses the years-6-10 model-derived fade and
    // the uncertain-assumption qualifications issue #442's DO item 4
    // requires — never silently dropped or left stale.
    for (const scenario of [bear, base, bull]) {
      expect(scenario.writtenAnchor).toMatch(/fade/i);
      expect(scenario.writtenAnchor).toMatch(/model-derived/i);
      expect(scenario.writtenAnchor).toMatch(/missing.*not zero/i);
      expect(scenario.writtenAnchor).toMatch(/no valuation or recommendation is guaranteed/i);
    }
    expect(bear.writtenAnchor).toMatch(/RISES/);
    expect(bull.writtenAnchor).toMatch(/FALLS/);

    expect(inputs.scenarioValues).not.toBeNull();
    expect(inputs.scenarioValues?.bear.toString()).toBe("214.26");
    expect(inputs.scenarioValues?.base.toString()).toBe("283.31");
    expect(inputs.scenarioValues?.bull.toString()).toBe("402.73");
    expect(inputs.configuredConstants.nopatTaxRate?.toString()).toBe("0.19");
    expect(inputs.configuredConstants.stressMarginLevel?.toString()).toBe("0.3006");
    expect(inputs.configuredConstants.preRevenueUnleveredRate).toBeNull();
    expect(inputs.configuredConstants.projectDebtCost).toBeNull();

    // analystInputsFor resolves the SAME sheet — the one resolver this
    // migration feeds, not a second, parallel read path.
    const viaResolver = await analystInputsFor("MSFT");
    expect(viaResolver?.inputs.scenarioValues?.bear.toString()).toBe("214.26");
  });

  // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — reviewed evaluator change. This
  // pinned the 16 Oct 2026 Stage-2 path's $214.26/$283.31/$402.73 (10% rate,
  // capital-intensity reinvestment, per-scenario terminal ROIC), which
  // product-decisions item 27 (D2) supersedes. The seeded sheet now runs as
  // what it is: pending adoption — no D2 value from the engine, and its typed
  // pre-D2 snapshot never shown in its place.
  it("the real production pathway reads the seeded sheet as pending adoption — no value from the engine, and the superseded snapshot never shown in its place", async () => {
    await applySeedMigration();

    const runId = await createRun("MSFT", "Microsoft Corporation");
    await recordJudgment(
      runId,
      "NON-OPERATING INVESTMENTS",
      "us-gaap:LongTermInvestments",
      "Calvin's §4.4 ruling, 2026-09-21T08:19:14Z, issue #188."
    );
    await completeSpotCheck(runId);
    const state = await loadGateState(runId);
    await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);

    const result = await computeAnalysisForRun(runId);
    expect(result.valuationBasis?.d2.status).toBe("PENDING ADOPTION");
    expect(result.valuationBasis?.discountRate.rate.toString()).toBe("0.09");
    expect(result.fairValueRange.kind).toBe("suppressed");
    if (result.fairValueRange.kind === "suppressed") expect(result.fairValueRange.cause).toMatch(/^Pending adoption/);
    for (const key of ["bear", "base", "bull"] as const) {
      expect(result.scenarioOutputs.values[key].isNaN()).toBe(true);
    }

    // This run's own real acquired base-year revenue — the real production
    // pathway (fact acquisition, gating, EV bridge) still runs in full.
    const baseRevenue = state.fixture.reverseDcf.baseYearRevenue;
    expect(baseRevenue?.value.toString()).toBe("331839000000");
    expect(result.diagnostics.enterpriseValue.suppressed).toBe(false);
  });

  it("no regression to NVDA, and MSFT never falls back to the committed fixture once its seed is removed", async () => {
    await applySeedMigration();

    // NVDA's own migration-008 seed is untouched by this migration — still
    // resolvable, and like MSFT's carrying no D2 input.
    const nvda = await bundleInForce("NVDA");
    expect(nvda).not.toBeNull();
    expect(nvda?.inputs.scenarios.bear.returnOnNewInvestment).toBeNull();
    expect(nvda?.inputs.scenarioValues?.bear.toString()).toBe("28.08");

    // With no recorded row and so no migrated sheet, MSFT has no sheet; this
    // offline run calls no model, so none is drafted — and MSFT_FIXTURE's
    // $265 / $510 / $650 never stand in (the fixture path is deleted).
    await deleteMsftRecordedBundle();
    await resetSheetsToMigrated();
    expect(await analystInputsFor("MSFT")).toBeNull();
  });
});
