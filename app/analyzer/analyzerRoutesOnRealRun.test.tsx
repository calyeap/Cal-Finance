// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { getPool } from "@/lib/db";
import {
  createRun,
  getFactDecisions,
  getRun,
  recordProfileDecision,
} from "@/lib/analyzer/runStore";
import { loadGateState } from "@/lib/analyzer/gate";
import { advanceRunAutomatically } from "@/lib/analyzer/autoRun";

// ---------------------------------------------------------------------------
// CF-ANALYZER-AUTORUN-01 — the four Analyzer routes, on a real acquired run.
//
// AUTHORITY. Calvin's CALVIN RULING, 22 September 2026 04:28:04Z: "V1
// acceptance target: enter ticker → analyze → report. No mandatory human
// interaction after ticker entry in the normal flow ... Technical
// acquisition/validation detail should remain available optionally under
// Sources / Details, but must not sit in the normal path."
//
// WHAT MAKES "NO REDIRECT" PROVABLE HERE. `next/navigation`'s `redirect` and
// `notFound` are mocked to throw. A route that still sent the analyst to
// Screen 2 or Screen 3 would fail these tests by throwing rather than by
// rendering something subtly different — which is the only way to assert the
// absence of a navigation from inside a server component.
//
// Facts are the committed SEC captures (ANALYZER_OFFLINE=1). No network, no
// new capture, no third company.
// ---------------------------------------------------------------------------

