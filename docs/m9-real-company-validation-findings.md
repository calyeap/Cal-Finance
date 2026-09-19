# M9 — real-company validation: MSFT and OKLO acceptance runs

**Status: both acceptance runs open, compute, and render on both M9 surfaces. No presentation defect was found in either route. Both runs land on `INCOMPLETE`, which is the expected, first-class result for this pass (Calvin's `CALVIN DECISION`, 19 Sep 2026 09:07:39Z, option (B)).**

This closes #118 runway item 10. Every M9 surface claim shipped before this
(items 3, 4, 6, 7, 8, 9) rested on `MSFT_FIXTURE` / `OKLO_FIXTURE`, a
synthetic reconstruction of the frozen design mocks
(`lib/analyzer/fixtures/msft.ts:24`). This is the two M9 routes' first
contact with a real fact set: one run per ticker, opened through the same
gated path both routes read (`lib/analyzer/gate.ts`), acquired from the
committed SEC captures (`ANALYZER_OFFLINE=1`) rather than from either
fixture, and rendered through `AnalyzerOverview` and `AnalyzerReport` exactly
as `app/analyzer/[runId]/page.tsx` and `.../report/page.tsx` render them.

Every claim below is a test in
`app/components/analyzerSurfacesOnRealRun.test.tsx` and
`lib/analyzer/m9RealCompanyValidationGuards.test.ts`, not only a statement
here.

## 1. The pipeline actually run

For each ticker: `createRun` → clear the spot-check queue from
`loadGateState`'s own `outstandingFactIds` (`CONFIRMED`, no reason code) →
`recordProfileDecision("CONFIRMED", <this run's own Gate 0-derived
recommended profile>, null)` → `computeAnalysisForRun` / `analysisForReport`
(with `call: null`, so the AI layer's own "not configured" path runs
regardless of what credentials happen to be set in the environment running
the suite — HARD BOUNDS forbids any model/AI call here).

No §4.4 non-operating-investments judgment (`recordJudgment`) was recorded
for either run. The issue's own SCOPE 1 pipeline does not name that step,
and answering it would mean this BUILD run inventing an investment
classification for MSFT's or OKLO's real balance-sheet securities — an
analytical judgment this run has no basis to make and HARD BOUNDS forbids
inventing. Its absence is itself the largest single finding below.

## 2. MSFT

| | |
|---|---|
| Company name (from the real filing) | **`MICROSOFT CORPORATION`** — SEC EDGAR's own `entityName`, upper-case. `MSFT_FIXTURE` uses title case, `"Microsoft Corporation"`. Slot 1 renders whichever string `assembleAnalysisResult` carries; this is the real filing's own name, not a rendering defect. |
| Price | **$499.70**, as of 2026-09-04 (`YAHOO latest close`, recorded capture 2026-09-08). Never `$510.12` — `MSFT_FIXTURE`'s synthetic mock price. |
| Recommended / confirmed profile | `MATURE_PROFITABLE_STABLE_FCF`, same enum `MSFT_FIXTURE` uses — but here it is Gate 0's own classification of the real fact set, not a value carried from the fixture. |
| Gate 0 | `PASS` (sector/industry: Services-Prepackaged Software). |
| Gate 1 | 13 filed years — no suppressing state. |
| Leverage | `LEVERAGE UNSUPPORTED IN v1` — `netDebtRatio` is `null` because enterprise value is `INCOMPLETE` (§4.4's judgment, §1 above). |
| Trust | `UNUSABLE`, `determinedBy` naming `LEVERAGE UNSUPPORTED IN v1`. |
| Fair-value range | `suppressed` (`state: "LEVERAGE UNSUPPORTED IN v1"`) — §9.3's rule removes the range under any suppressing state that names it, ahead of computing one. |
| Verdict (slot 2 / `DominantVerdictSlot`) | `INCOMPLETE` — *"Decision-critical analysis is incomplete — LEVERAGE UNSUPPORTED IN v1 — inputs missing — the ratio could not be computed, so the precondition fails closed."* Rendered verbatim as the cause line; no `.confidence` element renders (§2.1 slot 2: confidence only when the analysis is not `INCOMPLETE`). |
| Qualifying flag | `MARGIN AT HISTORICAL HIGH` (the real operating-margin history). |

**Overview — all twelve slots present, none absent.** Slot 1: real company
name, ticker, as-of date. Slot 2: the `INCOMPLETE` presentation above. Slot
3: the price, with *"No price history is in this analysis' fact set"* — the
offline capture (`prices.json`) carries one recorded close per ticker, never
a series, so there is nothing to chart; not a defect. Slot 4: `ValuationStrip`
shows Bear `—` / Bull `—` (the range is suppressed) beside Base `$510`
(`scenarioOutputs.values.base` — computed from the *analyst's* scenario
drivers, which for MSFT are still the validation-set numbers per
`analystInputs.ts`'s own disclosure, not acquired; this is a different,
always-computed diagnostic from the fair-value range itself, so it is
unaffected by the leverage suppression), then the `LEVERAGE UNSUPPORTED IN
v1` state for the range itself. Slots 5 and 11: the pre-existing "Not yet
available" structural frames (issue #160 SCOPE item 7 / #171), unchanged.
Slots 6, 7, 9, 10: "the interpretation call has not run for this analysis"
plus the AI layer's `NOT CONFIGURED` note. Slot 8 (price-implied restatement):
`steadyStateEv` and `pvgoShareOfEv` are both suppressed, so the slot shows
the `LEVERAGE UNSUPPORTED IN v1` state — never a numeral the Analysis Result
does not carry. Slot 12: the link to Full Analysis.

**Full Analysis — Sections A–J intact, six themed anchors present**
(`business`, `financials`, `valuation`, `risks-thesis`, `market-context`,
`evidence`), in contract order. Section D's diagnostics are mostly
`INCOMPLETE` (RONIC and implied-return-on-new-capital need five years of
delta NOPAT/invested capital that this run's acquisition does not carry;
margin history needs a 52-week high/low that was never supplied to this
run — `buildAcquiredRun`'s `fiftyTwoWeek` option is `null` on every acquired
run today, not something this validation introduced). FCF yield + growth
shows `PRECONDITION FAILED`. No pre-revenue-only D subsection renders, as
expected for this profile.

## 3. OKLO

| | |
|---|---|
| Company name | `Oklo Inc.` — matches `OKLO_FIXTURE`'s spelling (coincidence; SEC EDGAR's own `entityName` for this capture happens to already be mixed-case). |
| Price | **$41.27**, as of 2026-09-04 (recorded capture). Never `$14.50` — `OKLO_FIXTURE`'s placeholder mock price (the fixture's own comment records it as a placeholder, not a real quote). |
| Recommended / confirmed profile | `PRE_REVENUE_UNPROFITABLE` — Gate 0's own classification of the real fact set. |
| Gate 0 | `PASS` (sector/industry: Electric Services). |
| Gate 1 | 5 filed years → `SHORT HISTORY` qualifying flag (labelled, not suppressed). |
| Leverage | `LEVERAGE UNSUPPORTED IN v1`, same cause as MSFT (§1). |
| Trust | `UNUSABLE`. |
| Fair-value range | **`suppressed`, not `pre-revenue-distribution`.** This is the one outcome-level difference from every existing OKLO fixture test (`verdict.test.ts`, `AnalyzerReport.test.tsx`), which always drive `OKLO_FIXTURE` directly and so never exercise an unanswered §4.4 judgment. Read against `assemble.ts`'s own suppression order (`rangeRemovedBy = stateRemovingFairValueRange(suppressing)`, evaluated before the pre-revenue/range branch is chosen), this is the documented, intended rule — leverage suppression removes the range ahead of shaping it — not a defect. Recorded as a real difference in *shape*, confirmed correct by reading the suppression code, not fixed. |
| Verdict | `INCOMPLETE`, the same `LEVERAGE UNSUPPORTED IN v1` reason string as MSFT — both runs share one cause, for the same reason (§1). |

