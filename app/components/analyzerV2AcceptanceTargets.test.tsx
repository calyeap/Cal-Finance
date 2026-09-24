// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AnalyzerReportFrame, ANALYZER_TABS, type AnalyzerTabSlug } from "./AnalyzerReportFrame";
import { assembleAnalysisResult } from "@/lib/analyzer/assemble";
import { MSFT_FIXTURE } from "@/lib/analyzer/fixtures/msft";
import { deriveVerdict } from "@/lib/analyzer/verdict";

// CF-V2-DRIFT-GUARD-01 — docs/design/analyzer-v2-design-authority.md,
// "Implementation enforcement": "Add fixed-width visual-regression /
// screenshot checks at the required acceptance targets so navigation mode,
// company identity, price/verdict/uncertainty summary, tabs and body-start
// anchors cannot drift between tabs." This repo has no checked-in
// visual-baseline pipeline and HARD BOUNDS forbids adding one, so the
// equivalent guard combines the repo's two existing deterministic
// techniques: AnalyzerReportFrame.test.tsx's DOM-order render (the per-tab
// half) and app/globalsCss.test.ts's CSS-source assertions — jsdom has no
// layout engine, so a real fixed-width screenshot can't be taken here
// either way (the CSS-source half). Neither technique is duplicated
// wholesale; this file's job is the cross product neither one alone
// covers: every one of the seven tabs, at every one of the five required
// acceptance targets (design authority doc, "Responsive contract").
//
// Each target is mapped to one concrete pixel width chosen inside an
// EXISTING globals.css tier — no new breakpoint is introduced. The
// "Analyzer V2 shell" comment block (globals.css:3348-3357) already
// approximates the five named targets the same way: >=1280px wide desktop,
// 600-1279px compact icon rail (half-window and both tablet orientations —
// the contract draws no separate nav-mode distinction between them, and
// neither does globals.css), <600px phone icon strip. No chosen width sits
// on a tier boundary. app/globalsCss.test.ts's "only the M9-era
// breakpoints ... " pin is the guard that these tier boundaries (599,
// 1279, 1280) are not quietly moved out from under this file.

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

const css = readFileSync(path.resolve(__dirname, "../globals.css"), "utf-8");

// Same CSS-source technique as app/globalsCss.test.ts / app/m9AcceptanceGaps.test.ts
// — duplicated locally (the established convention for this helper; neither
// of those files exports it) rather than imported from a .test.ts file.
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`No CSS rule found for selector: ${selector}`);
  return match[1];
}

function ruleBodyIn(scope: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = scope.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) {
    throw new Error(`No CSS rule found for selector: ${selector} in given scope`);
  }
  return match[1];
}

function collectMediaBodies(query: string): string {
  const bodies: string[] = [];
  let searchFrom = 0;
  for (;;) {
    const idx = css.indexOf(query, searchFrom);
    if (idx === -1) break;
    const braceStart = css.indexOf("{", idx);
    let depth = 0;
    let end = -1;
    for (let i = braceStart; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) throw new Error(`Unbalanced braces for media query: ${query}`);
    bodies.push(css.slice(braceStart + 1, end));
    searchFrom = end + 1;
  }
  if (bodies.length === 0) throw new Error(`No @media rule found: ${query}`);
  return bodies.join("\n");
}

// The compact icon-rail nav tier — disambiguated from the hero's own
// `@media (max-width: 1279px)` block below by its "and (min-width: 600px)"
// suffix (a plain `indexOf` substring search would otherwise treat the nav
// query as a match for the hero query too, since the hero query's text is a
// prefix of the nav query's text).
const NAV_COMPACT_QUERY = "@media (max-width: 1279px) and (min-width: 600px)";
// The hero compact-header tier — the trailing "{" is what disambiguates it
// from the nav query above.
const HERO_COMPACT_QUERY = "@media (max-width: 1279px) {";
const NAV_PHONE_QUERY = "@media (max-width: 599px)";
const RIGHTRAIL_WIDE_QUERY = "@media (min-width: 1280px)";

