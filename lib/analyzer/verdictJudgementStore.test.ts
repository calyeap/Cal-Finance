import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../db";
import { createRun, recordFactDecision, recordProfileDecision, recordJudgment, getRecordedJudgementState } from "./runStore";
import { loadGateState } from "./gate";
import { analysisForReport } from "./reportAnalysis";
import { deriveVerdict } from "./verdict";
import { getVerdictJudgements, recordVerdictJudgement, InvalidVerdictJudgementError } from "./verdictJudgementStore";
import { NO_VERDICT_JUDGEMENTS, judgementInputProblem, type VerdictJudgementInput } from "./verdictJudgements";

// ---------------------------------------------------------------------------
// CF-AR5-VERDICT-CONSOLIDATION-01 — Calvin's verdict judgements as dated,
// versioned inputs (frozen spec §14.9 AR0-5; migration 013), through the
// real database.
// ---------------------------------------------------------------------------

const input = (over: Partial<VerdictJudgementInput>): VerdictJudgementInput => ({
  key: "UNCERTAINTY LEVEL",
  answer: "Medium",
  note: null,
  items: null,
  boundTo: null,
  ...over,
});

describe("judgementInputProblem — what a row must satisfy before it is written", () => {
  it("accepts each key's own answers, \"not sure\" included, and refuses anything else", () => {
    expect(judgementInputProblem(input({ answer: "High" }))).toBeNull();
    expect(judgementInputProblem(input({ answer: "not sure" }))).toBeNull();
    expect(judgementInputProblem(input({ answer: "Very high" }))).not.toBeNull();
    expect(judgementInputProblem(input({ key: "MANAGEMENT RATING", answer: "excellent" }))).not.toBeNull();
  });

  it("a cited moat mechanism needs its words; adopted process items need all five; a close call needs its binding", () => {
    expect(judgementInputProblem(input({ key: "MOAT MECHANISM", answer: "cited", note: "  " }))).not.toBeNull();
    expect(judgementInputProblem(input({ key: "MOAT MECHANISM", answer: "cited", note: "network effects" }))).toBeNull();
    expect(
      judgementInputProblem(input({ key: "PROCESS ITEMS", answer: "adopted", items: { thesis: "t", valuation: "v", keyRisks: "k", invalidation: "", bearCase: "b" } }))
    ).toContain("Thesis invalidation criteria");
    expect(judgementInputProblem(input({ key: "CLOSE CALL", answer: "SELL", boundTo: null }))).not.toBeNull();
    expect(judgementInputProblem(input({ key: "CLOSE CALL", answer: "SELL", boundTo: "inputs-sha256:x" }))).toBeNull();
  });
});

