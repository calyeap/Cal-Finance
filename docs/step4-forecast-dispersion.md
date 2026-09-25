# Step 4 forecast dispersion — reconciling option C under `CALVIN RULING — C`

`CF-STEP4-DISPERSION-C-01` (issue #320), authorised by **`CALVIN RULING —
C`** ([PR #319 comment 5829725268](https://github.com/calyeap/Cal-Finance/pull/319#issuecomment-5829725268)):
"Step 4's margin-of-safety input will use a genuinely new forecast-dispersion
measure, independent of both the existing evidence-quality flags (Step 1)
and the scenario range already consumed by Step 5," to be built or
reconciled "using existing captured and already-approved inputs where
possible," with the shape chosen (C) and no numeric threshold, band,
cut-point or acceptance constant adopted.

**This document reconciles, and cannot honestly build.** It executes SCOPE
1–3 of issue #320 (the input reconcile, the measure specification, the
independence account) against every candidate input the current tree
offers, finds that every one of them either does not exist for a company,
is not an already-approved input in the sense ruling C requires, or
collapses into option A or option B under `docs/step4-signal-observation.md`
§4's own "not under another name" test — SCOPE 6. It drafts, per SCOPE 5,
the numeric-policy questions the one structurally-ready candidate (the M14
sensitivity/tornado mechanism) would still need once its own capture gap is
closed — options and consequences, no adoption. **It adopts no number, marks
no `docs/acceptance-matrix.md` row satisfied, and answers no `§11` item
beyond recording ruling C's own closure of item 1's shape question.** Row 11
stays `WITHHELD`, byte-untouched.

**Head SHA.** All evidence below was read at `origin/master` =
`02d59700ac20a0e62695a9bfc34c07726577ec24` — not carried from this issue's
body, from `docs/step4-signal-observation.md`, or from any other prior
document's claim. Every `git grep` result quoted below was re-run this pass
at this SHA. No new run was executed this pass — SCOPE 4 does not apply
(SCOPE 6 does; see below) — so no per-company figure in this document is a
fresh run output; every per-company figure is either a static code/fixture
citation (file:line, read this pass) or is attributed to
`docs/step4-signal-observation.md`'s own already-pinned observations on the
unchanged tree (§1–§2 there; no `lib/analyzer` file relevant to those
readings has changed between `5caa5fc`, where that pass read, and `02d5970`,
where this one does — confirmed: the only two files PR #319 touched were
`docs/step4-signal-observation.md` and
`lib/analyzer/step4SignalObservationOnRealRun.test.ts`, neither read by
option A/B's own computation).

## What ruling C settled, and what this pass owns

Ruling C chose shape **C** — a genuinely new forecast-dispersion measure,
not A (scenario-range dispersion) and not B (evidence-quality flags) — and
instructed that the smallest defensible version of it be built or
reconciled from **existing captured, already-approved inputs where
possible**, with any residual numeric policy drafted, not adopted. It also
carried forward, unchanged, the two independence constraints
`docs/step4-signal-observation.md` §6 left as the second decision: no
collapse with Step 1/Gate 1 (`CALVIN RULING — B` amendment 1) and no
double-counting with Step 5's own use of the scenario range (Finding 3).
This document owns executing that reconcile-and-build instruction on the
inputs the tree actually has today, not re-arguing the shape choice itself
(HARD BOUNDS: "do not reopen the shape").

## SCOPE 1 — Input reconcile: every candidate, its acquisition status, its provenance

`docs/step4-signal-observation.md` §4 names one candidate direction
explicitly ("a distribution over the underlying forecast *inputs* — growth,
margin, reinvestment — rather than over their three named scenario
outputs") and one candidate class in the abstract ("an externally sourced
measure... this repo does not currently acquire from anywhere" — ruled out
by HARD BOUNDS' no-new-capture instruction on its own terms). This reconcile
does not stop at the named example: it checks every already-computed
quantity in `AnalysisResult`/`DiagnosticsResult` that could plausibly carry
a forecast-dispersion reading, and states each one's acquisition status from
the tree.

### 1. Scenario drivers — `revenueGrowthOrPath` / `operatingMargin` /
   `reinvestmentCapitalIntensity` per bear/base/bull (§4's own named
   candidate)

These are `ScenarioDriverSet`'s three numeric fields (`lib/analyzer/types.ts:337-342`),
carried into the schema at `assemble.ts:474-489` as "§10 F — the analyst's
scenarios, as the result carries them" — display-only; a missing driver
reaches the schema as `NaN` and the scenario is bound `INCOMPLETE`
(`assemble.ts:470-483`). They are never read by any valuation computation on
the real run path: `computeScenarioOutputs` (M15, the function that
produces option A's `scenarioOutputs.values`) is fed directly from
`fixture.scenarioValues.{bear,base,bull}` (`assemble.ts:456-459`), never from
`fixture.scenarios`. `computeScenarioEnterpriseValue` — the one function in
this codebase that *would* turn growth/margin/reinvestment into a dollar
value — is called nowhere in `assemble.ts`, `gate.ts`, or any other
production path; every call site is its own unit test
(`modules/scenarioOutputs.test.ts`) or `sensitivity.test.ts`'s tornado
fixtures (confirmed: `git grep -n "computeScenarioEnterpriseValue" -- lib`
returns exactly those two test files, the function's own definition at
`modules/scenarioOutputs.ts:22`, and its import — unused as a call — at
`assemble.ts:23`; no non-test file ever invokes it).

Provenance, per company:

| | MSFT | OKLO | NVDA |
|---|---|---|---|
| Present? | Yes | **No — explicitly nulled** | Yes |
| Values (bear/base/bull growth) | 10.0% / 13.7% / 18.5% (`fixtures/msft.ts:251,258,265`) | `null` for all nine driver cells (`acquisition/analystInputs.ts:73,78-82`) | 20% / 35% / — (draft) |
| Acquisition status | **NOT ACQUIRED** — carried from the validation set (`acquisition/analystInputs.ts:37-41`, same disclosure text as MSFT's `scenarioValues`) | Not authored at all — the fixture's own raw `0` placeholders (`fixtures/oklo.ts:346-348`) are deliberately overridden to `null` by `analystInputs.ts` "so both report INCOMPLETE" rather than presenting 0.0% as real (`analystInputs.ts:60-69`) | **Analyst-authored, approved** — `docs/analyst-drafts/nvda-step7-draft.md` §"Scenarios" (lines 62-104), merged `0753051`, PR #295 |

**Why this candidate is disqualified, per company, on two different
grounds:**

- **OKLO — absent.** There is no reading to aggregate. Zero of three
  scenarios carry any of the three drivers.
- **MSFT — present, but not an "already-approved input."** Ruling C's own
  instruction is to build from "existing captured and already-approved
  inputs." MSFT's drivers carry the identical NOT-ACQUIRED disclosure as
  its `scenarioValues` — the same sentence, the same file, the same
  validation-set origin (`acquisition/analystInputs.ts:37-41`): "were NOT
  acquired... carried from the validation set, because the screen where you
  enter scenarios is not built yet." A number the run's own disclosure
  disowns as not acquired is not a stronger input than option A's own
  three scenario dollar values it would sit beside — it is the identical
  disclosed weakness, one field over.
- **NVDA — present and approved, but not "a source other than what A
  already supplies."** `docs/step4-signal-observation.md` §4 requirement 1
  is explicit that the candidate quantity must not be "the three
  point-scenario outputs themselves (else it is option A under another
  name)." NVDA's draft states, in its own words, that its three scenario
  dollar values ARE this candidate's own three drivers run through the
  methodology's DCF formula: "Each scenario is projected over the ten-year
  explicit period using its own already-drafted, already-approved revenue
  growth, operating margin and reinvestment capital intensity... Computing
  the three scenario values, per methodology §3.1–§3.5"
  (`docs/analyst-drafts/nvda-step7-draft.md`, "Computing the three scenario
  values" section, lines 275-293). A dispersion measure over
  growth/margin/reinvestment is therefore not an independent quantity for
  NVDA — it is the stated computational precursor of the exact
  `scenarioOutputs.values` option A already reads, one layer upstream. Using
  it would be "manufacturing a measure that collapses back into A" — the
  outcome the issue text names and forbids, not a genuinely new measure.

### 2. Historical margin cyclicality — `tenYearMarginRange` /
   `worstSingleYearChange` (`marginHistory.ts`)

Real, acquired data: computed by `modules/marginHistory.ts:53` from
`operatingMarginSeries`, which is built from filed `us-gaap:Revenues` /
`us-gaap:OperatingIncomeLoss` facts in `companyInputs.ts` — genuinely
observed, not carried or authored. Present for MSFT (21.4pt range, 4.1pt
worst decline, `fixtures/msft.ts:136`) and NVDA (47.51pt / 21.65pt,
`docs/analyst-drafts/nvda-step7-draft.md` line 58-59, transcribed via
`recordAnalystBundle`); **not evaluated for OKLO** — its own fixture
carries `tenYearMarginRange: 0, worstSingleYearChange: 0` with the comment
"not evaluated — HISTORY INSUFFICIENT" (`fixtures/oklo.ts:236`).

**Why this candidate is disqualified: it is already Step 1's own object,
not a second one.** `evaluateTriggerA` (MARGIN AT HISTORICAL HIGH) reads
`windowRange` (the same ten-year range) and `evaluateTriggerB` (CYCLICAL)
reads `worstSingleYearDecline` (the same worst-decline figure) —
`gates.ts:215-264` — and both triggers' firings are pushed into
`states.qualifying` (`assemble.ts:522,681-682`, cited already by
`docs/step4-signal-observation.md` §2). `computeTrustStatus` rule 2 reads
`states.qualifying` directly (`trust.ts:118-123`) to determine `PARTIAL`.
This is the identical structure PR #319 already found for `SHORT HISTORY`
and Gate 1 — a `§9.4` qualifying flag that *is* an upstream diagnostic's own
read, carried into the same object `computeTrustStatus` consumes — except
here the underlying statistic (the margin range/decline figures themselves,
not just the flag they produce) is exactly what this candidate would
propose reading a second time. Building Step 4 from
`tenYearMarginRange`/`worstSingleYearChange` would not risk collapsing Step
1 and Step 4 into the same object in the abstract, the way §5 of the prior
document put it for option B in general — it would reuse the identical
statistic already wired into `trust.status`'s own `PARTIAL` determination
for MSFT (Trigger A fires today: `states.qualifying = [MARGIN AT
HISTORICAL HIGH]`) and, structurally, for any future run where Trigger B
fires. `CALVIN RULING — B` (amendment 1) forbids exactly this: Step 4 "never
the same object read a second time under another name."

### 3. `M14` sensitivity / tornado / two-way tables (`modules/sensitivity.ts`)

The one candidate whose *shape* is the closest structural fit to a genuine,
non-A, non-B forecast-dispersion reading: a value range produced by varying
growth, margin, discount rate, terminal growth and RONIC around a base
case, independent of both the three named point scenarios and the
evidence-quality flags. It is fully built as a generic mechanism
(`computeTornado`, `computeGrowthMarginTable`, `computeRateTerminalGrowthTable`,
`lib/analyzer/modules/sensitivity.ts:166-265`) and its own header names it
as the Step 4-shaped gap: `assemble.ts:439-442`'s own comment reads
"sensitivity (tornado/two-way tables left to Step 4 wiring... debtShareRemoved
is the only settled field at this milestone)."

**Why it cannot be used today: every reading requires new capture.**
`sensitivity.ts`'s own header is explicit that "EVERY RANGE IS AN EXPLICIT
ANALYST ASSUMPTION, never auto-derived" (`sensitivity.ts:53-65`) — the
module never reaches into a historical calculation to manufacture a range.
`AnalystSuppliedRange` — the type every tornado row and two-way table cell
needs — is used nowhere outside `sensitivity.ts` and its own test file
(`git grep -n "AnalystSuppliedRange" -- lib`: two files, both the module and
its unit test; zero hits in any fixture, `companyInputs.ts`, or
`analystInputs.ts`). Consequently `buildSensitivityResult()` is called with
no arguments at both of its two production call sites
(`assemble.ts:442` and `modules/scenarioOutputs.ts:189`, inside
`computeScenarioOutputs`) and always returns empty arrays
(`sensitivity.ts:33-40`) — `tornado: []`, `twoWayGrowthMargin: []`,
`twoWayRateTerminalGrowth: []`, on every real run today, MSFT, OKLO and
NVDA alike. Supplying real ranges (with the required recorded rationale)
for at least one company is a new-capture act — precisely what HARD BOUNDS
forbids acquiring in this pass absent a SCOPE 6 finding, which is exactly
where this reconcile lands.

### 4. Rate sensitivity — the existing ±1-point EV recomputation
   (`modules/rateSensitivity.ts`)

A different, already-built ±1pt-rate value range (`diagnostics.rateSensitivity`)
exists, computed from `currentEnterpriseValue` and a supplied
`rateSensitivityCells` pair (`assemble.ts:415-428`). It is unavailable on
every real run today for the same reason as candidate 3: `rateSensitivityCells`
is hardcoded `null` in the acquisition pipeline's own fixture builder
(`acquisition/companyInputs.ts:571` — the function every real-acquired
ticker's fixture is built through, not company-specific) and in both
committed fixtures (`fixtures/msft.ts:245`, `fixtures/oklo.ts:341`). A
new-capture gap, same disposition as candidate 3, narrower in scope (one
axis, not five).

### 5. The reverse-DCF RONIC ladder (M7)

Real, acquired, company-level historical data — but it is already Step 2's
own growth-licence input and Step 7's own reverse-DCF consistency-check
input (`docs/verdict-methodology-reconciliation.md`'s re-derived Step
numbering, §11 item 1's re-derived list above). Reusing it for Step 4 would
not risk the Step 1/Step 4 collapse SCOPE 3 is scoped to test, but it would
open a parallel double-counting question against Step 2/Step 7 of exactly
the shape Finding 3 already raised against Step 5 — a new methodology
question this outcome's HARD BOUNDS ("no methodology side quest... resolve
only what blocks the current verdict/final-acceptance path") does not
license opening here. Named, not built.

### 6. The pre-revenue funding/success-weight module (`PreRevenueModule`)

Real, acquired cash and burn data (§7.2 M16) — but populated only for the
pre-revenue profile (`assemble.ts` — `preRevenue: PreRevenueModule | null`,
`types.ts:1046`), which means it cannot supply a reading for MSFT or NVDA at
all, and its own success/fail weight is explicitly **price-implied**
("probability-weighted value," `ai/slots.ts:370`) — feeding the same
price-comparison territory Step 5 already owns, not an input independent of
it. Named, not built, for both reasons.

### 7. The AI challenger (§8.5.4)

Explicitly does not produce a confidence or dispersion signal by design:
"You do not aggregate or vote. No personas, no confidence tallies, no
scores" (`ai/interpretation.ts:43`). Nothing to reconcile.

## SCOPE 2 — Specifying each surviving candidate against §4, and why each still fails

`docs/step4-signal-observation.md` §4 sets three requirements: (1) a
quantity not sourced from A's outputs or B's flags; (2) a defined
aggregation; (3) a stated relationship to the scenario range. Candidates 4,
6 and 7 above are eliminated on requirement 1 or on outright unavailability
before aggregation is worth specifying. The three worth specifying in full
are 1, 2 and 3:

- **Candidate 1 (scenario-driver dispersion).** Quantity: the spread of
  `revenueGrowthOrPath` (and, secondarily, `operatingMargin`,
  `reinvestmentCapitalIntensity`) across bear/base/bull. Aggregation: e.g.
  bull-minus-bear or bull-over-bear on the growth rate, symmetric with how
  `docs/step4-signal-observation.md` §1 already reports option A's own
  `bull − bear`/`bull ÷ bear` arithmetic. Relationship to the scenario
  range: **fails at specification** — per SCOPE 1 above, it is either the
  same not-acquired status as the range's own inputs (MSFT), absent
  (OKLO), or the range's own stated computational precursor (NVDA). It does
  not clear requirement 1 for any company; there is no company left for
  which to check requirements 2-3 against a live reading.
- **Candidate 2 (margin-cyclicality dispersion).** Quantity:
  `tenYearMarginRange` / `worstSingleYearChange`. Aggregation: already
  computed, a single already-existing percentage-point figure per company.
  Relationship to the scenario range: independent of it (SCOPE 1's
  candidate 2 finding is about Step 1, not Step 5) — but it fails
  requirement 1 for a different, Step-1-shaped reason: it is `states.qualifying`'s
  own field, already reused by `trust.status`. Aggregation and the Step
  5 relationship are moot once requirement 1 fails.
- **Candidate 3 (tornado/two-way dispersion).** Quantity: the value range a
  named two-way table (growth × margin, or discount rate × terminal growth)
  or the five-row tornado produces around a base case. Aggregation: already
  defined in code — `fullRangeValueImpact` per tornado row
  (`sensitivity.ts:185`), or the `cells` matrix of a two-way table
  (`sensitivity.ts:241`) — the smallest defensible aggregation this pass can
  identify would be the existing `fullRangeValueImpact` reading (already a
  fraction of base-case value, already computed by code that exists) taken
  across the growth and margin rows specifically, since those are the two
  axes §7.2 M14 itself already names as the two-way table's own axes and
  they are structurally the input-side counterparts option A's range sits
  downstream of. Relationship to the scenario range: **genuinely
  independent by construction** — it varies the *inputs* to a fixed
  ten-year model around one *base* case, never touching the three
  point-scenario values `scenarioOutputs.values` carries or the
  `weightedDistribution`/`priceLocationWithinRange` Step 5 reads off them.
  This candidate clears requirement 1 and requirement 3 **in specification**
  — the only one of the seven that does. It fails only on availability
  (SCOPE 1 candidate 3): no company today supplies the `AnalystSuppliedRange`
  values the aggregation needs, so there is no live reading to report and no
  aggregation to run.

## SCOPE 3 — Independence account, tested against PR #319's two concrete instances

Ruling C carries forward two independence tests, and PR #319 gave each one
a concrete instance to test future candidates against rather than an
abstract standard:

**Against the Step 1/Gate 1 instance (`SHORT HISTORY` on OKLO, PR #319 §2-§5).**
Candidate 2 fails this test on its own concrete instance, not a new one:
`MARGIN AT HISTORICAL HIGH` on MSFT's own real run is the same
`states.qualifying` mechanism PR #319 already traced from Gate 1's
`SHORT HISTORY` into `trust.status` rule 2 — the same code path
(`trust.ts:118-123`), the same field, a different named flag. Candidate 1
and candidate 3 do not touch `states.qualifying`, `Gate 1`, or
`trust.status` anywhere in their specification, so neither reuses this
instance; candidate 1 is eliminated on SCOPE 1/2 grounds regardless,
candidate 3 clears this test.

**Against the Step 5 scenario-range instance (MSFT's live, rendered range
and its own `scenarioLabelsWarning = true`, PR #319 §1/§5).** Candidate 1
fails this test for NVDA specifically and by the draft's own account, not
by inference: the draft states its drivers are the stated computational
basis of the very `scenarioOutputs.values` Step 5's
`priceLocationWithinRange`/`weightedDistribution` are computed from
(`assemble.ts:456-466`) — reusing them would not merely risk the
double-counting Finding 3 named for option A itself, it would be the same
relationship one layer upstream, for the one company where the relationship
is actually stated. Candidate 3 clears this test in specification (SCOPE 2
above: it varies the ten-year model's own inputs around a base case,
never reading `fixture.scenarioValues` or `scenarioOutputs.values`
anywhere in its computation).

**Net:** the one candidate that specifies clean against both concrete
instances (candidate 3, the tornado/two-way mechanism) is also the one
candidate that fails purely on missing capture, not on independence or
provenance. The two candidates available today without new capture
(candidates 1 and 2) both fail independence or provenance, differently per
company for candidate 1, uniformly for candidate 2.

## SCOPE 4 / SCOPE 6 — the measure cannot be completed honestly from existing inputs

Per the issue's own SCOPE 6: **this is delivered instead of SCOPE 4**, not
alongside a partial one. No candidate above clears SCOPE 1 (already-captured,
already-approved), SCOPE 2 (specified without collapsing into A or B) and
SCOPE 3 (independent of both concrete instances) at once, for any company:

- Candidates 4, 6, 7 fail on availability or scope before reaching
  specification.
- Candidate 1 fails per-company: absent (OKLO), not-approved (MSFT),
  collapses into A (NVDA, by the draft's own stated derivation).
- Candidate 2 fails uniformly: it is Step 1's own `states.qualifying`
  field, already read into `trust.status`.
- Candidate 3 specifies clean against every requirement and both
  independence instances, but is unavailable on every company today —
  `AnalystSuppliedRange` values exist nowhere in the committed fixtures or
  the acquisition pipeline, and supplying them is new capture.

There is no fourth path this reconcile found. Building candidate 1 or 2
anyway would be "manufacturing a measure that collapses back into A or B" —
the outcome the issue text names and forbids. Building candidate 3 without
its ranges is not possible; the function throws no value, it returns an
empty array.

**What would be required, stated per SCOPE 6:**

1. **The lowest-cost real path:** Command Center/analyst capture of
   `AnalystSuppliedRange` values — three explicit points and a recorded
   rationale each — for at least the growth and margin axes (§7.2 M14's own
   named two-way table), for at least one already-committed company. This
   is new capture, not a code change: `computeGrowthMarginTable` and
   `computeTornadoRow` already exist and are already tested
   (`sensitivity.test.ts`); nothing in `lib/` would need to change to
   consume real ranges once supplied. This is squarely a capture gap, not a
   methodology or code gap.
2. **The gap this pass does not have standing to close:** a Calvin/Command
   Center ruling on whether candidate 2's reuse of `states.qualifying` is
   an acceptable, *named* exception to amendment 1's separation (the ruling
   could decide the reuse is tolerable for Step 4 specifically, the way it
   is already tolerated inside `trust.status` for Step 1's own purposes) —
   this pass does not raise it as a `CALVIN REQUIRED` because ruling C's own
   text already forecloses this shape ("independent of... the existing
   evidence-quality flags (Step 1)"); it is named here only as the
   alternative to new capture, not proposed.
3. **What does not need building:** the tornado/two-way mechanism itself.
   It is complete, tested, and already documented as "left to Step 4
   wiring." The gap is entirely upstream of it.

## SCOPE 5 — numeric policy the tornado path would still need (drafted, not adopted)

Contingent on requirement 1 above being satisfied by new capture, Step 4
would still need two policy decisions this pass drafts and does not adopt,
per ruling C's own instruction and HARD BOUNDS:

**(a) Which reading becomes the Step 4 quantity.** Option A1: the existing
`fullRangeValueImpact` on the growth tornado row alone (already computed,
already a fraction of base-case value, one number). Evidence: smallest
possible change to consume — no new aggregation code. Consequence: ignores
margin, rate and terminal-growth dispersion entirely, understating
uncertainty for a company whose margin is the more volatile driver.
Option A2: the full five-row tornado's maximum `fullRangeValueImpact`
across all available rows (worst-case single-driver sensitivity).
Evidence: captures whichever driver is actually most uncertain per
company, matching the tornado's own stated purpose (rank drivers by
impact). Consequence: needs all five ranges supplied, not just growth/margin,
raising the capture bar this pass already found is not cleared for even
one axis. **Recommendation, not adopted:** A2 in principle (truer to what
"forecast dispersion" should mean — the largest single-driver swing a
company's own valuation is exposed to) once capture supports it; A1 as a
fallback if only a subset of ranges is ever captured.

**(b) How the reading becomes a fair-value-zone width.** Option B1: a
numeric threshold directly on `fullRangeValueImpact` (e.g., "widen the zone
by X% for every Y% of impact") — a genuine numeric policy constant, the
kind HARD BOUNDS forbids adopting here and the kind `docs/frozen/calfinance-methodology-v2.md:154`
already names as the forbidden `PROVISIONAL`-value pattern. Option B2: a
categorical tier (e.g., LOW/MEDIUM/HIGH dispersion, thresholds still
undrafted) mirroring how `§9.4` qualifying flags are categorical rather
than numeric, avoiding a raw percentage import into the verdict path.
**Recommendation, not adopted:** B2 — a categorical shape is more
defensible against "do not adopt... any new numeric threshold" than a
percentage-scaled zone, and keeps Step 4's output the same *kind* of thing
(`AnalyticQualifier`-shaped) the rest of `states.qualifying` already is,
without reusing the field itself (SCOPE 3 above). Neither option is coded,
configured, or marked `PROVISIONAL` anywhere in this pass.

## What this pass does not do

It adopts no numeric threshold, band, cut-point or acceptance constant — not
in code, not as configuration, not as `PROVISIONAL`. It does not implement
any of the three specified candidates. It does not mark any
`docs/acceptance-matrix.md` row satisfied; row 11 remains `WITHHELD`,
byte-untouched. It does not reopen the shape — C stays chosen; this document
reports why C's smallest defensible version is not buildable from today's
inputs, not that C was the wrong choice. It answers no `§11` item other than
recording, in `verdict-methodology-reconciliation.md`, that ruling C closed
item 1's shape question and what this pass found against it; items 2-7 are
not raised, individually or as a pack. It does not acquire the
`AnalystSuppliedRange` values SCOPE 6 names as the required next step — that
is new capture, out of this pass's HARD BOUNDS.

## What this document observed this pass vs. cites from existing authority

**Observed this pass** (read fresh, this run, at `02d5970`, via direct file
reads and the `git grep` commands quoted inline above): every code citation
in SCOPE 1 items 1-7 and SCOPE 2-3's specification and independence
argument — the `computeScenarioOutputs`/`computeScenarioEnterpriseValue`
call-graph, `analystInputs.ts`'s NOT-ACQUIRED disclosure text and OKLO's
null-override, `marginHistory.ts`/`gates.ts`/`trust.ts`'s qualifying-flag
chain, `sensitivity.ts`'s `AnalystSuppliedRange` requirement and its
zero-hit `git grep`, `rateSensitivityCells`'s null default in
`companyInputs.ts` and both fixtures, `PreRevenueModule`'s price-implied
weight, and `ai/interpretation.ts`'s no-confidence-tallies rule.

**Cited from existing authority, not re-derived:** `docs/step4-signal-observation.md`
§1-§2's per-company `states.qualifying`/`trust.status`/`fairValueRange.kind`
table (unchanged tree, re-confirmed only by file-count, not re-run);
`docs/analyst-drafts/nvda-step7-draft.md`'s own "Computing the three
scenario values" section, quoted rather than re-derived; ruling C's own
text and `docs/step4-signal-observation.md` §4's three requirements and §6's
two independence decisions.

## Reproducing the static checks this pass ran

```
git grep -i -E 'marginOfSafety|margin of safety|forecastUncertainty|estimationUncertainty|forecastDispersion' -- lib
git grep -n "AnalystSuppliedRange" -- lib
git grep -n "rateSensitivityCells" -- lib/analyzer/fixtures lib/analyzer/acquisition
git grep -n "computeScenarioEnterpriseValue" -- lib
```

All four re-run this pass at `02d5970`; results quoted inline above.
