import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "../../db";
import { recordCompanyJudgment, getRecordedCompanyJudgment } from "./recordedJudgments";

// ---------------------------------------------------------------------------
// CF-ANALYZER-FINAL-CLOSEOUT-01 (issue #383) — the store behind a §4.4
// judgment recorded once per ticker, read by lib/analyzer/autoRun.ts to
// carry a human's earlier decision onto a fresh run of the same company.
// migrations/007_recorded_nonoperating_judgment.sql carries the full
// authority.
// ---------------------------------------------------------------------------

describe("recordedJudgments", () => {
  beforeEach(async () => {
    await getPool().query("DELETE FROM analyzer_recorded_judgments WHERE ticker = 'ZZZZ'");
  });

  afterAll(async () => {
    await getPool().query("DELETE FROM analyzer_recorded_judgments WHERE ticker = 'ZZZZ'");
    await getPool().end();
  });

  it("returns null where nothing has been recorded", async () => {
    expect(await getRecordedCompanyJudgment("ZZZZ", "NON-OPERATING INVESTMENTS")).toBeNull();
  });

  it("round-trips a recorded selection and reason", async () => {
    await recordCompanyJudgment("ZZZZ", "NON-OPERATING INVESTMENTS", "us-gaap:LongTermInvestments", "test reason");

    const recorded = await getRecordedCompanyJudgment("ZZZZ", "NON-OPERATING INVESTMENTS");
    expect(recorded?.selection).toBe("us-gaap:LongTermInvestments");
    expect(recorded?.reason).toBe("test reason");
  });

  it("normalizes the ticker's case, matching every other per-ticker resolver in this codebase", async () => {
    await recordCompanyJudgment("zzzz", "NON-OPERATING INVESTMENTS", "None of these are non-operating", null);

    expect((await getRecordedCompanyJudgment("ZZZZ", "NON-OPERATING INVESTMENTS"))?.selection).toBe(
      "None of these are non-operating"
    );
  });

  it("the most recent recording wins — last decision wins, same as recordAnalystBundle", async () => {
    await recordCompanyJudgment("ZZZZ", "NON-OPERATING INVESTMENTS", "us-gaap:LongTermInvestments", "first");
    await recordCompanyJudgment("ZZZZ", "NON-OPERATING INVESTMENTS", "None of these are non-operating", "second");

    const recorded = await getRecordedCompanyJudgment("ZZZZ", "NON-OPERATING INVESTMENTS");
    expect(recorded?.selection).toBe("None of these are non-operating");
    expect(recorded?.reason).toBe("second");
  });

  it("keys independently by judgment key — recording one does not touch another", async () => {
    await recordCompanyJudgment("ZZZZ", "NON-OPERATING INVESTMENTS", "us-gaap:LongTermInvestments", null);

    expect(await getRecordedCompanyJudgment("ZZZZ", "MEDIAN-MARGIN NOPAT WINDOW")).toBeNull();
  });

  it("refuses an empty selection, the same rule runStore.recordJudgment's caller already enforces", async () => {
    await expect(recordCompanyJudgment("ZZZZ", "NON-OPERATING INVESTMENTS", "  ", null)).rejects.toThrow();
  });
});