**The pre-revenue module itself is fully populated from the real filing,
independent of the leverage suppression above** (it is not one of the
things leverage suppresses):

- cash-per-share (failure basis): **$8.8417/share**, as of 2026-06-30, `SPOT-CHECK NOT REQUIRED`.
- quarterly burn: **$17,867,000**, for the quarter 2026-01-01 to 2026-03-31.
- runway: **≈92 quarters**.
- unit-economics breakeven: **$234.82/unit**.
- dilution required (back-loaded reference): **$150,240,591**.
- four success definitions (`$0`, `$1`, `$31`, `$48` per share) — every one
  reports `NOT COMPUTED / SUPPRESSED — V_success's valuation date is not
  established`, exactly as `analystInputs.ts`'s own comment predicts for
  OKLO (the validation set never authored one).

These are real, EDGAR-derived numbers, materially different from
`OKLO_FIXTURE`'s hand-written ones — the clearest evidence in this pass that
the acquired path is genuinely running, not reusing the fixture.

**Overview — all twelve slots present, none absent**, same shape as MSFT.
Slot 4 shows *"Failure — cash floor $8.84"* (real) beside *"Success as
described —"* (suppressed, since this run's `fairValueRange.kind` is
`suppressed` rather than `pre-revenue-distribution`) and the current price.
Slots 5–11 mirror MSFT (structural frames, interpretation not run, slot 8
showing the `LEVERAGE UNSUPPORTED IN v1` state).