class UnexpectedRedirect extends Error {
  constructor(url: string) {
    super(`UNEXPECTED REDIRECT to ${url} — the normal path must not route to a human step`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new UnexpectedRedirect(url);
  },
  notFound: () => {
    throw new Error("UNEXPECTED notFound()");
  },
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const { default: AnalyzerPage } = await import("./[runId]/page");
const { default: LegacyReportRedirect } = await import("./[runId]/report/page");
const { default: FactsPage } = await import("./[runId]/facts/page");
const { default: ProfilePage } = await import("./[runId]/profile/page");

type Page = (props: { params: Promise<{ runId: string }> }) => Promise<React.JSX.Element>;
type TabbedPage = (props: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) => Promise<React.JSX.Element>;

async function renderRoute(page: Page, runId: string) {
  return render(await page({ params: Promise.resolve({ runId }) }));
}

/**
 * CF-DESIGN-AUTHORITY-CUTOVER-01 — the unified `/analyzer/{runId}` shell
 * renders every report tab off `?tab=`, replacing the old separate Overview
 * and Full Analysis routes (design authority doc: "one shell, seven tabs").
 * `tab` omitted renders Overview, the route's own default.
 */
async function renderTab(runId: string, tab?: string) {
  return render(
    await (AnalyzerPage as unknown as TabbedPage)({
      params: Promise.resolve({ runId }),
      searchParams: Promise.resolve(tab === undefined ? {} : { tab }),
    })
  );
}

/** createRun + advanceRunAutomatically — what beginAnalysisAction does. */
async function analyze(ticker: string, companyName: string): Promise<string> {
  const runId = await createRun(ticker, companyName);
  await advanceRunAutomatically(runId);
  return runId;
}

describe("CF-ANALYZER-AUTORUN-01 — the Analyzer routes on a real automatic run", () => {
  beforeEach(async () => {
    await getPool().query(
      "TRUNCATE analyzer_run_fact_decisions, analyzer_run_judgments, analyzer_runs CASCADE"
    );
  });

  afterEach(cleanup);

  afterAll(async () => {
    await getPool().end();
  });

  describe.each([
    { ticker: "MSFT", companyName: "Microsoft Corporation", queuedFactName: "Price" },
    { ticker: "OKLO", companyName: "Oklo Inc.", queuedFactName: "Price" },
  ])("$ticker", ({ ticker, companyName, queuedFactName }) => {
    it("Overview renders a report from the run alone, with no redirect to Screen 2 or Screen 3", async () => {
      const runId = await analyze(ticker, companyName);
      const { container } = await renderTab(runId);

      // The shared hero is #118's most prominent element, and both real
      // runs land on INCOMPLETE — the honest, unchanged upstream state.
      const hero = container.querySelector(".az-hero-verdict") as HTMLElement;
      expect(hero.textContent).toContain("INCOMPLETE");
      // All seven Overview tab slots, in the fixed §2.1 order — the route
      // still renders the whole Overview tab body, not a reduced one.
      const slots = Array.from(container.querySelectorAll(".ovtab > .ovslot")).map((el) => el.id);
      expect(slots).toHaveLength(7);
    });

    it("the Evidence tab renders Sections B and J from the run alone, with no redirect", async () => {
      const runId = await analyze(ticker, companyName);
      const { container } = await renderTab(runId, "evidence");

      expect(container.querySelector("#B")).not.toBeNull();
      expect(container.querySelector("#J")).not.toBeNull();
    });

    it("the legacy /report route redirects into the unified shell rather than rendering a second one", async () => {
      const runId = await analyze(ticker, companyName);
      await expect(LegacyReportRedirect({ params: Promise.resolve({ runId }) })).rejects.toThrow(
        `/analyzer/${runId}?tab=business`
      );
    });

    it("both the default tab and a report tab offer Screens 2 and 3 under Sources / Details, off the normal path", async () => {
      const runId = await analyze(ticker, companyName);

      for (const tab of [undefined, "evidence"]) {
        const { container } = await renderTab(runId, tab);
        expect(container.textContent).toContain("Sources / Details");
        const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
        expect(hrefs).toContain(`/analyzer/${runId}/facts`);
        cleanup();
      }
    });

    it("the rendered provenance says the software recorded the confirmation, not a person", async () => {
      const runId = await analyze(ticker, companyName);
      const { container } = await renderTab(runId, "evidence");

      // Section B — the fact set's full provenance display (contract §2.2).
      const sectionB = container.querySelector("#B") as HTMLElement;
      expect(sectionB.textContent).toContain("Recorded by AUTOMATIC (software routine verification)");
      expect(sectionB.textContent).not.toContain("Recorded by HUMAN (analyst spot-check)");
    });

    // Screens 2 and 3 move off the path; they do not go away, and nothing on
    // them is removed.
    it("Screen 2 is still reachable, with its queue, its exempt sections, its cross-check report and its judgments", async () => {
      const runId = await analyze(ticker, companyName);
      const { container } = await renderRoute(FactsPage as Page, runId);
      const text = container.textContent ?? "";

      expect(text).toContain("Step 2 — Fact acquisition and spot-check");
      expect(text).toContain(queuedFactName);
      expect(text).toContain("Acquired through a tag mapping");
      expect(text).toContain("Automatic checks on the figures");
      expect(text).toContain("Judgments — labelled FACT, and not facts");
      // The two decisions are still offered on every queued card — an
      // automatic decision is a recorded answer, not a lock.
      const radios = Array.from(container.querySelectorAll('input[type="radio"]'));
      expect(radios.length).toBeGreaterThan(0);
      expect(radios.some((r) => r.getAttribute("value") === "CONFIRMED")).toBe(true);
      expect(radios.some((r) => r.getAttribute("value") === "NOT CONFIRMED")).toBe(true);
    });

    it("Screen 2 says which decisions the software took, rather than presenting them as the analyst's", async () => {
      const runId = await analyze(ticker, companyName);
      const { container } = await renderRoute(FactsPage as Page, runId);
      const text = container.textContent ?? "";

      expect(text).toContain("Confirmed automatically");
      expect(text).toContain("Recorded by the software, not by a person.");
      expect(text).not.toContain("Confirmed by you");
    });

    it("Screen 3 is still reachable, with the gate bands, the recommendation and the profile controls", async () => {
      const runId = await analyze(ticker, companyName);
      const { container } = await renderRoute(ProfilePage as Page, runId);
      const text = container.textContent ?? "";

      expect(text).toContain("Steps 3–5 — Gates and triggers");
      expect(text).toContain("Gate 1 — history sufficiency");
      expect(text).toContain("Step 6 — Profile confirmation");
      expect(text).toContain("Recommended:");
      expect(text).toContain("Confirm recommended profile");
      expect(text).toContain("Override");
      expect(text).toContain("Cannot judge");
    });

    it("the automatic profile resolution can still be overridden on the detail route, and the override wins", async () => {
      const runId = await analyze(ticker, companyName);
      const before = await getRun(runId);
      expect(before!.profileAutoResolved).not.toBeNull();
      expect(before!.profileHumanConfirmed).toBe(false);

      // What ProfileDecisionForm posts through recordProfileDecisionAction.
      await recordProfileDecision(runId, "OVERRIDDEN", "ASSET_BASED", "Analyst reading of the balance sheet.");

      const after = await getRun(runId);
      expect(after!.profileDecision).toBe("OVERRIDDEN");
      expect(after!.profile).toBe("ASSET_BASED");
      expect(after!.profileHumanConfirmed).toBe(true);
      // The automatic record is not erased by the override — both are history.
      expect(after!.profileAutoResolved).toBe(before!.profileAutoResolved);

      // And a later load does not re-resolve over the human decision.
      await advanceRunAutomatically(runId);
      expect((await getRun(runId))!.profileDecision).toBe("OVERRIDDEN");
    });

    it("a run created before this outcome reaches a report the first time it is opened", async () => {
      // No automatic pass at creation — the shape of a run that was committed
      // by the previous beginAnalysisAction and abandoned at Screen 2.
      const runId = await createRun(ticker, companyName);
      expect(await getFactDecisions(runId)).toEqual([]);
      expect((await loadGateState(runId)).spotCheckComplete).toBe(false);

      const { container } = await renderTab(runId);
      expect(container.querySelector(".az-hero-verdict")).not.toBeNull();
      expect((await getFactDecisions(runId)).every((d) => d.origin === "AUTOMATIC")).toBe(true);
    });
  });
});
