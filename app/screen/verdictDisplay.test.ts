import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AnalysisResult } from "@/lib/analyzer/types";

const computeAnalysisForRun = vi.fn();
class FakeSpotCheckIncompleteError extends Error {
  readonly runId: string;
  readonly outstandingFactIds: string[];
  constructor(runId: string, outstandingFactIds: string[]) {
    super("spot-check incomplete");
    this.name = "SpotCheckIncompleteError";
    this.runId = runId;
    this.outstandingFactIds = outstandingFactIds;
  }
}
vi.mock("@/lib/analyzer/gate", () => ({
  computeAnalysisForRun: (...args: unknown[]) => computeAnalysisForRun(...args),
  SpotCheckIncompleteError: FakeSpotCheckIncompleteError,
}));

const deriveVerdict = vi.fn();
vi.mock("@/lib/analyzer/verdict", () => ({
  deriveVerdict: (...args: unknown[]) => deriveVerdict(...args),
}));

const { screenVerdictDisplay, gateIncompleteReason } = await import("./verdictDisplay");

beforeEach(() => {
  computeAnalysisForRun.mockReset();
  deriveVerdict.mockReset();
});

const RUN_ID = "11111111-1111-1111-1111-111111111111";

describe("screenVerdictDisplay — reads the existing run's verdict, never derives one itself", () => {
  it("returns deriveVerdict's status and reason exactly as computed, for a real run", async () => {
    const result = {} as AnalysisResult;
    computeAnalysisForRun.mockResolvedValue(result);
    deriveVerdict.mockReturnValue({ status: "INCOMPLETE", reason: "some existing reason" });

    const display = await screenVerdictDisplay(RUN_ID);

    expect(computeAnalysisForRun).toHaveBeenCalledWith(RUN_ID);
    expect(deriveVerdict).toHaveBeenCalledWith(result);
    expect(display).toEqual({ kind: "verdict", status: "INCOMPLETE", reason: "some existing reason" });
  });

  it("passes through a non-INCOMPLETE status untouched — it is the report's own state, not synthesised here", async () => {
    computeAnalysisForRun.mockResolvedValue({} as AnalysisResult);
    deriveVerdict.mockReturnValue({ status: "BUY", reason: "existing report reason" });

    const display = await screenVerdictDisplay(RUN_ID);
    expect(display).toEqual({ kind: "verdict", status: "BUY", reason: "existing report reason" });
  });

  it("when Step 2's spot-check is itself incomplete, reports gate-incomplete with the outstanding fact ids", async () => {
    computeAnalysisForRun.mockRejectedValue(new FakeSpotCheckIncompleteError(RUN_ID, ["fact-a", "fact-b"]));

    const display = await screenVerdictDisplay(RUN_ID);

    expect(display).toEqual({ kind: "gate-incomplete", outstandingFactIds: ["fact-a", "fact-b"] });
    expect(deriveVerdict).not.toHaveBeenCalled();
  });

  it("re-throws any other error rather than mapping it into a display state", async () => {
    computeAnalysisForRun.mockRejectedValue(new Error("boom"));
    await expect(screenVerdictDisplay(RUN_ID)).rejects.toThrow("boom");
  });
});

describe("gateIncompleteReason — the report page's own INCOMPLETE wording, word for word", () => {
  it("matches app/analyzer/[runId]/page.tsx's IncompleteRun text for one outstanding figure", () => {
    expect(gateIncompleteReason(["revenue"])).toBe(
      "Automatic verification did not reach a decision on 1 acquired figure — revenue. " +
        "No calculation runs on an undecided figure (§2), so this run has no report. Nothing here " +
        "is estimated or filled in."
    );
  });

  it("matches app/analyzer/[runId]/page.tsx's IncompleteRun text for multiple outstanding figures", () => {
    expect(gateIncompleteReason(["revenue", "netIncome"])).toBe(
      "Automatic verification did not reach a decision on 2 acquired figures — revenue, netIncome. " +
        "No calculation runs on an undecided figure (§2), so this run has no report. Nothing here " +
        "is estimated or filled in."
    );
  });
});
