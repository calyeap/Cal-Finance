import { describe, it, expect, beforeEach, afterAll } from "vitest";
import Decimal from "decimal.js";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordJudgment, recordProfileDecision } from "./runStore";
import { computeAnalysisForRun, loadGateState } from "./gate";
import { deriveVerdict } from "./verdict";
import { POLICY } from "./policy";
import { selectionToNonOperatingInvestments } from "./acquisition/nonOperatingJudgment";

// ---------------------------------------------------------------------------
// CF-S44-RECORD-01 — Calvin's §4.4 ruling (issue #188, 2026-09-21T08:19:14Z),
// recorded for MSFT through the existing product path and re-run against the
// item-10 real-company acceptance runs.
//
// Calvin's ruling, verbatim: "treat the FY2026 $36.348B `LongTermInvestments`
// / 'Equity and other investments' aggregate as the non-operating investment
// balance for MSFT. Do not separately add the $12.0B EquityMethodInvestments
// or $12.4B EquitySecuritiesWithoutReadilyDeterminableFairValueAmount amounts
// because the primary-source evidence establishes they are components of the
// broader $36.348B balance."
//
// Driven through the SAME gated path the two M9 routes read
// (loadGateState / computeAnalysisForRun, lib/analyzer/gate.ts), via
// recordJudgment — the existing recording seam gate.ts already consumes at
// :318 through selectionToNonOperatingInvestments — never a fixture and
// never a second harness. completeSpotCheck below is trustOnRealRun.test.ts's
// own helper, reused rather than re-invented.
// ---------------------------------------------------------------------------

const MSFT_TAG = "us-gaap:LongTermInvestments";
const MSFT_JUDGMENT_REASON = "Calvin's §4.4 ruling, 2026-09-21T08:19:14Z, issue #188.";

async function completeSpotCheck(runId: string): Promise<void> {
  const state = await loadGateState(runId);
  for (const factId of state.outstandingFactIds) {
    await recordFactDecision(runId, factId, "CONFIRMED", null);
  }
}

async function openMsftRunWithRuling() {
  const runId = await createRun("MSFT", "Microsoft Corporation");
  await recordJudgment(runId, "NON-OPERATING INVESTMENTS", MSFT_TAG, MSFT_JUDGMENT_REASON);
  await completeSpotCheck(runId);
  const state = await loadGateState(runId);
  await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
  return computeAnalysisForRun(runId);
}

async function openOkloRunUnchanged() {
  const runId = await createRun("OKLO", "Oklo Inc.");
  await completeSpotCheck(runId);
  const state = await loadGateState(runId);
  await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
  return computeAnalysisForRun(runId);
}

