import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../../db";
import { createRun, recordFactDecision, recordProfileDecision, recordJudgment } from "../runStore";
import { computeAnalysisForRun, loadGateState } from "../gate";
import { recordedAnalystInputBundle } from "./recordedBundles";
import { analystInputsFor } from "./analystInputs";
import { endOfYearScenarioPerShare } from "../golden/endOfYearEquivalent";

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

  it("round-trips the exact approved classification, all three scenarios' drivers/terminalRoic/shareCount, and the approved snapshot values", async () => {
    await applySeedMigration();
    const stored = await recordedAnalystInputBundle("MSFT");
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
    expect(bear.terminalRoic?.toString()).toBe("0.1");
    expect(base.terminalRoic?.toString()).toBe("0.11");
    expect(bull.terminalRoic?.toString()).toBe("0.125");
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

    // analystInputsFor resolves the SAME recorded bundle (recorded wins
    // over the committed MSFT_FIXTURE carry-over) — the resolver this
    // migration is meant to feed, not a second, parallel read path.
    const viaResolver = await analystInputsFor("MSFT");
    expect(viaResolver?.inputs.scenarioValues?.bear.toString()).toBe("214.26");
  });

  it("the real production pathway recomputes dynamically from these drivers and reproduces the approved $214.26/$283.31/$402.73 to the cent", async () => {
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
    expect(result.fairValueRange.kind).toBe("range");
    if (result.fairValueRange.kind !== "range") return;

    // Reproduces the Calvin-approved snapshot from the durable record ALONE
    // (no recordAnalystBundle call anywhere in this file) — proving the
    // migration-seeded row, not a test-local write, is what makes this
    // reproducible. Matches lib/analyzer/acquisition/
    // msftStage2ValuationProof.test.ts's own independently-recomputed
    // figures, which is the dynamic-recomputation proof for this exact
    // candidate; this test proves the SEEDED path reaches the same place.
    // CF-AR3-REPRODUCIBLE-RUNS-01 — Methodology v2.1 D2's timing (mid-year,
    // terminal at 9.5 years, valued at the price date) moves these approved
    // end-of-year figures by one common factor; with that factor removed
    // (golden/endOfYearEquivalent.ts) they are still reproduced to the cent.
    expect(endOfYearScenarioPerShare(result, "bear").toFixed(2)).toBe("214.26");
    expect(endOfYearScenarioPerShare(result, "base").toFixed(2)).toBe("283.31");
    expect(endOfYearScenarioPerShare(result, "bull").toFixed(2)).toBe("402.73");

    // This run's own real acquired base-year revenue — confirms the real
    // production pathway (fact acquisition, gating, EV bridge), never a
    // stand-in, produced this figure (proof doc's own independent-oracle
    // cross-check reproduces the same fact from the same raw capture).
    const baseRevenue = state.fixture.reverseDcf.baseYearRevenue;
    expect(baseRevenue?.value.toString()).toBe("331839000000");
  });

  it("no regression to NVDA or legacy (no-terminalRoic) behaviour, and MSFT still falls back to the committed fixture once the recorded row is removed", async () => {
    await applySeedMigration();

    // NVDA's own migration-008 seed is untouched by this migration — still
    // resolvable, still carrying no terminalRoic anywhere (the pre-existing
    // default behaviour every other bundle in this codebase relies on).
    const nvda = await recordedAnalystInputBundle("NVDA");
    expect(nvda).not.toBeNull();
    expect(nvda?.inputs.scenarios.bear.terminalRoic).toBeNull();
    expect(nvda?.inputs.scenarioValues?.bear.toString()).toBe("28.08");

    // Removing the recorded MSFT row (simulating "nothing recorded yet")
    // falls back to the pre-existing committed MSFT_FIXTURE carry-over
    // exactly as before this migration existed — the precedence this
    // migration relies on (recorded-wins-over-committed) is not itself
    // something this migration invents, and removing its effect must not
    // leave MSFT unsupported.
    await deleteMsftRecordedBundle();
    const committedFallback = await analystInputsFor("MSFT");
    expect(committedFallback).not.toBeNull();
    expect(committedFallback?.inputs.scenarioValuesAreFixtureCarried).toBe(true);
    expect(committedFallback?.inputs.scenarioValues?.bear.toString()).toBe("265");
  });
});
