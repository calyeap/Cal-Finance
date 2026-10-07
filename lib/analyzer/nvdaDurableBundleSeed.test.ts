import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision } from "./runStore";
import { computeAnalysisForRun, loadGateState, isSupportedTicker } from "./gate";
import { deriveVerdict } from "./verdict";

// ---------------------------------------------------------------------------
// CF-ANALYZER-V1-SETTLE-01 (issue #392) — Calvin ruling 3: "when no durable
// Calvin scenario exists, the strong model may propose labelled scenario
// drivers; deterministic code computes the actual values." For NVDA a
// durable Calvin scenario already exists — CF-NVDA-RUN-OBSERVE-01 (issue
// #296) already proved the whole pipeline end to end
// (lib/analyzer/nvdaRealRunObservation.test.ts), transcribing the
// AI-authored, source-cited draft's approved scenario values (PR #295,
// "CALVIN RULING — APPROVE AS DRAFTED") through the same
// `recordAnalystBundle` path `/analyzer/inputs/NVDA` uses. What that prior
// outcome deliberately left undone, per its own HARD BOUNDS, was recording
// it DURABLY — every fresh run needed the same human act repeated.
// Migration 008 performs that recording once.
//
// Unlike nvdaRealRunObservation.test.ts and nvdaAnalystDraftValidation.test.ts
// (both of which delete any NVDA row before/after themselves, the correct
// discipline for a file that WRITES a transient or throwaway row), this file
// deliberately does NOT touch analyzer_recorded_analyst_bundles at all —
// proving the migration-seeded row alone, with no recordAnalystBundle call
// anywhere in this file, is what makes NVDA resolvable.
// ---------------------------------------------------------------------------

async function completeSpotCheck(runId: string): Promise<void> {
  const state = await loadGateState(runId);
  for (const factId of state.outstandingFactIds) {
    await recordFactDecision(runId, factId, "CONFIRMED", null);
  }
}

describe("NVDA's durably recorded scenario bundle (migration 008)", () => {
  beforeEach(async () => {
    // Deliberately NOT analyzer_recorded_analyst_bundles — that table's NVDA
    // row is exactly what this file exists to prove persists on its own.
    await getPool().query(
      "TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE"
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("is a supported ticker with no recordAnalystBundle call in this file", async () => {
    expect(await isSupportedTicker("NVDA")).toBe(true);
  });

  it("opens and computes a fresh report — business/company content is not blocked by the pre-existing EV-bridge tag-mapping gaps", async () => {
    const runId = await createRun("NVDA", "NVIDIA Corporation");
    await completeSpotCheck(runId);
    const state = await loadGateState(runId);
    await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);

    const result = await computeAnalysisForRun(runId);
    expect(result.ticker).toBe("NVDA");
    expect(result.companyName.toUpperCase()).toContain("NVIDIA");
    // The recorded bundle's own classification, not a fixture default.
    expect(result.profile.confirmedOrOverridden).toBe("HIGH_GROWTH_PROFITABLE_UNCERTAIN_DURABILITY");
  });

  it("degrades the valuation section locally, honestly, without cascading — the same pre-existing tag-mapping gaps docs/nvda-realrun-observation.md records, unchanged by this migration", async () => {
    const runId = await createRun("NVDA", "NVIDIA Corporation");
    await completeSpotCheck(runId);
    const state = await loadGateState(runId);
    await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);

    const result = await computeAnalysisForRun(runId);

    // Migration 008 seeds no §4.4 override for NVDA (unlike MSFT's
    // migration-007 override) — Calvin never ruled NVDA's own §4.4
    // candidates, unlike MSFT's issue #188 — so enterprise value stays
    // INCOMPLETE on the same named, pre-existing, out-of-scope gaps
    // (treasuryMethodDilution, financeLeaseLiabilities) the observation
    // document records, regardless of this outcome.
    const ev = result.diagnostics.enterpriseValue;
    expect(ev.suppressed).toBe(true);
    if (ev.suppressed) {
      expect(ev.cause).toContain("treasuryMethodDilution");
      expect(ev.cause).toContain("financeLeaseLiabilities");
    }
    expect(result.gates.leverage.result).toBe("LEVERAGE UNSUPPORTED IN v1");
    expect(result.fairValueRange.kind).toBe("suppressed");
    expect(result.trust.status).toBe("UNUSABLE");

    const verdict = deriveVerdict(result);
    expect(verdict.status).toBe("INCOMPLETE");

    // The local-degradation point: this run still acquires and carries a
    // real fact set (shares, debt, cash, leases, and more — from the real
    // SEC capture, not a fixture) — the valuation gap above does not
    // cascade into an empty or wholly-suppressed report.
    expect(result.facts.length).toBeGreaterThan(10);
    expect(result.facts.map((f) => f.id)).toEqual(
      expect.arrayContaining(["shares-outstanding", "total-debt", "cash-and-marketable-debt-securities"])
    );
  });

  it("running the automatic pass again (a fresh run) resolves the identical durable bundle — nothing here depends on a prior run's own decisions", async () => {
    const first = await createRun("NVDA", "NVIDIA Corporation");
    await completeSpotCheck(first);
    const firstState = await loadGateState(first);
    await recordProfileDecision(first, "CONFIRMED", firstState.fixture.profile.recommended, null);
    const firstResult = await computeAnalysisForRun(first);

    const second = await createRun("NVDA", "NVIDIA Corporation");
    await completeSpotCheck(second);
    const secondState = await loadGateState(second);
    await recordProfileDecision(second, "CONFIRMED", secondState.fixture.profile.recommended, null);
    const secondResult = await computeAnalysisForRun(second);

    expect(secondResult.profile.confirmedOrOverridden).toBe(firstResult.profile.confirmedOrOverridden);
    expect(secondResult.diagnostics.enterpriseValue).toEqual(firstResult.diagnostics.enterpriseValue);
  });
});