describe("verdict judgement store", () => {
  beforeEach(async () => {
    await getPool().query(
      "TRUNCATE analyzer_verdict_judgements, analyzer_run_outputs, analyzer_run_snapshots, analyzer_run_ai_outputs, analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE"
    );
  });

  afterAll(async () => {
    await getPool().query("TRUNCATE analyzer_verdict_judgements");
    await getPool().end();
  });

  it("nothing recorded reads as no judgements", async () => {
    expect(await getVerdictJudgements("MSFT")).toEqual(NO_VERDICT_JUDGEMENTS);
  });

  it("append-only: each answer is a new dated row, the latest is in force, and its version counts the answers before it", async () => {
    await recordVerdictJudgement("MSFT", input({ answer: "Low" }));
    await recordVerdictJudgement("MSFT", input({ answer: "not sure" }));
    await recordVerdictJudgement("MSFT", input({ answer: "Medium", note: "AI cloud capex is hard to bound" }));
    await recordVerdictJudgement("COST", input({ answer: "High" }));

    const msft = await getVerdictJudgements("MSFT");
    expect(msft.uncertainty).toMatchObject({ answer: "Medium", version: 3, note: "AI cloud capex is hard to bound" });
    expect(Number.isNaN(Date.parse(msft.uncertainty!.recordedAt))).toBe(false);
    expect((await getVerdictJudgements("COST")).uncertainty).toMatchObject({ answer: "High", version: 1 });

    const { rows } = await getPool().query("SELECT count(*)::int AS n FROM analyzer_verdict_judgements WHERE ticker = 'MSFT'");
    expect(rows[0].n).toBe(3);
  });

  it("\"not sure\" is stored as itself", async () => {
    await recordVerdictJudgement("MSFT", input({ key: "THESIS STATE", answer: "not sure" }));
    expect((await getVerdictJudgements("MSFT")).thesis?.answer).toBe("not sure");
  });

  it("close calls are kept per binding: the latest answer for each set of run inputs", async () => {
    await recordVerdictJudgement("MSFT", input({ key: "CLOSE CALL", answer: "HOLD", boundTo: "inputs-a" }));
    await recordVerdictJudgement("MSFT", input({ key: "CLOSE CALL", answer: "SELL", boundTo: "inputs-a" }));
    await recordVerdictJudgement("MSFT", input({ key: "CLOSE CALL", answer: "HOLD", boundTo: "inputs-b" }));
    const calls = (await getVerdictJudgements("MSFT")).closeCalls;
    expect(calls.map((c) => [c.boundTo, c.answer, c.version])).toEqual([
      ["inputs-a", "SELL", 2],
      ["inputs-b", "HOLD", 1],
    ]);
  });

  it("process items keep their five texts", async () => {
    const items = { thesis: "t", valuation: "v", keyRisks: "k", invalidation: "i", bearCase: "b" };
    await recordVerdictJudgement("MSFT", input({ key: "PROCESS ITEMS", answer: "adopted", items }));
    expect((await getVerdictJudgements("MSFT")).processItems).toMatchObject({ answer: "adopted", items });
  });

  it("refuses an invalid answer before writing, and the table's own CHECK refuses one written around it", async () => {
    await expect(recordVerdictJudgement("MSFT", input({ answer: "Extreme" }))).rejects.toBeInstanceOf(InvalidVerdictJudgementError);
    await expect(
      getPool().query("INSERT INTO analyzer_verdict_judgements (ticker, judgement_key, answer) VALUES ('MSFT', 'UNCERTAINTY LEVEL', 'Extreme')")
    ).rejects.toThrow();
    await expect(
      getPool().query("INSERT INTO analyzer_verdict_judgements (ticker, judgement_key, answer) VALUES ('MSFT', 'CLOSE CALL', 'SELL')")
    ).rejects.toThrow();
    expect(await getVerdictJudgements("MSFT")).toEqual(NO_VERDICT_JUDGEMENTS);
  });

  it("a recorded answer is part of the run's recorded state, so the stored output — and the verdict read from it — carries it", async () => {
    const runId = await createRun("MSFT", "Microsoft Corporation");
    await recordJudgment(runId, "NON-OPERATING INVESTMENTS", "None of these are non-operating", null);
    const state = await loadGateState(runId);
    for (const factId of state.outstandingFactIds) await recordFactDecision(runId, factId, "CONFIRMED", null);
    await recordProfileDecision(runId, "CONFIRMED", "MATURE_PROFITABLE", null);

    const before = await analysisForReport(runId, null);
    expect(before.result.verdictJudgements).toEqual(NO_VERDICT_JUDGEMENTS);

    await recordVerdictJudgement("MSFT", input({ key: "THESIS STATE", answer: "intact" }));
    expect((await getRecordedJudgementState(runId))!.verdictJudgements.thesis?.answer).toBe("intact");

    const after = await analysisForReport(runId, null);
    expect(after.result.verdictJudgements?.thesis?.answer).toBe("intact");
    // A judgement is not an engine input: the inputs fingerprint a close
    // call binds to does not move when one is recorded.
    expect(after.result.runIdentity!.inputsFingerprint).toBe(before.result.runIdentity!.inputsFingerprint);
    // MSFT's recorded sheet is not adopted: still pending adoption.
    expect(deriveVerdict(after.result).state).toBe("PENDING ADOPTION");
  });
});