describe("CF-S44-RECORD-01 — MSFT's §4.4 ruling recorded on a real run", () => {
  beforeEach(async () => {
    await getPool().query(
      "TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE"
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("resolves to the ruled tag ALONE, at $36,348,000,000, understating (§3.5) — enterprise value no longer INCOMPLETE", async () => {
    const result = await openMsftRunWithRuling();
    const ev = result.diagnostics.enterpriseValue;

    expect(ev.suppressed).toBe(false);
    if (!ev.suppressed) {
      expect(ev.value.nonOperatingEquityInvestmentsAtBook.equals(new Decimal("36348000000"))).toBe(true);
      expect(ev.value.nonOperatingInvestmentsErrorDirection).toBe("understates");
    }
  });

  it("leverage PASSes, below POLICY.leverageThreshold (never a new threshold or ratio constant)", async () => {
    const result = await openMsftRunWithRuling();

    expect(result.gates.leverage.result).toBe("PASS");
    expect(result.gates.leverage.netDebtRatio).not.toBeNull();
    expect(result.gates.leverage.netDebtRatio!.lessThan(POLICY.leverageThreshold)).toBe(true);
  });

  // CF-AR4-RATE-REINVESTMENT-TERMINAL-01 — reviewed evaluator change. These
  // pinned the 16 Oct 2026 Stage-2 range ($214.26/$283.31/$402.73), its
  // PARTIAL trust and its SELL, all superseded by product-decisions item 27
  // (D2). MSFT's sheet — migration 010's recorded one, or the committed
  // fixture carry-over if another file has removed that row — carries no D2
  // input, so no range is valued for this real run. What the §4.4 ruling
  // still settles (the EV bridge and leverage, above) is unchanged.
  const NO_MSFT_VALUATION = /scenario dollar values|Pending adoption/;

  it("with no D2 sheet adopted, the range is not valued — suppressed with the reason, and trust follows it to UNUSABLE", async () => {
    const result = await openMsftRunWithRuling();

    expect(result.fairValueRange.kind).toBe("suppressed");
    if (result.fairValueRange.kind === "suppressed") expect(result.fairValueRange.cause).toMatch(NO_MSFT_VALUATION);
    expect(result.trust.status).toBe("UNUSABLE");
  });

  it("the verdict is INCOMPLETE for that reason — never the old LEVERAGE UNSUPPORTED IN v1 cause, never a manufactured HOLD", async () => {
    const result = await openMsftRunWithRuling();
    const verdict = deriveVerdict(result);

    expect(verdict.status).toBe("INCOMPLETE");
    expect(verdict.reason).not.toContain("LEVERAGE UNSUPPORTED IN v1");
    expect(verdict.reason).toMatch(NO_MSFT_VALUATION);
  });

  it("a selection combining the ruled tag with a narrower one double-counts — the ruled run never carries the all-candidates sum", async () => {
    // The guard against re-introducing the $60.748B all-three sum: the
    // ruling is that LongTermInvestments ALONE is the balance, because the
    // other two candidates are already components of it (#188's primary-
    // source addendum) — not a containment rule in the tag mapping
    // (HARD BOUNDS), a pin on the recorded decision itself.
    const scratchRunId = await createRun("MSFT", "Microsoft Corporation");
    const scratchState = await loadGateState(scratchRunId);
    const candidates = scratchState.acquired.acquired.acquisition.candidateNonOperatingInvestments;
    const allCandidatesSum = candidates.reduce((acc, c) => acc.plus(c.value), new Decimal(0));

    const ruled = selectionToNonOperatingInvestments(MSFT_TAG, candidates)!;
    const otherTag = candidates.find((c) => c.tag !== MSFT_TAG)!.tag;
    const doubled = selectionToNonOperatingInvestments(`${MSFT_TAG} + ${otherTag}`, candidates)!;

    expect(ruled.tags).toEqual([MSFT_TAG]);
    expect(doubled.tags.length).toBe(2);
    expect(doubled.value.greaterThan(ruled.value)).toBe(true);
    expect(ruled.value.equals(allCandidatesSum)).toBe(false);

    const result = await openMsftRunWithRuling();
    const ev = result.diagnostics.enterpriseValue;
    if (!ev.suppressed) {
      expect(ev.value.nonOperatingEquityInvestmentsAtBook.equals(allCandidatesSum)).toBe(false);
      expect(ev.value.nonOperatingEquityInvestmentsAtBook.equals(ruled.value)).toBe(true);
    }
  });

  it("OKLO is unchanged — zero tagged candidates, LEVERAGE UNSUPPORTED IN v1, UNUSABLE trust, suppressed range, same cause as before", async () => {
    const result = await openOkloRunUnchanged();
    const verdict = deriveVerdict(result);

    expect(result.gates.leverage.result).toBe("LEVERAGE UNSUPPORTED IN v1");
    expect(result.gates.leverage.netDebtRatio).toBeNull();
    expect(result.trust.status).toBe("UNUSABLE");
    expect(result.fairValueRange.kind).toBe("suppressed");
    expect(verdict.status).toBe("INCOMPLETE");
    expect(verdict.reason).toContain("LEVERAGE UNSUPPORTED IN v1");
  });
});