**Full Analysis — Sections A–J intact, six themed anchors present**, same
order as MSFT. Section D additionally carries all three pre-revenue-only
subsections (*"D — Price-implied success weight"*, *"D — Unit economics and
the scale solve"*, *"D — Funding stack"*) populated with the real figures
above.

## 4. Named gaps — recorded, not fixed here

1. **No §4.4 non-operating-investments judgment was recorded for either
   run.** This is the dominant cause of both runs' suppression: enterprise
   value is `INCOMPLETE`, leverage fails closed, trust is `UNUSABLE`, and
   the fair-value range is suppressed under that one cause on both tickers
   — not evidence about either company's actual leverage, and not a defect
   in either M9 route. A future pass that records an answer (through the
   same `recordJudgment` seam the facts screen already uses) would let the
   range compute end-to-end and is the natural next real-data step, but
   recording one here would be this outcome inventing an analyst judgment,
   which HARD BOUNDS forbids.
2. **Neither run has price history.** The offline capture (`prices.json`)
   carries one recorded close per ticker, not a series; slot 3 renders *"No
   price history is in this analysis' fact set"* on both. Not a defect —
   the capture was never meant to carry history.
3. **MSFT's real filing name is upper-case** (`MICROSOFT CORPORATION`)
   where the fixture used title case. The real filing's own string, not a
   rendering defect.
4. **OKLO's real run does not reach the `pre-revenue-distribution` range
   shape** that every existing `OKLO_FIXTURE` test shows — superseded by the
   leverage suppression (finding in §3 above). Confirmed correct against
   `assemble.ts`'s own suppression ordering; not fixed.
5. **Slots 5 and 11 still have no approved content source** (issue #160
   SCOPE item 7 / #171) — reproduced identically on both real runs,
   unchanged by this outcome.
6. **The interpretation and challenger calls do not run**, per HARD BOUNDS
   (no model/AI call in this outcome) — both surfaces render the AI layer's
   `NOT CONFIGURED` note on both runs.
7. **52-week high/low is never supplied to an acquired run today**
   (`buildAcquiredRun`'s `fiftyTwoWeek` option is `null` on every call
   `lib/analyzer/gate.ts` makes) — a pre-existing product gap this
   validation surfaces rather than introduces; margin-history and related
   D diagnostics report `INCOMPLETE` on both runs because of it.

## 5. What this outcome does not do

No fix was made to either M9 route, `AnalyzerOverview`, `AnalyzerReport`,
`ValuationStrip`, or `ScenarioRangeStrip`: everything in §§2–3 rendered
correctly against real data on first contact, so SCOPE item 4's "fix only
what this validation proves is a presentation defect" finds nothing to fix.
`lib/analyzer/verdict.ts` is byte-unchanged (asserted by
`m9RealCompanyValidationGuards.test.ts`); no cut-point, band, threshold or
comparator was added anywhere; the two gate redirects are byte-for-byte
unchanged (same file); `globals.css`'s M9 token blocks remain byte-identical
per the pre-existing checks in `app/globalsCss.test.ts`. This outcome
produces real-run evidence only — no item 11 acceptance claim (visual,
responsive, finance-logic, evidence/provenance, regression) is made here.
