// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, cleanup } from "@testing-library/react";
import { getPool } from "@/lib/db";
import { createRun } from "@/lib/analyzer/runStore";
import { advanceRunAutomatically } from "@/lib/analyzer/autoRun";
import { appendSheet } from "@/lib/analyzer/sheets/sheetStore";
import { resetSheetsToMigrated } from "@/lib/analyzer/sheets/testSupport";
import { readingSurfaceViolations } from "@/lib/analyzer/overviewCopy";
import { deterministicReport } from "@/lib/analyzer/reportAnalysis";
import type { SheetContent } from "@/lib/analyzer/sheets/sheet";

// ---------------------------------------------------------------------------
// CF-AR7-REPORT-CONTENT-01 (issue #456) — the AR7 report content on a real
// MSFT run (ANALYZER_OFFLINE=1, committed SEC captures), valued on the real
// price-blind draft sheet Calvin reviewed in the AR7 prototype
// (docs/evidence/ar7-prototype/msft-run.json, #455). Driven through the
// report route exactly as the product serves it.
//
// Two evaluators the issue's VERIFY names:
//   1. Forbidden text: no raw state code, check outcome code, module id or
//      unformatted machine number on any reading tab (closed issue #418's
//      tab-level findings). Evidence is the diagnostics tab and is exempt; a
//      closed "Show the diagnostic state name" disclosure is opt-in
//      diagnostics, not reading text.
//   2. Every number links to its source: filed figures to their SEC filing,
//      drivers to the sources they cite (each of which is on the Evidence
//      ledger), and each Quick Read figure to the section that computes it.
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

async function renderTab(runId: string, tab: string) {
  return render(
    await (AnalyzerPage as unknown as TabbedPage)({
      params: Promise.resolve({ runId }),
      searchParams: Promise.resolve({ tab }),
    })
  );
}

/** The tab body's reading text: closed disclosures keep only their summary. */
function readingText(container: HTMLElement): string {
  const body = container.querySelector(".az-tabbody");
  if (body === null) throw new Error("no tab body rendered");
  const copy = body.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("details:not([open])").forEach((d) => {
    Array.from(d.children).forEach((child) => {
      if (child.tagName !== "SUMMARY") child.remove();
    });
  });
  return copy.textContent ?? "";
}

const PROTOTYPE_RUN = JSON.parse(
  readFileSync(join(process.cwd(), "docs", "evidence", "ar7-prototype", "msft-run.json"), "utf8")
) as { sheet: { content: SheetContent } };
const SHEET = PROTOTYPE_RUN.sheet.content;

describe("CF-AR7-REPORT-CONTENT-01 — AR7 report content on a real MSFT run", () => {
  let runId: string;

  beforeAll(async () => {
    await getPool().query("TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE");
    await resetSheetsToMigrated();
    await appendSheet({ ticker: "MSFT", status: "DRAFT", origin: "AI DRAFT", content: SHEET, model: "claude-opus-5" });
    runId = await createRun("MSFT", "Microsoft Corporation");
    await advanceRunAutomatically(runId);
  });

  afterEach(cleanup);

  afterAll(async () => {
    await resetSheetsToMigrated();
    await getPool().end();
  });

  it.each(["overview", "business", "financials", "valuation", "risks", "market"])(
    "the %s tab's reading text carries no forbidden text",
    async (tab) => {
      const { container } = await renderTab(runId, tab);
      const text = readingText(container);
      expect(text.length).toBeGreaterThan(200);
      expect(readingSurfaceViolations(text)).toEqual([]);
    }
  );

  it("the Overview leads with the seven Quick Read items, each linked to the section that computes it", async () => {
    const { container } = await renderTab(runId, "overview");
    const items = Array.from(container.querySelectorAll(".rc-qr .rc-item"));
    expect(items.map((i) => i.querySelector("h3")?.textContent)).toEqual([
      "What today's price assumes",
      "If our Base case happens",
      "Why this verdict",
      "Business quality",
      "Strongest argument against",
      "Top risks",
      "What would change it",
    ]);
    for (const item of items) {
      const link = item.querySelector("a.rc-source");
      expect(link, item.querySelector("h3")?.textContent ?? "").not.toBeNull();
      expect(link!.getAttribute("href")).toMatch(new RegExp(`^/analyzer/${runId}\\?tab=[a-z]+#`));
    }
    // The verdict check's nine points, as the grid.
    expect(container.querySelectorAll(".rc-grid tbody td.rc-zone")).toHaveLength(9);
  });

  it("every filed figure on the Financials statements links to the SEC filing it was read from", async () => {
    const { container } = await renderTab(runId, "financials");
    const cells = Array.from(container.querySelectorAll(".rc-statements tbody tr:not(.rc-derived) td")).filter((td) =>
      td.textContent!.startsWith("$")
    );
    expect(cells.length).toBeGreaterThanOrEqual(50);
    for (const td of cells) {
      expect(td.querySelector("a")?.getAttribute("href") ?? "", td.textContent!).toMatch(
        /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/789019\/\d{18}\/\d{10}-\d{2}-\d{6}-index\.htm$/
      );
    }
  });

  it("the statements' latest revenue is the same filed figure the achieved-growth comparator reads", async () => {
    const { result } = await deterministicReport(runId);
    const years = result.financialHistory!.years;
    const latest = years[years.length - 1];
    const cagr = result.achievedRevenueCagr.value!;
    expect(latest.fiscalYear).toBe(cagr.window.toFiscalYear);
    expect(latest.lines.revenue!.value.toString()).toBe(cagr.toValue.toString());
  });

  it("every driver on the Valuation sheet cites a source that is on the Evidence ledger", async () => {
    const valuation = await renderTab(runId, "valuation");
    const anchors = Array.from(valuation.container.querySelectorAll(".rc-sheet .rc-anchor"));
    expect(anchors).toHaveLength(15);
    const cited = new Set<string>();
    for (const anchor of anchors) {
      const links = Array.from(anchor.querySelectorAll(".rc-cites a"));
      expect(links.length, anchor.textContent ?? "").toBeGreaterThan(0);
      for (const a of links) {
        const href = a.getAttribute("href")!;
        expect(href.startsWith(`/analyzer/${runId}?tab=evidence#src-`)).toBe(true);
        cited.add(decodeURIComponent(href.split("#src-")[1]));
      }
    }
    cleanup();

    const evidence = await renderTab(runId, "evidence");
    for (const id of cited) {
      const row = evidence.container.querySelector(`tr[id="src-${id}"]`);
      expect(row, id).not.toBeNull();
      // Every ledger row a driver cites links on to its filing, or to the statements for a filed series.
      expect(row!.querySelector("a"), id).not.toBeNull();
    }
  });

  it("the Business tab shows the filing research the drivers cite", async () => {
    const { container } = await renderTab(runId, "business");
    const ids = Array.from(container.querySelectorAll("#research .rc-card")).map((c) => c.id);
    const expected = (SHEET.sources ?? [])
      .filter((s) => s.kind === "FILING TEXT" || s.kind === "EARNINGS RELEASE")
      .map((s) => `research-${s.id}`);
    expect(expected.length).toBeGreaterThan(0);
    expect(ids).toEqual(expected);
  });

  it("the Risks & Thesis tab shows the three cases as written", async () => {
    const { container } = await renderTab(runId, "risks");
    const text = container.querySelector("#scenario-stories")?.textContent ?? "";
    for (const key of ["bear", "base", "bull"] as const) {
      expect(text).toContain(SHEET.scenarios[key].writtenAnchor.slice(0, 80));
    }
  });
});
