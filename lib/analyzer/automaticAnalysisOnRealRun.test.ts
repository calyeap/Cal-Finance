import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import Decimal from "decimal.js";
import { getPool } from "../db";
import {
  createRun,
  getFactDecisions,
  getRun,
  recordAutomaticFactDecisions,
  recordFactDecision,
  recordJudgment,
  recordProfileDecision,
} from "./runStore";
import { computeAnalysisForRun, loadGateState, SpotCheckIncompleteError } from "./gate";
import { advanceRunAutomatically } from "./autoRun";
import { automaticDecisionsFor } from "./autoVerify";
import { deriveVerdict } from "./verdict";
import type { AnalysisResult } from "./types";

// ---------------------------------------------------------------------------
// CF-ANALYZER-AUTORUN-01 — `ticker → analyze → report`, proved on real MSFT
// and real OKLO.
//
// AUTHORITY. Calvin's CALVIN RULING, 22 September 2026 04:28:04Z (PR #216
// comment 5771211284): "V1 acceptance target: enter ticker → analyze →
// report. No mandatory human interaction after ticker entry in the normal
// flow."
//
// HOW THESE RUNS ARE DRIVEN. `createRun` then `advanceRunAutomatically` — the
// two statements `beginAnalysisAction` executes after identity resolution, in
// that order, and nothing else. `beginAnalysisAction` itself is not called
// because its first statement resolves identity through the live market-data
// provider, and this outcome acquires nothing over the network; the source
// pin at the bottom of this file is what keeps the two in step.
//
// WHAT "NO HUMAN WRITE" MEANS HERE, LITERALLY. Between `createRun` and the
// rendered analysis, `recordFactDecision`, `recordJudgment` and
// `recordProfileDecision` are not called. The tests assert that against the
// stored rows rather than against the test's own good behaviour: every fact
// decision must carry origin AUTOMATIC, and the run must carry no profile
// decision at all.
//
// Facts come from the committed SEC captures (ANALYZER_OFFLINE=1,
// vitest.setup.ts:51). No new capture, no NVDA, no third company.
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..", "..");

/** The §4.4 selection Calvin ruled for MSFT (issue #188, 2026-09-21T08:19:14Z). */
const MSFT_TAG = "us-gaap:LongTermInvestments";

interface AutomaticRun {
  runId: string;
  result: AnalysisResult;
}

/**
 * Everything that happens after the analyst presses "begin analysis", and
 * nothing more.
 */
async function analyzeAutomatically(ticker: string, companyName: string): Promise<AutomaticRun> {
  const runId = await createRun(ticker, companyName);
  await advanceRunAutomatically(runId);
  return { runId, result: await computeAnalysisForRun(runId) };
}

/**
 * The same run as an analyst would have produced it before this outcome:
 * every queued fact confirmed by hand, and Step 6 answered *Cannot judge* —
 * the one §6.3 outcome that, like the automatic resolution, leaves the profile
 * not human-confirmed. That is what makes the comparison below apples to
 * apples rather than a comparison against a confirmation nobody gave.
 */
async function analyzeByHand(ticker: string, companyName: string): Promise<AnalysisResult> {
  const runId = await createRun(ticker, companyName);
  const state = await loadGateState(runId);
  for (const factId of state.outstandingFactIds) {
    await recordFactDecision(runId, factId, "CONFIRMED", null);
  }
  const decided = await loadGateState(runId);
  await recordProfileDecision(runId, "CANNOT JUDGE", decided.fixture.profile.recommended, null);
  return computeAnalysisForRun(runId);
}

/** The finance state of a run, as the report reads it. */
function financeStateOf(result: AnalysisResult) {
  const verdict = deriveVerdict(result);
  return {
    price: result.price.value.toString(),
    companyName: result.companyName,
    profile: result.profile.confirmedOrOverridden,
    recommendedProfile: result.profile.recommended,
    leverage: result.gates.leverage.result,
    gate0: result.gates.gate0.result,
    trust: result.trust.status,
    fairValueRange: result.fairValueRange.kind,
    verdictStatus: verdict.status,
    verdictReason: verdict.reason,
    factValues: result.facts.map((f) => `${f.id}=${f.value === null ? "—" : String(f.value)}`),
  };
}

