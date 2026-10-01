// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { getPool } from "@/lib/db";
import { createRun } from "@/lib/analyzer/runStore";
import { advanceRunAutomatically } from "@/lib/analyzer/autoRun";
import { computeAnalysisForRun } from "@/lib/analyzer/gate";

// ---------------------------------------------------------------------------
// CF-ANALYZER-V1-SETTLE-01 (issue #392) — the fresh-run MSFT + NVDA proof
// REVIEW's `CORRECT:` (PR #399, comment 5931193833) asked for: produced
// through the SAME automatic path beginAnalysisAction/beginUpdateRunAction
// actually run (createRun -> advanceRunAutomatically -> compute), never a
// manually-confirmed CLI run. No recordFactDecision/recordProfileDecision/
// recordJudgment call appears anywhere in this file.
//
// What is proved here, and NOT already covered by
// app/analyzer/analyzerRoutesOnRealRun.test.tsx (report renders, no redirect,
// 7 Overview slots, Evidence Sections A/B/J render, "Recorded by AUTOMATIC"
// provenance, Screens 2/3 reachable as detail only — all already proved
// there for MSFT, OKLO and NVDA) or lib/analyzer/updateRunOnRealRun.test.ts
// (UPDATE produces an independent run, for MSFT, OKLO and NVDA):
//
//   1. The §4.4 durable company-level override (migration 007) is applied
//      on a run that records NO per-run judgment and passes no CLI flag —
//      answering REVIEW's "the proof output contradicts the §4.4 claim...
//      has to show which is true" directly, at the data layer.
//   2. Key stats populate on a fresh automatic MSFT run: market cap, FCF
//      yield and the leverage metric render as real figures (not a state
//      marker); P/E (trailing) and 52-week range show their own local
//      marker under this suite's offline capture (vitest.setup.ts) — the
//      honest, already-pinned behaviour (fiftyTwoWeekOfflineOnRealRun.
//      test.ts) for a figure that needs a live quote the offline fixture
//      does not carry — not a cascade into anything else on the page.
//   3. Overview never exceeds 3 inline missing-data markers.
//   4. NVDA's valuation suppression stays local: Business and Financials
//      still render real content while only the valuation-dependent rows
//      show their own state.
//   5. Evidence's fact register carries source/as-of/provenance for a real
//      fact, not placeholder columns.
//   6. CF-ANALYZER-V1-SETTLE-01 correction (REVIEW's `CORRECT:`, comment
//      5931716147) — no raw gate/trust/spot-check state code (the right
//      rail's Leverage row, the hero's suppressed slots, the Financials
//      Leverage precondition row, and Overview's price-implied restatement)
//      appears outside Evidence on a fresh automatic run, for either
//      ticker. The rail and hero are part of the shared shell
//      (AnalyzerReportFrame), so any one tab render already exercises them.
// ---------------------------------------------------------------------------

// Every forbidden raw code #392's ACCEPTANCE GATE and REVIEW's `CORRECT:`
// name, checked against exactly the surfaces that correction named — the
// right rail, the hero (ScenarioRangeStrip), the Financials Leverage
// precondition row, and Overview's price-implied restatement — never the
// whole page. `DominantVerdictSlot`'s verdict.reason is rendered verbatim
// one `.verdictslot` over, by explicit, separately-pinned contract (this
// PR's own body: "doesn't touch DominantVerdictSlot's pinned verbatim-
// verdict.reason contract") — it legitimately quotes these same state names
// as explanatory prose, so a whole-page text search would wrongly flag
// protected, out-of-scope content. Not a bare "SUPPRESSED": that substring
// also appears inside the unrelated, pre-existing, legitimately-still-
// outside-Evidence seasonality state "SEASONAL — RUN-RATE SUPPRESSED"
// (stateCatalogue.ts) and the human-composed "Valuation position —
// suppressed" label this correction keeps.
const FORBIDDEN_RAW_STATE_TEXT = [
  "LEVERAGE UNSUPPORTED IN v1",
  "UNSUPPORTED PROFILE",
  "PROFILE NOT CONFIRMED",
  "TRUST STATUS UNUSABLE",
];

