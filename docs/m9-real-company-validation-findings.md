# M9 — real-company validation: MSFT and OKLO acceptance runs

**Status: both acceptance runs open, compute, and render on both M9 surfaces. No presentation defect was found in either route. Both runs render `INCOMPLETE` in slot 2 — the verbatim, observed output of today's unchanged `verdict.ts` (`:56`, `:65`, `:72`, `:78`), reported here as the observed result of a nonconforming implementation path awaiting its own outcome, not as a ruled end state for this pass.**

**Update — CF-S44-RECORD-01, 2026-09-21.** Calvin's §4.4 ruling on issue #188 (`CALVIN DECISION`, 2026-09-21T08:19:14Z) has been recorded for MSFT through the existing `recordJudgment` product path and re-run against this run. §1 and §2 below now describe that recorded state; the "no judgment recorded" observation that follows describes the run's original, pre-ruling state and OKLO's continuing state — OKLO has zero tagged candidates, so no selection was ever possible for it and nothing about it changed. MSFT's verdict is still `INCOMPLETE`, for the separate §10.6.2 reason §2 now records.

**Update — CF-REALRUN-CURRENT-01, 2026-09-21, re-run at `2c805b4`.** Both runs
re-observed against current `master`, adding the two M9 surfaces that changed
after this file was last written and had never been observed on a real run:
Market Context's SEC SIC category framing (PR #200, `5b2c728`) and the
verdict slot's evidence-status label (PR #204, `736e773`). Nothing in §1–§3's
prior content changed — the same pipeline, the same MSFT ruling, the same
OKLO absence — so this update only adds the new observations below and one
new named gap in §4. No new capture, no new ticker, no product code change.

**Update — CF-LOOP-UPDATE-01, 2026-09-22.** The `UPDATE` / what-changed half
of the V2 product loop (Calvin's 22 Sep 02:24:07Z ruling, [issue #211
comment 5770328112](https://github.com/calyeap/Cal-Finance/issues/211#issuecomment-5770328112))
is now proved on real MSFT and real OKLO, driven through the same
`recordJudgment` seam CF-S44-RECORD-01 already used, and the same immutable
snapshots CF-V2-PROOF-01 already proved: `lib/analyzer/snapshotComparison.ts`
(`diffStoredSnapshots` / `compareSnapshots`), reading only the two stored
`analyzer_run_snapshots` rows a run's own two versions occupy, never
`analysisForReport` or `computeAnalysisForRun`. Real-run tests:
`lib/analyzer/snapshotComparisonOnRealRun.test.ts`.

- **MSFT — the genuine-change case.** Version 1 is taken before Calvin's
  §4.4 ruling is recorded; version 2, after. Version 1 still reopens exactly
  as §2 above describes it (leverage `LEVERAGE UNSUPPORTED IN v1`, trust
  `UNUSABLE`, range `suppressed`) after version 2 exists. The comparison
  between them reports, with both figures: `fairValueRange` moving from
  `suppressed` to `range` (a suppression clearing, reported as the real
  event it is, not skipped as a null), `gates.leverage` moving from
  `LEVERAGE UNSUPPORTED IN v1` to `PASS`, `trust.status` moving from
  `UNUSABLE` to `PARTIAL`, and `verdict.reason` moving from the
  leverage-unsupported cause to the §10.6.2 comparator-unavailable cause —
  while `verdict.status` (`INCOMPLETE` both versions — deriveVerdict is
  untouched) and `price.value` are reported unchanged, in the same
  comparison, alongside the fields that moved.
- **OKLO — the no-material-change case.** OKLO has zero tagged
  non-operating-investment candidates (§1), so no §4.4 judgment is ever
  possible for it — version 2 is an ordinary refresh of the same inputs.
  The comparison reports zero changed fields and every tracked field
  unchanged, and OKLO's honest upstream `INCOMPLETE` (leverage
  `LEVERAGE UNSUPPORTED IN v1`, trust `UNUSABLE`, range `suppressed`) is
  identical in both versions — the same state §3 already records, now
  proved stable across a refresh rather than merely observed once.

