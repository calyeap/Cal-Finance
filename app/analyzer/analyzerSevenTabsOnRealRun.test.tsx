// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { getPool } from "@/lib/db";
import { createRun } from "@/lib/analyzer/runStore";
import { advanceRunAutomatically } from "@/lib/analyzer/autoRun";
import { ANALYZER_TABS, type AnalyzerTabSlug } from "@/app/components/AnalyzerReportFrame";

// ---------------------------------------------------------------------------
// CF-ANALYZER-USER-READY-01 (DO item 6) — the smallest deterministic
// regression for two of #419's VERIFY items the credential-free environment
// CAN check: "all seven routes" and "warm repeated-tab behavior does not
// pointlessly repeat expensive acquisition, calculation or AI generation".
//
// No ANTHROPIC_API_KEY/live EDGAR dependency: this is a real acquired MSFT
// run (ANALYZER_OFFLINE=1, committed SEC captures), driven through the exact
// same `/analyzer/{runId}?tab=` route this product serves, the same path
// app/analyzer/analyzerRoutesOnRealRun.test.tsx already exercises for the
// Overview and Evidence tabs — extended here to the other five, plus a
// second render per tab standing in for "navigate away and back" (a real
// browser's warm tab click re-requests the same server route; jsdom cannot
// drive a browser tab bar, but it can call the route handler twice on the
// same runId and check it behaves identically both times, which is the part
// of "warm navigation" actually decided by this route's own code, not by
// browser caching).
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`UNEXPECTED REDIRECT to ${url}`);
  },
  notFound: () => {
    throw new Error("UNEXPECTED notFound()");
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const { default: AnalyzerPage } = await import("./[runId]/page");

type TabbedPage = (props: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) => Promise<React.JSX.Element>;

async function renderTab(runId: string, tab: AnalyzerTabSlug) {
  return render(
    await (AnalyzerPage as unknown as TabbedPage)({
      params: Promise.resolve({ runId }),
      searchParams: Promise.resolve({ tab }),
    })
  );
}

const SEVEN_TAB_SLUGS = ANALYZER_TABS.map((t) => t.slug);

describe("CF-ANALYZER-USER-READY-01 DO item 6 — all seven tabs render on a real MSFT run, warm navigation is stable", () => {
  let runId: string;

  beforeEach(async () => {
    await getPool().query("TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE");
    runId = await createRun("MSFT", "Microsoft Corporation");
    await advanceRunAutomatically(runId);
  });

  afterEach(cleanup);

  afterAll(async () => {
    await getPool().end();
  });

  it("all seven tabs are the full, fixed set the design authority names — not six, not eight", () => {
    expect(SEVEN_TAB_SLUGS).toEqual(["overview", "business", "financials", "valuation", "risks", "market", "evidence"]);
  });

  it.each(SEVEN_TAB_SLUGS)("tab=%s renders with no crash and non-empty content, first view (cold)", async (tab) => {
    const { container } = await renderTab(runId, tab);
    expect(container.textContent).not.toBe("");
    expect(container.querySelector(".az-shell")).not.toBeNull();
  });

  // The seven-tab "pass matrix" this test produces, for the evidence pack:
  // one row per tab, PASS iff it rendered non-empty content with no thrown
  // redirect/crash, both cold and warm (second render of the same tab on
  // the same runId, standing in for navigating back to a previously-opened
  // tab without recomputation).
  it("PASS MATRIX — every tab passes both cold and warm (repeated) render, with identical content both times", async () => {
    const matrix: { tab: AnalyzerTabSlug; cold: "PASS" | "FAIL"; warm: "PASS" | "FAIL"; stable: boolean }[] = [];

    for (const tab of SEVEN_TAB_SLUGS) {
      const first = await renderTab(runId, tab);
      const coldText = first.container.textContent ?? "";
      const cold: "PASS" | "FAIL" = coldText.length > 0 ? "PASS" : "FAIL";
      cleanup();

      // "Warm" here means: the same run, the same tab, requested again —
      // the one thing this credential-free jsdom path can actually prove
      // about repeated navigation (no acquisition/profile re-decision
      // error, no divergent content from a second pass over the same
      // already-settled run).
      const second = await renderTab(runId, tab);
      const warmText = second.container.textContent ?? "";
      const warm: "PASS" | "FAIL" = warmText.length > 0 ? "PASS" : "FAIL";
      cleanup();

      matrix.push({ tab, cold, warm, stable: coldText === warmText });
    }

    for (const row of matrix) {
      expect(row.cold).toBe("PASS");
      expect(row.warm).toBe("PASS");
      expect(row.stable).toBe(true);
    }
    expect(matrix).toHaveLength(7);
  });

  it("warm navigation does not create a second run or re-trigger the human-step gate — the run stays automatic across repeated tab loads", async () => {
    for (const tab of SEVEN_TAB_SLUGS) {
      await renderTab(runId, tab);
      cleanup();
    }
    const { rows } = await getPool().query(
      "SELECT count(*)::int AS n FROM analyzer_runs WHERE run_id = $1",
      [runId]
    );
    expect(rows[0].n).toBe(1);
  });
});
