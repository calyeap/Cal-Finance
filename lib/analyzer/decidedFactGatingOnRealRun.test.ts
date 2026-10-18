import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Decimal from "decimal.js";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision, recordJudgment } from "./runStore";
import { loadGateState } from "./gate";
import { assembleAnalysisResult, type CompanyFixture } from "./assemble";
import { deriveVerdict, isIssuedVerdict } from "./verdict";
import { withStatedD2Inputs } from "./fixtures/statedD2Inputs";
import { NOT_CONFIRMED_INPUT_CAUSE } from "./figures";
import { CLEAN_PROVENANCE } from "./provenance";
import { NO_VERDICT_JUDGEMENTS, type VerdictJudgements } from "./verdictJudgements";
import type { AnalysisResult, Figure } from "./types";

// ---------------------------------------------------------------------------
// CF-LEG2-DECIDED-FACT-GATING-01 (issue #481) — AR3 DO 2 on the real path:
// "a contradicted fact blocks every output that depends on it" (#451).
//
// The real production path, on the committed offline captures and the test
// database: createRun -> the Step 2 queue -> recorded decisions ->
// loadGateState, whose decided facts are what buildCompanyInputs builds the
// calculation inputs from (decideFacts). Each queued fact is decided NOT
// CONFIRMED (CONTRADICTED BY SOURCE) in turn, every other one CONFIRMED.
//
// THE DEFECT. companyInputs.ts built the price input with CLEAN_PROVENANCE
// whatever the run decided about its `price` fact, so a contradicted price
// left enterprise value, the fair-value range, the reverse DCF and the
// verdict exactly as they were. The current-operating-margin half (#481's
// "needs re-checking" after AR4's reverseDcf.ts rewrite): M7 no longer reads
// the current margin; its one remaining reader is M6's NOPAT gap, which MSFT
// shows because its margin trigger has fired — and which still showed the
// contradicted margin's NOPAT.
//
// The D2 sheet inputs are STATED TEST INPUTS (withStatedD2Inputs), exactly as
// msftStage3VerdictOnRealRun.test.ts uses them, so the all-confirmed run
// values the company and — with Calvin's close call recorded against its
// inputs (a stated test answer, never stored) — issues a verdict. A blocked
// verdict below is the contradicted fact's doing, not a sheet pending
// adoption.
// ---------------------------------------------------------------------------

const MIGRATION_SQL = readFileSync(join(process.cwd(), "migrations", "010_msft_recorded_bundle_seed.sql"), "utf-8");

interface DecidedRun {
  queued: string[];
  fixture: CompanyFixture;
  result: AnalysisResult;
}

async function openMsftRun(notConfirmed: string | null): Promise<DecidedRun> {
  const runId = await createRun("MSFT", "Microsoft Corporation");
  await recordJudgment(
    runId,
    "NON-OPERATING INVESTMENTS",
    "us-gaap:LongTermInvestments",
    "Calvin's §4.4 ruling, 2026-09-21T08:19:14Z, issue #188."
  );
  const { outstandingFactIds: queued } = await loadGateState(runId);
  for (const factId of queued) {
    if (factId === notConfirmed) await recordFactDecision(runId, factId, "NOT CONFIRMED", "CONTRADICTED BY SOURCE");
    else await recordFactDecision(runId, factId, "CONFIRMED", null);
  }
  const decided = await loadGateState(runId);
  await recordProfileDecision(runId, "CONFIRMED", decided.fixture.profile.recommended, null);
  const { fixture } = await loadGateState(runId);
  return { queued, fixture, result: assembleAnalysisResult(withStatedD2Inputs(fixture)) };
}

function closeCallAnswer(boundTo: string): VerdictJudgements["closeCalls"][number] {
  return { answer: "SELL", note: null, recordedAt: "2026-10-18T00:00:00.000Z", version: 1, boundTo };
}

function withJudgements(result: AnalysisResult, judgements: Partial<VerdictJudgements>): AnalysisResult {
  return { ...result, verdictJudgements: { ...NO_VERDICT_JUDGEMENTS, ...judgements } };
}

function plain(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (v instanceof Decimal ? v.toString() : v));
}

function suppressedNotConfirmed<T>(figure: Figure<T>): boolean {
  return figure.suppressed && figure.state === "INCOMPLETE" && figure.cause === NOT_CONFIRMED_INPUT_CAUSE;
}

