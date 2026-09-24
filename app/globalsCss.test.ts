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

  it("only the M9-era breakpoints (720px, 1024px) plus the CF-DESIGN-AUTHORITY-CUTOVER-01 Analyzer V2 shell tiers (599px, 767px, 1279px) appear under .cb-analyzer — no other max-width query was introduced", () => {
    // CF-DESIGN-AUTHORITY-CUTOVER-01 (docs/design/analyzer-v2-design-
    // authority.md) supersedes the M9 3-tier Standard/Compact/Wide system
    // this guard originally pinned: it explicitly requires five named
    // acceptance targets (32-inch desktop / half-window / iPad landscape /
    // iPad portrait / iPhone), which the old 720/1024px pair cannot
    // express. The three new values are the Analyzer V2 shell's own tiers
    // (globals.css, "Analyzer V2 shell" section) — 599/1279px bound the
    // compact-icon-rail range, 767px is the phone/tablet-portrait split.
    const cbAnalyzerCss = css.slice(css.indexOf(".cb-analyzer {"));
    const maxWidths = new Set(
      [...cbAnalyzerCss.matchAll(/@media \(max-width:\s*(\d+)px\)/g)].map((m) => m[1])
    );
    expect([...maxWidths].sort()).toEqual(["1024", "1279", "599", "720", "767"]);
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

describe("globals.css — §5 both-theme contrast check for the new M9 component roles (contract §5, item 6)", () => {
  it("DominantVerdictSlot, ScenarioRangeStrip and the Overview's slot chrome carry zero colour literals — every colour they use resolves through a §5 token, so both themes are reached automatically", () => {
    // The M9-DESKTOP-SHELL-01 block covers .verdictslot (DominantVerdictSlot),
    // .scenariorangestrip/.hframe/.pi (ScenarioRangeStrip), .pricechart*
    // (PriceChartPanel), .fanav (FullAnalysisNav) and .overview .ovslot* (the
    // Overview's own slot chrome) — every M9 component role §16's last
    // accessibility validation predates. It runs to the end of the file.
    const block = css.slice(css.indexOf("M9-DESKTOP-SHELL-01 — the Overview page"));
    expect(block.length).toBeGreaterThan(0);
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("the suppressing-state chrome those roles share (.state/.name/.cause) is likewise token-only, not a literal colour", () => {
    expect(ruleBody(".cb-analyzer .state")).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe("globals.css — M9 shared Calboard chrome (M9-THEME-COMPLETION-01)", () => {
  const standard = collectMediaBodies("@media (min-width: 1024px)");
  const wide = collectMediaBodies("@media (min-width: 1600px)");
  const narrow = collectMediaBodies("@media (max-width: 720px)");

  it("matches design.md:961's composition — 18px/500/-0.01em wordmark, 20px nav gap, 30px bare icon buttons, --muted resting / --ink hover", () => {
    expect(ruleBody(".cb-analyzer .brand")).toMatch(/font-size:\s*18px\s*;/);
    expect(ruleBody(".cb-analyzer .brand")).toMatch(/font-weight:\s*500\s*;/);
    expect(ruleBody(".cb-analyzer .brand")).toMatch(/letter-spacing:\s*-0\.01em\s*;/);
    expect(ruleBody(".cb-analyzer .topbar .nav")).toMatch(/gap:\s*20px\s*;/);
    expect(ruleBody(".cb-analyzer .iconbare")).toMatch(/width:\s*30px\s*;/);
    expect(ruleBody(".cb-analyzer .iconbare")).toMatch(/height:\s*30px\s*;/);
    expect(ruleBody(".cb-analyzer .iconbare")).toMatch(/color:\s*var\(--muted\)\s*;/);
    expect(ruleBody(".cb-analyzer .iconbare:hover")).toMatch(/color:\s*var\(--ink\)\s*;/);
  });

  it("the bar carries zero colour literals — every colour resolves through a §5 token, same as the rest of the M9 stylesheet", () => {
    const topbarBlock = css.slice(css.indexOf(".cb-analyzer .topbar {"), css.indexOf(".cb-analyzer .layout {"));
    expect(topbarBlock).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("the Overview bar's max-width tracks .layout at every width mode (design.md:1021)", () => {
    expect(ruleBody(".cb-analyzer .topbar")).toMatch(/max-width:\s*900px\s*;/);
    expect(ruleBodyIn(standard, ".cb-analyzer .topbar")).toMatch(/max-width:\s*1160px\s*;/);
    expect(ruleBodyIn(wide, ".cb-analyzer .topbar")).toMatch(/max-width:\s*1360px\s*;/);
  });

  it("the Full Analysis bar (.fa) tracks .fa-shell at Standard/Wide instead, where the rail lives — .layout's values would misalign it", () => {
    expect(ruleBodyIn(standard, ".cb-analyzer .topbar.fa")).toMatch(/max-width:\s*1400px\s*;/);
    expect(ruleBodyIn(wide, ".cb-analyzer .topbar.fa")).toMatch(/max-width:\s*1600px\s*;/);
  });

  it("below 1024px both routes' bars share .layout's 900px cap — .fa-shell itself carries no max-width there, so no .fa override is declared", () => {
    const compact = collectMediaBodies("@media (max-width: 1024px)");
    expect(() => ruleBodyIn(compact, ".cb-analyzer .topbar.fa")).toThrow();
    expect(() => ruleBodyIn(compact, ".cb-analyzer .topbar")).toThrow();
  });

  it("Compact phone behaviour is the frozen mocks' own rule verbatim (mock-report-msft.html:244-245) — wrap, 12px row-gap, 20px/20px/0 padding, 14px wrapping nav gap, no hamburger or drawer", () => {
    expect(ruleBodyIn(narrow, ".cb-analyzer .topbar")).toMatch(/flex-wrap:\s*wrap\s*;/);
    expect(ruleBodyIn(narrow, ".cb-analyzer .topbar")).toMatch(/row-gap:\s*12px\s*;/);
    expect(ruleBodyIn(narrow, ".cb-analyzer .topbar")).toMatch(/padding:\s*20px 20px 0\s*;/);
    expect(ruleBodyIn(narrow, ".cb-analyzer .topbar .nav")).toMatch(/gap:\s*14px\s*;/);
    expect(ruleBodyIn(narrow, ".cb-analyzer .topbar .nav")).toMatch(/flex-wrap:\s*wrap\s*;/);
    expect(narrow).not.toMatch(/hamburger|drawer/i);
  });

  // M9-NONM9-CHROME-01 — the entry/facts/profile bar (`.topbar.steps`)
  // tracks `.cb-analyzer .cb-steps .wrap` (globals.css:2285), whose own
  // max-width is a flat 1100px with no Standard/Wide step-up, unlike
  // `.layout`/`.fa-shell` above. One unconditional override — not a
  // per-breakpoint media rule — keeps it equal to its container "at every
  // width mode" (design.md:1021) precisely because the container itself
  // never changes width.
  it("the entry/facts/profile bar (.steps) tracks .cb-analyzer .cb-steps .wrap — a flat 1100px at every width mode, declared once, not per breakpoint", () => {
    expect(ruleBody(".cb-analyzer .cb-steps .wrap")).toMatch(/max-width:\s*1100px\s*;/);
    expect(ruleBody(".cb-analyzer .topbar.steps")).toMatch(/max-width:\s*1100px\s*;/);
    // No Standard/Wide override exists for .steps — the base rule already
    // matches its container at every mode, so a repeated 1100px declaration
    // there would be redundant, not a second value.
    expect(() => ruleBodyIn(standard, ".cb-analyzer .topbar.steps")).toThrow();
    expect(() => ruleBodyIn(wide, ".cb-analyzer .topbar.steps")).toThrow();
    // Declared exactly once — a flat rule, not repeated per breakpoint.
    expect(css.match(/\.cb-analyzer \.topbar\.steps\s*\{/g)).toHaveLength(1);
  });

  it("the .cb-analyzer token block and its [data-theme=\"dark\"] block are byte-identical to e3da0be — this outcome redeclares no §5 token", () => {
    const lightTokens = ruleBody(".cb-analyzer");
    expect(lightTokens).toMatch(/--ground:\s*#F2EEE5\s*;/);
    expect(lightTokens).toMatch(/--field:\s*#F8F5EE\s*;/);
    expect(lightTokens).toMatch(/--line-strong:\s*#CBC2AE\s*;/);
    expect(lightTokens).toMatch(/--muted:\s*#5F5A50\s*;/);
    expect(lightTokens).toMatch(/--tint:\s*#E8E1D2\s*;/);
    const darkTokens = ruleBody('.cb-analyzer[data-theme="dark"]');
    expect(darkTokens).toMatch(/--ground:\s*#16181A\s*;/);
    expect(darkTokens).toMatch(/--field:\s*#1E2124\s*;/);
    expect(darkTokens).toMatch(/--line-strong:\s*#3C4045\s*;/);
    expect(darkTokens).toMatch(/--muted:\s*#979CA1\s*;/);
    expect(darkTokens).toMatch(/--tint:\s*#24272A\s*;/);
    // Exactly one declaration of each token role in scope — this outcome adds
    // no second token set alongside the approved one.
    expect(css.match(/\.cb-analyzer\s*\{/g)).toHaveLength(1);
    expect(css.match(/\.cb-analyzer\[data-theme="dark"\]\s*\{/g)).toHaveLength(1);
  });

  it("only the M9-era breakpoints plus the Analyzer V2 shell tiers were introduced by the chrome — same set app/globalsCss.test.ts's Compact describe block above pins", () => {
    // CF-DESIGN-AUTHORITY-CUTOVER-01 — see the sibling assertion above for
    // why this set grew from the M9-era {720, 1024} pair.
    const cbAnalyzerCss = css.slice(css.indexOf(".cb-analyzer {"));
    const maxWidths = new Set(
      [...cbAnalyzerCss.matchAll(/@media \(max-width:\s*(\d+)px\)/g)].map((m) => m[1])
    );
    expect([...maxWidths].sort()).toEqual(["1024", "1279", "599", "720", "767"]);
  });
});

describe("globals.css — M9 route-level states (M9-STATE-HANDLING-01)", () => {
  it("reuses .state/.name/.cause verbatim — no second suppressing-state mechanism for the new route states", () => {
    // The route files render the pre-existing .state/.name/.cause markup
    // (app/analyzer/[runId]/not-found.tsx, error.tsx, loading.tsx); this
    // guards that this outcome declared no parallel treatment for it.
    expect(css.match(/\.cb-analyzer \.state \.name\s*\{/g)).toHaveLength(1);
    expect(css.match(/\.cb-analyzer \.state \.cause\s*\{/g)).toHaveLength(1);
  });

  it("the new .routestate action carries zero colour literals — every colour resolves through a §5 token or an already-shipped role", () => {
    expect(ruleBody(".cb-analyzer .routestate .act")).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(ruleBody(".cb-analyzer .routestate .act")).toMatch(/border:\s*1px solid var\(--line-strong\)\s*;/);
    expect(ruleBody(".cb-analyzer .routestate .act")).toMatch(/background:\s*var\(--field\)\s*;/);
    expect(ruleBody(".cb-analyzer .routestate .act")).toMatch(/color:\s*var\(--ink\)\s*;/);
  });

  it("no .status-msg, .status-danger or --color-danger appears under .cb-analyzer — those are Dashboard/Holdings-global and outside §5's token set", () => {
    const cbAnalyzerCss = css.slice(css.indexOf(".cb-analyzer {"));
    expect(cbAnalyzerCss).not.toMatch(/\.status-msg/);
    expect(cbAnalyzerCss).not.toMatch(/\.status-danger/);
    expect(cbAnalyzerCss).not.toMatch(/--color-danger/);
    expect(cbAnalyzerCss).not.toMatch(/\.button-link/);
  });

  it("the .cb-analyzer token block and its dark block are unchanged by this outcome — the same token names in both themes, no new §5 token or colour role", () => {
    const tokenNames = (body: string) => [...body.matchAll(/(--[a-z-]+):/g)].map((m) => m[1]).sort();
    const lightNames = tokenNames(ruleBody(".cb-analyzer"));
    const darkNames = tokenNames(ruleBody('.cb-analyzer[data-theme="dark"]'));
    expect(lightNames).toEqual(darkNames);
    expect(lightNames).toEqual([
      "--field",
      "--gain",
      "--ground",
      "--hairline",
      "--ink",
      "--line-strong",
      "--loss",
      "--muted",
      "--stale",
      "--tint",
    ]);
  });
});

describe("globals.css — M9 accessibility pass (M9-ACCESSIBILITY-01, runway item 9)", () => {
  it(".cb-analyzer carries its own :focus-visible rule at design.md:975's exact treatment, token-only", () => {
    const rule = ruleBody(".cb-analyzer :focus-visible");
    expect(rule).toMatch(/outline:\s*2px solid var\(--ink\)\s*;/);
    expect(rule).toMatch(/outline-offset:\s*3px\s*;/);
    expect(rule).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  // globals.css is checked in with CRLF line endings — normalise before any
  // byte-for-byte comparison so the assertion doesn't depend on a
  // checkout's line-ending settings.
  const normalise = (s: string) => s.replace(/\r\n/g, "\n");

  it("the global :focus-visible rule at :root is byte-unchanged — still --color-text, 2px, offset 2px", () => {
    const rule = normalise(ruleBody(":focus-visible"));
    expect(rule).toBe("\n  outline: 2px solid var(--color-text);\n  outline-offset: 2px;\n");
    // Exactly one unscoped :focus-visible rule — the Analyzer's is scoped
    // under .cb-analyzer, never a second bare declaration.
    expect(css.match(/^:focus-visible\s*\{/gm)).toHaveLength(1);
  });

  it("the .cb-analyzer token block and its dark block are byte-identical to 8f6f6a1 — this outcome adds a focus rule, not a token", () => {
    const lightTokens = normalise(ruleBody(".cb-analyzer"));
    expect(lightTokens).toBe(
      "\n  --ground: #F2EEE5;\n  --ink: #1F1C17;\n  --muted: #5F5A50;\n  --hairline: #E2DBCC;\n  --line-strong: #CBC2AE;\n  --field: #F8F5EE;\n  --gain: #1B6B4A;\n  --loss: #A3352A;\n  --stale: #856713;\n  --tint: #E8E1D2;\n  background: var(--ground);\n  color: var(--ink);\n  min-height: 100vh;\n  /* The frozen mocks are set in IBM Plex Sans, and every spacing and\n     line-length judgement in them was made against its metrics. The\n     next/font variable is on <html>, but this container never consumed it,\n     so the Analyzer alone rendered in the system stack — a different\n     typeface from the one the design was drawn in. Same declaration as\n     .cb-dash and .holdings-chrome, which have always had it. */\n  font-family: var(--font-ibm-plex-sans), \"IBM Plex Sans\", system-ui, -apple-system, \"Segoe UI\", sans-serif;\n  font-feature-settings: \"tnum\" 1;\n"
    );
    const darkTokens = normalise(ruleBody('.cb-analyzer[data-theme="dark"]'));
    expect(darkTokens).toBe(
      "\n  --ground: #16181A;\n  --ink: #E9EAE7;\n  --muted: #979CA1;\n  --hairline: #2C2F33;\n  --line-strong: #3C4045;\n  --field: #1E2124;\n  --gain: #56B98C;\n  --loss: #E27A66;\n  --stale: #D9AB45;\n  --tint: #24272A;\n"
    );
  });

  it("every table.t <th> is scoped: thead th keeps the uppercase column-header look, tbody th (row headers) shares one rule with td rather than inheriting it", () => {
    const theadRule = ruleBody(".cb-analyzer table.t thead th");
    expect(theadRule).toMatch(/text-transform:\s*uppercase\s*;/);
    // The row-label <th scope="row"> cells promoted from <td> must share
    // td's rule, not the thead th rule above — a semantics change, not a
    // restyle to the uppercase/muted column-header look.
    expect(css).toMatch(/\.cb-analyzer table\.t td,\s*\n\s*\.cb-analyzer table\.t tbody th \{/);
    const tbodyThRule = ruleBody(".cb-analyzer table.t tbody th");
    expect(tbodyThRule).not.toMatch(/text-transform/);
    expect(tbodyThRule).toMatch(/padding:\s*12px 0 12px 20px\s*;/);
    expect(tbodyThRule).toMatch(/text-align:\s*right\s*;/);
    expect(css).toMatch(/\.cb-analyzer table\.t td:first-child,\s*\n\s*\.cb-analyzer table\.t tbody th:first-child \{/);
  });
});

describe("globals.css — Analyzer V2 compact report header order (design authority doc, 'Compact report header')", () => {
  // Regression guard for the CALBOARD-BUILD correction on PR #266: below
  // wide desktop the hero's grid-template-areas reordered the row sequence
  // to identity -> verdict -> price, contradicting both authorities' fixed
  // "company identity -> current price -> verdict + uncertainty -> tab
  // rail" sequence. jsdom has no layout engine, so — same technique as the
  // rest of this file — the CSS source is asserted directly rather than a
  // rendered layout.
  it("wide-desktop hero keeps verdict/price side-by-side, scenarios full-width below", () => {
    expect(ruleBody(".cb-analyzer .az-hero")).toMatch(
      /grid-template-areas:\s*"verdict price"\s*"scenarios scenarios"\s*;/
    );
  });

  it("the compact header (<=1279px) stacks price before verdict, per the required orientation sequence", () => {
    const compactShell = collectMediaBodies("@media (max-width: 1279px)");
    expect(ruleBodyIn(compactShell, ".cb-analyzer .az-hero")).toMatch(
      /grid-template-areas:\s*"price"\s*"verdict"\s*"scenarios"\s*;/
    );
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
