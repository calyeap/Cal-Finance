import { describe, it, expect, afterAll, beforeEach, vi } from "vitest";
import { getPool } from "../db";
import { createRun } from "./runStore";
import { loadGateState, RunNotFoundError } from "./gate";
import { draftAssumptionSheet } from "./acquisition/aiProposedBundle";
import { sheetInForce } from "./sheets/sheetStore";
import { resetSheetsToMigrated } from "./sheets/testSupport";

// ---------------------------------------------------------------------------
// CF-LEG2-PINNED-REOPEN-01 (issue #483) — a run must reopen from the inputs
// it was valued on, never through a fresh model call, and fail closed only
// when no inputs exist at all. #483 fixed this for the per-run A5 pin
// (migration 009). CF-AR6-ANY-TICKER-DRAFTS-01 (#454) deletes that pin and
// replaces it with the durable, append-only assumption sheet, so the same
// invariant is held here on the sheet store: protected-evaluator change,
// replaced by its invariant, not loosened.
//
// NVDA is used because it has a committed SEC capture (so an offline run
// acquires) and a sheet only through migration 014's version 1 draft of its
// recorded bundle — no committed fixture of any kind.
// ---------------------------------------------------------------------------

vi.mock("./acquisition/aiProposedBundle", async (importOriginal) => {
  const original = await importOriginal<typeof import("./acquisition/aiProposedBundle")>();
  return { ...original, draftAssumptionSheet: vi.fn(original.draftAssumptionSheet) };
});

describe("loadGateState — a run reopens from its ticker's stored sheet (CF-LEG2-PINNED-REOPEN-01 under AR6)", () => {
  beforeEach(async () => {
    await resetSheetsToMigrated();
    vi.mocked(draftAssumptionSheet).mockClear();
  });

  afterAll(async () => {
    await resetSheetsToMigrated();
    await getPool().end();
  });

  it("opens a run offline from the stored sheet, twice, without drafting", async () => {
    expect(process.env.ANALYZER_OFFLINE).toBe("1");
    expect(await sheetInForce("NVDA")).not.toBeNull();
    const runId = await createRun("NVDA", "NVIDIA Corporation");

    expect((await loadGateState(runId)).run.runId).toBe(runId);
    expect((await loadGateState(runId)).run.runId).toBe(runId);
    expect(draftAssumptionSheet).not.toHaveBeenCalled();
  });

  it("still fails closed for a run whose ticker has no sheet and cannot be drafted", async () => {
    expect(await sheetInForce("ZZZQ")).toBeNull();
    const runId = await createRun("ZZZQ", "No Such Company");

    await expect(loadGateState(runId)).rejects.toBeInstanceOf(RunNotFoundError);
    expect(await sheetInForce("ZZZQ")).toBeNull();
  });
});
