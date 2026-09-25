# MSFT range-capture gate — Step 4's remaining policy decision, restated against real numbers

**Outcome:** `CF-STEP4-MSFT-RANGE-CAPTURE-01` ([issue #324](https://github.com/calyeap/Cal-Finance/issues/324)).
**Authority:** `CALVIN RULING — A`, 25 Sep 2026 09:59:49Z
([PR #323 comment 5830507368](https://github.com/calyeap/Cal-Finance/pull/323#issuecomment-5830507368)):
*"after the capture, use the existing sensitivity/tornado machinery and
return the smallest remaining Step 4 policy decision as **one combined
Calvin gate**, not separate drip-fed questions."*

**This is a draft, not a decision.** Per `docs/product-decisions.md` items 3
and 9, nothing here is adopted. No Step 4 quantity is chosen, no
fair-value-zone width is set, no dispersion tier or threshold is adopted,
`deriveVerdict` is unchanged, and no `docs/acceptance-matrix.md` row is
marked satisfied (row 11 stays `WITHHELD`, byte-untouched). This document
restates `docs/verdict-decision-pack.md` §1's already-drafted `(a)`/`(b)`
gate against MSFT's *actual* real-run numbers, per ruling A's own
instruction — it does not re-open, re-derive, or re-argue the options
themselves.

**Head SHA.** Every figure below was produced by
`lib/analyzer/msftSensitivityCaptureOnRealRun.test.ts`, run against
`origin/master` = `0c90cd46819a87a9d8c3e54457d5417d8911a684` plus this PR's
own diff, via:

```
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/calboard_test \
  npx vitest run lib/analyzer/msftSensitivityCaptureOnRealRun.test.ts
```

That test drives MSFT's real acquired run (the same gated path
`step4SignalObservationOnRealRun.test.ts`'s `openMsftRunWithRuling` already
uses) through `result.diagnostics.sensitivity`, and pins every value quoted
below with a `toString()`/`toEqual()` assertion — nothing here is carried
from this issue's body or from `docs/step4-forecast-dispersion.md` without
re-checking.

## 1. What the capture is

Two `AnalystSuppliedRange` values, added in
`lib/analyzer/acquisition/analystInputs.ts` (`sensitivityRangesFor`), MSFT
only:

- **Growth:** 10.0% / 13.7% / 18.5% — MSFT's own bear/base/bull scenario
  growth assumptions, already authored in `fixtures/msft.ts`'s `scenarios`
  block, cited here as the analyst's own already-recorded anchors.
- **Operating margin:** 38.0% / 41.8% / 46.8% — MSFT's own already-configured
  stress margin (`configuredConstants.stressMarginLevel`), the already-
  acquired M3 median margin (`reverseDcf.medianMargin`, equal to the bear
  scenario's own margin), and the already-acquired M3 current margin
  (`reverseDcf.currentMargin`, equal to the base/bull scenarios' own
  margin).

Both are cited from already-authored, already-on-the-record MSFT figures —
nothing is computed from `POLICY` or a historical calculation
(`sensitivity.ts:53-65`'s own rule). Neither range reads
`states.qualifying`, `trust.status`, `fixture.scenarioValues`, or
`scenarioOutputs.values` — ruling C's two independence instances, restated
by ruling A. `git grep` over this PR's diff for those four identifiers
returns nothing (stated exactly in the PR's own VERIFICATION section).

## 2. What the real run actually produces

Wired in `lib/analyzer/assemble.ts`'s M14 section, through
`computeScenarioEnterpriseValue` — the same M15 model this run's own
scenario valuation already uses (previously imported, unused, at this call
site) — closing over MSFT's real acquired base revenue
(`reverseDcf.baseYearRevenue`), the base scenario's own operating margin
(46.8%) and capital intensity (15.0%), policy's own rate-grid midpoint
(`POLICY.rateGrid[1]`, 10%), and the run's own configured NOPAT tax rate
(20%).

| Tornado row | available | displayed (>10% rule) | fullRangeValueImpact |
| --- | --- | --- | --- |
| growth | true | true | **48.60%** (0.48598121081564411663) |
| operatingMargin | true | true | **23.38%** (0.23377202026469612084) |
| discountRate | false | — | `missing REQUIRED analyst-supplied range: discountRate` |
| terminalGrowth | false | — | `missing REQUIRED analyst-supplied range: terminalGrowth` |
| ronic | false | — | `missing REQUIRED analyst-supplied range: ronic` |

The growth × margin two-way table is `available: true`, all nine cells
computed (growth rows 10.0%/13.7%/18.5% × margin columns
38.0%/41.8%/46.8%); the rate × terminal-growth table stays
`available: false` with `missing REQUIRED analyst-supplied range:
discountRate` — the same real function, called honestly with no captured
range, not a hand-typed stand-in. Full cell values are in the test file;
the base-case cell (growth 13.7%, margin 46.8%) is
$2,296,844,836,934.72 — this uses MSFT's real acquired base revenue
(`reverseDcf.baseYearRevenue`, raw dollars), not the analyst bundle's own
illustrative `scenarioValues` placeholder ($265/$510/$650), which is why
the magnitude differs enormously from that placeholder range — an honest,
already-latent characteristic of this fixture (its scenario dollar values
are Step-7 placeholders untethered to real acquired dollar scale; not a
defect this outcome diagnoses or fixes) worth naming here because it bears
directly on how large `fullRangeValueImpact` reads.

**Item 7 honesty check:** the capture unblocks Step 4's input exactly as
intended — both rows and the two-way table compute cleanly, and the >10%
display rule fires correctly on real magnitudes (48.60% and 23.38%, both
comfortably above the 10% threshold). Nothing here surfaces a reason the
pack did not anticipate; `discountRate`/`terminalGrowth`/`ronic` remain
honestly unavailable exactly as ruling A intended.

## 3. The one combined gate — restated against these numbers, not answered

`docs/verdict-decision-pack.md` §1's already-drafted `(a)`/`(b)` gate,
restated as one decision with two parts, per ruling A's instruction never to
split it:

### (a) Which reading becomes the Step 4 quantity — A1 vs A2

- **A1:** the growth tornado row's `fullRangeValueImpact` alone.
- **A2:** the maximum `fullRangeValueImpact` across all *available* tornado
  rows.

**For MSFT, with exactly two rows captured (growth, operatingMargin), A1
and A2 evaluate to the identical figure: 48.60%.** Growth's swing (48.60%)
already exceeds margin's (23.38%), so A2's max-across-available-rows read
does not change the answer here — the two options diverge only once a
company's *non-growth* driver becomes the largest available swing, which
does not happen on this run. This is new evidence §1 did not have (no
company had computed rows before this capture): the two readings are not
distinguishable on MSFT's own numbers today, though A2 remains the more
defensible rule in principle (per §1) since it would diverge from A1 the
moment a wider driver range, or a captured `discountRate`/`terminalGrowth`/
`ronic` row, swings harder than growth does.

**Recommendation, not adopted — carried intact from §1: A2 in principle,
A1 as fallback if only a subset of ranges is ever captured.** MSFT is
exactly that fallback case today (subset captured: 2 of 5 axes), and on
this company the fallback and the principle happen to agree.

### (b) How that reading becomes a fair-value-zone width — B1 vs B2

- **B1:** a numeric threshold directly on `fullRangeValueImpact` — a
  genuine numeric policy constant, the `PROVISIONAL`-value pattern HARD
  BOUNDS forbids adopting in this outcome.
- **B2:** a categorical tier (LOW/MEDIUM/HIGH dispersion), thresholds still
  undrafted.

MSFT's own reading (48.60%) is not, by itself, evidence for where any B1
threshold or B2 tier boundary should sit — no threshold is proposed or
implied here, consistent with HARD BOUNDS. It is offered only as the first
real data point either option would eventually classify.

**Recommendation, not adopted — carried intact from §1: B2**, for the same
reason §1 gives (keeps Step 4's output the same *kind* of thing
`states.qualifying` already is, without reusing the field itself, and avoids
adopting a numeric threshold this outcome's HARD BOUNDS forbid).

### Stated as one gate

Calvin's ruling on `(a)` and `(b)` is one combined question — *"does A2
(falling back to A1 where fewer ranges are captured) become the Step 4
reading, rendered as a B2 categorical tier?"* — not two separate rulings,
per ruling A's own instruction. Nothing above answers it.

## 4. What this pass adopts

Nothing. §11 items 2–7 remain backlog/latent (ruling A). Row 11 of
`docs/acceptance-matrix.md` stays `WITHHELD`. `deriveVerdict` is unchanged.
No numeric policy, threshold, tier, or `PROVISIONAL` value is written to
`POLICY`/`PolicyConstants`/`POLICY_THRESHOLD_PROVENANCE`. The next step in
this lane, not dispatched here, is Calvin's one ruling on the gate stated
in §3 above, then final real-run proof → Calvin acceptance → freeze
(issue #210).
