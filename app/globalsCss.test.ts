import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// CSS-source assertions for rules jsdom can't verify through component
// rendering (no real layout engine) — a lightweight guard against
// regressing a specific, previously-shipped visual bug.
const css = readFileSync(path.resolve(__dirname, "globals.css"), "utf-8");

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`No CSS rule found for selector: ${selector}`);
  return match[1];
}

// Same idea as ruleBody, but scoped to a substring (e.g. the concatenated
// body of every @media block at a given breakpoint) so a selector that is
// declared more than once at different breakpoints can be told apart.
function ruleBodyIn(scope: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = scope.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) {
    throw new Error(`No CSS rule found for selector: ${selector} in given scope`);
  }
  return match[1];
}

// Concatenates the (brace-balanced) bodies of every top-level occurrence of
// a given `@media (...)` block in the stylesheet. globals.css repeats the
// same breakpoint in several places, one per feature section (the existing
// `@media (max-width: 720px)` blocks already do this), so a plain indexOf
// can't be used to find "the" block for a given query.
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

describe("globals.css — M9 responsive width system (§17.15 Standard/Wide, item 6)", () => {
  const standard = collectMediaBodies("@media (min-width: 1024px)");
  const wide = collectMediaBodies("@media (min-width: 1600px)");

  function maxWidthOf(scope: string, selector: string): number {
    const match = ruleBodyIn(scope, selector).match(/max-width:\s*(\d+)px\s*;/);
    if (!match) throw new Error(`No pixel max-width found for ${selector}`);
    return Number(match[1]);
  }

  it("defines a Wide (>=1600px) rule for both M9 routes", () => {
    expect(() => ruleBodyIn(wide, ".cb-analyzer .layout")).not.toThrow();
    expect(() => ruleBodyIn(wide, ".cb-analyzer .fa-shell")).not.toThrow();
  });

  it("Overview route's main column (.layout has no rail) lands in Standard's 976-1164px range and grows, not narrows, at Wide", () => {
    // .layout's only overhead is its own 24px-each-side padding.
    const overhead = 48;
    const standardMain = maxWidthOf(standard, ".cb-analyzer .layout") - overhead;
    const wideMain = maxWidthOf(wide, ".cb-analyzer .layout") - overhead;
    expect(standardMain).toBeGreaterThanOrEqual(976);
    expect(standardMain).toBeLessThanOrEqual(1164);
    expect(wideMain).toBeGreaterThanOrEqual(1164);
    expect(wideMain).toBeGreaterThan(standardMain);
  });

  it("Full Analysis main column (the grid's 1fr track) lands in Standard's range and grows at Wide, rail/gap unchanged", () => {
    const shellStandard = ruleBodyIn(standard, ".cb-analyzer .fa-shell");
    expect(shellStandard).toMatch(/grid-template-columns:\s*200px minmax\(0,\s*1fr\)\s*;/);
    expect(shellStandard).toMatch(/gap:\s*40px\s*;/);
    // rail (200px) + gap (40px) + padding (24px x2 = 48px) sit outside the
    // main column, per the issue's own arithmetic on the pre-fix CSS.
    const overhead = 288;
    const standardMain = maxWidthOf(standard, ".cb-analyzer .fa-shell") - overhead;
    const wideMain = maxWidthOf(wide, ".cb-analyzer .fa-shell") - overhead;
    expect(standardMain).toBeGreaterThanOrEqual(976);
    expect(standardMain).toBeLessThanOrEqual(1164);
    expect(wideMain).toBeGreaterThanOrEqual(1164);
    expect(wideMain).toBeGreaterThan(standardMain);
  });

  it("no third column or sticky aside is introduced at Wide, on either route", () => {
    expect(wide).not.toMatch(/grid-template-columns/);
    expect(wide).not.toMatch(/position:\s*sticky/);
    // The Full Analysis grid is declared exactly once (Standard) — Wide
    // widens the shell without redefining its tracks.
    const faShellGridDecls = css.match(/\.cb-analyzer \.fa-shell\s*\{[^}]*grid-template-columns/g) ?? [];
    expect(faShellGridDecls).toHaveLength(1);
  });

  it("prose measure is unchanged by the Wide step, and analytical containers are not prose-capped", () => {
    // SCOPE item 4: the editorial prose cap is aligned to the contract's
    // stated 72ch measure, not left at the old 66ch.
    expect(ruleBody(".cb-analyzer .overview .ovslot.editorial p")).toMatch(/max-width:\s*72ch\s*;/);
    // Analytical containers (ValuationStrip's fair-value frame, the price
    // chart) use the column and carry no prose-measure cap.
    expect(ruleBody(".cb-analyzer .hframe")).not.toMatch(/max-width/);
    expect(ruleBody(".cb-analyzer .pricechartsvg")).not.toMatch(/max-width/);
    // The Wide block itself only widens containers — it introduces no ch
    // measure of its own.
    expect(wide).not.toMatch(/\dch\s*;/);
  });
});

