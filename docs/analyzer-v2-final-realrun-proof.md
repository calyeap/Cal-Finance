# Analyzer V2 — final real-run proof at head (MSFT, OKLO, NVDA)

**Outcome:** `CF-ANALYZER-V2-FINAL-REALRUN-PROOF-01` ([issue #331](https://github.com/calyeap/Cal-Finance/issues/331)).

**Head SHA.** `origin/master` = `235dc0b274bc6d287aba90a333adba99f7c6c32a`
(`CF-STEP4-TIER-BOUNDARY-DEFAULT-01`, #330). Every figure below is recorded
**from the three runs themselves at this head**, opened through the existing
gated offline path and pinned by a new, network-free test file
(`lib/analyzer/step4FinalRealRunProof.test.ts`) — never carried from a prior
document's claim. Where a figure is unchanged from a prior document
(`docs/m9-real-company-validation-findings.md`,
`docs/nvda-realrun-observation.md`), that is stated explicitly, because this
run reproduced it, not by citation alone.

**Documentation and tests only. Zero product code.** `lib/analyzer/verdict.ts`
and `lib/analyzer/policy.ts` are read-only inputs to this pass, both
byte-identical to head (confirmed by `git diff --name-only
origin/master...HEAD`, which excludes both). Nothing in this document is
accepted, adopted, or marked satisfied; `docs/acceptance-matrix.md` row 11
stays `WITHHELD` and row 13 stays `OPEN`; no `docs/acceptance-matrix.md` row
is marked satisfied. Per `docs/product-decisions.md` items 3 and 9, AI does
not make the final qualitative call and human input is evidence, not
authority.

## How to reproduce every figure below

```
npx vitest run lib/analyzer/step4FinalRealRunProof.test.ts
```

Network-free (`ANALYZER_OFFLINE=1`, set by `vitest.setup.ts`), no AI/model
call (every run's `computeAnalysisForRun` call passes `call: null`
internally, the same convention every other `*OnRealRun` test file in this
lane uses). The test opens all three companies through the existing gated
path — `createRun` → clear the spot-check queue → `recordProfileDecision` →
(MSFT only) `recordJudgment` for Calvin's §4.4 ruling → (NVDA only)
`recordAnalystBundle` with the approved Step-7 bundle → `computeAnalysisForRun`
— reusing `openMsftRunWithRuling` / `openOkloRunUnchanged` /
`openNvdaObservationRun`, copied verbatim from
`lib/analyzer/step4SignalObservationOnRealRun.test.ts` and
`lib/analyzer/step4ForecastDispersionReadingOnRealRun.test.ts` (both already
committed; neither invented by this outcome). This test asserts every figure
transcribed below; three tests, three companies, all passing at head.

---

## MSFT

Recorded selection for §4.4 (Calvin's `CALVIN DECISION`, issue #188 comment
5757487226, 2026-09-21T08:19:14Z) is applied via `recordJudgment` before the
run computes — reproducing, not re-litigating, the same ruling
`docs/m9-real-company-validation-findings.md` §2 already records.

| Field | Value | Reproduced by |
|---|---|---|
| `trust.status` | `PARTIAL` | assertion |
| `trust.determinedBy` | 4 entries: (1) qualifying flag "MARGIN AT HISTORICAL HIGH on operating margin"; (2) incomplete input "13 diagnostic(s) INCOMPLETE on a missing REQUIRED input"; (3) incomplete input "INCOMPLETE on ±1% rate sensitivity — missing REQUIRED input: the base case revalued at a discount rate one point higher and one point lower — none was supplied for this run"; (4) incomplete input "INCOMPLETE on the discount rate at which the base case equals the price — missing REQUIRED input: a revaluation of the base case at other discount rates — none was supplied for this run, so no rate was solved for" | assertion (entry 1) + recorded observation (entries 2–4, this run's own output, transcribed verbatim) |
| `gates.gate0.result` | `PASS` (sector/industry classification resolves) | assertion |
| `gates.gate1` | `filedYearsCount: 13`, `state: null` (no suppressing state) | recorded observation, matching `docs/m9-real-company-validation-findings.md` §2 |
| `diagnostics.enterpriseValue` | **not suppressed** — `marketCap` $3,722,537,881,852.70; `totalDebt` $40,294,000,000; `financeLeaseLiabilities` $66,594,000,000; `cashAndMarketableDebtSecurities` $76,843,000,000; `nonOperatingEquityInvestmentsAtBook` $36,348,000,000 (the §4.4-ruled `us-gaap:LongTermInvestments` figure); `nonOperatingInvestmentsErrorDirection: "understates"`; `enterpriseValue` **$3,716,234,881,852.70** (≈$3.716T) | assertion (suppressed: false, positive EV) + recorded observation (exact figures, transcribed from this run's own output) |
| `gates.leverage` | `result: "PASS"`; `netDebtRatio` ≈ **0.80848%** (`0.0080847957557034981878`), below `POLICY.leverageThreshold`'s 10%; `operatingLeaseInclusiveMemo` ≈ 1.39846% | assertion (result, netDebtRatio not null) + recorded observation (exact figures) |
| `fairValueRange` | `kind: "range"`, bear **$265.00**, bull **$650.00**, `weightedValueInside` ≈ **$475.00** (`474.99999999999999999`), `drivingInputs`: years 1-5 revenue growth / operating margin path / reinvestment as % of NOPAT, `scenarioLabelsWarning: true` | assertion |
| `price` | **$499.70**, as of 2026-09-04 (recorded capture close) | assertion |
| Tornado (M14, all five rows) | `growth`: `available: true`, `displayed: true`, `fullRangeValueImpact` **0.48598121081564411663**; `operatingMargin`: `available: true`, `displayed: true`, `fullRangeValueImpact` **0.23377202026469612084**; `discountRate` / `terminalGrowth` / `ronic`: each `available: false`, cause `"missing REQUIRED analyst-supplied range: <driver>"` | assertion (all five rows and both available `fullRangeValueImpact` values) |
| **Step 4 forecast-dispersion reading** (`diagnostics.sensitivity.forecastDispersion`) | `available: true`, `selectedDriver: "growth"`, `fullRangeValueImpact` **`0.48598121081564411663`**, `tier: "HIGH"` | assertion — the now-live figure this outcome exists to prove |
| `deriveVerdict(result)` | `status: "INCOMPLETE"`, `reason`: *"Decision-critical analysis is incomplete — a fair-value range alone cannot determine BUY / HOLD / SELL. Synthesizing a verdict also requires the required-versus-achieved growth comparator (spec §10.6.2), and that fact has not been acquired yet (spec §10.6.5, milestone M8). Recovery: this verdict becomes available once M8 delivers the comparator fact."* | assertion (status + a substring of reason) |
| Rendered dominant-verdict hero | The `.az-hero-verdict` INCOMPLETE state: state name `INCOMPLETE`, `verdict.reason` verbatim as the cause line, no `.confidence` element | recorded observation — `app/components/analyzerSurfacesOnRealRun.test.tsx:148-167` renders this exact MSFT run through `AnalyzerReportFrame`/`DominantVerdictSlot` and asserts this, re-run and passing at this head; `DominantVerdictSlot.tsx:41-48` shows the branch is keyed only on `verdict.status`/`verdict.reason`, never on ticker |

The Step 4 reading's `fullRangeValueImpact` (`0.48598121081564411663`) matches
policy.ts's own provenance comment (`POLICY_THRESHOLD_PROVENANCE.step4DispersionTierMediumHighBoundary`,
`lib/analyzer/policy.ts:172-174`) verbatim — the same real number the
boundary's own calibration note cites, reproduced by this run rather than
carried from that comment.

## OKLO

| Field | Value | Reproduced by |
|---|---|---|
| `trust.status` | `UNUSABLE` | assertion |
| `trust.determinedBy` | 1 entry: suppressing state `"LEVERAGE UNSUPPORTED IN v1 — inputs missing — the ratio could not be computed, so the precondition fails closed"` | assertion |
| `gates.gate0.result` | `PASS` (sector/industry classification resolves — Electric Services) | assertion |
| `gates.gate1` | `filedYearsCount: 5`, `state: "SHORT HISTORY"` | recorded observation, matching `docs/m9-real-company-validation-findings.md` §3 |
| `diagnostics.enterpriseValue` | **suppressed**, `state: "INCOMPLETE"`, `cause: "missing REQUIRED input(s): treasuryMethodDilution, nonOperatingEquityInvestmentsAtBook"` — two named missing REQUIRED inputs; OKLO has zero tagged non-operating-investment candidates, so §4.4 was never reachable for it either way | assertion |
| `gates.leverage` | `result: "LEVERAGE UNSUPPORTED IN v1"`, `netDebtRatio: null` — cascaded from the missing EV bridge | assertion |
| `fairValueRange` | `kind: "suppressed"`, `state: "LEVERAGE UNSUPPORTED IN v1"`, `cause: "inputs missing — the ratio could not be computed, so the precondition fails closed"` — **not** `pre-revenue-distribution`, per `docs/m9-real-company-validation-findings.md` §3's own recorded finding, reproduced here | assertion |
| `price` | **$41.27**, as of 2026-09-04 (recorded capture close) | assertion |
| Tornado (M14) | **`[]` — genuinely empty, not five populated-but-unavailable rows.** `assemble.ts`'s `sensitivityRangesFor(ticker)` wires a captured `AnalystSuppliedRange` only for MSFT (`CF-STEP4-MSFT-RANGE-CAPTURE-01`); for OKLO it returns `null`, and the run falls back to `buildSensitivityResult()`'s own empty-array default (`sensitivity.ts:33-41`) — the M14 module never runs for this ticker at all | assertion (`toEqual([])`) |
| **Step 4 forecast-dispersion reading** | `available: false`, `cause: "no tornado row is available: true — every analyst-supplied range for this run is missing"`, **no `tier` field** | assertion — reproduced by this run, not merely cited; unchanged from `docs/step4ForecastDispersionReadingOnRealRun.test.ts`'s own prior pin |
| `deriveVerdict(result)` | `status: "INCOMPLETE"`, `reason: "Decision-critical analysis is incomplete — LEVERAGE UNSUPPORTED IN v1 — inputs missing — the ratio could not be computed, so the precondition fails closed"` | assertion |
| Rendered dominant-verdict hero | Same `.az-hero-verdict` INCOMPLETE state as MSFT, different cause line | recorded observation — `app/components/analyzerSurfacesOnRealRun.test.tsx:148-167`'s OKLO case, re-run and passing at this head |

## NVDA

§4.4 is left deliberately **unmade** on this run (no `recordJudgment` call),
per `CF-NVDA-RUN-OBSERVE-01`'s own HARD BOUNDS, exactly as
`docs/nvda-realrun-observation.md` already records.

| Field | Value | Reproduced by |
|---|---|---|
| `trust.status` | `UNUSABLE` | assertion |
| `trust.determinedBy` | 1 entry: suppressing state `"LEVERAGE UNSUPPORTED IN v1 — inputs missing — the ratio could not be computed, so the precondition fails closed"` | assertion |
| `gates.gate0.result` | `PASS` (sector/industry classification resolves) | assertion |
| `gates.gate1` | `filedYearsCount: 13`, `state: null` | recorded observation, matching `docs/nvda-realrun-observation.md` |
| `diagnostics.enterpriseValue` | **suppressed**, `state: "INCOMPLETE"`, `cause: "missing REQUIRED input(s): treasuryMethodDilution, price, financeLeaseLiabilities, nonOperatingEquityInvestmentsAtBook"` — **four** named missing REQUIRED inputs, not the three `docs/nvda-realrun-observation.md` §(c) recorded (see "A surprise, recorded" below) | assertion |
| `gates.leverage` | `result: "LEVERAGE UNSUPPORTED IN v1"`, `netDebtRatio: null` | assertion |
| `fairValueRange` | `kind: "suppressed"`, `state: "LEVERAGE UNSUPPORTED IN v1"`, same cause string as OKLO | assertion |
| `price` | **the honest `$0` sentinel** — `value: 0`, `timestamp: ""` (no `NVDA` row in the committed `prices.json`) | assertion |
| Tornado (M14) | **`[]` — genuinely empty**, same reason as OKLO: no `AnalystSuppliedRange` capture exists for NVDA either | assertion (`toEqual([])`) |
| **Step 4 forecast-dispersion reading** | `available: false`, `cause: "no tornado row is available: true — every analyst-supplied range for this run is missing"`, **no `tier` field** | assertion — reproduced by this run, not merely cited |
| `deriveVerdict(result)` | `status: "INCOMPLETE"`, `reason: "Decision-critical analysis is incomplete — LEVERAGE UNSUPPORTED IN v1 — inputs missing — the ratio could not be computed, so the precondition fails closed"` | assertion |
| Rendered dominant-verdict hero | Same `.az-hero-verdict` INCOMPLETE state, by the same ticker-independent `DominantVerdictSlot.tsx` branch (`:41-48`) `verdict.status === "INCOMPLETE"` already takes for MSFT/OKLO above — no NVDA-specific render test exists in the tree today, so this line is a recorded observation from the component's own code path, not a new assertion this outcome adds against a rendered DOM | recorded observation, not a DOM assertion — named honestly rather than silently upgraded to "assertion" |

### A surprise, recorded

`docs/nvda-realrun-observation.md` §(c) recorded NVDA's enterprise-value
bridge as missing exactly **three** REQUIRED inputs
(`treasuryMethodDilution`, `financeLeaseLiabilities`,
`nonOperatingEquityInvestmentsAtBook`). **This run's own current output
carries a fourth: `price`.** This is not a regression this outcome
introduces — it is the observed, current effect of an intervening
reconciliation landed between that document's own head and this proof's:
`CF-NOPRICE-HONESTY-RECON-01` (`f740941`, #303,
`docs/noprice-honesty-reconciliation.md`; `docs/acceptance-matrix.md` row
16(a)), which carries a real, possibly-absent price through
`computeEnterpriseValue`'s own REQUIRED-input check
(`lib/analyzer/modules/enterpriseValue.ts:36-51`) rather than a flattened
`$0` that would silently satisfy it. NVDA has no committed price capture
(the honest `$0`/`""` sentinel above), so `price` is now correctly named as
missing rather than silently treated as present-and-zero. This changes the
count of named missing inputs from three to four; it does not change NVDA's
`enterpriseValue`/`leverage`/`fairValueRange`/`trust`/`verdict` states, all
of which were already the corresponding suppressed/`INCOMPLETE`/`UNUSABLE`
values before and after. Recorded here because SCOPE item 3 of this outcome
requires recording what was actually observed, not what a prior document
predicted.

---

## What stands between this proof and final acceptance

Stated from head evidence, each claim anchored to a `file:line` or a link —
none carried on trust.

### 1. Row 11's withholding condition is unchanged

`docs/acceptance-matrix.md` row 11 withholds Analyzer V2 / M9 final
acceptance under **`CALVIN RULING — SUPERSEDE OPTION B FOR ANALYZER V2 FINAL
ACCEPTANCE`** ([issue #210 comment
5807320616](https://github.com/calyeap/Cal-Finance/issues/210#issuecomment-5807320616),
2026-09-24T03:58:03Z): do not accept Analyzer V2 as complete while a
successful real run's dominant verdict remains `INCOMPLETE`. **Nothing at
head changes this condition.** All three companies' dominant verdicts are
`INCOMPLETE` on this run (MSFT, OKLO, NVDA above) — the same state
`docs/acceptance-matrix.md` row 11 already records for all three. Row 11
stays `WITHHELD`; this proof does not lift, narrow, or reinterpret that
ruling.

### 2. Row 13 — `deriveVerdict` is still unconditional; §11 items 2–7 stay parked

`lib/analyzer/verdict.ts:61-109` is read-only in this outcome and remains
five unconditional branches, every one returning `INCOMPLETE`, confirmed
byte-identical to `origin/master` by `git diff --name-only
origin/master...HEAD` (verdict.ts absent from that diff):

1. `trust.status === "UNUSABLE"` → `INCOMPLETE` (`:62-68`).
2. `range.kind === "suppressed"` → `INCOMPLETE` (`:72-77`).
3. `range.kind === "pre-revenue-distribution"` → `INCOMPLETE` (`:79-84`).
4. `PROFILE NOT CONFIRMED` active → `INCOMPLETE` (`:93-103`).
5. Otherwise → `INCOMPLETE`, `COMPARATOR_NOT_YET_AVAILABLE` (`:105-108`).

No branch computes a position of any kind, or reads Step 4's `tier` (§4
below).

`docs/verdict-methodology-reconciliation.md` §11 (the re-derived house-policy
list under `CALVIN RULING — C`) carries eight items. **Item 8 — the
REQUIRED-comparator gate's own reach — is CLOSED**, by `CALVIN RULING — B`
(amendment 2), 24 Sep 2026 07:18:42Z (`verdict-methodology-reconciliation.md:1440-1451`):
the gate narrows to §10.6.4's action clause only and does not itself force
the Step 5/6 position to `INCONCLUSIVE`. **Items 1–7 remain open** (same
document, §11, each item's own text, re-read in full for this proof):

- Item 1 (Step 4's margin-of-safety measure) — its *shape* question is
  closed (option C, `verdict-methodology-reconciliation.md:1278-1294`), but
  its *capture* question stays open, restated as one closed question in
  `docs/verdict-decision-pack.md` §1 (re-verified there at `51ed41a`) —
  nothing at `235dc0b` authorises new capture, and this outcome's own HARD
  BOUNDS forbid it regardless.
- Items 2–7 (`verdict-methodology-reconciliation.md:1296-1417`) are
  classified **LATENT** against the current, real, CI-asserted evidence for
  MSFT/OKLO/NVDA by `docs/verdict-decision-pack.md` §8
  (`verdict-decision-pack.md:436-460`), re-verified there, not re-derived
  here: none of items 2–7 changes any of the three companies' current
  outcome, because `deriveVerdict` does not yet implement any of the seven
  ruled steps beyond Step 1's underwritability checks — this proof's own
  verdict readings above (all three `INCOMPLETE`, all five `verdict.ts`
  branches unconditional) are the same fact restated on fresh evidence, not
  a new finding.

This proof implements none of Steps 2, 3, 5 or 6 (HARD BOUNDS 5) and reads no
new figure into `deriveVerdict`.

### 3. Row 14 — design-contract §8 items 2 and 4, dispositioned not closed

`docs/acceptance-matrix.md` row 14, re-read in full: item 2 —
**ANSWERED** (Calvin's 21 Sep 2026 11:01:20Z ruling, issue #196 comment
5759425335) — the §10.6.4 action clause stays separate from the top-level
verdict; item 4 — **NARROWED BY EVIDENCE** — the `INCOMPLETE`-by-default
state is validated as first-class on the current V2 surface (this proof's
own hero-state observations above corroborate that, for all three
companies, not only MSFT/OKLO as the row's cited test file covers). Neither
item is closed, built, or accepted by row 14's own text, and nothing in this
proof changes that — no `app/` file other than a test file is touched (HARD
BOUNDS 1), and no design-contract disposition is revisited.

### 4. `tier` and `forecastDispersion` are computed but consumed nowhere — re-grepped fresh at head

```
$ git grep -n '\.tier\b' -- lib/ app/
lib/analyzer/modules/sensitivity.test.ts:409,447,463,464,465,472,473,474,479
lib/analyzer/step4ForecastDispersionReadingOnRealRun.test.ts:159
```

Every hit is a test assertion (`sensitivity.test.ts`'s synthetic-fixture
tests, and this lane's own prior real-run pin) — **zero hits in any
non-test file under `lib/` or `app/`.**

```
$ git grep -n 'forecastDispersion' -- lib/ app/
lib/analyzer/assemble.ts:512            forecastDispersion: selectStep4ForecastDispersionReading(tornado),
lib/analyzer/modules/sensitivity.test.ts:43
lib/analyzer/modules/sensitivity.ts:39
lib/analyzer/step4ForecastDispersionReadingOnRealRun.test.ts:132,162,164,172,174
lib/analyzer/types.ts:517  forecastDispersion: unknown;
```

The only non-test production hits are `assemble.ts:512` (the field is
written onto `AnalysisResult.diagnostics.sensitivity.forecastDispersion`)
and `types.ts:517` (typed `unknown`, by design — the schema layer stays
independent of the module that shapes it). A further fresh check —
`git grep -n "diagnostics.sensitivity" -- app/` — returns **no hits at
all**: no rendered surface reads `diagnostics.sensitivity` in any form,
tier or otherwise. `resolveStep4DispersionTier`'s own header comment
(`sensitivity.ts:293-294`) already states this plainly ("`tier` remains read
by no valuation, position, gate or verdict computation") — this section
re-verifies that claim fresh at `235dc0b` rather than trusting the comment,
and finds it still true.

---

## The drafted final-acceptance decision package (DRAFT ONLY — nothing adopted)

Per the DRAFT BEFORE ASK rule (`.github/ai-routines/OWNER.md`), the options
for closing row 11 (the `WITHHELD` acceptance status), derived and tested
against head evidence rather than transcribed from the issue's own framing.
**Nothing below is adopted, chosen, or partially implemented by this
outcome** (HARD BOUNDS 10). No number, band, or policy constant is added
anywhere in this section or elsewhere in this diff.

### Option (a) — accept/freeze V2 with the dominant `INCOMPLETE` verdict recorded as a documented known limitation

**Exact consequence.** Analyzer V2 ships and is accepted with every real run
today, and every foreseeable run until M8 lands, showing `INCOMPLETE` in the
dominant verdict slot — a product that never states BUY/HOLD/SELL for any
company. **Cost.** None in engineering effort — nothing to build. **New
permission/capture/spend needed.** None. **Can it move a supported real-run
result?** No — this option changes no code and no output; MSFT, OKLO and
NVDA's figures above are unaffected either way. **Reversible?** Yes, in the
sense that accepting V2 under this framing does not itself prevent a later
M8 delivery from producing a completed verdict — but the acceptance grant
itself, once given, is a decision only Calvin can reverse, and it would
require Calvin to **narrow or supersede his own 24 Sep 2026 ruling** (issue
#210 comment 5807320616) — the ruling row 11 currently withholds acceptance
under. This option is not "do nothing"; it is a request to Calvin to rule
differently than his own most recent ruling on this exact question.

### Option (b) — unpark §11 items 2–7 and authorise implementing the ruled Steps 2/3/5/6 to reach a completed BUY/HOLD/SELL before acceptance

**Exact consequence.** A genuinely completed verdict becomes reachable for
at least MSFT and NVDA (both already clear Step 2's YES licence under every
option of `verdict-decision-pack.md` §2, per its own re-verified evidence)
— but only after real engineering and evidence work, not as a documentation
outcome. **Cost.** Substantial: this is the one item `verdict-decision-pack.md`
§8 identifies as **BLOCKING** (item 1's capture question) plus new code
implementing Steps 2, 3, 5 and 6 — exactly what this outcome's own HARD
BOUNDS 5 forbids doing here. **New permission/capture/spend needed.**
Authorisation to capture `AnalystSuppliedRange` values (`verdict-decision-pack.md`
§1's own recommendation: scoped to growth/margin axes, one already-committed
company); Calvin's ruling on §11 items 1(a)/(b)'s two numeric-policy
sub-questions (A2-vs-A1 reading, B1-vs-B2 shape — both already decided by
`CALVIN RULING — OPTION 1 APPROVED`, issue #325, so only the tier boundaries
and any further calibration remain, per `docs/product-decisions.md` items
23–24); and, per `verdict-decision-pack.md` §12, real observations to answer
items 2–7 where they are not already invariant for the current three
companies. **Can it move a supported real-run result?** Yes — potentially
the only option that can, eventually producing a completed BUY/HOLD/SELL for
at least one company. **Reversible?** The capture itself is reversible
(deleting a recorded `AnalystSuppliedRange` costs nothing); the engineering
work to implement Steps 2/3/5/6 is not trivially reversible once merged and
would need its own later outcome to unwind.

### Option (c) — a narrower middle: take only MSFT to a position under provisional bands

**Exact consequence.** MSFT alone reaches a completed CHEAP/FAIR/EXPENSIVE
→ BUY/HOLD/SELL position, using `PROVISIONAL`-labelled bands rather than
Calvin-ruled ones. **This option is not credible as stated, and is dropped
rather than offered as a genuine middle path:** `docs/verdict-methodology-reconciliation.md`
§11 item 5 (the CHEAP/FAIR/EXPENSIVE numeric band) states plainly that this
is "the one item in this pack where no evidence-grounded recommendation is
possible without inventing the number HARD BOUNDS forbids"
(`verdict-decision-pack.md:343-349`), and
`docs/frozen/calfinance-methodology-v2.md:154` independently states
"numerical valuation-position cut-points remain TEST/provisional... until
adequately validated and explicitly approved." A `PROVISIONAL` band for
Step 5 is not a smaller version of option (b); it is the exact numeric
policy constant every HARD BOUNDS in this lane (including this outcome's
own HARD BOUNDS 4) forbids inventing without evidence that does not yet
exist. Dropped for that reason, not offered with a consequence table.

### Recommendation (not adopted)

**Option (a)**, narrowly: recommend that Calvin consider ruling on whether
his own 24 Sep 2026 finish-line condition (issue #210 comment 5807320616)
should be narrowed to accept V2's shipped UI/data pipeline as complete while
explicitly, permanently recording the dominant-verdict gap as a known
limitation pending M8 — **not** a recommendation that the gap be waved away
silently. This is recommended over (b) because (b)'s own blocking dependency
(item 1's capture authorisation) is itself Calvin's decision to make first,
not something this pass can shortcut, and because (b)'s cost is substantial
new engineering work this outcome's HARD BOUNDS forbid starting on
spec. It is recommended over (c) because (c) is not credible (above).

**The smallest reversible default, if one honestly exists:** there is no
default here that does not require Calvin's own ruling — row 11's condition
is his ruling, and every option above either asks him to narrow it (a),
authorise new capture and code (b), or is dropped as not credible (c). No
option is adoptable by anyone but Calvin, and none is adopted here.

---

## Whether `docs/acceptance-matrix.md` was touched

**Left byte-untouched.** SCOPE item 6 of this outcome makes this narrow
currency update optional and explicitly says "given the size/fragility of
this file (79 lines, extremely dense prose cells), lean toward leaving it
untouched unless you're confident the edit is narrow and safe." Row 10, 11,
13 and 14's cells are each a single, extremely dense paragraph
cross-referencing exact commit SHAs, line numbers and prior headers; a safe
edit would need to thread four new commits (`22a96dc`/#325, `87eca78`/#328,
`9de66dc`/#327, `235dc0b`/#330) into that existing prose without breaking any
of its own cross-references, while touching no `CALVIN ACCEPTANCE` cell and
changing neither row 11's `WITHHELD` status nor row 13's `OPEN` status. That
was not attempted here; this document supplies the same currency (head SHA,
what changed since `3728479`, and the exact current-evidence figures) as a
new, self-contained proof instead, per the outcome's own "that's an
acceptable outcome, not a failure" clause.

---

## What this document does and does not do

**Did:** re-ran all three companies (MSFT, OKLO, NVDA) at `235dc0b` through
the existing gated offline path; recorded each company's complete current
output (trust, gates, EV bridge, leverage, fair-value range, price, the full
tornado row set, the Step 4 forecast-dispersion reading, the verdict and its
cause, and the rendered dominant-verdict hero state) verbatim from the runs;
pinned every new figure by a named assertion in
`lib/analyzer/step4FinalRealRunProof.test.ts`, run and passing; recorded one
genuine surprise (NVDA's enterprise-value bridge now names a fourth missing
REQUIRED input, `price`) rather than silently matching the prior document's
stale three-input figure; re-derived, from head evidence with `file:line`
anchors, exactly what stands between this proof and final acceptance (row
11's unchanged withholding condition, row 13's unconditional `verdict.ts`
and §11's item disposition, row 14's dispositioned-not-closed items, and a
fresh grep proving `tier`/`forecastDispersion` are read by no consumer);
drafted, but did not adopt, the final-acceptance decision package with three
options, their exact consequences, and one named recommendation; confirmed
`npx tsc --noEmit` clean and the full `npm test` run's only failure is the
known pre-existing `chromium_headless_shell` environmental gap
(`.github/workflows/ci.yml:29-39`).

**Did not:** touch `lib/analyzer/verdict.ts`, `lib/analyzer/policy.ts`,
`docs/frozen/`, `docs/product-decisions.md`, or `docs/design/`; add any
number, band, cut-point, or `POLICY_THRESHOLD_PROVENANCE` entry anywhere;
change the two Step 4 tier boundaries; implement any of §11 items 2–7 or let
anything read `tier`; grant, claim, or imply Calvin's final acceptance —
row 11 stays `WITHHELD`, row 13 stays `OPEN`, no row is marked satisfied;
adopt, choose, or partially implement anything in the drafted decision
package; rewrite `docs/m9-real-company-validation-findings.md` or
`docs/nvda-realrun-observation.md` beyond the one short pointer line each
carries to this document; acquire new capture, a new ticker, a new axis, or
any EDGAR/price fetch; reopen any settled ruling this outcome's HARD BOUNDS
names.
