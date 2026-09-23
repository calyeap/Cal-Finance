# Cal Finance — Analyzer V2 Design Authority

**OUTCOME-ID:** `CF-DESIGN-AUTHORITY-CUTOVER-01`
**Status:** current implementation-facing Analyzer V2 design contract
**Effective:** 23 Sep 2026

This file is the repo-owned implementation contract for **how Analyzer V2 must be built**. It is intentionally compact. It does not replace the human-readable design rationale or the accepted visual artefact store.

## Source and precedence

Human-readable / visual authority remains:

- [Cal Finance — UX & Design System Principles](https://app.notion.com/p/3d20ca9a8fd081f08606df9f7dcc489d)
- [Analyzer V2 — Approved Design Artefacts](https://app.notion.com/p/3e40ca9a8fd081358d31cf1f3e1e45a3)

Implementation-facing Analyzer V2 design work starts here, then follows those sources for the accepted visual references. If this file and the current approved Notion sources disagree, stop with `RECONCILIATION REQUIRED`; do not invent a compromise.

**Analyzer V2 is the strongest current visual reference / proving implementation for Cal Finance.** Existing Portfolio / Holdings visuals and older M9/frozen Analyzer design contracts are legacy or surface-scoped evidence and must not override this contract.

## Accepted visual pack

The Approved Design Artefacts page owns the accepted visual reference pack until the exact binaries are deliberately promoted into this repository. Do not regenerate or approximate them.

| File | Standing |
|---|---|
| `Analyzer-V2-Desktop-North-Star.png` | canonical desktop shell / visual North Star |
| `Analyzer-V2-Desktop-7-Tab-Contact-Sheet.png` | locked desktop seven-tab reference; **Financials panel is stale** |
| `Analyzer-V2-Desktop-Financials-Corrected.png` | authoritative desktop Financials reference |
| `Analyzer-V2-Mobile-7-Tabs-Locked.png` | locked mobile seven-tab composition |
| `Analyzer-V2-Half-Window-Locked.png` | locked half-window Overview / Financials / Valuation responsive reference |
| `Analyzer-V2-Tablet-Locked.png` | locked tablet landscape + portrait responsive reference |

Generated mock finance copy never overrides current Product Decisions / Methodology. Preserve the accepted layout and use canonical report semantics.

## One shell, seven tabs

There is one reusable Analyzer shell. The shell does not change per tab.

Canonical tabs, in order:

1. Overview
2. Business
3. Financials
4. Valuation
5. Risks & Thesis
6. Market Context
7. Evidence

Only the selected tab body below the tab rail changes.

Locked shell invariants:

- same global navigation/header geometry for a given responsive mode;
- same company identity + actions row role and alignment;
- same top analysis-row outer geometry;
- same compact BUY / HOLD / SELL verdict slot role;
- same current-price / price-chart slot role;
- same Bear / Base / Bull / Uncertainty supporting order;
- same tab-rail order, placement and selected-state treatment;
- same body-start anchor and content bounds;
- wide-desktop right rail remains Key Stats (TTM) / Market Context / Upcoming Events rather than being reinvented per tab;
- no theme control in Analyzer V2;
- no motivational/decorative filler panel;
- no duplicate generic summary modules unless the content is genuinely unique to that tab and materially improves comprehension.

Tab bodies use the shared 12-column grid. Default supported compositions are `12/12`, `8/4`, `6/6`, `4/4/4`. Other splits require an explicit UX reason. Reuse common module types and shared padding/borders/heading treatment rather than inventing local component languages.

## Responsive contract

Required acceptance targets:

- 32-inch full-screen desktop
- half-window
- iPad landscape
- iPad portrait
- iPhone

A dedicated full-screen 34-inch ultrawide Analyzer layout is **not** a target.

### Wide desktop

- labelled sidebar;
- persistent right rail;
- locked North Star shell;
- body may use the supported multi-column grid when readable.

### Half-window

Half-window is compressed desktop, not enlarged mobile.

- compact icon navigation rail;
- no persistent right rail;
- preserve the desktop visual language and company/analyzer hierarchy;
- keep verdict + price/chart relationship where readable;
- maximum two simultaneous body columns;
- 3/4-up grids collapse to 2-up or full width;
- charts/tables get readable minimum width and stack/restructure before typography shrinks;
- horizontal scrolling is reserved for analytical structures that genuinely need width;
- no half-window-only content or tab-semantic changes.

### Tablet

- compact icon rail in landscape and portrait;
- landscape supports up to two readable columns;
- portrait uses one primary reading column;
- compact paired metrics may remain 2-up only when comfortably readable;
- narrative, charts and dense tables take full width and stack/restructure before type shrinks.

### Phone

- mobile header instead of sidebar/icon rail;
- deliberate stacked hierarchy, not a shrunk desktop;
- same report orientation and tab semantics.

## Compact report header

At half-window, tablet and mobile widths, every report tab preserves this orientation sequence:

**company identity → current price → BUY / HOLD / SELL verdict + Low / Medium / High uncertainty → seven-tab rail with active tab visible**

Overview may then expand into the richer verdict / price-chart summary. Non-Overview tabs use the restrained compact verdict treatment and do not repeat the full Overview hero.

Use **uncertainty**, not `confidence`, for the approved Low / Medium / High state.

## Premium hierarchy

- Company marks support identity; they do not dominate it.
- Keep company logos subordinate to the company-name block and progressively smaller at narrower widths.
- BUY / HOLD / SELL remains the strongest verdict text in the Overview hero, but avoid billboard sizing; prefer weight, semantic colour, spacing and placement.
- Outside Overview, use the restrained compact verdict treatment.
- Apply this consistently across desktop, half-window, tablet and mobile; do not create one-off screen exceptions.

## Product foundation used by Analyzer V2

Analyzer V2 is finance / investment first and AI-enabled second: calm, premium, modern, trustworthy and analytical. Avoid crypto-terminal density, AI-startup spectacle, neon, gratuitous glass, decorative dashboards and card soup.

### Colour / state tokens

These shared tokens are binding. Analyzer V2 ships dark-only, but the implementation stays token-based for future theme work.

| Token | Light | Dark |
|---|---:|---:|
| `--ground` | `#F2EEE5` | `#16181A` |
| `--ink` | `#1F1C17` | `#E9EAE7` |
| `--muted` | `#5F5A50` | `#979CA1` |
| `--hairline` | `#E2DBCC` | `#2C2F33` |
| `--line-strong` | `#CBC2AE` | `#3C4045` |
| `--field` | `#F8F5EE` | `#1E2124` |
| `--gain` | `#1B6B4A` | `#56B98C` |
| `--loss` | `#A3352A` | `#E27A66` |
| `--stale` | `#856713` | `#D9AB45` |

Gain / loss / stale keep their finance meanings and are not decorative colours. Colour never carries state alone.

### Type / numbers

- IBM Plex Sans is the shared V1 family.
- 15px body baseline.
- 13px metadata/status floor.
- 20px shared page/section heading role.
- Larger company/price/display roles are allowed only when deliberate and reusable.
- Use tabular figures for aligned/comparable numbers.
- Raw provider formatting never reaches the UI.
- Primary prose stays roughly 65–80 characters per line.

### Spacing

Shared spacing scale: **4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px**.

Whitespace communicates hierarchy. Extra width reduces compression; it does not justify extra widgets.

## Pre-report states

Analyzer Home, Analyzing and rare True Failure use the same responsive shell modes without report-only chrome.

- **Analyzer Home:** one dominant ticker/company entry action. Input + Analyze may stay inline when readable and stack at narrow portrait/mobile widths. Recent analyses remain a compact list rather than a dashboard grid.
- **Analyzing:** narrow calm vertical progress state with company identity and only the approved user-level stages: Gathering company information / Checking financial data / Running valuation / Preparing analysis. No fake percentage, backend jargon or extra controls.
- **True Failure:** small whole-run fallback with plain-language explanation and the clearest recovery action where one exists. No raw provider/internal error language.

Pre-report states do not render report tabs, verdict placeholders, scenario tiles or right-rail analysis content before a report exists.

## Implementation enforcement

- Implement the Analyzer shell once as reusable layout; tabs supply body content only.
- Add fixed-width visual-regression / screenshot checks at the required acceptance targets so navigation mode, company identity, price/verdict/uncertainty summary, tabs and body-start anchors cannot drift between tabs.
- Do not regenerate accepted desktop/mobile/half-window/tablet screens merely for polish.
- Do not alter methodology, verdict logic or tab semantics while implementing this contract.

## Legacy boundaries

- `DESIGN.md` remains the Portfolio-era / Portfolio-surface design router. It does not govern Analyzer V2.
- `docs/design/m9-analyzer-design-contract.md` is historical / surface-scoped evidence for the prior M9 Analyzer direction. It cannot override this contract.
- `docs/frozen/calboard-stock-analyzer-v1-design.md` and frozen mock HTML files are historical/current-at-source implementation evidence only. They cannot override Analyzer V2.
- The desktop 7-tab contact sheet does not govern Financials where it differs from `Analyzer-V2-Desktop-Financials-Corrected.png`.

## Asset-promotion boundary

The six accepted PNGs are not declared repo-native by this text file. Until their exact approved binaries are deliberately promoted, the Approved Design Artefacts page remains their visual source. Once exact binaries are promoted, update this file to point to their repo paths; do not create regenerated substitutes.

Brand remains separate. The current logo direction / preserved source variants stay on **Cal Finance — Brand Identity & Assets** until the pending small-size / Figma production inspection is complete and a shipped master is promoted.