/**
 * Per queued fact: the inputs built from it, the outputs that read it, and
 * the outputs that do not. Which outputs read a fact is the code's own
 * dependency on the current engine, cross-read against §4.2's map
 * (requiredInputs.ts) — not a new methodology rule. A queued fact with no
 * entry fails the suite rather than being skipped.
 */
interface FactDependents {
  inputsCarryDecision: (fixture: CompanyFixture) => boolean;
  dependentsBlocked: (result: AnalysisResult) => Record<string, boolean>;
  /** Outputs that do not read the fact — unchanged from the all-confirmed run. */
  independent: (result: AnalysisResult) => unknown;
}

const DEPENDENTS: Record<string, FactDependents> = {
  // §4.2: enterprise value and every EV-based multiple, P/E, and the §10.6
  // valuation position. Through enterprise value: the leverage precondition
  // (§6.5 fails closed without it), steady-state EV and PVGO, the reverse
  // DCF's target, and the scenario per-share bridge the fair-value range is
  // built on.
  price: {
    inputsCarryDecision: (f) =>
      f.enterpriseValue.price?.provenance.verificationState === "NOT CONFIRMED" &&
      f.multiplesInput.price?.provenance.verificationState === "NOT CONFIRMED" &&
      f.multiplesInput.marketCap?.provenance.verificationState === "NOT CONFIRMED",
    dependentsBlocked: (r) => ({
      "enterprise value (INCOMPLETE, unconfirmed-input cause)": suppressedNotConfirmed(r.diagnostics.enterpriseValue),
      "leverage precondition (not measured, fails closed — §6.5)": r.gates.leverage.netDebtRatio === null,
      "EV/EBIT": r.diagnostics.multiples.evToEbit.suppressed,
      "EV/revenue": r.diagnostics.multiples.evToRevenue.value.suppressed,
      "FCF yield on market cap (INCOMPLETE, unconfirmed-input cause)": suppressedNotConfirmed(r.diagnostics.multiples.fcfYieldOnMarketCap),
      "steady-state EV": r.priceImplied.steadyStateEv.suppressed,
      PVGO: r.priceImplied.pvgo.suppressed,
      "reverse DCF": r.priceImplied.reverseDcf.fiveYearGrowth.suppressed,
      "fair-value range": r.fairValueRange.kind === "suppressed",
      "price within the range": r.scenarioOutputs.priceLocationWithinRange === null || r.scenarioOutputs.priceLocationWithinRange.isNaN(),
      "rate at which the Base equals the price": r.scenarioOutputs.rateAtWhichBaseEqualsPrice === null,
    }),
    independent: (r) => ({
      fcf: r.diagnostics.fcf,
      marginHistory: r.diagnostics.marginHistory,
      runRate: r.diagnostics.runRate,
      gates: { gate0: r.gates.gate0, gate1: r.gates.gate1, triggerA: r.gates.triggerA, triggerB: r.gates.triggerB },
      achievedRevenueCagr: r.achievedRevenueCagr,
    }),
  },
  // After AR4 (reverseDcf.ts: "Read by M6 (steady-state EV), not by this
  // solve"), M6's current-margin NOPAT gap is the one output built from the
  // current-operating-margin fact. Every other output is unchanged.
  "current-operating-margin": {
    inputsCarryDecision: (f) => f.reverseDcf.currentMargin?.provenance.verificationState === "NOT CONFIRMED",
    dependentsBlocked: (r) => ({ "current-vs-median-margin NOPAT gap": r.priceImplied.nopatGap === null }),
    independent: (r) => ({
      diagnostics: r.diagnostics,
      priceImplied: { ...r.priceImplied, nopatGap: "<dependent>" },
      scenarioOutputs: r.scenarioOutputs,
      fairValueRange: r.fairValueRange,
      verdictInputs: r.verdictInputs,
    }),
  },
};