describe("globals.css — M9 Compact (§17.15 tiers 4-5, item 6, M9-RESPONSIVE-COMPACT-01)", () => {
  const compact = collectMediaBodies("@media (max-width: 1024px)");
  const narrow = collectMediaBodies("@media (max-width: 720px)");
  const standard = collectMediaBodies("@media (min-width: 1024px)");

  it("defines a Compact (<=1024px) rule for both M9 routes", () => {
    expect(() => ruleBodyIn(compact, ".cb-analyzer .layout")).not.toThrow();
    expect(() => ruleBodyIn(compact, ".cb-analyzer .fa-shell .fanav")).not.toThrow();
  });

  it("Overview route's Compact main column lands inside §17.15's 320-976px range", () => {
    const match = ruleBodyIn(compact, ".cb-analyzer .layout").match(/max-width:\s*(\d+)px\s*;/);
    if (!match) throw new Error("no pixel max-width in Compact .layout rule");
    const overhead = 48; // .layout's own 24px-each-side padding, same as Standard/Wide.
    const compactMain = Number(match[1]) - overhead;
    expect(compactMain).toBeGreaterThanOrEqual(320);
    expect(compactMain).toBeLessThanOrEqual(976);
  });

  it("Full Analysis's Compact rule introduces no grid, sticky aside, or third column — the inset is on .fanav, not the shell, so it doesn't double .layout's own padding", () => {
    // A bare `.fa-shell` rule in the Compact block would add its own
    // horizontal padding on top of .layout's (nested inside the shell on
    // this route), pushing the main column outside §17.15's 320-976px
    // range — the inset belongs on .fanav instead, which sits beside
    // .layout rather than around it.
    expect(() => ruleBodyIn(compact, ".cb-analyzer .fa-shell")).toThrow();
    const fanavCompact = ruleBodyIn(compact, ".cb-analyzer .fa-shell .fanav");
    expect(fanavCompact).not.toMatch(/grid-template-columns/);
    expect(fanavCompact).not.toMatch(/position:\s*sticky/);
    expect(fanavCompact).toMatch(/padding:\s*0 24px\s*;/);
  });

  it("Full Analysis's Compact main column lands inside §17.15's 320-976px range at both named phone widths, now that the shell adds no overhead of its own", () => {
    // Overhead is .layout's own 24px-each-side padding only (the same
    // overhead the Overview route uses above) — .fa-shell no longer
    // carries a Compact padding rule that would double it.
    const overhead = 48;
    for (const viewport of [390, 430]) {
      const main = viewport - overhead;
      expect(main).toBeGreaterThanOrEqual(320);
      expect(main).toBeLessThanOrEqual(976);
    }
  });

  it("below 720px, .hframe stacks to a single column with the price-implied half (the second child) ordered first, per design.md:525", () => {
    expect(ruleBodyIn(narrow, ".cb-analyzer .hframe")).toMatch(/grid-template-columns:\s*1fr\s*;/);
    const firstChild = ruleBodyIn(narrow, ".cb-analyzer .hframe > div:first-child");
    const lastChild = ruleBodyIn(narrow, ".cb-analyzer .hframe > div:last-child");
    expect(firstChild).toMatch(/order:\s*2\s*;/);
    expect(lastChild).toMatch(/order:\s*1\s*;/);
    // A right-hand hairline is meaningless once the frame is one full-width
    // column — dropped, not left dangling on the now-second half.
    expect(firstChild).toMatch(/border-right:\s*0\s*;/);
  });

  it("this same 720px .hframe rule also governs Section H — one selector, one rule, not a component-specific duplicate", () => {
    const hframeDecls = css.match(/\.cb-analyzer \.hframe\s*\{[^}]*grid-template-columns/g) ?? [];
    // Exactly two: the always-on base rule (1fr 1fr) and this one 720px
    // override (1fr) — never a second, differently-scoped selector for
    // Section H or for Overview slot 4's reuse of the same class.
    expect(hframeDecls).toHaveLength(2);
  });

  it("at 720px, .atglance drops to two columns — cited from the frozen mocks' own Compact rule for this class, not chosen on taste", () => {
    expect(ruleBodyIn(narrow, ".cb-analyzer .atglance")).toMatch(
      /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*;/
    );
  });

  it("no second breakpoint below Compact was introduced for the M9 routes — every max-width query touching .cb-analyzer content is 720px (the project's pre-existing shared breakpoint) or 1024px (this outcome's new Compact ceiling)", () => {
    const cbAnalyzerCss = css.slice(css.indexOf(".cb-analyzer {"));
    const maxWidths = new Set(
      [...cbAnalyzerCss.matchAll(/@media \(max-width:\s*(\d+)px\)/g)].map((m) => m[1])
    );
    expect([...maxWidths].sort()).toEqual(["1024", "720"]);
  });

  it("nothing at or above 1024px changed: the Standard/Wide grid, gap, sticky rail and 72ch prose cap from PR #165 are untouched", () => {
    const shellStandard = ruleBodyIn(standard, ".cb-analyzer .fa-shell");
    expect(shellStandard).toMatch(/grid-template-columns:\s*200px minmax\(0,\s*1fr\)\s*;/);
    expect(shellStandard).toMatch(/gap:\s*40px\s*;/);
    expect(ruleBodyIn(standard, ".cb-analyzer .fa-shell .fanav")).toMatch(/position:\s*sticky\s*;/);
    expect(ruleBody(".cb-analyzer .overview .ovslot.editorial p")).toMatch(/max-width:\s*72ch\s*;/);
    // Compact carries no `ch` prose cap of its own (§17.15: prose "fills"
    // below 1024px, the 72ch cap starts at Standard).
    expect(compact).not.toMatch(/\dch\s*;/);
  });
});