Comparing the same two versions a second time reproduces the identical
result in both cases (asserted by `toEqual`), and the output's field order
is fixed by `snapshotComparison.ts`'s own declared field list, not by
either version's object key enumeration. `deriveVerdict` is not touched;
`lib/analyzer/verdict.ts` stays byte-identical to `367aae2`.

Satisfies the condition #118 item 10 sets. Every M9 surface claim shipped
before this (items 3, 4, 6, 7, 8, 9) rested on `MSFT_FIXTURE` /
`OKLO_FIXTURE`, a synthetic reconstruction of the frozen design mocks
(`lib/analyzer/fixtures/msft.ts:24`). This is the two M9 routes' first
contact with a real fact set: one run per ticker, opened through the same
gated path both routes read (`lib/analyzer/gate.ts`), acquired from the
committed SEC captures (`ANALYZER_OFFLINE=1`) rather than from either
fixture, and rendered through `AnalyzerOverview` and `AnalyzerReport` exactly
as `app/analyzer/[runId]/page.tsx` and `.../report/page.tsx` render them.

The price, company-name, profile, twelve-slot-order, slot-2-presentation,
slot-8-suppression and Section/anchor-order claims below are each a test in
`app/components/analyzerSurfacesOnRealRun.test.tsx`; the `verdict.ts`-hash
and gate-redirect claims are tests in
`lib/analyzer/m9RealCompanyValidationGuards.test.ts`. The remaining
per-ticker figures in §§2–3 (Gate 0/1 results, leverage/trust detail,
`fairValueRange.kind`, the qualifying flags, and every OKLO pre-revenue
figure) are recorded observation from the runs, per SCOPE item 3 — true,
but not separately pinned by an assertion in either test file, **except**
MSFT's ruled figures in §2: the recorded selection, enterprise value,
leverage `PASS` and ratio, trust `PARTIAL`, `fairValueRange.kind`, the
guard against the all-candidates sum, the twelve-slot and slot-2 render
checks, and OKLO's unchanged states, are each pinned by
`lib/analyzer/nonOperatingJudgmentRecordedOnRealRun.test.ts` and
`app/components/nonOperatingJudgmentRecordedOnRealRun.test.tsx`
(CF-S44-RECORD-01); and the two new §2/§3 observations below (Market Context's
rendered SIC classification, Business's rendered capture empty state), each
pinned by a new `it` in `app/components/analyzerSurfacesOnRealRun.test.tsx`
(CF-REALRUN-CURRENT-01). The evidence-status label's absence on both runs was
already pinned, incidentally, by that file's pre-existing slot-2
`.confidence`-is-null assertion — written before `DominantVerdictSlot` grew
the `ConfidenceIndicator` it now guards, and confirmed on this re-run to still
cover it (§2, §3 below).

## 1. The pipeline actually run

For each ticker: `createRun` → clear the spot-check queue from
`loadGateState`'s own `outstandingFactIds` (`CONFIRMED`, no reason code) →
`recordProfileDecision("CONFIRMED", <this run's own Gate 0-derived
recommended profile>, null)` → `computeAnalysisForRun` / `analysisForReport`
(with `call: null`, so the AI layer's own "not configured" path runs
regardless of what credentials happen to be set in the environment running
the suite — HARD BOUNDS forbids any model/AI call here).

No §4.4 non-operating-investments judgment (`recordJudgment`) was recorded
for either run at the time this pass was originally written. The issue's own
SCOPE 1 pipeline did not name that step, and answering it then would have
meant this BUILD run inventing an investment classification for MSFT's or
OKLO's real balance-sheet securities — an analytical judgment that run had
no basis to make.

**CF-S44-RECORD-01, 2026-09-21 — MSFT only.** Calvin has since ruled the
classification on issue #188 (`CALVIN DECISION`, 2026-09-21T08:19:14Z): the
FY2026 `us-gaap:LongTermInvestments` aggregate ($36.348B) alone is MSFT's
non-operating investment balance; the narrower `EquityMethodInvestments` and
`EquitySecuritiesWithoutReadilyDeterminableFairValueAmount` tags are
components of it, not additional amounts, per the primary-source 10-K
addendum on #188. That ruling is now recorded for MSFT's real run —
`recordJudgment(runId, "NON-OPERATING INVESTMENTS", "us-gaap:LongTermInvestments", ...)`
— through the same `selectionToNonOperatingInvestments` → `gate.ts` seam the
pipeline above already used for every other input. **OKLO is unchanged**:
it has zero tagged non-operating-investment candidates, so no selection was
ever possible for it, ruled or otherwise, and its absence was never this
outcome's to fix (an independent missing `treasury-method-dilution` tag
blocks its EV regardless — §4 item 1 below now reflects both facts).

