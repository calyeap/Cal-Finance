# CF-ANALYZER-NORTHSTAR-VISUAL-RESTORE-01 — visual evidence

Real browser (Chromium via Playwright) screenshots of the MSFT fixture report,
captured against a throwaway local preview route (not part of this PR's
diff — created, used, and deleted within the same session) that renders the
exact same `AnalyzerShell` / `AnalyzerReportFrame` / tab-body components the
real DB-backed `/analyzer/{runId}` route renders, against the deterministic
`MSFT_FIXTURE` (`lib/analyzer/fixtures/msft.ts`). No fabricated or
AI-generated mock images.

- **Before**: `master@451cf4431d1928329b944fbf893a1345deeccf3b` (this PR's
  base, dispatch HEAD for issue #416).
- **After**: this PR's head.

| File | Viewport | Tab |
|---|---|---|
| `*-desktop-overview.png` | 1920×1080 | Overview |
| `*-half-window-overview.png` | 960×900 | Overview |
| `*-phone-overview.png` | 390×844 | Overview |
| `*-desktop-financials.png` | 1920×1080 | Financials (non-Overview) |

## Reference-image access disclosure (HARD GATE ZERO)

The exact named binary (`Analyzer-V2-Desktop-North-Star.png`, in Calvin's
ChatGPT Library) is not reachable from this session — only the **Notion
Visual Vault's embedded duplicate** is (`CAL FINANCE — Visual Vault`,
heading "NORTH STAR — STOCK ANALYZER UI"). That embedded image was
downloaded and visually inspected directly (actual pixels, not a
description): 1536×1024 PNG, Apple/AAPL example, dark navy dashboard, green
BUY verdict tile with a real line chart beside it, Bear/Base/Bull +
"Attractive Price Range" row, a 7-tab rail (Overview/Business/Financials/
Valuation/Risks & Thesis/Market Context/Evidence), and a three-block right
rail (Key Stats/Market Context/Upcoming Events) — consistent with the
binary's own named description. Per the issue's own stated fallback, this
narrow composition match is disclosed as **PROVISIONAL** against the exact
binary, not asserted byte-identical.

## What changed, and what deliberately did not

1. **Hero verdict hierarchy** — the verdict slot is now a bordered card
   (`.az-hero-verdict`), left-aligned, with the plain-English incomplete
   headline rendered larger and ink-coloured instead of the small muted
   suppressing-state note it was. No BUY/HOLD/SELL is shown where
   `deriveVerdict` has no supported decision (MSFT's fixture is
   INCOMPLETE) — a real completed-verdict render is out of this PR's
   evidence (no fixture reaches that path today), and no status colour is
   introduced (`--gain`/`--loss`/`--stale` are not referenced anywhere in
   the new CSS — see `m9AcceptanceGaps.test.ts`'s existing colour-
   independence guard, unaffected).
2. **Compact valuation presentation** — tighter padding/margins on the
   Overview hero's own instance of the shared `.atglance`/`.hframe`/`.pi`
   classes (`.az-hero-scenarios` scoping), leaving Section H elsewhere (the
   Valuation tab body, same classes) untouched. No figure, label, guard, or
   number format changed — see `before-desktop-financials.png` vs
   `after-desktop-financials.png`: the non-Overview tab body is pixel-for-
   pixel identical except for the shared hero/actions chrome above it.
3. **Consolidated actions** — "Save this version" and "Look at this company
   again" now sit in one row (`.az-actions`) instead of two stacked
   full-width bands.

## Residual fidelity differences from the North Star (by design, not left undone)

- No historical line chart — `PriceChartPanel.tsx` is untouched; a real
  price series does not exist in `AnalysisResult` for any run today, and
  inventing one is explicitly out of scope.
- No colored BUY tile, no "Attractive Price Range" — both would mean
  showing a decision or a methodology clause this build does not support
  for the rendered fixture.
- The left sidebar / full app chrome (Dashboard/Holdings/search bar) in the
  North Star image belongs to an older, superseded app shell, not this
  outcome's three approved Overview-hero/action changes.
