import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getPool } from "@/lib/db";
import { createRun } from "@/lib/analyzer/runStore";
import { GET } from "./route";

// ANALYZER-V2-PREREPORT-01 — the read-only identity lookup the Analyzing
// pre-report state fetches (loading.tsx receives no params from Next, so
// this is how it learns the run's real company identity). Same R7 shape as
// every other run lookup: takes only the run_id the caller already holds,
// returns nothing a client without that id could enumerate.

describe("GET /api/analyzer/runs/[runId]/identity", () => {
  beforeEach(async () => {
    await getPool().query("TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE");
  });

  afterAll(async () => {
    await getPool().end();
  });

  it("returns the run's own ticker and resolved company name", async () => {
    const runId = await createRun("MSFT", "Microsoft Corporation");
    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ runId }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ticker: "MSFT", companyName: "Microsoft Corporation" });
  });

  it("404s for a run that does not exist, rather than guessing an identity", async () => {
    const res = await GET(new Request("http://localhost/x"), {
      params: Promise.resolve({ runId: "11111111-1111-4111-8111-111111111111" }),
    });
    expect(res.status).toBe(404);
  });
});
