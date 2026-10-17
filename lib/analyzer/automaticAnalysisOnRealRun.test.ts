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
import { assembleAnalysisResult } from "./assemble";
import { withStatedD2Inputs } from "./fixtures/statedD2Inputs";

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
 * a real, explicit human act of uncertainty, unlike the automatic path's
 * silent resolution.
 *
 * CF-ANALYZER-V1-SETTLE-01 (RM-brief ruling item 2) deliberately makes this
 * no longer equivalent to the automatic path for an unambiguous operating
 * company: Gate 0 PASS plus an automatic resolution now stands in for a
 * human confirmation, while an explicit *Cannot judge* still means exactly
 * what it always meant and still raises PROFILE NOT CONFIRMED. The two paths
 * stay apples-to-apples wherever the range is already suppressed for an
 * unrelated reason (OKLO's LEVERAGE UNSUPPORTED IN v1 — trust.ts's Rule 1
 * returns before Rule 2's profile check ever runs), which is why the
 * comparison below is split by ticker rather than asserted uniformly.
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

      // Every deterministic finance fact is identical regardless of ticker —
      // that claim is unaffected by CF-ANALYZER-V1-SETTLE-01's profile-
      // confirmation change, which only touches presentation (trust status
      // and the verdict's own reason string).
      const { trust: _automaticTrust, verdictStatus: _automaticVerdictStatus, verdictReason: _automaticVerdictReason, ...automaticFinance } =
        financeStateOf(automatic);
      const { trust: _byHandTrust, verdictStatus: _byHandVerdictStatus, verdictReason: _byHandVerdictReason, ...byHandFinance } =
        financeStateOf(byHand);
      expect(automaticFinance).toEqual(byHandFinance);

      if (ticker === "MSFT") {
        // MSFT's Gate 0 PASS makes the automatic resolution stand in for a
        // human confirmation (see analyzeByHand's doc comment), so its
        // automatic run no longer carries PROFILE NOT CONFIRMED the way the
        // explicit-Cannot-judge hand run still does.
        //
        // CF-MSFT-STAGE2-DURABLE-SEED-01 (issue #442, migration 010)
        // durably recorded Calvin's approved MSFT Stage-2 bundle — a real,
        // driver-authored analyst bundle, never fixture-carried — so A4
        // (CF-ANALYZER-INTEGRITY-PHASE-A-01) no longer suppresses MSFT's
        // range.
        //
        // CF-AR4-RATE-REINVESTMENT-TERMINAL-01: that Stage-2 sheet is
        // superseded by D2 (product-decisions item 27) and carries no D2
        // input, so both paths read the same pending-adoption suppression and
        // UNUSABLE trust; the automatic path still never carries PROFILE NOT
        // CONFIRMED.
        expect(automatic.trust.status).toBe("UNUSABLE");
        expect(byHand.trust.status).toBe("UNUSABLE");
        expect(automatic.fairValueRange.kind).toBe("suppressed");
        expect(deriveVerdict(automatic).reason).not.toContain("PROFILE NOT CONFIRMED");
      } else {
        // OKLO's range is already suppressed for an unrelated reason
        // (LEVERAGE UNSUPPORTED IN v1), so trust/verdict are unaffected and
        // stay identical between the two paths.
        expect(financeStateOf(automatic)).toEqual(financeStateOf(byHand));
      }
    });

    it("MSFT reads INCOMPLETE while its sheet is pending adoption (D2); OKLO still reads INCOMPLETE, for the upstream reason it reads INCOMPLETE for", async () => {
      const { result } = await analyzeAutomatically(ticker, companyName);
      const verdict = deriveVerdict(result);

      if (ticker === "MSFT") {
        // CF-ANALYZER-V1-SETTLE-01 — migration 007's durable §4.4 override
        // (Calvin ruling 2) now resolves MSFT's enterprise value/leverage
        // on a fresh run automatically, carrying forward the exact same
        // ruling "MSFT's recorded §4.4 state" below records explicitly. And
        // the RM-brief ruling's automatic-profile-confirmation fix (item 2)
        // means this run's Gate 0 PASS now stands in for a human
        // confirmation, so PROFILE NOT CONFIRMED no longer fires either.
        //
        // CF-MSFT-STAGE2-DURABLE-SEED-01 (issue #442, migration 010)
        // durably recorded Calvin's approved MSFT Stage-2 bundle — a real,
        // driver-authored analyst bundle, never fixture-carried — so A4
        // (CF-ANALYZER-INTEGRITY-PHASE-A-01) no longer suppresses MSFT's
        // range; trust reads PARTIAL for the genuine, unrelated
        // rate-sensitivity gap instead.
        //
        // CF-ANALYZER-STAGE3-VERDICT-FINISH-01: with every upstream gate
        // clear, deriveVerdict now falls through to the live Methodology's
        // "Verdict synthesis policy v1" (APPROVED 22 Sep 2026) instead of
        // the old permanent M8-comparator INCOMPLETE — real price $499.70
        // against the real recomputed Base $283.31 (1.7638×) clears the
        // strictest uncertainty-bucket SELL threshold invariantly.
        //
        // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — reviewed evaluator change:
        // that SELL was off the superseded Stage-2 Base (product-decisions
        // item 27). With no D2 input on MSFT's sheet the verdict is
        // INCOMPLETE and says why — never a manufactured HOLD.
        expect(result.gates.leverage.result).toBe("PASS");
        expect(result.trust.status).toBe("UNUSABLE");
        expect(result.fairValueRange.kind).toBe("suppressed");
        expect(verdict.status).toBe("INCOMPLETE");
        expect(verdict.reason).not.toContain("LEVERAGE UNSUPPORTED IN v1");
        expect(verdict.reason).not.toContain("PROFILE NOT CONFIRMED");
        expect(verdict.reason).toMatch(/Pending adoption|scenario dollar values/);
      } else {
        // 22 Sep 02:24:07Z (B) — OKLO's verdict stays honestly INCOMPLETE,
        // blocked upstream of any synthesis by the leverage precondition.
        expect(verdict.status).toBe("INCOMPLETE");
        // OKLO has zero tagged non-operating-investment candidates
        // (docs/m9-real-company-validation-findings.md), so no override —
        // durable or per-run — was ever possible for it; unchanged.
        expect(result.gates.leverage.result).toBe("LEVERAGE UNSUPPORTED IN v1");
        expect(result.trust.status).toBe("UNUSABLE");
        expect(result.fairValueRange.kind).toBe("suppressed");
        expect(verdict.reason).toContain("LEVERAGE UNSUPPORTED IN v1");
      }
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
  it("MSFT's recorded §4.4 state (CF-S44-RECORD-01) is unchanged — recording the ruling on the detail route still reaches PASS leverage, and the EV bridge is unsuppressed", async () => {
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
    // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — see the shared block's
    // identical assertion above: the sheet is pending adoption.
    expect(result.trust.status).toBe("UNUSABLE");
    expect(result.fairValueRange.kind).toBe("suppressed");

    const ev = result.diagnostics.enterpriseValue;
    expect(ev.suppressed).toBe(false);
    if (!ev.suppressed) {
      expect(ev.value.nonOperatingEquityInvestmentsAtBook.equals(new Decimal("36348000000"))).toBe(
        true
      );
    }

    const verdict = deriveVerdict(result);
    // Same state as the shared block above; this test exercises the
    // detail-route judgment path rather than the automatic pass, but reaches
    // the identical financial state, so the same verdict follows.
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
      // CF-AR4-RATE-REINVESTMENT-TERMINAL-01: MSFT's recorded sheet is
      // pending adoption, which would make trust UNUSABLE before rule 2 ever
      // reads the facts; STATED D2 test inputs (never recorded) keep this
      // test about the fact.
      const state = await loadGateState(runId);
      const result = assembleAnalysisResult({ ...withStatedD2Inputs(state.fixture), scenarioValues: null, scenarioValuesAreFixtureCarried: false });

      const price = result.facts.find((f) => f.id === "price")!;
      expect(price.verificationState).toBe("NOT CONFIRMED");
      expect(price.verificationOrigin).toBe("AUTOMATIC");
      expect(price.verificationReasonCode).toBe("CONTRADICTED BY SOURCE");

      // CF-MSFT-STAGE2-DURABLE-SEED-01 (issue #442, migration 010) durably
      // recorded Calvin's approved MSFT Stage-2 bundle, so A4
      // (CF-ANALYZER-INTEGRITY-PHASE-A-01) no longer suppresses MSFT's
      // range unconditionally — trust.ts's rule 2 now actually inspects
      // this run's own facts, surfacing this exact "<name> is NOT
      // CONFIRMED" detail (previously only independently covered with
      // synthetic inputs in trust.test.ts; now a real claim about this
      // fact row).
      expect(result.trust.status).toBe("PARTIAL");
      expect(result.trust.determinedBy.map((d) => d.detail).join(" ")).toContain("Price is NOT CONFIRMED");
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