describe("CF-LEG2-DECIDED-FACT-GATING-01 — a contradicted fact blocks what depends on it, on MSFT's real run", () => {
  let confirmed: DecidedRun;
  const gated = new Map<string, DecidedRun>();

  beforeAll(async () => {
    await getPool().query("TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE");
    await getPool().query(MIGRATION_SQL);
    confirmed = await openMsftRun(null);
    for (const factId of confirmed.queued) gated.set(factId, await openMsftRun(factId));
  }, 300_000);

  afterAll(async () => {
    // Leave migration 010's row as it wants to end up, for any later file.
    await getPool().query(MIGRATION_SQL);
    await getPool().end();
  });

  it("queues price, current-operating-margin and nothing else — every queued fact is decided in turn below", () => {
    // A fact the queue gains later fails here until its dependents are listed.
    expect([...confirmed.queued].sort()).toEqual(Object.keys(DEPENDENTS).sort());
  });

  it("precondition: the all-confirmed run computes every one of those dependents and issues a verdict", () => {
    const r = confirmed.result;
    expect(r.diagnostics.enterpriseValue.suppressed).toBe(false);
    expect(r.gates.leverage.netDebtRatio).not.toBeNull();
    expect(r.diagnostics.multiples.fcfYieldOnMarketCap.suppressed).toBe(false);
    expect(r.priceImplied.steadyStateEv.suppressed).toBe(false);
    expect(r.priceImplied.reverseDcf.fiveYearGrowth.suppressed).toBe(false);
    expect(r.fairValueRange.kind).toBe("range");
    expect(r.scenarioOutputs.rateAtWhichBaseEqualsPrice).not.toBeNull();
    expect(r.priceImplied.nopatGap).not.toBeNull();
    const verdict = deriveVerdict(withJudgements(r, { closeCalls: [closeCallAnswer(r.runIdentity!.inputsFingerprint)] }));
    expect(verdict.state).toBe("ISSUED");
    expect(verdict.status).toBe("SELL");
  });

  it("the all-confirmed run's price input is exactly what it was before this outcome (CLEAN_PROVENANCE)", () => {
    // A confirmed price fact's tokens are CLEAN_PROVENANCE, so carrying the
    // decision changes nothing on a fully confirmed run.
    expect(confirmed.fixture.enterpriseValue.price?.provenance).toEqual(CLEAN_PROVENANCE);
    expect(confirmed.fixture.multiplesInput.price?.provenance).toEqual(CLEAN_PROVENANCE);
  });

  describe.each(Object.keys(DEPENDENTS))("%s decided NOT CONFIRMED", (factId) => {
    const run = () => gated.get(factId)!;
    const deps = DEPENDENTS[factId];

    it("the fact carries the decision, and so does every input built from it", () => {
      expect(run().fixture.facts.find((f) => f.id === factId)?.verificationState).toBe("NOT CONFIRMED");
      expect(deps.inputsCarryDecision(run().fixture)).toBe(true);
    });

    it("every output that depends on it is blocked", () => {
      const blocked = deps.dependentsBlocked(run().result);
      expect(Object.entries(blocked).filter(([, isBlocked]) => !isBlocked).map(([name]) => name)).toEqual([]);
    });

    it("outputs that do not depend on it stay computed, unchanged from the all-confirmed run", () => {
      expect(plain(deps.independent(run().result))).toBe(plain(deps.independent(confirmed.result)));
    });

    it("no verdict is issued — Calvin's close call was recorded against the all-confirmed inputs", () => {
      const r = run().result;
      const verdict = deriveVerdict(withJudgements(r, { closeCalls: [closeCallAnswer(confirmed.result.runIdentity!.inputsFingerprint)] }));
      expect(isIssuedVerdict(verdict)).toBe(false);
    });
  });

  it("current-operating-margin — trust's rule 2 names the run's own NOT CONFIRMED fact, since the range it does not feed still renders", () => {
    const r = gated.get("current-operating-margin")!.result;
    expect(r.trust.status).toBe("PARTIAL");
    expect(r.trust.determinedBy.map((d) => d.detail)).toContain("Current operating margin is NOT CONFIRMED");
  });

  it("price — the verdict reads it (price / Base), so no answer issues one: INCOMPLETE even with the close call bound to this run and the thesis recorded broken", () => {
    const r = gated.get("price")!.result;
    const verdict = deriveVerdict(
      withJudgements(r, {
        closeCalls: [closeCallAnswer(r.runIdentity!.inputsFingerprint)],
        thesis: { answer: "broken", note: null, recordedAt: "2026-10-18T00:00:00.000Z", version: 1 },
      })
    );
    expect(isIssuedVerdict(verdict)).toBe(false);
    expect(verdict.status).toBe("INCOMPLETE");
  });
});