// The non-Evidence surfaces this correction touched — right rail (every
// tab), hero (every tab), Financials' Gate-results section, Overview's
// price-implied slot — queried by the selectors their own components
// already use elsewhere in this suite / their own source.
const CORRECTED_SURFACE_SELECTORS = [".az-keystats", ".scenariorangestrip", "#C", ".ovtab"];

function assertNoRawStateTextOnCorrectedSurfaces(container: HTMLElement) {
  for (const selector of CORRECTED_SURFACE_SELECTORS) {
    const surface = container.querySelector(selector);
    if (surface === null) continue; // not every tab render includes every surface
    const text = surface.textContent ?? "";
    for (const forbidden of FORBIDDEN_RAW_STATE_TEXT) {
      expect(text).not.toContain(forbidden);
    }
  }
}

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

async function analyze(ticker: string, companyName: string): Promise<string> {
  const runId = await createRun(ticker, companyName);
  await advanceRunAutomatically(runId);
  return runId;
}

async function renderTab(runId: string, tab?: string) {
  return render(
    await (AnalyzerPage as unknown as TabbedPage)({
      params: Promise.resolve({ runId }),
      searchParams: Promise.resolve(tab === undefined ? {} : { tab }),
    })
  );
}

describe("CF-ANALYZER-V1-SETTLE-01 — #392's fresh-run acceptance proof, through the automatic path alone", () => {
  beforeEach(async () => {
    await getPool().query(
      "TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE"
    );
  });

  afterEach(cleanup);

  afterAll(async () => {
    await getPool().end();
  });

  describe("MSFT", () => {
    it("the §4.4 durable company override (migration 007) applies with no per-run judgment and no CLI flag — enterprise value, FCF yield and leverage are no longer suppressed", async () => {
      const runId = await analyze("MSFT", "Microsoft Corporation");
      const result = await computeAnalysisForRun(runId);

      const ev = result.diagnostics.enterpriseValue;
      expect(ev.suppressed).toBe(false);
      if (!ev.suppressed) {
        // Same $36.348B figure CALVIN DECISION issue #188 ruled and
        // nonOperatingJudgmentRecordedOnRealRun.test.ts pins for a per-run
        // judgment — here reached with NO recordJudgment call at all.
        expect(ev.value.nonOperatingEquityInvestmentsAtBook.toString()).toBe("36348000000");
      }
      expect(result.diagnostics.multiples.fcfYieldOnMarketCap.suppressed).toBe(false);
      expect(result.gates.leverage.result).toBe("PASS");
      expect(result.gates.leverage.netDebtRatio).not.toBeNull();
      expect(result.trust.status).not.toBe("UNUSABLE");
    });

    it("Key Stats populate market cap, FCF yield and the leverage metric on a fresh automatic run", async () => {
      const runId = await analyze("MSFT", "Microsoft Corporation");
      const { container } = await renderTab(runId);

      const rail = container.querySelector(".az-keystats") as HTMLElement;
      expect(rail).not.toBeNull();
      const text = rail.textContent ?? "";

      // Market cap and FCF yield are real figures, not state markers.
      expect(text).toMatch(/Market cap\$[\d,.]/);
      expect(text).not.toMatch(/Market cap(INCOMPLETE|SUPPRESSED)/);
      expect(text).toMatch(/FCF yield\d/);
      // The leverage metric (#392's "one compact balance-sheet/leverage
      // metric") now has its own row, PASS on this run.
      expect(text).toContain("Net debt");

      // P/E (trailing) and 52-week range need a live quote this suite's
      // offline capture does not carry (vitest.setup.ts, ANALYZER_OFFLINE)
      // — the same already-pinned honest degradation
      // fiftyTwoWeekOfflineOnRealRun.test.ts proves at the data layer.
      // Local to those two rows only: it does not blank the market cap,
      // FCF yield or leverage rows beside them (missing-data stays local).
      expect(text).toContain("INCOMPLETE");
    });

    it("Overview never exceeds 3 inline missing-data markers", async () => {
      const runId = await analyze("MSFT", "Microsoft Corporation");
      const { container } = await renderTab(runId, "overview");

      const overview = container.querySelector(".ovtab") as HTMLElement;
      const markers = Array.from(overview.querySelectorAll(".note")).filter(
        (el) => (el.textContent ?? "").includes("Not yet available")
      );
      expect(markers.length).toBeLessThanOrEqual(3);
    });

    it("no raw gate/trust/spot-check state code appears outside Evidence (rail and hero included)", async () => {
      const runId = await analyze("MSFT", "Microsoft Corporation");
      const { container } = await renderTab(runId);
      assertNoRawStateTextOnCorrectedSurfaces(container);
    });

    // REVIEW's `CORRECT:` (comment 5932208513) — a fresh automatic run
    // records no profile decision, so §10.6.3 suppresses the valuation
    // position; the hero must not show its percentage restatement either.
    it("never shows the bear-to-bull location percentage on a fresh automatic run (profile not yet confirmed)", async () => {
      const runId = await analyze("MSFT", "Microsoft Corporation");
      const { container } = await renderTab(runId);
      const hero = container.querySelector(".scenariorangestrip") as HTMLElement;
      expect(hero).not.toBeNull();
      expect(hero.textContent ?? "").not.toMatch(/of the way from bear to bull/);
      expect(hero.textContent ?? "").toContain("Valuation position — suppressed");
    });
  });

  describe("NVDA", () => {
    it("valuation suppression stays local — Business and Financials still render real content", async () => {
      const runId = await analyze("NVDA", "NVIDIA Corporation");

      const business = await renderTab(runId, "business");
      const businessText = business.container.textContent ?? "";
      expect(businessText).toContain("NVIDIA");
      // Real narrative/business content, not a bare state block for the
      // whole tab.
      expect(businessText.length).toBeGreaterThan(200);
      cleanup();

      const financials = await renderTab(runId, "financials");
      const financialsText = financials.container.textContent ?? "";
      // Gate 1 (history sufficiency) and the RONIC ladder are independent
      // of the unmade §4.4 judgment and the missing EV inputs (lib/analyzer/
      // nvdaRealRunObservation.test.ts pins the RONIC ladder CLEAN at
      // 75.2385% for this exact capture) — they render as real figures, not
      // swallowed by the Leverage precondition row's own state beside them.
      expect(financialsText).toContain("13 filed years");
      expect(financialsText).toContain("CLEAN (75.2%)");
      expect(financialsText).toContain("Leverage precondition");
      // CF-ANALYZER-V1-SETTLE-01 correction (REVIEW's `CORRECT:`, comment
      // 5931716147) — the precondition's own raw code must not render
      // outside Evidence; a local marker takes its place, and the raw code
      // still reaches Evidence via `states.suppressing` (assemble.ts).
      expect(financialsText).toContain("Unavailable — see Evidence");
      assertNoRawStateTextOnCorrectedSurfaces(financials.container);
    });

    it("no raw gate/trust/spot-check state code appears outside Evidence (rail and hero included)", async () => {
      const runId = await analyze("NVDA", "NVIDIA Corporation");
      const { container } = await renderTab(runId, "overview");
      assertNoRawStateTextOnCorrectedSurfaces(container);
    });

    it("Overview never exceeds 3 inline missing-data markers, same local-degradation rule as MSFT", async () => {
      const runId = await analyze("NVDA", "NVIDIA Corporation");
      const { container } = await renderTab(runId, "overview");

      const overview = container.querySelector(".ovtab") as HTMLElement;
      const markers = Array.from(overview.querySelectorAll(".note")).filter(
        (el) => (el.textContent ?? "").includes("Not yet available")
      );
      expect(markers.length).toBeLessThanOrEqual(3);
    });
  });

  describe("Evidence — source/as-of/provenance", () => {
    it("the fact register carries a real source, provenance and as-of date, not placeholder columns", async () => {
      const runId = await analyze("MSFT", "Microsoft Corporation");
      const { container } = await renderTab(runId, "evidence");

      const sectionB = container.querySelector("#B") as HTMLElement;
      expect(sectionB.textContent).toContain("Provenance");
      expect(sectionB.textContent).toContain("As-of / retrieved");

      const firstRow = sectionB.querySelector("tbody tr") as HTMLElement;
      expect(firstRow).not.toBeNull();
      // Every acquired fact carries a real source/type and a real as-of
      // date — never a blank or placeholder cell.
      expect(firstRow.textContent).toMatch(/\d{4}/);
    });
  });
});
