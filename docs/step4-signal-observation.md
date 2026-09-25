# Step 4 signal observation — option A vs. option B on the three real runs

`CF-STEP4-SIGNAL-OBSERVE-01` (issue #318), authorised by **`CALVIN RULING —
D`** ([PR #317 comment 5828926086](https://github.com/calyeap/Cal-Finance/pull/317#issuecomment-5828926086)):
"one bounded, no-new-capture observation pass over the existing MSFT, OKLO and
NVDA real runs to compare the currently available Step 4 candidate signals
before choosing A, B or C."

**This document reports. It rules nothing.** It does not answer
`docs/verdict-methodology-reconciliation.md` §11 item 1, does not choose,
rank, default to, or recommend option A, B or C, sets no number, and marks no
`docs/acceptance-matrix.md` row satisfied — those stay Calvin's
(`docs/product-decisions.md` items 3 and 9). It follows
`docs/nvda-realrun-observation.md`'s reporting-only framing (the
`CF-NVDA-RUN-OBSERVE-01` precedent named in this outcome's authority).

**Head SHA.** All evidence below was read and every run below was executed
this pass at `origin/master` = `5caa5fc29d7b176b0c4fdfd7b01a68ccb73da4f4` —
not carried from this issue's own body, from
`docs/m9-real-company-validation-findings.md`, from
`docs/nvda-realrun-observation.md`, or from any other prior document's claim.

## What §11 item 1 asks, restated

`docs/verdict-methodology-reconciliation.md` §11 item 1: "what is 'economic /
forecast uncertainty' for Step 4's margin of safety?" Options, verbatim in
substance: **A**, a measure of the dispersion across the bear/base/bull
scenario range itself; **B**, a measure of the evidence-quality flags already
carried (SECONDARY, UNVERIFIED, AI-EXTRACTED, SHORT HISTORY); **C**, a
genuinely new measure of forecast dispersion not yet computed anywhere.
**`CALVIN RULING — B` (amendment 1)** — already settled, carried not
reopened — requires that whichever shape Step 4 takes, it stays a separate
input from Step 1's evidence/estimation confidence, never the same object
read a second time under another name.

## Method

The three runs were opened this pass through the same gated product path the
precedent real-run tests already use
(`createRun` → complete the spot-check queue → record the profile decision →
`computeAnalysisForRun`, `lib/analyzer/gate.ts`):

- **MSFT** — Calvin's §4.4 ruling (issue #188: the FY2026 `LongTermInvestments`
  aggregate alone is the non-operating investment balance) recorded via
  `recordJudgment`, exactly as `nonOperatingJudgmentRecordedOnRealRun.test.ts`
  already opens it. Without this recording MSFT's enterprise value — and so
  its fair-value range — is INCOMPLETE for the same reason OKLO's is below;
  this is the one state among MSFT's own already-committed real-run variants
  in which a rendered range exists to observe against option A at all.
- **OKLO** — opened unchanged, zero non-operating-investment candidates, the
  same state `nonOperatingJudgmentRecordedOnRealRun.test.ts`'s own
  `openOkloRunUnchanged` reaches.
- **NVDA** — the approved Step-7 bundle
  (`docs/analyst-drafts/nvda-step7-draft.md`, merged `0753051`, PR #295)
  transcribed via `recordAnalystBundle`, §4.4 left unmade, exactly as
  `nvdaRealRunObservation.test.ts` opens it.

The reproducing test is
`lib/analyzer/step4SignalObservationOnRealRun.test.ts` — a single new
read-only observation test (this outcome's only permitted non-doc file per
`BUILD.md`'s HARD BOUNDS), asserting every run-output figure quoted below
directly off each run's own output (the `bull − bear`/`bull ÷ bear` rows in
§1 are this document's own arithmetic on asserted values, not themselves
asserted — see the note under §1's table). It records and deletes the NVDA
bundle around itself,
the same discipline its precedent already uses, and touches no other file's
recorded state. Run this pass: **3/3 passing**
(`npx vitest run lib/analyzer/step4SignalObservationOnRealRun.test.ts`).

## (1) Option A per company — the bear/base/bull scenario range

| | MSFT | OKLO | NVDA |
|---|---|---|---|
| `fairValueRange.kind` | `"range"` | `"suppressed"` (`LEVERAGE UNSUPPORTED IN v1`) | `"suppressed"` (`LEVERAGE UNSUPPORTED IN v1`) |
| `scenarioOutputs.values.bear` | $265.00 | $3.10 | $28.08 |
| `scenarioOutputs.values.base` | $510.00 | $31.00 | $102.38 |
| `scenarioOutputs.values.bull` | $650.00 | $48.00 | $296.44 |
| `weightedDistribution` | $474.99999999999999999 (≈ $475.00) | $27.366666666666666666 (≈ $27.37) | $142.30 |
| bull − bear *(derived, not a run output — see below)* | $385.00 | $44.90 | $268.36 |
| bull ÷ bear *(derived, not a run output — see below)* | 2.4528… | 15.4839… | 10.5570… |
| `scenarioLabelsWarning` (only meaningful where the range renders) | `true` | — (range suppressed) | — (range suppressed) |

The `bull − bear` and `bull ÷ bear` rows are arithmetic this document derives
from the two `scenarioOutputs.values` rows directly above them — they are not
a value any run itself produces, and not a dispersion formula this pass
defines or adopts (SCOPE 1 forbids that). They sit in the same table as the
run-output rows for readability only; the two kinds of row are not the same
kind of fact.

**A dispersion reading is available for all three companies at the raw
`scenarioOutputs` level, but the rendered `FairValueRange` §10.3 governs is
available for only one of them.** MSFT's is a genuine, unsuppressed
`"range"`. OKLO's and NVDA's `FairValueRange` is `"suppressed"` — not a
degenerate or single-point range, an absent one — because both fail the
leverage precondition upstream (`LEVERAGE UNSUPPORTED IN v1`, §6.5), a cause
unrelated to either company's own scenario authorship. The three raw
`scenarioOutputs.values` themselves still compute for OKLO and NVDA, because
that computation sits upstream of the leverage gate that removes the
rendered range — so if option A were built from `scenarioOutputs` rather than
from the post-suppression `FairValueRange`, all three companies would supply
a reading; built from `FairValueRange` itself, only MSFT would. This is
reported as the observed state, not resolved: SCOPE forbids defining a
dispersion formula or adopting either reading here.

**MSFT's own range already carries §10.3's own caveat live.** MSFT's
`scenarioLabelsWarning` is `true` — the same run's `states.qualifying` fires
`MARGIN AT HISTORICAL HIGH` (Trigger A), which is what raises the warning —
so on the one company where option A's range actually renders, §10.3's own
text ("the bounds are scenario labels, not confidence bounds") already
applies to it, on real evidence, not hypothetically.

NVDA's three values are the transcribed Step-7 bundle's own authored
scenario values (`docs/analyst-drafts/nvda-step7-draft.md`, PR #295) carried
straight through — not independently re-derived by anything this run
computes beyond authoring itself. **OKLO's and MSFT's are not computed by
anything.** Both are the M5/M7 validation set's carried scenario constants:
OKLO's bear/base/bull are hardcoded at `lib/analyzer/fixtures/oklo.ts:353`
(bear = the `3.10` cash-per-share constant at `:51`, base `31`, bull `48`) —
that same line's own comment states they are "Not used for the pre-revenue
profile" — and MSFT's `265`/`510`/`650` are hardcoded at
`lib/analyzer/fixtures/msft.ts:272`. Both reach the run unchanged through
`acquisition/analystInputs.ts`, whose own disclosure text is explicit that
this is not incidental: "The three scenarios, the values they produce and
four unset policy constants on this run were NOT acquired. They are carried
from the validation set, because the screen where you enter scenarios is
not built yet. Every fact, gate and margin figure on this run comes from SEC
filings." So of option A's three per-company readings above, only NVDA's is
analyst-authored and approved; OKLO's and MSFT's are arithmetic on carried
validation-set placeholders the run itself discloses as not acquired.

## (2) Option B per company — evidence-quality flags and §9.6 trust status

| | MSFT | OKLO | NVDA |
|---|---|---|---|
| Gate 1 | PASS, 13 filed years (`state: null`) | `SHORT HISTORY`, 5 filed years | PASS, 13 filed years (`state: null`) |
| `states.qualifying` (actually carried) | `[MARGIN AT HISTORICAL HIGH]` | `[SHORT HISTORY]` | `[CAPITAL-LIGHT]` |
| `trust.status` | `PARTIAL` | `UNUSABLE` | `UNUSABLE` |
| Facts with `sourceClass: "SECONDARY"` | 0 of 20 | 0 of 16 | 0 of 15 |
| Facts with `extractionType: "AI-EXTRACTED"` | 0 of 20 | 0 of 16 | 0 of 15 |
| Facts with `verificationState: "NOT CONFIRMED"` | 0 of 20 | 0 of 16 | 0 of 15 |

**Of item 1's four named flags (SECONDARY, UNVERIFIED, AI-EXTRACTED, SHORT
HISTORY), exactly one instance fires across the three companies: SHORT
HISTORY, on OKLO alone.** MSFT and NVDA each carry one `states.qualifying`
flag, but neither is one of the four named — `MARGIN AT HISTORICAL HIGH` and
`CAPITAL-LIGHT` are both `AnalyticQualifier` values outside item 1's own
list.

**Where SHORT HISTORY does fire, it plays no part in the trust status it is
carried alongside.** `computeTrustStatus` (`lib/analyzer/trust.ts:96-107`) is
FIRST-MATCH-WINS: rule 1 (`fairValueRange.kind === "suppressed"` → `UNUSABLE`)
returns immediately, before rule 2 ever reads `states.qualifying`. OKLO's
range is suppressed for the leverage reason above, so its `trust.status` is
`UNUSABLE` by rule 1 alone — the run's own `trust.determinedBy` names only
the suppressing state, never `SHORT HISTORY` (confirmed by this pass's test:
`determinedBy.some(d => d.detail.includes("SHORT HISTORY"))` is `false`).
SHORT HISTORY is carried on the run; it is not read.

**SECONDARY and AI-EXTRACTED are absent on all three runs, and this is not
particular to these three companies.** `lib/analyzer/acquisition/acquire.ts`
hardcodes every acquired fact's provenance at three separate construction
sites (`:125-126`, `:171-172`, `:244-245`): `sourceClass: "PRIMARY"`,
`extractionType: "DETERMINISTIC/STRUCTURED"`. There is currently no code path
in the real-acquisition pipeline — the path all three of this pass's runs go
through — that can produce a `SECONDARY` or `AI-EXTRACTED` fact on any real
run, not only these three. (`SECONDARY`/`AI-EXTRACTED` values do exist
elsewhere in the tree, but only inside illustrative fixtures and
provenance-propagation tests, never on an acquired real run.)

**UNVERIFIED goes further: it is not wired to fire at all, on any run, real
or fixture.** `ProvenanceQualifier` (`"SECONDARY" | "UNVERIFIED" |
"AI-EXTRACTED"`, `lib/analyzer/types.ts:158`) is a member of `QualifyingFlag`,
but a repo-wide search of `lib/` outside test files
(`git grep -n '"UNVERIFIED"' lib/`) finds it only in that type declaration and
in explanatory comments — never constructed as an actual flag value.
`assemble.ts`'s only three `qualifying.push(...)` call sites push
`SHORT HISTORY`, `MARGIN AT HISTORICAL HIGH` and `CAPITAL-LIGHT`
(`:522, :681, :682`) — all `AnalyticQualifier`, none a `ProvenanceQualifier`.
No code path anywhere pushes `SECONDARY`, `UNVERIFIED` or `AI-EXTRACTED` into
`states.qualifying`, on these three runs or in general. This is a structural
fact about the current tree, confirmed by this pass, not something specific
to MSFT, OKLO or NVDA's own filings.

**One caveat on the fourth candidate carrier, `NOT CONFIRMED`.**
`computeTrustStatus`'s rule 2 separately reads
`fact.verificationState === "NOT CONFIRMED"` (`lib/analyzer/trust.ts:130-134`)
— a mechanism distinct from `states.qualifying`. All three runs this pass
opened show zero `NOT CONFIRMED` facts, but that is a property of how this
pass (and its three precedents) opened them: each completes every outstanding
spot-check item as `CONFIRMED` before computing
(`completeSpotCheck`/`recordFactDecision(..., "CONFIRMED", ...)`), the same
discipline `trustOnRealRun.test.ts`,
`nonOperatingJudgmentRecordedOnRealRun.test.ts` and
`nvdaRealRunObservation.test.ts` already use. A differently-driven run of the
same three companies could carry a `NOT CONFIRMED` fact; nothing in the
acquisition pipeline forecloses it the way it forecloses `SECONDARY`/
`AI-EXTRACTED`. This absence is not read as the same kind of finding as the
structural one above.

## (3) Does A diverge from B, materially?

**Yes, and on this evidence the divergence is closer to "one has readings,
the other has almost none" than to "both read, but disagree."** Option A,
read off `scenarioOutputs` rather than the post-suppression range, produces a
number for all three companies, with materially different bull-to-bear
ratios (2.45× MSFT, 15.48× OKLO, 10.56× NVDA) — a live, differentiated signal
today. Option B, restricted to the four flags item 1 itself names, produces
exactly one instance across all three companies (SHORT HISTORY, OKLO), and
that one instance never reaches the trust determination it is carried
alongside, because rule 1 already resolved OKLO to `UNUSABLE` first. MSFT and
NVDA supply zero instances of any of the four named flags. So today, for
this exact four-flag reading of option B, there is close to nothing to
compare against option A's per-company numbers — not a disagreement between
two live signals, but one signal that is live on all three companies and
one that is live on none of them in a way that reaches anything downstream.

This does not itself argue for option A. A live number is not the same claim
as a good margin-of-safety measure, and §10.3's own `scenarioLabelsWarning`
— true on the one company (MSFT) where option A's range actually renders —
already disclaims exactly the confidence-bound reading a margin-of-safety
input would need. It is reported as the observed asymmetry, not as an
argument toward either option.

Nor are option A's three readings themselves of equal standing, per §1's
provenance note above: NVDA's is analyst-authored and approved, while
OKLO's and MSFT's are arithmetic on carried validation-set placeholders the
run itself discloses as not acquired. Option B's side of this same
comparison — the one SHORT HISTORY instance and the zero-count flags — is
read off genuinely acquired output. A reader weighing this asymmetry should
weigh it knowing that two of option A's three inputs, and none of option
B's, are not yet real acquired or analyst-authored data. This is reported
alongside the asymmetry above, not a re-argument of it, and changes no
number.

## (4) What option C would require

No measure of forecast/estimation uncertainty independent of the scenario
range's own spread exists anywhere in the current tree — re-verified this
pass (`git grep -i -E 'marginOfSafety|margin of safety|forecastUncertainty|estimationUncertainty|forecastDispersion' -- lib` returns zero hits at `5caa5fc`, the same empty result §12 bullet 5 already records). From the tree as it stands, a genuinely new measure would need at minimum:

1. **A quantity computed from a source other than what A and B already
   supply** — otherwise it collapses into one of them. Not the three
   point-scenario outputs themselves (else it is option A under another
   name), and not the evidence-quality flags §9.4/§9.6 already carry (else
   it is option B under another name) — e.g. a distribution over the
   underlying forecast *inputs* (growth, margin, reinvestment) rather than
   over their three named scenario outputs, or an externally sourced measure
   (analyst estimate dispersion, a historical forecast-error track record)
   this repo does not currently acquire from anywhere.
2. **A defined aggregation** turning that quantity into whatever numeric or
   categorical shape Step 4 ultimately consumes.
3. **A stated relationship to the scenario range it would sit beside**, since
   Step 5 already reads that range for its own comparison — an independent
   Step 4 measure would need its own account of why it does not reintroduce
   a *different* double-counting relationship with Step 5, symmetric to
   Finding 3's original concern about reverse DCF one layer down (§11 item 1
   already names this risk for option A; a new measure inherits the same
   question in a different shape rather than escaping it by construction).

Nothing above is built, specified numerically, or adopted here — HARD BOUNDS.

## (5) Reuse risks against current authority

**Option A against Finding 3's double-counting concern.** Already a named
risk in §11 item 1's own text: the scenario range "already feeds Step 5's
comparison." This pass adds one concrete instance rather than a new
argument: MSFT's own real run this pass is the one company where the range
renders, and its `scenarioLabelsWarning` is independently `true` on that same
run — §10.3's caveat that the bounds are "scenario labels, not confidence
bounds" is not a hypothetical concern for the calibration set, it is already
active on the one calibration company where option A could currently be
observed rendering at all.

**Option B against `CALVIN RULING — B` (amendment 1)'s Step 1/Step 4
separation.** The ruling's risk, restated: Step 4 must stay "a separate
input from Step 1's evidence/estimation confidence, never the same object
read a second time under a different name." On this evidence the risk is not
abstract: every flag actually observed in `states.qualifying` across all
three runs (`SHORT HISTORY`, `MARGIN AT HISTORICAL HIGH`, `CAPITAL-LIGHT`)
already derives from a fact Gate 1 or another diagnostic already computed and
reports elsewhere in the same run — `SHORT HISTORY` *is* Gate 1's own
filed-years read, the same gate that governs Step 1's own
history-sufficiency test. Building option B by reusing `states.qualifying`
would not risk collapsing Step 1 and Step 4 into the same object in the
abstract; for the one instance observed this pass, it would reuse the
identical field carrying the identical Gate 1 fact. This is reported as the
concrete instance of the risk the ruling already named, not a new argument
for or against option B.

## (6) The minimum remaining decision (no choice made)

Two decisions remain, in order, neither made here. **First**, which shape —
A, B or C — Step 4's margin of safety takes; this is Calvin's, per ruling D's
own text and per item 1's "needs Calvin's ruling on which shape, then real
observations to size it." **Second**, once a shape is picked, what
independence from Step 1/Gate 1 (amendment 1) and from Step 5's own use of
the scenario range (Finding 3) that shape must maintain to avoid becoming the
same object read twice or the same relationship double-counted one layer
down — a definitional question about what "separate" and "not
double-counting" mean for the chosen shape, not one these three runs' own
numbers can answer by themselves. This pass supplies observed evidence toward
the first decision (what each option's real inputs look like today, per
(1)–(5) above); it supplies none toward the second.

## (7) Can these three runs distinguish A, B and C?

They distinguish *availability*, not *fitness*: option A currently produces a
differentiated per-company reading on all three companies (§1 above); option
B, read strictly as the four flags item 1 names, produces one instance total
across the three, and that instance does not reach any run's actual trust
determination (§2 above); option C is unbuilt everywhere in the tree (§4
above; not evaluable on any run because it does not exist to observe). They
cannot distinguish which option is the *right* margin-of-safety measure —
that needs Calvin's shape ruling first, per §11 item 1's own stated order,
and then real observations produced under whatever that specific shape turns
out to be. If Calvin's eventual definition of option B differs from the
narrow four-flag presence/absence reading tested here (for instance, a
numeric evidence-quality index built from the same underlying fields rather
than a flag count), nothing in this pass forecloses that a differently
defined option B could look different from what §2–§3 report; a fresh
observation would be needed against that specific definition.

## Reproducing this pass

```
TEST_DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<name>_test \
  npx vitest run lib/analyzer/step4SignalObservationOnRealRun.test.ts
```

1 test file touched by this outcome (new): the reproducing test above. All
other real-run test files it reuses helpers/patterns from
(`nonOperatingJudgmentRecordedOnRealRun.test.ts`, `leverageOnRealRun.test.ts`,
`reverseDcfOnRealRun.test.ts`, `trustOnRealRun.test.ts`,
`nvdaRealRunObservation.test.ts`) are unmodified and were also re-run this
pass (22/22 passing) to confirm nothing in this outcome disturbed them.

## What this document observed this pass vs. cites from existing authority

**Observed this pass** (executed fresh, this run, at `5caa5fc`, and directly
pinned by `step4SignalObservationOnRealRun.test.ts`'s own assertions): every
run-output row in the two tables in §1 and §2 — `scenarioOutputs.values`,
`weightedDistribution`, `fairValueRange`, `scenarioLabelsWarning`,
`states.qualifying`, `gates.gate1`, `trust.status`, and the fact-level
SECONDARY/AI-EXTRACTED/NOT CONFIRMED counts (numerators and denominators
alike) — on all three companies; the `scenarioLabelsWarning`/`MARGIN AT
HISTORICAL HIGH` link on MSFT; the SHORT HISTORY/rule-1 precedence finding on
OKLO; the CAPITAL-LIGHT reading on NVDA; the `acquire.ts` and `assemble.ts`
code citations in §2; the `git grep` re-confirmations in §2 and §4. The
`bull − bear` and `bull ÷ bear` rows in §1 are this document's own arithmetic
on those observed values, not themselves asserted by the test or produced by
any run — see the note under §1's table.

**Cited from existing authority, not re-derived**: §11 item 1's own text and
its three options; `CALVIN RULING — B` (amendment 1)'s separation
requirement; Finding 3's double-counting concern; §12 bullet 5's "no
independent measure exists" finding (re-verified empty this pass, not
newly discovered); the NVDA bundle's own authored scenario values
(`docs/analyst-drafts/nvda-step7-draft.md`, PR #295) and Calvin's §4.4 ruling
for MSFT (issue #188) — both transcribed, not re-authored, by this pass's
test, matching their own precedent tests' transcription exactly. OKLO's and
MSFT's `scenarioValues` inputs themselves (as opposed to the `scenarioOutputs`
computed from them, which this pass's test does assert fresh) are likewise
not authored or acquired this pass: they are the M5/M7 validation set's
pre-existing fixture constants (`fixtures/oklo.ts:353`, `fixtures/msft.ts:272`),
carried unchanged through `analystInputs.ts`'s own disclosure — see §1.

## What this document does not do

It does not answer §11 item 1. It does not choose, rank, default to, or
recommend option A, B or C. It sets no numeric threshold, band, cut-point, or
new forecast-dispersion measure. It does not mark
`docs/acceptance-matrix.md` row 11, or any other row, satisfied — row 11
remains `WITHHELD`, byte-untouched by this outcome. It changes no product
code, methodology file, or acceptance verdict. Where SCOPE 7 asked whether
the three runs can tell A–C apart, §7 above states plainly what they can and
cannot show, rather than lifting any bound to obtain more. Those decisions
remain Calvin's (`docs/product-decisions.md` items 3 and 9).
