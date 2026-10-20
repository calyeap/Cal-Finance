// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { getPool } from "@/lib/db";
import { createRun, listRecentRuns } from "@/lib/analyzer/runStore";
import { RecentAnalyses } from "./RecentAnalyses";

// CF-AR7-REPORT-CONTENT-01 — Analyzer Home's recent-analyses list
// (product-decisions item 31 / D6): newest first, each run linked, each
// naming its latest "Save this version" record where one exists, in words.

async function save(runId: string, version: number, status: string, state: string | null): Promise<void> {
  await getPool().query(
    `INSERT INTO analyzer_run_snapshots
       (run_id, version, schema_version, analysis_result, ai_layer_status, verdict_status, verdict_reason, verdict_state)
     VALUES ($1, $2, '1', '{}'::jsonb, 'NOT CONFIGURED', $3, 'test', $4)`,
    [runId, version, status, state]
  );
}

describe("CF-AR7-REPORT-CONTENT-01 — recent analyses on Analyzer Home", () => {
  beforeEach(async () => {
    await getPool().query("TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE");
  });

  afterEach(cleanup);

  afterAll(async () => {
    await getPool().end();
  });

  it("lists runs newest first, each with its latest saved version", async () => {
    const older = await createRun("NVDA", "NVIDIA Corporation");
    await getPool().query("UPDATE analyzer_runs SET created_at = now() - interval '1 day' WHERE run_id = $1", [older]);
    const newer = await createRun("MSFT", "Microsoft Corporation");
    await save(newer, 1, "INCOMPLETE", "PENDING ADOPTION");
    await save(newer, 2, "SELL", null);

    const runs = await listRecentRuns();
    expect(runs.map((r) => r.runId)).toEqual([newer, older]);
    expect(runs[0].latestSave?.version).toBe(2);
    expect(runs[0].latestSave?.verdictStatus).toBe("SELL");
    expect(runs[1].latestSave).toBeNull();
  });

  it("renders a compact list linking each run, with saved outcomes in words, never a raw state code", async () => {
    const pending = await createRun("MSFT", "Microsoft Corporation");
    await save(pending, 1, "INCOMPLETE", "PENDING ADOPTION");

    const { container } = render(<RecentAnalyses runs={await listRecentRuns()} />);
    const link = container.querySelector(`a[href="/analyzer/${pending}"]`);
    expect(link?.textContent).toContain("Microsoft Corporation");
    expect(container.textContent).toContain("Saved version 1");
    expect(container.textContent).toContain("pending adoption");
    expect(container.textContent).not.toContain("INCOMPLETE");
  });

  it("renders nothing when no run exists", async () => {
    const { container } = render(<RecentAnalyses runs={await listRecentRuns()} />);
    expect(container.textContent).toBe("");
  });

  it("respects its limit", async () => {
    for (let i = 0; i < 3; i++) await createRun("MSFT", "Microsoft Corporation");
    expect(await listRecentRuns(2)).toHaveLength(2);
  });
});
