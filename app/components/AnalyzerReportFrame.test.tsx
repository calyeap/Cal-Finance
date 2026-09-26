// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { AnalyzerReportFrame, ANALYZER_TABS, type AnalyzerTabSlug } from "./AnalyzerReportFrame";
import { assembleAnalysisResult } from "@/lib/analyzer/assemble";
import { MSFT_FIXTURE } from "@/lib/analyzer/fixtures/msft";
import { deriveVerdict } from "@/lib/analyzer/verdict";

// CF-ANALYZER-V2-BUILD-01 correction — the design authority doc's
// "Implementation enforcement" clause calls for a drift guard "so
// navigation mode, company identity, price/verdict/uncertainty summary,
// tabs and body-start anchors cannot drift between tabs." globalsCss.test.ts
// already pins the compact-header grid-template-areas order (the CSS half
// of that guard, verified against jsdom's inability to compute layout);
// this file is the component half — a fixed-width visual/screenshot check
// is not this repo's mechanism (no checked-in baseline pipeline exists),
// so the equivalent guard here is a DOM-order pin: the same shell chrome,
// in the same source order, regardless of which tab is active. A PR that
// re-interposes .az-save between the hero and the tab rail (the exact
// defect this guards) fails this test rather than only being catchable by
// eye in a screenshot.

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

const result = assembleAnalysisResult(MSFT_FIXTURE);
const verdict = deriveVerdict(result);

function renderFrame(activeTab: AnalyzerTabSlug) {
  return render(
    <AnalyzerReportFrame runId="run-1" result={result} verdict={verdict} profileNotConfirmed={false} activeTab={activeTab}>
      <div data-testid="tab-body">tab body</div>
    </AnalyzerReportFrame>
  );
}

describe("AnalyzerReportFrame — locked shell invariant order", () => {
  it.each(ANALYZER_TABS.map((t) => t.slug))(
    "renders identity -> hero -> tab rail -> save action -> tab body, in that order, on the %s tab",
    (slug) => {
      const { container } = renderFrame(slug);
      const main = container.querySelector(".az-report-main") as HTMLElement;
      const classesInOrder = Array.from(main.children).map((el) => el.className.split(" ")[0]);

      const identityIndex = classesInOrder.indexOf("az-identity");
      const heroIndex = classesInOrder.indexOf("az-hero");
      const tabsIndex = classesInOrder.indexOf("az-tabs");
      const saveIndex = classesInOrder.indexOf("az-save");
      const bodyIndex = classesInOrder.indexOf("az-tabbody");

      expect(identityIndex).toBeGreaterThanOrEqual(0);
      expect(heroIndex).toBeGreaterThan(identityIndex);
      expect(tabsIndex).toBeGreaterThan(heroIndex);
      expect(saveIndex).toBeGreaterThan(tabsIndex);
      expect(bodyIndex).toBeGreaterThan(saveIndex);
    }
  );

  it.each(ANALYZER_TABS.map((t) => t.slug))("keys the hero's compact-header CSS gate off the active tab (%s)", (slug) => {
    const { container } = renderFrame(slug);
    const hero = container.querySelector(".az-hero") as HTMLElement;
    expect(hero.getAttribute("data-tab")).toBe(slug);
  });

  it("renders the same shell chrome (identity, hero, tabs, save, right rail) regardless of which tab is active", () => {
    const shapes = ANALYZER_TABS.map(({ slug }) => {
      const { container } = renderFrame(slug);
      const shape = {
        identity: container.querySelectorAll(".az-identity").length,
        hero: container.querySelectorAll(".az-hero").length,
        tabs: container.querySelectorAll(".az-tabs .az-tab").length,
        save: container.querySelectorAll(".az-save").length,
        rightRail: container.querySelectorAll(".az-rightrail").length,
      };
      cleanup();
      return shape;
    });
    for (const shape of shapes) {
      expect(shape).toEqual(shapes[0]);
    }
  });

  // CF-UPDATE-FIRST-OUTCOME-01 — the UPDATE entry point, surfaced from this
  // same shared shell alongside the existing "Save this version" action, on
  // every tab (not just Overview), since every tab renders this frame.
  it("surfaces the UPDATE entry point ('Look at this company again') alongside Save this version, carrying this run's own id", () => {
    const { container } = renderFrame("overview");
    const forms = Array.from(container.querySelectorAll("form.az-save"));
    expect(forms).toHaveLength(2);

    const updateForm = forms.find((f) => f.textContent?.includes("Look at this company again"));
    expect(updateForm).toBeDefined();
    const hiddenRunId = updateForm!.querySelector('input[type="hidden"][name="runId"]');
    expect(hiddenRunId).not.toBeNull();
    expect((hiddenRunId as HTMLInputElement).value).toBe("run-1");
  });
});