describe("globals.css — .cb-dash regressions", () => {
  it(".toggle sizes to its own content (inline-flex), not the full section width", () => {
    // display: flex on a plain block <div> still stretches to 100% of its
    // parent's width, same as any block box — the "By holding / By asset
    // class" toggle rendered as a full-width bordered bar instead of a
    // compact segmented control until this was inline-flex.
    expect(ruleBody(".cb-dash .toggle")).toMatch(/display:\s*inline-flex\s*;/);
  });
});

describe("globals.css — .holdings-chrome control-direction regressions", () => {
  it("defines its own parallel token set in dark mode, not the legacy --color-* tokens", () => {
    // 2026-09-01: .holdings-chrome moved from the earlier minimal dark-only
    // patch (which redefined the legacy --color-* tokens so unstyled
    // foundation rules picked them up automatically) to a full,
    // self-contained system mirroring .cb-dash — HoldingsTopBar and the
    // rewritten HoldingsEditor no longer render any legacy-foundation class
    // (.site-nav, .page-shell, the button/input/select{color:inherit}
    // fallback) inside this wrapper, so there is nothing left for
    // --color-* to serve here. This replaces the assertion that used to
    // require the opposite ("redefines the shared --color-* custom
    // properties rather than introducing a parallel token set") — that
    // mechanism existed only to keep form controls "deliberately left
    // native/light," which is exactly the seam this milestone closes.
    const body = ruleBody('.holdings-chrome[data-theme="dark"]');
    expect(body).toMatch(/--ink:\s*#E9EAE7\s*;/);
    expect(body).toMatch(/--field:\s*#1E2124\s*;/);
    expect(body).toMatch(/--line-strong:\s*#3C4045\s*;/);
    expect(body).not.toMatch(/--color-text:/);
    expect(body).not.toMatch(/--color-page-bg:/);
    expect(body).not.toMatch(/--color-border:/);
  });

  it("form controls theme via the scoped tokens, not a hardcoded light colour", () => {
    // The old block forced every input/select/button back to a literal
    // #1a1a1a in dark mode. That seam is closed: .inp and .cellinput read
    // var(--ink)/var(--field), which the dark block above already
    // redefines — no separate dark-mode override is needed, and no
    // hardcoded colour literal survives on either class.
    const inp = ruleBody(".holdings-chrome .inp");
    expect(inp).toMatch(/color:\s*var\(--ink\)\s*;/);
    expect(inp).toMatch(/background-color:\s*var\(--field\)\s*;/);
    expect(inp).not.toMatch(/#1a1a1a/i);
    const cellinput = ruleBody(".holdings-chrome .cellinput");
    expect(cellinput).toMatch(/color:\s*var\(--ink\)\s*;/);
    expect(cellinput).not.toMatch(/#1a1a1a/i);
  });
});
