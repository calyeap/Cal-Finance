# NVDA — real-run §12 observation

`CF-NVDA-RUN-OBSERVE-01` (issue #296). This document reports the §12
observation `docs/verdict-methodology-reconciliation.md` §12 names as the
minimum evidence the Analyzer finish-line work still lacks: one company
reachable without lifting the no-new-capture/no-EDGAR bound, run through the
same gated product path MSFT and OKLO already run through.

**This document reports. It rules nothing.** It answers none of §11's open
items, marks no acceptance-matrix row satisfied, and changes no acceptance
verdict — those stay Calvin's (`docs/product-decisions.md` items 3 and 9).

## What was done

1. The now-complete, Calvin-approved NVDA Step-7 / §6.3 bundle
   (`docs/analyst-drafts/nvda-step7-draft.md`, approved field values as they
   stand at `0753051`, PR #295) was transcribed byte-faithful into
   `RecordedAnalystBundleInput` and recorded for `NVDA` through
   `recordAnalystBundle` — the same path `/analyzer/inputs/NVDA` writes.
2. One real run was opened through the same gated product path MSFT and
   OKLO already run through: `createRun("NVDA", …)` → every queued fact
   confirmed → the profile decision recorded → `computeAnalysisForRun`.
3. The §4.4 non-operating-investments judgment was left **unmade** on this
   run (SCOPE item 3) — no selection among the candidate tags, no proposed
   value, the same state OKLO's own real run already reaches.
4. The reproducing test is
   `lib/analyzer/nvdaRealRunObservation.test.ts` — it records the same
   transcribed bundle, drives the same gated path, and asserts every figure
   quoted below directly off the run's own output. It deletes the recorded
   row before and after itself (the same discipline
   `nvdaAnalystDraftValidation.test.ts`'s own throwaway ticker already
   uses), so this outcome leaves no ticker-support pin elsewhere
   contradicted.

NVDA still has no `BUNDLES` entry, no hand-written
`TICKERS_WITH_ANALYST_INPUTS` change and no fixture — it becomes reachable
only through the recorded store, by the same act a human performs at
`/analyzer/inputs/NVDA`, exactly as this outcome's HARD BOUNDS require.

## (a) The reverse-DCF grid and the RONIC ladder behind it

**The RONIC ladder itself** (`diagnostics.reinvestmentRonic.ronic`, read
independent of enterprise value / §4.4) is:

```
suppressed: true, state: "INCOMPLETE"
cause: "missing REQUIRED input(s): fiveYearDeltaNopat, fiveYearDeltaInvestedCapital"
```

This is **not** a reading of NVDA's own five-year returns — it is a
structural, pipeline-wide gap. `lib/analyzer/acquisition/companyInputs.ts`
hard-codes both `ronic.fiveYearDeltaNopat` and
`ronic.fiveYearDeltaInvestedCapital` to `null` for every company this
mapping version acquires (lines 402–406); `scripts/analyzer/calibrate-
position.ts` already documents this in its own comment ("RONIC is not
acquired in this mapping version — companyInputs.ts holds both five-year
deltas at null — so the ladder has no cells at all"). NVDA's capture was
never read for this figure at all — the gap exists before any company-
specific data would be consulted.

**The reverse-DCF grid itself** (`priceImplied.reverseDcfGrid`, all nine
cells: 8/10/12% × current/median/stress margin) is, on this run:

```
9/9 cells: fiveYearGrowth, tenYearCagr, year10Revenue, ronic — all suppressed
state: "INCOMPLETE"
cause: "missing REQUIRED input(s): targetEnterpriseValue"
```

Because §4.4 is left unmade on this run, enterprise value is itself
INCOMPLETE, and `computeReverseDcfGrid`'s own missing-base check
(`baseYearRevenue`, `targetEnterpriseValue`, `currentMargin`,
`nopatTaxRate`) fires before any per-cell RONIC check is ever reached
(`lib/analyzer/modules/reverseDcf.ts:110-148`) — every cell reports the more
upstream cause, not the RONIC-specific one. MSFT's own real run reaches the
RONIC-specific cause ("RONIC not meaningful for this company (§7.2 M5
ladder)") only because `reverseDcfOnRealRun.test.ts` separately answers
§4.4 (`nonOperatingInvestments: { tags: [], value: 0, errorDirection: null
}`) to get past the EV gate first — this outcome's HARD BOUNDS forbid doing
that for NVDA.

**Answer to §12's question.** NVDA's ladder is **not** a case of "not
uniformly NOT MEANINGFUL" — it is uniformly **unacquired** (INCOMPLETE),
which is the same practical dead end MSFT's ladder reaches ("RONIC not
meaningful for this company"), for the identical underlying reason
(`fiveYearDeltaNopat`/`fiveYearDeltaInvestedCapital` never acquired). §12's
first evidence-gap bullet — "at least one company whose RONIC ladder is
**not** uniformly NOT MEANINGFUL" — is **not closed** by this run. This is
a pipeline-wide gap common to every company this acquisition pipeline
reaches today, not a fact about NVDA's own fundamentals, and this document
does not propose lifting it (that would be new capture/methodology work,
outside this outcome's bound).

## (b) The achieved-comparator: ten-year and five-year, on the same series

**Ten-year** — already wired onto `AnalysisResult.achievedRevenueCagr`
(`companyInputs.ts` calls `achievedRevenueCagr(revenueAnnualSeries, 10,
revenueRecency)` and threads the result straight through):

```
tag: "us-gaap:Revenues"
window: FY2016 -> FY2026 (yearsStale: 0)
fromValue: $5,010M, toValue: $215,938M
cagr: 45.6965...% (0.457 to 3 significant places)
```

**Five-year** — `AnalysisResult` does not carry a five-year comparator for
any run today (§13's own "`achievedRevenueCagr` remains unwired" gap is
closed only for the ten-year horizon). Computed here from the **exact same**
acquired `CompanyFactsDocument` and the exact same `comparatorRecency`
evidence this run's own acquisition already used for the ten-year figure —
the same pure function (`lib/analyzer/calibration/inputs.ts`'s
`achievedRevenueCagr`), a different `horizonYears` argument, no new capture,
no second harness (the same pattern `scripts/analyzer/calibrate-
position.ts` already uses to compute both horizons side by side):

```
tag: "us-gaap:Revenues"
window: FY2021 -> FY2026 (yearsStale: 0)
fromValue: $16,675M, toValue: $215,938M
cagr: 66.8986...% (0.669 to 3 significant places)
```

**Answer to §12's question.** Both a ten-year and a five-year achieved
comparator ARE constructible on NVDA's real capture, on the **same**
single-tag series (`us-gaap:Revenues`), with no window-recency refusal
(`yearsStale: 0` on both, `comparatorRecency` finds no live series NVDA's
mapping skipped over). §12's second evidence-gap bullet — "at least one
company producing both a ten-year and a five-year achieved comparator on
the same series" — **is closed** by NVDA. This is a genuine difference from
MSFT (no multi-year single-tag series exists at all — its fixture is a
synthetic reconstruction) and from OKLO (blocked upstream at Gate 1,
`HISTORY INSUFFICIENT`). This document draws no conclusion from the two
figures themselves (a 21-point acceleration from the ten-year to the
five-year window) — reading what that difference means is a finding this
outcome's HARD BOUNDS place out of scope.

## (c) Every suppressed / INCOMPLETE output on this run, with the code's own cause

| Output | State | Cause (verbatim) |
|---|---|---|
| Price | — (sentinel) | `AnalysisResult.price` is `{ value: 0, timestamp: "" }` (`buildAcquiredRun`'s own "no price" sentinel, never `null`); the run's own disclosure states: *"No price was available for this run, so anything that needs one reports incomplete. A price is never estimated or carried forward from an earlier day."* No `NVDA` row exists in `prices.json` — the honest expected result under **FINAL OWNER RULING #205**, not a defect. |
| Enterprise value (`diagnostics.enterpriseValue`) | `INCOMPLETE` | `missing REQUIRED input(s): treasuryMethodDilution, financeLeaseLiabilities, nonOperatingEquityInvestmentsAtBook` — **three** missing inputs, only the third of which is the unmade §4.4 judgment; the first two are pre-existing tag-mapping gaps on this filer's capture (the same class of gap the draft's own text already names for `ShortTermInvestments`/`FinanceLeaseLiability`), independent of §4.4 and not cleared by a §4.4 answer alone. |
| RONIC ladder (`diagnostics.reinvestmentRonic.ronic`) | `INCOMPLETE` | `missing REQUIRED input(s): fiveYearDeltaNopat, fiveYearDeltaInvestedCapital` — see (a) above. |
| Reverse-DCF grid, all 9 cells (`priceImplied.reverseDcfGrid`) | `INCOMPLETE` | `missing REQUIRED input(s): targetEnterpriseValue` — cascaded from enterprise value above; see (a) above. |
| Leverage gate (`gates.leverage`) | `LEVERAGE UNSUPPORTED IN v1` | `netDebtRatio` is `null` — "inputs missing — the ratio could not be computed, so the precondition fails closed" — cascaded from enterprise value. |
| Fair-value range (`fairValueRange`) | suppressed, `LEVERAGE UNSUPPORTED IN v1` | same cause as leverage above — §3.5's own suppression-scope rule. |
| Trust (`trust.status`) | `UNUSABLE` | determined by the same `LEVERAGE UNSUPPORTED IN v1` suppressing state. |
| Verdict (`deriveVerdict`) | `INCOMPLETE` | *"Decision-critical analysis is incomplete — LEVERAGE UNSUPPORTED IN v1 — inputs missing — the ratio could not be computed, so the precondition fails closed."* |
| FCF yield + growth | `PRECONDITION FAILED` | listed in `states.suppressing` — cascaded from the same leverage precondition. |
| ±1% rate sensitivity / rate-at-which-base-equals-price | `INCOMPLETE` | "missing REQUIRED input: … none was supplied for this run" — no `revalueBaseCaseAtRate` solver exists for a recorded bundle (`recordedBundles.ts`'s own contract: always `null`), the same absence MSFT's committed bundle already discloses (CB-AUDIT-01 H2). |
| Gate 1 | `PASS` (13 filed years) | not suppressed — named here only to confirm it is not the blocker. |
| Gate 0 | `PASS` | sector/industry classification resolved from the SIC code; not suppressed. |
| Trigger B (worst single-year margin decline) | fired | 21.65pt decline (FY2022→FY2023) — not a suppression, an analytic flag. |

**What the unmade §4.4 judgment costs, precisely.** Per SCOPE item 3: it is
one of three missing inputs behind enterprise value's own INCOMPLETE state,
not the only one. Making it (selecting among the candidate tags) would
still leave enterprise value INCOMPLETE on this capture, because
`treasuryMethodDilution` and `financeLeaseLiabilities` are independently
absent from NVDA's mapped tags. This document does not make that judgment
and does not speculate further about what answering it plus fixing the two
tag-mapping gaps would produce — that combination is outside this outcome's
SCOPE and HARD BOUNDS.

**The four §4.4 candidate tags, as evidence for Calvin's later judgment
only** — not a selection made here:

| Candidate tag | Value | As of | Form |
|---|---|---|---|
| `us-gaap:EquitySecuritiesWithoutReadilyDeterminableFairValueAmount` | $47,898M | 2026-07-26 | 10-Q |
| `us-gaap:EquityMethodInvestments` | *(absent from this capture)* | — | — |
| `us-gaap:EquitySecuritiesFvNiCurrentAndNoncurrent` | *(absent from this capture)* | — | — |
| `us-gaap:LongTermInvestments` | *(absent from this capture)* | — | — |

Only one of the four candidates resolves anything on this filer's capture —
narrower than the draft's own framing of "the four candidate tags" might
suggest. This is reported as evidence, not interpreted.

## An unrelated observation, reported not fixed

`scenarioOutputs.priceLocationWithinRange` (`lib/analyzer/modules/
scenarioOutputs.ts:156`) computes `(currentPrice − bear) ÷ (bull − bear)`
directly off `fixture.price`, which is the same zero-value "no price"
sentinel described above — it is not gated on price availability the way
`calibration/inputs.ts`'s own `priceLocationWithinRange` is (that one
explicitly returns `blocked("no price")`). On this run it silently reports
`-0.1046` (≈ "10.5% below the bear case"), a number with no real price
behind it, without a suppressed/INCOMPLETE state. This is reported as an
observed fact about the current build's output — not a defect this outcome
diagnoses, rules on, or fixes (HARD BOUNDS: transcription and reporting
only), and not something this document is naming a required correction to.

## Summary against §12

| §12 evidence gap | Closed by NVDA? |
|---|---|
| A company whose RONIC ladder is not uniformly NOT MEANINGFUL | **No** — uniformly unacquired (INCOMPLETE), the same practical dead end as MSFT, for a pipeline-wide reason (§12(a) above). |
| A company producing both a ten-year and five-year achieved comparator on the same series | **Yes** — FY2016→FY2026 (45.70%) and FY2021→FY2026 (66.90%), both on `us-gaap:Revenues` (§12(b) above). |

This document states what the observation does and does not supply against
§12's list. It concludes nothing about which way any §11 open item should
be ruled, and marks no acceptance-matrix row satisfied — those remain
Calvin's.
