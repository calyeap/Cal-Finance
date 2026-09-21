import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision } from "./runStore";
import { computeAnalysisForRun, loadGateState } from "./gate";

// ---------------------------------------------------------------------------
// M9-RECORD-RECON-01, SCOPE item 2 — what M9-FIFTYTWOWEEK-01 (PR #184) actually
// changes for the two item-10 offline captured runs, established by running
// them rather than assumed.
//
// PR #184 closed the WIRING gap: gate.ts now computes `fiftyTwoWeek` and
// passes it to both `buildAcquiredRun` calls (gate.ts:309, :317, :329). But
// `gate.ts`'s own `fiftyTwoWeekRange` (:214) returns null unconditionally
// under ANALYZER_OFFLINE — by design, per its own doc comment: "Offline mode
// never calls the provider ... An offline run keeps today's M3 INCOMPLETE."
// And the committed capture (`prices.json`) carries one recorded close per
// ticker, not a series (docs/m9-real-company-validation-findings.md §4
// finding 2) — there is no history for an offline fetch to serve even if the
// offline gate were lifted.
//
// So for MSFT and OKLO under this suite's ANALYZER_OFFLINE=1
// (vitest.setup.ts:51), the wiring fix changes nothing observable: margin
// history and the related Section D diagnostics stay INCOMPLETE, for the
// same reason as before PR #184, now pinned by assertion rather than left to
// a "not something this validation introduced" line of prose.
//
// Driven through the SAME gated path the two M9 routes read
// (loadGateState / computeAnalysisForRun, lib/analyzer/gate.ts), following
// nonOperatingJudgmentRecordedOnRealRun.test.ts's own pattern — never a
// fixture, never a second harness.
// ---------------------------------------------------------------------------

async function completeSpotCheck(runId: string): Promise<void> {
  const state = await loadGateState(runId);
  for (const factId of state.outstandingFactIds) {
    await recordFactDecision(runId, factId, "CONFIRMED", null);
  }
}

async function openRun(ticker: string, companyName: string) {
  const runId = await createRun(ticker, companyName);
  await completeSpotCheck(runId);
  const state = await loadGateState(runId);
  await recordProfileDecision(runId, "CONFIRMED", state.fixture.profile.recommended, null);
  return { state, result: await computeAnalysisForRun(runId) };
}

describe("M9-RECORD-RECON-01 — 52-week range on the offline captured real runs", () => {
  beforeEach(async () => {
    await getPool().query(
      "TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE"
    );
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("MSFT: fiftyTwoWeek resolves to null under the offline capture — margin history and Section D stay INCOMPLETE", async () => {
    const { state, result } = await openRun("MSFT", "Microsoft Corporation");

    // The wiring: gate.ts's own fiftyTwoWeek input, passed through
    // buildAcquiredRun into the fixture's marginHistory input, is null on
    // this offline run — not absent because nobody asked, but because
    // gate.ts's own fiftyTwoWeekRange takes the fail-closed ANALYZER_OFFLINE
    // branch at gate.ts:214 before ever reaching the provider.
    expect(state.fixture.marginHistory.fiftyTwoWeekLow).toBeNull();
    expect(state.fixture.marginHistory.fiftyTwoWeekHigh).toBeNull();

    const mh = result.diagnostics.marginHistory;
    expect(mh.suppressed).toBe(true);
    if (mh.suppressed) {
      expect(mh.state).toBe("INCOMPLETE");
      expect(mh.cause).toContain("fiftyTwoWeekLow");
      expect(mh.cause).toContain("fiftyTwoWeekHigh");
    }
  });

  it("OKLO: fiftyTwoWeek resolves to null under the offline capture — margin history and Section D stay INCOMPLETE", async () => {
    const { state, result } = await openRun("OKLO", "Oklo Inc.");

    expect(state.fixture.marginHistory.fiftyTwoWeekLow).toBeNull();
    expect(state.fixture.marginHistory.fiftyTwoWeekHigh).toBeNull();

    const mh = result.diagnostics.marginHistory;
    expect(mh.suppressed).toBe(true);
    if (mh.suppressed) {
      expect(mh.state).toBe("INCOMPLETE");
      expect(mh.cause).toContain("fiftyTwoWeekLow");
      expect(mh.cause).toContain("fiftyTwoWeekHigh");
    }
  });
});
