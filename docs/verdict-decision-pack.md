# Verdict decision pack — the consolidated remaining Calvin-owned choices on the verdict lane

**Outcome:** `CF-VERDICT-DECISION-PACK-01` ([issue #322](https://github.com/calyeap/Cal-Finance/issues/322)).
**Authority:** `CALVIN RULING — C`, 25 Sep 2026 08:58:54Z
([PR #319 comment 5829725268](https://github.com/calyeap/Cal-Finance/pull/319#issuecomment-5829725268)):
*"after the bounded C pass, do not drip-feed §11 items 2–7 one at a time.
Consolidate the remaining independent Calvin-owned methodology choices into
one final decision pack wherever possible, with a recommended option for
each and exact consequences. Split only if one decision genuinely blocks
collecting the evidence needed for the others."*

**This is a consolidation, not a decision.** Per `docs/product-decisions.md`
items 3 and 9, AI does not make the final qualitative call and human input
is evidence, not authority. Every recommendation below is a recommendation
for Calvin's ruling. Nothing here is adopted, no threshold or band is set,
no `docs/acceptance-matrix.md` row is marked satisfied, and no product code
changes.

**Head SHA.** Every evidence claim below was re-verified against
`origin/master` = `51ed41ae2b7cdcc718ada7b79b1aed589961b9ee` in this pass —
either by re-reading the cited file directly or by re-running the cited
`git`/`grep` command, not carried from this issue's body, from
`docs/verdict-methodology-reconciliation.md` §11's own `8be9a50` notes, or
from `docs/step4-forecast-dispersion.md` without re-checking. `git diff
--stat 8be9a50 51ed41a -- lib/` returns exactly one file
(`lib/analyzer/step4SignalObservationOnRealRun.test.ts`, a new test, no
existing file touched) — so every `lib/` citation §11 and §12 made at
`8be9a50` is unchanged at this head, confirmed by that diff rather than
assumed; the specific figures this pack repeats (verdict.ts's branch
structure, policy.ts's `UNDEFINED_POLICY_CONSTANTS`, the `AnalystSuppliedRange`
zero-hit outside `sensitivity.ts`/its test, MSFT's and NVDA's RONIC ladder
values, NVDA's ten-year/five-year comparator pair) were each independently
re-read or re-grepped this pass, not only inferred from the diff being
empty. Every such re-check is cited inline below.

## What §322 is, and how this pack is organised

Every still-open item on the verdict lane's house-policy list
(`docs/verdict-methodology-reconciliation.md` §11) is carried into this pack
as one closed question: item 1's residual half (§1 below), then items 2–7
(§§2–7 below), each restated with its options, its evidence re-verified at
this head, the exact consequence of each option, and one named
recommendation. **Item 8 is CLOSED** (the REQUIRED-comparator gate narrows
to §10.6.4's action clause only, `CALVIN RULING — B` amendment 2, applied by
`CF-VERDICT-1062-APPLY-01`) and does not appear below as an open question —
named here once, for completeness, and not reopened.

§8 below gives each item's blocking-versus-latent classification against
the current verdict/final-acceptance path, per ruling C's finish-line rule.
§9 states the consolidation judgement itself. Nothing in §§1–7 adopts a
number, a shape, or a default; every recommendation is labelled as a
recommendation.

---

## 1. Item 1 (residual half) — what is Step 4's margin-of-safety measure, and should its one buildable candidate's capture be authorised?

**Shape already ruled, not reopened.** `CALVIN RULING — C` (`02d5970`) ruled
this item's shape question: **option C**, a genuinely new forecast-dispersion
measure independent of both Step 1's evidence-quality flags and Step 5's
scenario range — not A (scenario-range dispersion) and not B (evidence-quality
flags). That half is closed and stays closed here.

**What is open is the capture question `CF-STEP4-DISPERSION-C-01`
established, carried forward from `docs/step4-forecast-dispersion.md`
without re-deriving it (re-verified this pass, not re-argued):**

- Every already-captured candidate in the tree was reconciled against option
  C and against both of ruling C's independence instances. Three specify
  clean enough to evaluate in full; the rest fail on availability or scope
  before reaching specification (`docs/step4-forecast-dispersion.md` SCOPE
  1–2).
- Of those three, only the tornado/two-way mechanism (`modules/sensitivity.ts`,
  `computeTornado` / `computeGrowthMarginTable` /
  `computeRateTerminalGrowthTable`, `sensitivity.ts:166-265`) specifies clean
  against **both** independence instances at once (SCOPE 3): it never reads
  `states.qualifying`/`trust.status` (the Step 1/Gate 1 instance) and never
  reads `fixture.scenarioValues`/`scenarioOutputs.values` (the Step 5
  instance). The other two candidates fail independence or provenance:
  scenario-driver dispersion is either not-acquired (MSFT), absent (OKLO),
  or the scenario range's own stated computational precursor (NVDA);
  margin-cyclicality dispersion is already `states.qualifying`'s own field,
  already read into `trust.status`.
- The tornado/two-way mechanism is fully built and tested
  (`sensitivity.test.ts`) but unusable on every real run today because
  `AnalystSuppliedRange` — the type every tornado row and two-way cell needs
  — is supplied nowhere in the acquisition pipeline or either committed
  fixture. **Re-verified this pass:** `git grep -n "AnalystSuppliedRange" --
  lib` returns exactly two files, `modules/sensitivity.ts` (the type's
  definition and its five call sites) and `modules/sensitivity.test.ts` (its
  own unit test) — zero hits in `fixtures/`, `companyInputs.ts`, or
  `analystInputs.ts`. `buildSensitivityResult()` is called with no arguments
  at both of its two production call sites, `assemble.ts:442` and
  `modules/scenarioOutputs.ts:189`, and returns empty arrays on every real
  run, MSFT/OKLO/NVDA alike.

**The decision, stated as one closed question for Calvin:** *should Command
Center/analyst capture of `AnalystSuppliedRange` values — three explicit
points and a recorded rationale each, for at least the growth and margin
axes (§7.2 M14's own named two-way table), for at least one already-committed
company — be authorised?*

- **Options.** (a) Authorise the capture, on named axes, for a named
  company. (b) Do not authorise it now; leave Step 4 unbuilt and the
  question open. (c) Authorise a Command Center/Calvin ruling that
  candidate 2 (margin-cyclicality dispersion, `tenYearMarginRange` /
  `worstSingleYearChange`) is an acceptable named exception to `CALVIN
  RULING — B` amendment 1's Step 1/Step 4 separation, in place of new
  capture — named in `docs/step4-forecast-dispersion.md` SCOPE 4 only as the
  alternative to capture, not proposed, because ruling C's own text already
  forecloses this shape ("independent of... the existing evidence-quality
  flags (Step 1)").
- **Consequence of each.** (a) is new capture, out of every prior outcome's
  HARD BOUNDS in this lane, and is the only path that keeps Step 4
  independent of both Step 1 and Step 5 by construction; nothing in `lib/`
  needs to change once the values exist — `computeGrowthMarginTable` and
  `computeTornadoRow` are already tested against exactly this shape. (b)
  leaves Step 4, and therefore the whole seven-step structure's Step 5/6,
  unbuildable indefinitely; per §8 below, this is what is currently blocking
  MSFT's position from ever computing under the ruled structure — this
  option accepts that block continuing. (c) is smaller (no new capture) but
  reuses a statistic already load-bearing on `trust.status`'s own `PARTIAL`
  determination (Trigger A/B, `gates.ts:215-264`, feeding `trust.ts:118-123`)
  for a second, distinct purpose ruling C's own text already forecloses —
  offered for completeness, not recommended.
- **Recommendation, not adopted:** (a), scoped to the growth and margin axes
  only (not all five `sensitivity.ts` axes) and to one already-committed
  company (MSFT or NVDA — both already clear the RONIC-ladder and
  dual-horizon evidence bullets in §12 below), because it is the smallest
  capture that unblocks the one candidate that specifies clean against both
  independence tests, and because option (c) is foreclosed by ruling C's own
  words rather than genuinely open.

**If (a) is authorised, two further numeric-policy questions follow —
carried intact from `docs/step4-forecast-dispersion.md` SCOPE 5, not
re-derived, with their recommendations preserved as recommendations:**

**(a) Which reading becomes the Step 4 quantity.** Option A1: the existing
`fullRangeValueImpact` on the growth tornado row alone — smallest change to
consume, but ignores margin/rate/terminal-growth dispersion, understating
uncertainty for a company whose margin is the more volatile driver. Option
A2: the full five-row tornado's maximum `fullRangeValueImpact` across all
available rows — captures whichever driver is actually most uncertain per
company, matching the tornado's own stated purpose, but needs all five
ranges captured, not just growth/margin, raising the capture bar above what
this item's own recommendation just scoped. **Recommendation, not adopted:
A2 in principle once capture supports it; A1 as a fallback if only a subset
of ranges is ever captured** — unchanged from the source document.

**(b) How the reading becomes a fair-value-zone width.** Option B1: a
numeric threshold directly on `fullRangeValueImpact` — a genuine numeric
policy constant, the kind HARD BOUNDS forbids adopting here and the kind
`docs/frozen/calfinance-methodology-v2.md:154` already names as the
forbidden `PROVISIONAL`-value pattern. Option B2: a categorical tier
(LOW/MEDIUM/HIGH dispersion, thresholds still undrafted) mirroring how §9.4
qualifying flags are categorical rather than numeric. **Recommendation, not
adopted: B2** — unchanged from the source document, for the same reason
(more defensible against "do not adopt... any new numeric threshold," and
keeps Step 4's output the same *kind* of thing the rest of `states.qualifying`
already is, without reusing the field itself).

Neither (a) nor (b) is answerable before the capture question itself is
ruled; both are stated here so a single yes on capture does not reopen a
second round of drip-fed questions.

---

## 2. Item 2 — what makes Step 2's growth licence UNKNOWN, and does RONIC NOT MEANINGFUL count as UNKNOWN or as a Step 1 failure?

**The question.** Ruling C's Step 2 (`docs/frozen/calboard-stock-analyzer-v1-spec.md`
§10.6.2, applied text) is a three-way YES / NO / UNKNOWN split with no
stated test for UNKNOWN's membership, and no stated mapping from §7.2 M5's
own ladder states (RONIC NOT MEANINGFUL · LOW RONIC — VALUE-DESTROYING
GROWTH · computed · RONIC CAPPED AT 200%) onto the three readings.

**Options**, unchanged from §11 item 2: (i) UNKNOWN means "the RONIC reading
is close enough to the rate-grid boundary that estimation error could
plausibly place it on either side" — an estimation-uncertainty test,
distinct from item 1's Step 4 concern but symmetric with it in spirit; (ii)
UNKNOWN means any ladder state that is not a clean "computed" reading —
i.e. RONIC NOT MEANINGFUL as well as a boundary-adjacent LOW RONIC reading;
(iii) RONIC NOT MEANINGFUL specifically is a Step 1 underwritability failure,
not a Step 2 state — a licence that cannot be computed at all is a different
claim from one that is computed but ambiguous.

**Consequence of each.** (i) and (ii) route a MSFT-shaped company (were its
RONIC actually NOT MEANINGFUL on every cell, which it is not — see below) to
Step 6's flip test; (iii) routes it to INCONCLUSIVE at Step 1 directly,
without ever reaching Step 2, 3, 4 or 6.

**Evidence, re-verified this pass.** MSFT's RONIC ladder is **not** NOT
MEANINGFUL: it is CLEAN at ~17.4977% on all nine reverse-DCF cells. Re-read
directly this pass — `lib/analyzer/reverseDcfOnRealRun.test.ts:74-82`
asserts `cells.every((c) => causeOf(c.fiveYearGrowth) !== "RONIC not
meaningful for this company (§7.2 M5 ladder)")` is `true` against a real
acquired MSFT run, and the surrounding comment (`:63-72`) states this is the
state since `CF-RONIC-DELTAS-RECON-01` (#298) acquired both of RONIC's
five-year deltas. NVDA's ladder is likewise CLEAN, at ~75.2385% on all nine
cells — re-read directly this pass at
`lib/analyzer/nvdaRealRunObservation.test.ts:143-175`, which computes
$132{,}147{,}000{,}000 \times 0.752385$ from the run's own acquired NOPAT and
invested-capital deltas and asserts the CLEAN state on every cell. 17.50%
and 75.24% both sit comfortably above every point in the 8/10/12% rate grid
— neither is "close to" any grid point under any plausible reading of
option (i), and neither is a NOT MEANINGFUL or boundary-adjacent LOW RONIC
reading under option (ii), and the RONIC computation itself resolves for
both companies (not a Step 1 failure) under option (iii). **All three
options read MSFT's and NVDA's Step 2 licence identically: YES.** OKLO's
ladder is separately unacquired
(`docs/ronic-deltas-composition-reconciliation.md` §7c) and OKLO never
reaches Step 2 at all — blocked upstream at Step 1 by the leverage
precondition (`LEVERAGE UNSUPPORTED IN v1`; re-confirmed this pass via
`lib/analyzer/nonOperatingJudgmentRecordedOnRealRun.test.ts` and
`lib/analyzer/recordedAnalystInputEntryOnRealRun.test.tsx`, both still
asserting this state).

**This item's answer therefore changes none of the three companies'
current Step 2 outcomes, whichever option Calvin rules.**

**Recommendation, not adopted:** option (iii) — a licence the RONIC
computation cannot resolve at all is a different claim from one that
resolves but sits near a boundary, and keeping that distinction at Step 1
(where §10.6.3's other underwritability failures already live) rather than
folding it into Step 2's YES/NO/UNKNOWN keeps Step 2's three readings all
meaning "the computation resolved, and here is what it says" — options (i)
and (ii) both let a non-resolving computation masquerade as an ambiguous
resolved one. This recommendation is offered because a question this pack
puts to Calvin should not be silent on which way the authors lean, not
because the evidence compels it — no company today tests option (iii)
against (i)/(ii) either.

---

## 3. Item 3 — is the conservative / no-growth value a fixed floor or a company-specific lower bound?

**The question.** Step 3 produces the conservative / no-growth value only
where Step 2 reads NO, or (transiently, for Step 6's flip test) where Step 2
reads UNKNOWN. Its own shape is undefined: a fixed floor (e.g. zero growth)
or a company-specific lower bound (e.g. the bear scenario's own growth
path).

**Options, unchanged from §11 item 3.** Fixed floor: simpler, more uniform,
favours fixed rule 1 (no per-company adjustment), but may be economically
meaningless for a structurally shrinking company. Company-specific bound
(the bear case): reuses machinery already in the range, but ties Step 3's
reading to an assumption that already feeds Step 5's comparison — risking a
version of Finding 3's double-counting concern one layer down, the same
shape already named and not resolved in `docs/verdict-methodology-reconciliation.md`
§4 item 3 / §11 item 3.

**Evidence, re-verified this pass.** Both companies whose RONIC ladder
currently resolves (MSFT, NVDA — §2 above) read Step 2 = YES under every
option of item 2. Step 3 under a YES licence produces the growth-inclusive
value only (`docs/frozen/calboard-stock-analyzer-v1-spec.md` §10.6.2 Step 3,
applied text: "the growth-inclusive value where YES... conservative /
no-growth value where NO"); the conservative reading is not the operative
value for either company today. OKLO never reaches Step 2. **No currently
evidenced company has a Step 2 reading of NO or UNKNOWN, so no company's
current outcome exercises this item's answer either way.**

**Recommendation, not adopted:** the company-specific bound (the bear
scenario's own growth path), because a fixed floor of zero growth is
economically arbitrary for a company whose bear case is itself a considered,
analyst-authored assumption already in the tree, and because the
double-counting risk this option raises is the same shape Finding 3 already
named and Step 2/Step 5's licensing mechanism (§10.2 of the reconciliation
document) was designed to answer, not a new unaddressed risk — the same
reasoning applies here at one remove. This is a recommendation, not a
resolution of the double-counting question, which remains named rather than
answered.

---

## 4. Item 4 — which reverse-DCF cell (or combination) supplies Step 2's RONIC-vs-rate reading and Step 7's consistency-check figure?

**The question.** M7 produces a nine-cell grid (8/10/12% discount rate ×
three margin levels). Step 2 and Step 7 both need one RONIC-vs-rate reading
per company; the grid does not collapse to one reading on its own.

**Options, unchanged from §11 item 4.** A single designated margin/rate
cell — simplest, but arbitrary, with no precedent in the frozen text for
which cell. Requiring direction-of-agreement across all nine cells — more
defensible, still undefined for what happens on disagreement. Reading the
grid's range — most defensible in principle, but has no precedent in the
frozen text for how a *range* of readings collapses to one Step 2
determination.

**Evidence, re-verified this pass.** MSFT's ladder is CLEAN at ~17.4977% on
all nine cells; NVDA's is CLEAN at ~75.2385% on all nine cells (§2 above,
same citations re-read). **All nine cells agree in direction for both
companies** — none straddles or sits near the 8/10/12% grid. That means
nothing in the current evidence set distinguishes a single-cell reading from
a grid-range reading from a direction-of-agreement reading: whichever option
is chosen, MSFT's and NVDA's Step 2 reading is YES either way, because every
cell agrees. Telling the three options apart needs a company whose ladder
crosses or sits near the grid — the same gap §12 bullet 4 below states is
still open.

**This item's answer changes none of the three companies' current outcomes,
because all nine cells already agree in direction for the two companies
whose ladders resolve, and OKLO's ladder is unacquired.**

**Recommendation, not adopted:** direction-of-agreement across all nine
cells, defaulting to Step 2 = UNKNOWN (not a silent NO) where the nine cells
disagree in direction — it is the option closest to the frozen text's own
existing "fails toward saying less" discipline (§10.6.2's fixed rule 2, in
substance carried into Step 6's flip test), avoids picking one arbitrary
cell, and needs no numeric aggregation of a range the way the range option
would. This is offered as the option most consistent with existing house
discipline, not because current evidence discriminates between the three —
it does not (this item's own evidence-status paragraph above).

---

## 5. Item 5 — what numeric band or cut-point does the eventual CHEAP / FAIR / EXPENSIVE classification at Step 5 need?

**The question.** Step 5 compares price against the Step 3 value (or, under
Step 6, both candidate values) to derive CHEAP / FAIR / EXPENSIVE. No band
or cut-point exists anywhere in the tree for this comparison today.

**Evidence, re-verified this pass.** `lib/analyzer/policy.ts`'s
`PolicyConstants` and `POLICY_THRESHOLD_PROVENANCE` re-read in full this
pass: no §10.6.2/Step-5 entry of any kind exists in either. The one
plausibly-adjacent constant, `fcfYieldGrowthPreconditionBand`
(`policy.ts:60`), is M11's §7.2 precondition band, unrelated to Step 5.
Unchanged from every prior read of this file in this lane.

**Options.** None are named — per HARD BOUNDS and `docs/frozen/calfinance-methodology-v2.md:154`'s
own "numerical valuation-position cut-points remain TEST/provisional...
until adequately validated and explicitly approved," no shape is proposed
here, and none is answerable from evidence that does not yet exist (§12
below).

**Consequence.** Whatever band is eventually set governs how wide a Step 4
zone or Step 3 value must be from price before CHEAP or EXPENSIVE fires,
for every company simultaneously (fixed rule 1: no per-company adjustment).
Setting it prematurely, on a two-company evidence set neither of which
currently reaches Step 5 (§8 below), would itself be exactly the invented
numeric policy constant HARD BOUNDS forbids.

**Recommendation:** none offered — this is the one item in this pack where
no evidence-grounded recommendation is possible without inventing the
number HARD BOUNDS forbids. That is itself the answer this item needs to
carry: **not answerable from evidence today**, not merely "not answered
here." This item is not stalled by not naming a preferred shape; it is
genuinely blocked on the composition requirement in §12 below.

---

## 6. Item 6 — is the eventual EXPENSIVE band mirrored to the CHEAP band around FAIR, or set independently?

**The question.** Once item 5's band exists, is the EXPENSIVE side
symmetric to the CHEAP side around FAIR, or independently calibrated?

**Evidence, re-verified this pass.** Unchanged: ruling C's own text
("do not adopt... mirrored SELL geometry... in this ruling") declines to
adopt either shape; nothing since has adopted one. `docs/verdict-synthesis-research.md`
§2 item 3 (Morningstar) is evidence about *how* practitioners structure a
calibration process under thin data, not evidence for a specific geometry,
per Finding 5 (§1.5 of the reconciliation document) — still the governing
caution, unchanged.

**Options.** Symmetric (a house convention Finding 5 warns against adopting
without evidence) or asymmetric (e.g., a wider margin required to call
something EXPENSIVE than CHEAP, or vice versa — equally unevidenced today).
No default is assumed by ruling C's non-adoption; declining to adopt a
shape now is not itself a ruling that the shape is wrong, only that it is
undecided.

**Consequence.** Symmetric is simpler and reuses one calibration pass for
both sides; asymmetric would need its own, separate evidence base and
rationale before it could be set, on top of item 5's own composition
requirement.

**Recommendation, not adopted:** symmetric as the default working
assumption **only if and when item 5's band itself is ever set**, on the
narrow ground that Finding 5's caution is against *importing a specific
number or shape from Morningstar without evidence*, not against symmetry as
a concept — a symmetric band is the smaller, more falsifiable claim to test
first, and an asymmetric one can be justified later from observed
asymmetric evidence rather than assumed up front. This recommendation is
explicitly conditional on item 5, which is itself not answerable today;
it is not a standalone adoption.

---

## 7. Item 7 — may five-year and ten-year observations share one band?

**The question.** `docs/frozen/calboard-stock-analyzer-v1-spec.md` §10.6.2's
own carried-forward text already states this must be "answered from
observations rather than assumed" — restated here as its own item because
it survives unchanged under the ruled structure.

**Evidence, re-verified this pass.** Partially exists, where it did not
before. NVDA supplies one company's own matched pair on the same
single-tag series (`us-gaap:Revenues`), re-read directly this pass at
`docs/nvda-realrun-observation.md:121-140`: ten-year FY2016→FY2026 at
45.6965% (`cagr: 45.6965...%`) and five-year FY2021→FY2026 at 66.8986%
(`cagr: 66.8986...%`), both `yearsStale: 0`, no cross-series stitching. That
is one company's pair, not the cross-company comparison the spec text's own
"answered from observations" implies — whether a common band holds needs
multiple companies' pairs compared against each other, and NVDA supplies
only the first.

**Options.** Pool five-year and ten-year observations into one band, or
calibrate per-horizon. Not resolvable from a single company's pair.

**Consequence.** Pooling is simpler if it holds, but risks masking a real
horizon-dependent difference (a five-year window is more volatile than a
ten-year one on the same series almost definitionally, as NVDA's own pair
shows — 66.90% vs 45.70%). Per-horizon calibration is safer but needs
roughly twice the evidence to reach the same confidence per band.

**Recommendation, not adopted:** calibrate per-horizon until at least a
second company's matched pair exists to test whether the two horizons'
readings move together in a way that would justify pooling — NVDA's own
pair (66.90% five-year vs. 45.70% ten-year, a 21-point gap on the same
series) is itself a caution against assuming they pool, not evidence either
way on a second company. This is closer to answerable than before this
refresh, and further work here is exactly the kind of incremental evidence
this item's own text asks for; it is not answered by having one data point.

---

## 8. Blocking-versus-latent classification, and why

Per ruling C's own finish-line rule ("resolve only what blocks the current
verdict/final acceptance path; latent methodology issues go to backlog"),
each item above is classified against the current, real, CI-asserted
evidence for MSFT, OKLO and NVDA — the whole evidence base available without
new capture.

| Item | Classification | Why |
|---|---|---|
| 1 (Step 4 measure / capture) | **BLOCKS** | The one item whose answer currently controls whether any company's position can be computed at all under the ruled structure. Per the corrected MSFT reading (§2/§4 above): MSFT's Step 2 licence already resolves `YES` under every option of item 2, and Step 3 already produces a growth-inclusive value under that licence — Step 5's comparison cannot run without Step 4's zone, and no independently-measurable forecast-uncertainty input exists anywhere in the tree (§1 above). This is the named, specific evidence gap standing in front of the gate today. |
| 2 (Step 2 UNKNOWN definition) | **LATENT** | Provably does not change MSFT's or NVDA's current Step 2 reading — both read `YES` under all three options (§2 above) — and OKLO never reaches Step 2. No currently-evidenced company's outcome turns on this item. Backlog candidate, named as such by ruling C's own finish-line rule. |
| 3 (conservative-value shape) | **LATENT** | No currently-evidenced company has a Step 2 reading of `NO` or `UNKNOWN`; the conservative value is not the operative value for MSFT, NVDA (both `YES`) or OKLO (never reaches Step 2). Not exercised by any current outcome. |
| 4 (which RONIC cell) | **LATENT** | All nine cells agree in direction for both companies whose ladders resolve (MSFT, NVDA); nothing today distinguishes the three options, and none changes either company's Step 2 reading. |
| 5 (numeric band/cut-point) | **LATENT** | Downstream of Step 4, which is itself blocked (item 1); no company reaches Step 5 today, and the evidence needed to set a number does not exist (§12 below). Not answerable, let alone blocking, until item 1 clears. |
| 6 (mirrored/asymmetric geometry) | **LATENT** | Downstream of item 5, which is itself downstream of item 1. Conditional on a decision that is not itself reachable today. |
| 7 (5yr/10yr pooling) | **LATENT** | Needs a second company's matched pair to answer; not reachable from NVDA's pair alone, and downstream of item 5's band existing to be pooled or not. |

**The single, load-bearing consequence of this table:** item 1 is the sole
item currently on the critical path to closing `docs/acceptance-matrix.md`
row 13 and unwithholding row 11. Every other item is latent **today** —
not because it is unimportant, but because `deriveVerdict` does not yet
implement any of the seven ruled steps beyond Step 1's underwritability
checks (`lib/analyzer/verdict.ts:61-109`, re-read this pass, unchanged:
`UNUSABLE` → `INCOMPLETE` (`:62-68`); `suppressed` → `INCOMPLETE` (`:72-77`);
`pre-revenue-distribution` → `INCOMPLETE` (`:79-84`); `PROFILE NOT
CONFIRMED` → `INCOMPLETE` (`:96-103`); otherwise `INCOMPLETE`,
`COMPARATOR_NOT_YET_AVAILABLE` (`:105-108`)), so no real run's actual
product output depends on items 2–7's answers *yet*. That does not mean
items 2–7 can be deferred forever — implementing Steps 2, 3, 5 and 6 in
code will eventually need each of them answered — but it does mean none of
them is what stands between today's tree and the next real verdict, which
is exactly the distinction the finish-line rule draws.

---

## 9. The consolidation judgement

**One pack, not split.** Item 1's capture question (Command Center/analyst
authorship of `AnalystSuppliedRange` values) does not block collecting the
evidence any of items 2–7 need: items 2 and 4 need a company whose RONIC
ladder crosses or sits near the 8/10/12% grid (§12 bullet 4 below); item 3
needs a company whose Step 2 reading is `NO` or `UNKNOWN`; items 5 and 6
need real observations across companies once a band exists to calibrate;
item 7 needs a second company's matched five-year/ten-year pair. None of
these evidence requirements depends on whether item 1's capture is
authorised or on what item 1's measure eventually reads — they are
orthogonal evidence-gathering paths, not a dependency chain. Per ruling C's
own instruction, splitting is the exception; no genuine blocking dependency
was found here, so this pack stays consolidated, per the default.

---

## What this pack does and does not do

**Did:** re-derived every still-open §11 item (item 1's residual half, then
items 2–7) as one closed question each, with options, a re-verified
evidence status at `51ed41a`, the exact consequence of each option
(including, where the evidence supports it, what it does and does not
change for MSFT, OKLO and NVDA specifically), and one named recommendation
per item, per ruling C's own requirement; classified each item as blocking
the current verdict/final-acceptance path or latent, with the classification
justified from re-verified evidence rather than asserted; stated the
consolidation judgement ruling C asks for and why no evidence dependency
forces a split; carried item 1's residual half from
`docs/step4-forecast-dispersion.md` intact, including its (a)/(b) drafted
numeric-policy questions and their A2/B2 recommendations, without
re-deriving or adopting them; confirmed item 8 is closed and does not
reappear as open.

**Did not:** adopt any numeric threshold, band, cut-point, zone width,
horizon rule, disagreement constant, `PROVISIONAL` entry or
`POLICY_THRESHOLD_PROVENANCE` row, anywhere, in code or in prose presented
as settled; touch any `docs/frozen/` byte or `FROZEN_HASHES` entry; touch
`docs/acceptance-matrix.md`, `docs/m9-acceptance-record.md`,
`docs/product-decisions.md`, `docs/product-roadmap.md`, `.github/`, or
`lib/`; reopen §11 item 1's shape (option C stays chosen) or item 8's
closure; acquire new capture, a new company, or new EDGAR data — item 1's
capture question is put to Calvin as a decision, not acted on; claim any
`docs/acceptance-matrix.md` row satisfied — row 11 stays `WITHHELD`; reach
final real-run proof or Calvin acceptance, which remain the next steps in
lane after this pack's own ruling.

---

## Reproducing the checks this pack ran

```
git diff --stat 8be9a50 51ed41a -- lib/
git grep -n "AnalystSuppliedRange" -- lib
sed -n '61,109p' lib/analyzer/verdict.ts
sed -n '55,73p' lib/analyzer/policy.ts
grep -n "RONIC not meaningful" lib/analyzer/reverseDcfOnRealRun.test.ts
grep -n "75.2385\|RONIC" lib/analyzer/nvdaRealRunObservation.test.ts
sed -n '113,155p' docs/nvda-realrun-observation.md
```

All re-run this pass at `51ed41a`; results quoted inline above.