// "Compact report header" (design authority doc): "Overview may then expand
// into the richer verdict/price-chart summary. Non-Overview tabs use the
// restrained compact verdict treatment." The CSS mechanism is this
// selector, keyed off AnalyzerReportFrame's own `data-tab` attribute (no
// second render path — AnalyzerReportFrame.tsx:24-29).
const SCENARIOS_HIDE_SELECTOR = '.cb-analyzer .az-hero[data-tab]:not([data-tab="overview"]) .az-hero-scenarios';
// AnalyzerReportFrame renders without its AnalyzerShell `.cb-analyzer`
// ancestor in this test (the same isolation AnalyzerReportFrame.test.tsx
// already renders under) — `.matches()` needs the selector without that
// outer scoping class or it would never match anything here regardless of
// tab.
const SCENARIOS_HIDE_SELECTOR_UNSCOPED = SCENARIOS_HIDE_SELECTOR.replace(/^\.cb-analyzer /, "");

type NavMode = "wide" | "compact" | "phone";

interface AcceptanceTarget {
  name: string;
  width: number;
  navMode: NavMode;
  rightRailVisible: boolean;
  heroCompact: boolean;
}

// docs/design/analyzer-v2-design-authority.md, "Responsive contract" names
// the five required acceptance targets; each is mapped below to one
// concrete pixel width and the nav/right-rail/hero mode the contract
// requires at that width. See the file-level comment above for the tier
// citations.
const ACCEPTANCE_TARGETS: AcceptanceTarget[] = [
  {
    // "Wide desktop": labelled sidebar, persistent right rail. globals.css
    // base `.az-nav` (unmodified above 1279px) and
    // `@media (min-width: 1280px) { .az-rightrail { display: block } }`.
    name: "32-inch full-screen desktop",
    width: 1920,
    navMode: "wide",
    rightRailVisible: true,
    heroCompact: false,
  },
  {
    // "Half-window": compact icon navigation rail, no persistent right
    // rail. globals.css `@media (max-width: 1279px) and (min-width: 600px)`
    // (nav) and `@media (max-width: 1279px)` (hero compact header).
    name: "half-window",
    width: 960,
    navMode: "compact",
    rightRailVisible: false,
    heroCompact: true,
  },
  {
    // "Tablet": compact icon rail in landscape and portrait — same
    // globals.css rules as half-window (one shared 600-1279px nav tier).
    name: "iPad landscape",
    width: 1024,
    navMode: "compact",
    rightRailVisible: false,
    heroCompact: true,
  },
  {
    // "Tablet": compact icon rail in landscape and portrait. 768px still
    // falls inside the same 600-1279px compact tier as half-window and
    // landscape above.
    name: "iPad portrait",
    width: 768,
    navMode: "compact",
    rightRailVisible: false,
    heroCompact: true,
  },
  {
    // "Phone": mobile header instead of sidebar/icon rail. globals.css
    // `@media (max-width: 599px)` (nav) — the hero compact header still
    // governs here too, since 390px also falls inside the
    // `@media (max-width: 1279px)` range.
    name: "iPhone",
    width: 390,
    navMode: "phone",
    rightRailVisible: false,
    heroCompact: true,
  },
];

const result = assembleAnalysisResult(MSFT_FIXTURE);
const verdict = deriveVerdict(result);

function renderFrame(activeTab: AnalyzerTabSlug) {
  return render(
    <AnalyzerReportFrame runId="run-1" result={result} verdict={verdict} profileNotConfirmed={false} activeTab={activeTab}>
      <div data-testid="tab-body">tab body</div>
    </AnalyzerReportFrame>
  );
}

