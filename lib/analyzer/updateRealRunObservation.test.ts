import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../db";
import { createRun, getRun, getFactDecisions } from "./runStore";
import { computeAnalysisForRun } from "./gate";
import { advanceRunAutomatically } from "./autoRun";
import { deriveVerdict } from "./verdict";
import type { AnalysisResult } from "./types";

// ---------------------------------------------------------------------------
// CF-UPDATE-REALRUN-PROOF-01 (issue #345) — the observation
// docs/update-realrun-observation.md reports.
//
// Extends lib/analyzer/updateRunOnRealRun.test.ts rather than restating it:
// that file already proves, structurally, that a re-look gets its own
// distinct database runId, that the prior run's row/report stay untouched,
// that no fact or judgment is copied forward, and that the new run is gated
// shut until its own automatic pass completes it. None of those four
// assertions is repeated here.
//
// What this file adds is the figure-for-figure comparison the document
// reports: what the re-look's own AnalysisResult reads against the first
// run's, at the same head, against the real store and the real committed
// MSFT/OKLO captures (ANALYZER_OFFLINE=1, vitest.setup.ts). It drives both
// runs the same way beginUpdateRunAction's own post-identity body does
// (createRun -> advanceRunAutomatically -> computeAnalysisForRun,
// app/actions/analyzer.ts's shared commitAndRunAnalysis), taking the
// re-look's identity from the prior run's own stored ticker via getRun —
// never a client-posted value — exactly as beginUpdateRunAction does. The
// identity-resolution half of that action (resolveAnalyzerIdentity, a
// network call this offline suite does not exercise) is proved separately,
// as a mocked unit test, in app/actions/analyzer.test.ts — not driven here.
// ---------------------------------------------------------------------------

interface Observed {
  runId: string;
  result: AnalysisResult;
  verdict: ReturnType<typeof deriveVerdict>;
}

async function openObservedRun(ticker: string, companyName: string): Promise<Observed> {
  const runId = await createRun(ticker, companyName);
  await advanceRunAutomatically(runId);
  const result = await computeAnalysisForRun(runId);
  return { runId, result, verdict: deriveVerdict(result) };
}

describe("CF-UPDATE-REALRUN-PROOF-01 — the re-look's report against the first run's, at the same head", () => {
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
      expectedAnalysisResultRunId: "acquired-msft",
      expectedPriceValue: "499.7",
      expectedPriceTimestamp: "2026-09-04",
      expectedEnterpriseValueCause: "missing REQUIRED input(s): nonOperatingEquityInvestmentsAtBook",
      expectedFactIds: ["current-operating-margin", "price"],
    },
    {
      ticker: "OKLO",
      companyName: "Oklo Inc.",
      expectedAnalysisResultRunId: "acquired-oklo",
      expectedPriceValue: "41.27",
      expectedPriceTimestamp: "2026-09-04",
      expectedEnterpriseValueCause:
        "missing REQUIRED input(s): treasuryMethodDilution, nonOperatingEquityInvestmentsAtBook",
      expectedFactIds: ["price"],
    },
  ])(
    "$ticker",
    ({
      ticker,
      companyName,
      expectedAnalysisResultRunId,
      expectedPriceValue,
      expectedPriceTimestamp,
      expectedEnterpriseValueCause,
      expectedFactIds,
    }) => {
      it("the re-look's own AnalysisResult is byte-identical to the first run's, field for field — zero cells differ", async () => {
        const first = await openObservedRun(ticker, companyName);

        // The re-look, driven exactly as beginUpdateRunAction's post-identity
        // body drives it: identity taken ONLY from the prior run's own
        // stored ticker (getRun), never a literal repeated here.
        const priorRun = await getRun(first.runId);
        expect(priorRun).not.toBeNull();
        const relook = await openObservedRun(priorRun!.ticker, companyName);

        // The two runs are genuinely distinct at the database level (proved
        // structurally by updateRunOnRealRun.test.ts; not re-asserted here).
        expect(relook.runId).not.toBe(first.runId);

        // Every figure the document quotes, off the run's own output: the
        // computed report itself is identical in every field.
        expect(relook.result).toEqual(first.result);
        expect(relook.verdict).toEqual(first.verdict);
      });

      it("AnalysisResult.runId is a ticker-scoped constant, not the database run's own id — identical on both runs, unlike the database runId itself", async () => {
        // lib/analyzer/acquisition/companyInputs.ts:342 sets
        // AnalysisResult.runId to `acquired-${ticker.toLowerCase()}` for an
        // acquired real run — a value derived only from the ticker, not from
        // the createRun-issued database uuid. Reported here because the
        // issue's own SCOPE text names "runId" as an example of a cell that
        // could differ between the first run and a re-look; on this pipeline
        // it does not, and the reason is this field's own source, not
        // anything re-look-specific. Not a defect this outcome diagnoses or
        // fixes (HARD BOUNDS: observe only).
        const first = await openObservedRun(ticker, companyName);
        const priorRun = await getRun(first.runId);
        const relook = await openObservedRun(priorRun!.ticker, companyName);

        expect(first.result.runId).toBe(expectedAnalysisResultRunId);
        expect(relook.result.runId).toBe(expectedAnalysisResultRunId);
        expect(relook.result.runId).toBe(first.result.runId);
        expect(relook.runId).not.toBe(first.runId);
      });

      it("the verdict, price and the enterprise-value cause quoted in the document, asserted directly off this run's own output", async () => {
        const { result, verdict } = await openObservedRun(ticker, companyName);

        expect(result.price.value.toString()).toBe(expectedPriceValue);
        expect(result.price.timestamp).toBe(expectedPriceTimestamp);

        expect(verdict.status).toBe("INCOMPLETE");
        expect(verdict.reason).toContain("LEVERAGE UNSUPPORTED IN v1");
        expect(result.trust.status).toBe("UNUSABLE");
        expect(result.gates.leverage.result).toBe("LEVERAGE UNSUPPORTED IN v1");
        expect(result.fairValueRange.kind).toBe("suppressed");

        const ev = result.diagnostics.enterpriseValue;
        expect(ev.suppressed).toBe(true);
        if (ev.suppressed) expect(ev.cause).toBe(expectedEnterpriseValueCause);
      });

      it("both the first run and the re-look decide their own queue automatically, with no fact left undecided", async () => {
        const first = await openObservedRun(ticker, companyName);
        const priorRun = await getRun(first.runId);
        const relook = await openObservedRun(priorRun!.ticker, companyName);

        for (const observed of [first, relook]) {
          const decisions = await getFactDecisions(observed.runId);
          expect(decisions.map((d) => d.factId).sort()).toEqual([...expectedFactIds].sort());
          expect(decisions.every((d) => d.origin === "AUTOMATIC")).toBe(true);
        }
      });
    }
  );
});