describe("CF-ANALYZER-AUTORUN-01 — a real run reaches a report with no human step", () => {
  beforeEach(async () => {
    await getPool().query(
      "TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE"
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  describe.each([
    {
      ticker: "MSFT",
      companyName: "Microsoft Corporation",
      // The capture's own entityName, upper-case — recorded in
      // docs/m9-real-company-validation-findings.md, not corrected.
      expectedCompanyName: "MICROSOFT CORPORATION",
      capturedClose: "499.70",
      expectedProfile: "MATURE_PROFITABLE_STABLE_FCF",
      // The queue this real capture actually produces: the market quote (no
      // tag mapping, so §3.8.1 guard 1 keeps it queued) and the derived
      // operating margin (§3.8 names it, so the derived-fact exemption cannot
      // reach it). Asserted rather than described, because the whole claim is
      // about which facts the software answered.
      expectedQueue: ["current-operating-margin", "price"],
    },
    {
      ticker: "OKLO",
      companyName: "Oklo Inc.",
      expectedCompanyName: "Oklo Inc.",
      capturedClose: "41.27",
      expectedProfile: "PRE_REVENUE_UNPROFITABLE",
      expectedQueue: ["price"],
    },
  ])("$ticker", ({
    ticker,
    companyName,
    expectedCompanyName,
    capturedClose,
    expectedProfile,
    expectedQueue,
  }) => {
    it("reaches a rendered analysis from the run alone — no fact decision, judgment or profile decision was recorded by a human", async () => {
      const { runId, result } = await analyzeAutomatically(ticker, companyName);

      const decisions = await getFactDecisions(runId);
      expect(decisions.length).toBeGreaterThan(0);
      expect(decisions.every((d) => d.origin === "AUTOMATIC")).toBe(true);
      expect(decisions.some((d) => d.origin === "HUMAN")).toBe(false);
      expect(decisions.map((d) => d.factId).sort()).toEqual(expectedQueue);

      const run = await getRun(runId);
      expect(run!.profileDecision).toBeNull();
      expect(run!.profileHumanConfirmed).toBe(false);

      // And the analysis exists, which is the outcome.
      expect(result.ticker).toBe(ticker);
      expect(result.companyName).toBe(expectedCompanyName);
      expect(result.price.value.equals(new Decimal(capturedClose))).toBe(true);
    });

    it("Step 6 resolves onto this run's own recommendation, marked automatic, and profileHumanConfirmed stays honest", async () => {
      const { runId, result } = await analyzeAutomatically(ticker, companyName);
      const run = await getRun(runId);

      expect(run!.profileAutoResolved).toBe(expectedProfile);
      expect(result.profile.recommended).toBe(expectedProfile);
      // Not a confirmation, and not written as one. This is what keeps
      // PROFILE NOT CONFIRMED, the §9.6 trust consequence and the §10.6.3
      // position suppression all working exactly as before.
      expect(run!.profileHumanConfirmed).toBe(false);
      expect(run!.profileDecision).toBeNull();
      expect(run!.profile).toBeNull();
    });

    it("every automatic confirmation is recorded as automatic and carried onto the fact, distinguishable from a human one", async () => {
      const { runId, result } = await analyzeAutomatically(ticker, companyName);

      for (const factId of expectedQueue) {
        const fact = result.facts.find((f) => f.id === factId)!;
        expect(fact.verificationState).toBe("CONFIRMED");
        expect(fact.verificationOrigin).toBe("AUTOMATIC");
        expect(fact.verificationReasonCode).toBeNull();
      }

      // An exempt fact was decided by nobody and nothing, and says so.
      const exempt = result.facts.filter(
        (f) => f.verificationState === "SPOT-CHECK NOT REQUIRED"
      );
      expect(exempt.length).toBeGreaterThan(0);
      expect(exempt.every((f) => f.verificationOrigin === null)).toBe(true);

      // The same fact, decided by a person, is not confusable with the above.
      const byHandRunId = await createRun(ticker, companyName);
      await recordFactDecision(byHandRunId, expectedQueue[0], "CONFIRMED", null);
      const [human] = await getFactDecisions(byHandRunId);
      expect(human.origin).toBe("HUMAN");
      const [automatic] = await getFactDecisions(runId);
      expect(automatic.origin).toBe("AUTOMATIC");
      expect(human.origin).not.toBe(automatic.origin);
    });

    it("produces exactly the finance state a hand-worked run produces — the automatic path changes no number", async () => {
      const { result: automatic } = await analyzeAutomatically(ticker, companyName);
      const byHand = await analyzeByHand(ticker, companyName);

      expect(financeStateOf(automatic)).toEqual(financeStateOf(byHand));
    });

    it("still reads INCOMPLETE, for the upstream reason it already read INCOMPLETE for", async () => {
      const { result } = await analyzeAutomatically(ticker, companyName);
      const verdict = deriveVerdict(result);

      // 22 Sep 02:24:07Z (B) — deriveVerdict stays honestly INCOMPLETE, and
      // this outcome neither fixes that nor is entitled to.
      expect(verdict.status).toBe("INCOMPLETE");
      // The state docs/m9-real-company-validation-findings.md records for a
      // run carrying no §4.4 judgment, unchanged.
      expect(result.gates.leverage.result).toBe("LEVERAGE UNSUPPORTED IN v1");
      expect(result.trust.status).toBe("UNUSABLE");
      expect(result.fairValueRange.kind).toBe("suppressed");
      expect(verdict.reason).toContain("LEVERAGE UNSUPPORTED IN v1");
    });

    it("running the automatic pass again writes nothing and changes nothing", async () => {
      const { runId, result } = await analyzeAutomatically(ticker, companyName);
      const before = await getFactDecisions(runId);
      const runBefore = await getRun(runId);

      await advanceRunAutomatically(runId);
      await advanceRunAutomatically(runId);

      expect(await getFactDecisions(runId)).toEqual(before);
      expect(await getRun(runId)).toEqual(runBefore);
      expect(financeStateOf(await computeAnalysisForRun(runId))).toEqual(financeStateOf(result));
    });

    it("never overwrites a decision an analyst has already made", async () => {
      const runId = await createRun(ticker, companyName);
      // The analyst got to one fact before the automatic pass ran.
      await recordFactDecision(runId, expectedQueue[0], "NOT CONFIRMED", "NOT LOCATED");

      await advanceRunAutomatically(runId);

      const decisions = await getFactDecisions(runId);
      const theirs = decisions.find((d) => d.factId === expectedQueue[0])!;
      expect(theirs.origin).toBe("HUMAN");
      expect(theirs.decision).toBe("NOT CONFIRMED");
      expect(theirs.reasonCode).toBe("NOT LOCATED");
    });
  });

  // -------------------------------------------------------------------------
  // The one company-specific claim, kept out of the shared block because it
  // is MSFT's alone: the §4.4 ruling's recorded state is still reachable, and
  // still the same state, on top of an automatically analyzed run.
  // -------------------------------------------------------------------------
  it("MSFT's recorded §4.4 state (CF-S44-RECORD-01) is unchanged — recording the ruling on the detail route still reaches PASS / PARTIAL / range", async () => {
    const runId = await createRun("MSFT", "Microsoft Corporation");
    await advanceRunAutomatically(runId);

    // Screen 2's judgment selector, used from the detail route after the
    // report already exists — the ordinary way an analyst revises a run now.
    await recordJudgment(
      runId,
      "NON-OPERATING INVESTMENTS",
      MSFT_TAG,
      "Calvin's §4.4 ruling, 2026-09-21T08:19:14Z, issue #188."
    );

    const result = await computeAnalysisForRun(runId);
    expect(result.gates.leverage.result).toBe("PASS");
    expect(result.trust.status).toBe("PARTIAL");
    expect(result.fairValueRange.kind).toBe("range");

    const ev = result.diagnostics.enterpriseValue;
    expect(ev.suppressed).toBe(false);
    if (!ev.suppressed) {
      expect(ev.value.nonOperatingEquityInvestmentsAtBook.equals(new Decimal("36348000000"))).toBe(
        true
      );
    }

    const verdict = deriveVerdict(result);
    expect(verdict.status).toBe("INCOMPLETE");
    expect(verdict.reason).not.toContain("LEVERAGE UNSUPPORTED IN v1");
  });

  // -------------------------------------------------------------------------
  // The failure direction. Calvin: "If the system cannot reliably complete an
  // analysis, return a clear INCOMPLETE report explaining the reason rather
  // than forcing me through an operator workflow."
  //
  // The condition simulated is the §3.8.2 cross-check outcome set — the one
  // input to this path that neither committed capture produces a failure in
  // today. Everything downstream of it is real: the real acquired MSFT facts,
  // the real store, the real gate, the real assembly.
  // -------------------------------------------------------------------------
  describe("a fact the software cannot verify", () => {
    async function runWithFailedCrossCheckOnPrice() {
      const runId = await createRun("MSFT", "Microsoft Corporation");
      // The §4.4 judgment so the run is NOT already fully suppressed for the
      // unrelated leverage reason — otherwise "this field reads INCOMPLETE"
      // would be true for a cause that has nothing to do with this outcome.
      await recordJudgment(runId, "NON-OPERATING INVESTMENTS", MSFT_TAG, "Calvin's §4.4 ruling.");

      const state = await loadGateState(runId);
      const failed = new Set(["price"]);
      const decisions = automaticDecisionsFor(
        state.fixture.facts,
        state.decidedFactIds,
        failed,
        state.derivedExemption
      );
      await recordAutomaticFactDecisions(
        runId,
        decisions.map((d) => ({
          factId: d.factId,
          decision: d.decision,
          reasonCode: d.reasonCode,
        }))
      );
      return { runId, decisions };
    }

    it("is recorded NOT CONFIRMED automatically, with the §3.8.4 code, rather than left undecided", async () => {
      const { decisions } = await runWithFailedCrossCheckOnPrice();
      const price = decisions.find((d) => d.factId === "price")!;

      expect(price.decision).toBe("NOT CONFIRMED");
      expect(price.reasonCode).toBe("CONTRADICTED BY SOURCE");
      expect(price.cause).toBe("CROSS-CHECK FAILED");
      // The other queued fact is unaffected — one failure does not condemn the
      // rest of the queue.
      expect(decisions.find((d) => d.factId === "current-operating-margin")!.decision).toBe(
        "CONFIRMED"
      );
    });

    it("still produces a report — the analyst is not routed to Screen 2", async () => {
      const { runId } = await runWithFailedCrossCheckOnPrice();

      // Verification-complete, so the gate does not refuse: there is nothing
      // for a route to redirect on.
      const state = await loadGateState(runId);
      expect(state.spotCheckComplete).toBe(true);
      expect(state.outstandingFactIds).toEqual([]);
      await expect(computeAnalysisForRun(runId)).resolves.toBeDefined();
    });

    it("names the reason at the affected field, and says the software recorded it", async () => {
      const { runId } = await runWithFailedCrossCheckOnPrice();
      const result = await computeAnalysisForRun(runId);

      const price = result.facts.find((f) => f.id === "price")!;
      expect(price.verificationState).toBe("NOT CONFIRMED");
      expect(price.verificationOrigin).toBe("AUTOMATIC");
      expect(price.verificationReasonCode).toBe("CONTRADICTED BY SOURCE");

      // §9.6 — and the run's own trust register names the fact, so the reason
      // is not only on the fact row.
      expect(result.trust.determinedBy.map((d) => d.detail)).toContain("Price is NOT CONFIRMED");
    });
  });

  // -------------------------------------------------------------------------
  // The chokepoint, unchanged. This outcome changes how a run reaches
  // verification-complete; it never changes whether the gate exists.
  // -------------------------------------------------------------------------
  it("computeAnalysisForRun still refuses before any calculation module when the run is not verification-complete", async () => {
    const runId = await createRun("MSFT", "Microsoft Corporation");
    // No automatic pass, no human decisions — the queue is untouched.
    await expect(computeAnalysisForRun(runId)).rejects.toBeInstanceOf(SpotCheckIncompleteError);
  });

  // -------------------------------------------------------------------------
  // The source pin that keeps beginAnalysisAction in step with what the runs
  // above simulate. Two statements, in this order, and a destination that is
  // not a human step.
  // -------------------------------------------------------------------------
  it("beginAnalysisAction creates the run, advances it automatically, and sends the analyst to the run — never to Screen 2", () => {
    const src = readFileSync(path.join(ROOT, "app/actions/analyzer.ts"), "utf8");
    const created = src.indexOf("const runId = await createRun(");
    const advanced = src.indexOf("await advanceRunAutomatically(runId);");
    const redirected = src.indexOf("redirect(`/analyzer/${runId}`);");

    expect(created).toBeGreaterThan(-1);
    expect(advanced).toBeGreaterThan(created);
    expect(redirected).toBeGreaterThan(advanced);
    expect(src).not.toContain("redirect(`/analyzer/${runId}/facts`);");
  });
});
