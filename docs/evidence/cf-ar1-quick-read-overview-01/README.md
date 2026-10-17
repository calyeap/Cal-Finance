# CF-AR1-QUICK-READ-OVERVIEW-01 — visual evidence

Real browser (Chromium via Playwright) full-page screenshots of the Overview
tab for the MSFT fixture run, captured against a throwaway local preview
route (not part of this PR's diff — created, used and deleted within the
same session) that renders the same `AnalyzerShell` / `AnalyzerTopBar` /
`AnalyzerReportFrame` / `AnalyzerOverview` tree the DB-backed
`/analyzer/{runId}` route renders, on `assembleAnalysisResult(MSFT_FIXTURE)`
(`lib/analyzer/fixtures/msft.ts`) with the app's own `globals.css`. The
Next.js dev-overlay badge was removed from the DOM before capture. No
fabricated or AI-generated images.

Captured on this PR's code at `0a8adf2f7419c4c5aa10e4449dc7e36ba541fc43`
(this evidence commit changes no source file).

| File | Viewport | Design-authority width |
|---|---|---|
| `overview-2560x1440.png` | 2560×1440 | 32-inch full screen |
| `overview-1280x1440.png` | 1280×1440 | half window |
| `overview-1024x768.png` | 1024×768 | iPad landscape |
| `overview-768x1024.png` | 768×1024 | iPad portrait |
| `overview-390x844.png` | 390×844 | iPhone |

Checked at each width by the capture script: `#slot-quickread` present (1),
"Rate convention under review" caveat present (1), no horizontal page
overflow (`scrollWidth − innerWidth` ≤ 0).

Visible in the images: Quick read is the first block of the Overview body;
the HOLD verdict card carries the rate-convention caveat under its
rationale; the hero's Bear/Base/Bull/Current-price grid is the only such
grid on the page. Observation for REVIEW, not changed here: the
`MARGIN AT HISTORICAL HIGH` flag label renders in capitals inside two Quick
read items (a flag name, not a `states.suppressing` code).
