import { NextResponse } from "next/server";
import { getRun } from "@/lib/analyzer/runStore";

// Read-only identity lookup for the Analyzing pre-report state
// (ANALYZER-V2-PREREPORT-01).
//
// [runId]/loading.tsx is a Next.js route convention that is always
// instantiated with an empty props object (create-component-tree.js), so it
// has no way to read the segment's own runId directly. A client-side fetch
// keyed off the runId already in the URL is what lets it show the run's real
// company identity instead of inventing or guessing one.
//
// Same R7 shape as every other run lookup in this codebase (runStore.ts,
// snapshotStore.ts): takes only the run_id the caller already holds, adds no
// listing surface, and returns nothing beyond the two fields Home already
// showed the analyst on the previous screen.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const run = await getRun(runId);
  if (run === null) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({
    ticker: run.ticker,
    companyName: run.resolvedCompanyName,
  });
}