## 2. MSFT

| | |
|---|---|
| Company name (from the real filing) | **`MICROSOFT CORPORATION`** — SEC EDGAR's own `entityName`, upper-case. `MSFT_FIXTURE` uses title case, `"Microsoft Corporation"`. Slot 1 renders whichever string `assembleAnalysisResult` carries; this is the real filing's own name, not a rendering defect. |
| Price | **$499.70**, as of 2026-09-04 (`YAHOO latest close`, recorded capture 2026-09-08). Never `$510.12` — `MSFT_FIXTURE`'s synthetic mock price. |
| Recommended / confirmed profile | `MATURE_PROFITABLE_STABLE_FCF`, same enum `MSFT_FIXTURE` uses — but here it is Gate 0's own classification of the real fact set, not a value carried from the fixture. |
| Gate 0 | `PASS` (sector/industry: Services-Prepackaged Software). |
| Gate 1 | 13 filed years — no suppressing state. |
| Leverage | **`PASS`** — `netDebtRatio` ≈ **0.808%**, below `POLICY.leverageThreshold`'s 10%. Was `LEVERAGE UNSUPPORTED IN v1` before the ruling, because enterprise value was `INCOMPLETE` on §4.4's unanswered judgment (§1 above). |
| Trust | **`PARTIAL`** (was `UNUSABLE`). `determinedBy`: the `MARGIN AT HISTORICAL HIGH` qualifying flag, and 14 diagnostics still `INCOMPLETE` on missing REQUIRED inputs — RONIC, reinvestment, the FCF definitions and P/E among them, and the ±1% rate-sensitivity pair, independently of §4.4 and untouched by this outcome. |
| Fair-value range | **`range`** (was `suppressed`) — bear **$265.00**, bull **$650.00**, unsuppressed now that leverage passes and no suppressing state names the range. |
| Verdict (slot 2 / `DominantVerdictSlot`) | Still **`INCOMPLETE`** — but for a different, separate reason now that trust is no longer `UNUSABLE` and the range is no longer `suppressed`: *"Decision-critical analysis is incomplete — a fair-value range alone cannot determine BUY / HOLD / SELL. Synthesizing a verdict also requires the required-versus-achieved growth comparator (spec §10.6.2), and that fact has not been acquired yet (spec §10.6.5, milestone M8). Recovery: this verdict becomes available once M8 delivers the comparator fact."* Rendered verbatim as the cause line; no `.confidence` element renders (§2.1 slot 2: confidence only when the analysis is not `INCOMPLETE`). This is `verdict.ts`'s own unconditional-`INCOMPLETE` behaviour (byte-unchanged; §5), not a defect this outcome may fix. |
| Qualifying flag | `MARGIN AT HISTORICAL HIGH` (the real operating-margin history) — unaffected by the ruling. |
| Market Context (PR #200) — CF-REALRUN-CURRENT-01 | Renders **`SEC classification (SIC 7372): Services-Prepackaged Software`**, the capture's own `__capture.sic` / `__capture.sicDescription`, beside the fixed "not a peer, index or sector-average comparison" disclaimer — never the "Not yet available" branch. The same SIC and description Gate 0 itself classifies against (§2 table, `Gate 0` row above): one real classification read on both paths, not two. |
| Business (PR #200) — CF-REALRUN-CURRENT-01 | Renders the **disclosed capture empty state**, verbatim: *"Not yet available — 10-K Item 1 excerpts are not part of the committed SEC capture — this run reads captured XBRL facts only, and the extraction rule requires a live EDGAR filing-document fetch. Chosen as the honest empty state for CAPTURE runs rather than extending the capture shape (M9-ITEM5-CONTENT-01 SCOPE item 3)."* `result.business.narrative` is `null`, as `CAPTURE_BUSINESS_CONTENT` (`provider.ts:150-156`) fixes for every `ANALYZER_OFFLINE` run — the filer's own 10-K Item 1 narrative is unreachable from this offline pass by that settled decision, not a defect (§4 item 8 below). |
| Evidence-status label (PR #204) — CF-REALRUN-CURRENT-01 | **Absent.** `DominantVerdictSlot` renders `ConfidenceIndicator` (`.confidence`) only on the completed-verdict branch (`DominantVerdictSlot.tsx:50-56`); this run's verdict is `INCOMPLETE`, so the `INCOMPLETE`-branch markup renders instead (`:41-48`) and no `.confidence` element exists in slot 2 — confirmed by assertion, not merely by reading the branch. |

**Overview — all twelve slots present, none absent.** Slot 1: real company
name, ticker, as-of date. Slot 2: the `INCOMPLETE` presentation above. Slot
3: the price, with *"No price history is in this analysis' fact set"* — the
offline capture (`prices.json`) carries one recorded close per ticker, never
a series, so there is nothing to chart; not a defect. Slot 4: `ValuationStrip`
now shows Bear **$265** / Bull **$650** (the range computes) beside Base
`$510` (`scenarioOutputs.values.base` — computed from the *analyst's*
scenario drivers, which for MSFT are still the validation-set numbers per
`analystInputs.ts`'s own disclosure, not acquired; this is a different,
always-computed diagnostic from the fair-value range itself, and was never
affected by the leverage suppression). Slots 5 and 11: the pre-existing "Not
yet available" structural frames (issue #160 SCOPE item 7 / #171), unchanged.
Slots 6, 7, 9, 10: "the interpretation call has not run for this analysis"
plus the AI layer's `NOT CONFIGURED` note. Slot 8 (price-implied
restatement): **`steadyStateEv` and `pvgoShareOfEv` are no longer
suppressed** — steady-state EV ≈ **$1.10T**, PVGO share of EV ≈ **70.3%** —
now rendering the figures the Analysis Result actually carries, where
before the ruling both showed the `LEVERAGE UNSUPPORTED IN v1` state. Slot
12: the link to Full Analysis.

**Full Analysis — Sections A–J intact, six themed anchors present**
(`business`, `financials`, `valuation`, `risks-thesis`, `market-context`,
`evidence`), in contract order. Section D's diagnostics are mostly
`INCOMPLETE` (RONIC and implied-return-on-new-capital need five years of
delta NOPAT/invested capital that this run's acquisition does not carry;
~~margin history needs a 52-week high/low that was never supplied to this
run — `buildAcquiredRun`'s `fiftyTwoWeek` option is `null` on every acquired
run today, not something this validation introduced~~ **PARTIALLY CLOSED —
M9-FIFTYTWOWEEK-01, PR #184 (`c121a97`, 2026-09-19).** The wiring is fixed:
`gate.ts` now supplies `fiftyTwoWeek` to `buildAcquiredRun`. But on this
offline captured run `fiftyTwoWeek` still resolves to `null` — `gate.ts`'s
own `fiftyTwoWeekRange` fails closed under `ANALYZER_OFFLINE` by design, and
`prices.json` carries one recorded close for MSFT, not a series (§4 finding
2 below) — so margin history stays `INCOMPLETE` for the same reason as
before, now confirmed by
`lib/analyzer/fiftyTwoWeekOfflineOnRealRun.test.ts`). FCF yield + growth
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
| Market Context (PR #200) — CF-REALRUN-CURRENT-01 | Renders **`SEC classification (SIC 4911): Electric Services`**, the capture's own `__capture.sic` / `__capture.sicDescription`, beside the same fixed disclaimer as MSFT — never "Not yet available". Matches Gate 0's own sector/industry classification above. |
| Business (PR #200) — CF-REALRUN-CURRENT-01 | Renders the **same disclosed capture empty state** as MSFT, verbatim (§2 above) — `CAPTURE_BUSINESS_CONTENT` is one fixed constant shared by every `ANALYZER_OFFLINE` run, not computed per ticker. `result.business.narrative` is `null`. |
| Evidence-status label (PR #204) — CF-REALRUN-CURRENT-01 | **Absent**, same reason as MSFT (§2 above): this run's verdict is `INCOMPLETE`, so `DominantVerdictSlot` never reaches the branch that renders `.confidence`. |

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

1. **CLOSED for MSFT, unchanged for OKLO.** No §4.4 non-operating-investments
   judgment was recorded for either run when this finding was first written;
   that was the dominant cause of both runs' suppression. **CF-S44-RECORD-01
   (2026-09-21) records Calvin's ruling (#188) for MSFT** — §2 above — and
   enterprise value, leverage, trust and the fair-value range all change as
   a result. **OKLO is unaffected**: it has zero tagged non-operating-
   investment candidates (§3), so no selection was ever possible for it,
   ruled or otherwise, and an independent missing `treasury-method-dilution`
   tag blocks its EV regardless — not a defect in either M9 route, and not
   this outcome's to fix.
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
7. ~~**52-week high/low is never supplied to an acquired run today**
   (`buildAcquiredRun`'s `fiftyTwoWeek` option is `null` on every call
   `lib/analyzer/gate.ts` makes) — a pre-existing product gap this
   validation surfaces rather than introduces; margin-history and related
   D diagnostics report `INCOMPLETE` on both runs because of it.~~
   **WIRING CLOSED, OBSERVED STATE UNCHANGED — M9-FIFTYTWOWEEK-01, PR #184
   (`c121a97`, 2026-09-19).** `gate.ts` now supplies `fiftyTwoWeek` to both
   `buildAcquiredRun` calls. On these two offline captured runs it still
   resolves to `null` for both MSFT and OKLO: `gate.ts`'s own
   `fiftyTwoWeekRange` fails closed under `ANALYZER_OFFLINE` by design
   (never reaching the provider), and the committed `prices.json` carries
   one recorded close per ticker, not a series (finding 2 above) — there
   is no history to serve even with the wiring gap closed. Margin history
   and the related Section D diagnostics stay `INCOMPLETE` on both runs,
   for this offline-capture reason rather than the old wiring gap, now
   pinned by assertion:
   `lib/analyzer/fiftyTwoWeekOfflineOnRealRun.test.ts` (new).
8. **Business's 10-K Item 1 narrative is unreachable from a capture run, on
   both real tickers — CF-REALRUN-CURRENT-01, 2026-09-21.** `provider.ts`'s
   `fromCapture` always returns the fixed `CAPTURE_BUSINESS_CONTENT` constant
   (`:150-156`) rather than the filer's actual Item 1 text; `businessNarrativeFrom`
   (`:225-265`), which does the real EDGAR filing-document fetch and
   extraction, runs only inside `fromEdgar`, the live path. This is
   `M9-ITEM5-CONTENT-01` SCOPE item 3's own settled, disclosed decision — not
   extending the capture shape to carry a 10-K excerpt — reaffirmed rather
   than reopened here (HARD BOUNDS). Consequence, now observed rather than
   assumed: PR #200's Business half remains validated on the live path only;
   every offline acceptance run, this one included, shows the empty state,
   never the narrative. Pinned by the two new `it` blocks in
   `app/components/analyzerSurfacesOnRealRun.test.tsx` asserting
   `result.business.narrative` is `null` and the disclosed reason renders, on
   both MSFT and OKLO.

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