describe("Analyzer V2 acceptance-target drift guard (CF-V2-DRIFT-GUARD-01)", () => {
  it("the Overview-only-expands rule is declared exactly once, and only inside the hero compact-header media query", () => {
    const occurrences = css.match(
      /\.cb-analyzer \.az-hero\[data-tab\]:not\(\[data-tab="overview"\]\) \.az-hero-scenarios\s*\{/g
    ) ?? [];
    expect(occurrences).toHaveLength(1);
    const heroCompactScope = collectMediaBodies(HERO_COMPACT_QUERY);
    expect(heroCompactScope).toContain(SCENARIOS_HIDE_SELECTOR);
    expect(ruleBodyIn(heroCompactScope, SCENARIOS_HIDE_SELECTOR)).toMatch(/display:\s*none\s*;/);
  });

  describe.each(ACCEPTANCE_TARGETS)("$name (@ $width px)", (target) => {
    it(`globals.css puts this width in the "${target.navMode}" nav tier (rightRail visible=${target.rightRailVisible}, hero compact=${target.heroCompact})`, () => {
      // 1279px / 1280px are the exact tier boundaries this table encodes —
      // cross-checked against the real thresholds below, not just asserted
      // by the table's own say-so.
      expect(target.width <= 1279).toBe(target.heroCompact);
      expect(target.width >= 1280).toBe(target.rightRailVisible);

      if (target.navMode === "wide") {
        expect(ruleBody(".cb-analyzer .az-nav")).toMatch(/width:\s*220px\s*;/);
      } else if (target.navMode === "compact") {
        const nav = collectMediaBodies(NAV_COMPACT_QUERY);
        expect(ruleBodyIn(nav, ".cb-analyzer .az-nav")).toMatch(/width:\s*64px\s*;/);
        expect(ruleBodyIn(nav, ".cb-analyzer .az-navlabel")).toMatch(/display:\s*none\s*;/);
      } else {
        const nav = collectMediaBodies(NAV_PHONE_QUERY);
        expect(ruleBodyIn(nav, ".cb-analyzer .az-nav")).toMatch(/flex-direction:\s*row\s*;/);
        expect(ruleBodyIn(nav, ".cb-analyzer .az-navlabel")).toMatch(/display:\s*none\s*;/);
      }

      expect(ruleBody(".cb-analyzer .az-rightrail")).toMatch(/display:\s*none\s*;/);
      expect(ruleBodyIn(collectMediaBodies(RIGHTRAIL_WIDE_QUERY), ".cb-analyzer .az-rightrail")).toMatch(
        /display:\s*block\s*;/
      );

      if (target.heroCompact) {
        expect(ruleBodyIn(collectMediaBodies(HERO_COMPACT_QUERY), ".cb-analyzer .az-hero")).toMatch(
          /grid-template-areas:\s*"price"\s*"verdict"\s*"scenarios"\s*;/
        );
      } else {
        expect(ruleBody(".cb-analyzer .az-hero")).toMatch(
          /grid-template-areas:\s*"verdict price"\s*"scenarios scenarios"\s*;/
        );
      }
    });

    it.each(ANALYZER_TABS.map((t) => t.slug))(
      "%s tab — identity, hero, tab rail (active tab visible) and body-start anchor all present and in the locked order",
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

        // Company identity row.
        const identity = container.querySelector(".az-identity") as HTMLElement;
        expect(identity.querySelector("h1")?.textContent).toBe(result.companyName);
        expect(identity.querySelector(".az-ticker")?.textContent).toBe(result.ticker);

        // Price / verdict / uncertainty summary.
        const hero = container.querySelector(".az-hero") as HTMLElement;
        expect(hero.getAttribute("data-tab")).toBe(slug);
        expect(hero.querySelector(".az-hero-verdict")?.textContent).toContain(verdict.status);
        expect(hero.querySelector(".az-hero-price")).not.toBeNull();
        expect(hero.querySelector(".az-uncertainty")).not.toBeNull();

        // Seven-tab rail, with the active tab visibly marked.
        const tabLinks = Array.from(container.querySelectorAll(".az-tabs .az-tab"));
        expect(tabLinks.map((el) => el.textContent)).toEqual(ANALYZER_TABS.map((t) => t.label));
        const activeLinks = tabLinks.filter((el) => el.classList.contains("on"));
        expect(activeLinks).toHaveLength(1);
        expect(activeLinks[0].getAttribute("aria-current")).toBe("page");
        expect(activeLinks[0].textContent).toBe(ANALYZER_TABS.find((t) => t.slug === slug)!.label);

        // Body-start anchor.
        expect(container.querySelector(".az-tabbody [data-testid='tab-body']")).not.toBeNull();

        // Wide-desktop right rail: always in the DOM (no second render
        // path — CSS-hidden below 1280px, per AnalyzerRightRail.tsx), so
        // its at-width visibility is exactly the CSS fact pinned above,
        // never a DOM presence/absence toggle.
        expect(container.querySelector(".az-rightrail")).not.toBeNull();

        // Overview-versus-other-tabs compact header rule: the CSS
        // selector's structural target (independent of any @media scope —
        // `.matches()` only evaluates the selector itself) must be exactly
        // the non-Overview tabs, for every one of the seven tabs.
        const scenarios = hero.querySelector(".az-hero-scenarios") as HTMLElement;
        expect(scenarios.matches(SCENARIOS_HIDE_SELECTOR_UNSCOPED)).toBe(slug !== "overview");
      }
    );
  });
});
