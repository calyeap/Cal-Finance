# AR7 report content — real-run evidence (issue #456)

Screenshots of the running app (`next dev`) on one real MSFT run, after the
AR7 build. The run is valued on the same price-blind DRAFT sheet Calvin
reviewed in the AR7 prototype (`docs/evidence/ar7-prototype/msft-run.json`),
with live SEC EDGAR filings and the live Yahoo close (MSFT $533.52, 19 Oct
2026). No model call was made: the interpretation and challenger did not run,
so the "Strongest argument against" item shows its labelled empty slot.

| Width | Viewport | Files |
|---|---|---|
| 32-inch desktop | 2560 × 1440 | `desktop-32in-{overview,financials,valuation,home}.png` |
| Half-window | 1280 × 1440 | `half-window-{overview,financials,valuation}.png` |
| iPad landscape | 1180 × 820 | `ipad-landscape-{overview,financials,valuation}.png` |
| iPad portrait | 820 × 1180 | `ipad-portrait-{overview,financials,valuation}.png` |
| iPhone | 390 × 844 | `iphone-{overview,financials,valuation,home}.png` |

All seven tabs were loaded at all five widths (35 page loads): none widens the
page past the viewport. Wide analytical tables (the statements, the
assumption sheet, the Evidence ledgers) scroll inside their own container.

Warm tab loads on the dev server, browser to network-idle: 1.0–1.3 s per tab
(first Overview load at 32-inch 2.5 s). The speed fix itself is proven by
deterministic tests, not wall-clock timing:
`app/analyzer/analyzerTabAiLayerCost.test.tsx` (one gate-state load per view;
no AI-layer call on Business, Financials, Valuation, Market Context) and
`lib/analyzer/acquisition/provider.test.ts` (one SEC ticker-directory fetch per
TTL; companyFacts and submissions requested together).

## Reproduce

```
# a scratch database, migrated, with the prototype's sheet recorded for MSFT
npm run migrate                                   # DATABASE_URL=<scratch db>
# append docs/evidence/ar7-prototype/msft-run.json's sheet (appendSheet) and
# its #188 non-operating selection (recordCompanyJudgmentOverride), create a
# run (createRun), then with the app running:
node scripts/analyzer/shoot-ar7-report.mjs http://127.0.0.1:3000 <runId> docs/evidence/ar7-report/screenshots
```
