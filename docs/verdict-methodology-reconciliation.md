# Verdict-methodology reconciliation — §10.6.2 against `CF-VERDICT-SYNTHESIS-RND-01`

**Outcome:** `CF-VERDICT-METHODOLOGY-RECON-01` ([issue #272](https://github.com/calyeap/Cal-Finance/issues/272)).
**Authority:** Calvin's `CALVIN RULING — NEITHER A NOR B AS STATED`, 24 Sep 2026
05:33:02Z ([PR #271 comment 5808311255](https://github.com/calyeap/Cal-Finance/pull/271#issuecomment-5808311255)).

**Superseding outcome:** `CF-VERDICT-1062-AMEND-TEXT-01` ([issue #274](https://github.com/calyeap/Cal-Finance/issues/274)).
**Superseding authority:** Calvin's `CALVIN RULING — C`, 24 Sep 2026 06:08:48Z
([PR #273 comment 5808704819](https://github.com/calyeap/Cal-Finance/pull/273#issuecomment-5808704819)).

> **§§2–4 of this document are SUPERSEDED IN PART, as of `CALVIN RULING — C`.**
> §2's determination — **AMEND** §10.6.2 — stands and is not reopened. **§3.1
> and §3.3's proposed structure and proposed §10.6.2 text do not stand.**
> Calvin ruled a different, simpler single-comparison structure instead of
> §3.3's two-dimension design. §§9–14 below are the current proposal;
> §§2–4 remain in the document only as the record of the superseded
> candidate and are not current guidance. §1 (the five-finding
> reconciliation), §5 (minimum evidence) and §6 (carried-forward non-policy
> gaps) are live input, re-read and re-applied at §§11–13 below — they are
> not superseded, only re-derived where the new structure changes what
> follows from them.

**This is a reconciliation and decision-structuring document, not an
implementation and not a decision.** Per `docs/product-decisions.md` items 3
and 9, AI does not make the final qualitative call and human input is
evidence, not authority. Every determination below — including "KEEP" or
"AMEND" — is a recommendation framed for Calvin's ruling. Nothing here is
adopted, and nothing here is claimed accepted.

Re-verified at `origin/master` = `c99712f`, working tree clean throughout.
`lib/analyzer/verdict.ts` and `lib/analyzer/policy.ts` are byte-identical to
that commit (§3 and §6 below cite the exact lines re-read). No
`docs/frozen/` byte and no `FROZEN_HASHES` entry is touched by this
document. No threshold, band, cut-point, or disagreement constant is
introduced anywhere below, including as an illustrative or "for now" number.

---

## 0. What this reconciles, and against what

`docs/verdict-synthesis-research.md` (merged `c99712f`, PR #271,
`CF-VERDICT-SYNTHESIS-RND-01`) is the "new external R&D" Calvin's ruling
refers to. Its own primary finding (§5.1) is that no §10.6.2 methodology
decision is framable today that would change either MSFT's or OKLO's
outcome — reached *against the existing mechanism*. Calvin's 24 Sep
05:33:02Z ruling accepts that finding but adds a further instruction: before
spending effort collecting evidence for §10.6.2 as currently written, decide
whether that mechanism is even the right one, in light of five named
evidence-backed findings his ruling states outright. This document is that
decision-structuring pass. It is not a second run of the R&D outcome, and it
does not re-litigate `docs/verdict-synthesis-research.md`'s own conclusions
except where a specific named finding requires it.

**On §10.6.5's no-reopen clause.** §10.6.5 (`docs/frozen/calboard-stock-analyzer-v1-spec.md:1126-1130`)
says "a later session may not reopen the decision on the grounds that the
comparator was not ready." That clause binds sessions, not Calvin, and this
document does not invoke it on that ground — it evaluates AMEND only because
Calvin's own 24 Sep ruling explicitly authorises reconciling §10.6.2 against
new external evidence. Nothing else frozen or settled is reopened on this
document's own initiative (§8 below).

---

## 1. Finding-by-finding reconciliation

Each of Calvin's five named findings gets an answer by name, per the ruling's
own instruction that "every clause binds" and the five findings "are
required considerations, not a menu." For each: what the merged research and
its adversarial challenge actually establish, what current frozen §10.6.2
says, and whether they agree, are silent, or conflict.

### 1.1 Finding 1 — growth value should be licensed by incremental/going-forward return on new capital versus cost of capital, not headline historical ROIC alone

**What the evidence establishes.** `docs/verdict-synthesis-research.md` does
not itself argue this point directly — it is Calvin's own addition in the 24
Sep ruling, not a conclusion the merged document reached. What the merged
document *does* establish, and what bears on it, is in §2 item 4 (Piotroski:
a deterministic, conjunctive, no-model combination of already-computed
facts is a credentialed approach) and §3 item 1 (the PEG/growth-gap
literature is genuinely contested as a valuation classifier). Read together
with `docs/frozen/calfinance-methodology-v2.md`'s own governing "RONIC /
incremental returns" section (line 131: "Incremental-return analysis remains
useful but must be interpreted cautiously..."), the finding is a request to
ground growth's *value*, not merely its *rate*, in whether it earns above
the cost of capital used to discount it.

**What current frozen §10.6.2 says.** §10.6.2's Input B
(`docs/frozen/calboard-stock-analyzer-v1-spec.md:1068-1098`) is a comparison
of *growth rates* — implied (required) growth from the reverse-DCF grid
against the company's own achieved growth, on the same series and horizon.
It says nothing about whether that growth earns a return above the cost of
capital. That question is answered elsewhere in the frozen contract, but
not as a §10.6.2 input: §7.2 M5's RONIC state ladder
(`docs/frozen/calboard-stock-analyzer-v1-spec.md:648-664`) already computes
trailing five-year RONIC and already flags **LOW RONIC — VALUE-DESTROYING
GROWTH** where `0 < RONIC < the rate in that cell`, additionally labelled
**INVERTED — HIGHER GROWTH LOWERS VALUE** where value falls as growth rises
— read explicitly as "a ceiling." That is a RONIC-versus-the-discount-rate
test, computed today, on every reverse-DCF cell, for every company. It is
just not a §10.6.2 input: it is a §9.4 qualifying flag on the reverse-DCF
diagnostic, one layer removed from the position itself.

**Agree, silent, or conflict.** Silent, not conflicting — and closer to
agreement than the ruling's phrasing might suggest. The frozen contract
already runs the exact comparison Finding 1 asks for (RONIC vs. the rate
used to discount it); it just does not currently let that comparison license
or block the §10.6.2 position. §10.6.2's Input B answers "is the market
requiring more or less growth than the company has shown," which is silent
on whether the growth on either side of that comparison actually creates
value. A company could clear Input B (required growth ≤ achieved growth)
while that achieved growth was itself LOW RONIC — VALUE-DESTROYING GROWTH,
and §10.6.2 as written would still license CHEAP on the growth axis. That is
a real, evidence-backed gap between the frozen mechanism and Finding 1's
standard, not a contradiction — no ruling says RONIC must feed §10.6.2, and
none has now been proposed to. It is treated in §3 below as one of the
structural ideas the smallest final methodology should reconcile against, as
Calvin's ruling instructs directly.

### 1.2 Finding 2 — evidence/estimation confidence is an underwritability gate; economic/forecast uncertainty is a separate margin-of-safety overlay

**What the evidence establishes.** This distinction is Calvin's own
addition, not a conclusion `docs/verdict-synthesis-research.md` states in
those terms — the closest the merged document comes is §2 item 3's
Morningstar citation (an uncertainty-scaled margin of safety) and its own
caveat that Morningstar's rating is a single-diagnostic system Calvin has
already forbidden structurally (§4 response to point 7). The distinction
itself — "is there enough evidence to say anything" versus "given there is,
how much cushion does genuine forecast uncertainty deserve" — is a real and
useful separation of concerns not previously named together in the frozen
contract or the prior research.

**What current frozen §10.6.2 and its surrounding sections say.** The
frozen contract already implements something close to the *first* half of
this distinction, under a different name, and does so in two places, not
one: §9.6's trust status (`docs/frozen/calboard-stock-analyzer-v1-spec.md:930-951`)
and §10.6.3's three render conditions
(`docs/frozen/calboard-stock-analyzer-v1-spec.md:1100-1108`) already gate
whether the position renders at all on evidence sufficiency — a REQUIRED
input missing, a §9.3 suppressing state active, or PROFILE NOT CONFIRMED all
block the position before §10.6.2's two inputs are even consulted. That is
an underwritability gate in substance, already built, already load-bearing.
What the frozen contract has **nothing resembling** is the *second* half:
once the gate is cleared, a margin-of-safety overlay that widens with
genuine economic/forecast uncertainty (as opposed to evidence insufficiency)
before a position is licensed. §10.6.2's fixed rule 2
(`docs/frozen/calboard-stock-analyzer-v1-spec.md:1092-1096`) has one blunt
instrument for both cases today — "anything else is INCONCLUSIVE" — which
does not distinguish "the evidence is not good enough" from "the evidence is
good enough but the range of plausible outcomes is genuinely wide."

**Agree, silent, or conflict.** Agrees on the first half (the gate exists,
under §9.6/§10.6.3's names, not Finding 2's); silent on the second (no
overlay of any kind exists today). This is not a conflict — nothing in
§10.6.2 asserts that a margin-of-safety overlay must not exist, and Finding
2's own framing does not require touching the fixed rules. It is a genuine
structural gap the smallest final methodology should name, per §3 below,
while being explicit that **no numeric margin is proposed here** — Finding
2 describes a shape, not a size, and HARD BOUNDS forbids inventing the size
regardless of which shape Calvin rules on.

### 1.3 Finding 3 — reverse DCF should be explanation/consistency checking, not an independent second verdict vote, where treating it as one would double-count the same underlying valuation relationship

**What the evidence establishes.** This is the finding closest to being
already-argued in the merged document, though not in these words.
`docs/verdict-synthesis-research.md` §2 item 1 (Damodaran: reverse DCF
"makes latent assumptions explicit and falsifiable" — a diagnostic to
interrogate, not a mechanical verdict) and §2 item 2 (CFA curriculum: a
"question-generating tool, not an output-generating one") both describe
reverse DCF as an explanatory instrument in practitioner and academic
practice, not an independent classifier. Calvin's own concern about
double-counting is new to this ruling, but it is a real structural
observation: §10.2 section G's price-location range and §7.2 M7's
reverse-DCF grid are not independent measurements of two different things —
both are read off the same underlying DCF machinery (the same scenarios,
the same rate grid, the same terminal assumptions in substance), just
solved in opposite directions. Location asks "where does today's price sit
between the bear and bull values this machinery produces"; the required-
growth figure asks "what growth would this machinery need to justify
today's price." Both answers move together as the same underlying inputs
move.

**What current frozen §10.6.2 says.** §10.6.2 explicitly names both as
independent inputs, with fixed rule 2 requiring "positive agreement from
both" — treating price location and the growth gap as two votes that must
concur. Nothing in the frozen text states or defends the premise that they
are independent measurements rather than two views of one relationship;
§10.6.2's own text motivates the two-input structure only by appeal to the
17 Sep single-diagnostic ruling (below), not by an argument that the two
inputs are statistically or economically independent of each other.

**Agree, silent, or conflict.** This is the one finding with a genuine
tension against a *settled, non-reopenable* ruling, and it is named as such
rather than smoothed over, per the ruling's own instruction: **the 17 Sep
2026 ruling ([PR #140 comment 5719869973](https://github.com/calyeap/Cal-Finance/pull/140#issuecomment-5719869973))
forbids a fair-value range or any other single diagnostic from by itself
determining BUY/HOLD/SELL, including as a labelled non-recommendation.** If
reverse DCF is demoted to explanation/consistency-checking rather than an
independent vote, price location cannot become the sole remaining input
without violating that ruling. Calvin's own ruling anticipates exactly this
consequence by pairing Finding 3 with Finding 4 (the dual-value test) as the
candidate second dimension — so the honest reconciliation is: **Finding 3 is
adoptable only together with a genuine second dimension that is not price
location alone**, and §3 below proposes Finding 1's RONIC-vs-cost-of-capital
growth-quality axis, combined with Finding 4's dual-value test, as that
second dimension. This is stated as an interaction between two of Calvin's
own findings, not a conflict between two rulings requiring
`STOP: RECONCILIATION REQUIRED` — the 17 Sep ruling and Findings 3–4 are
reconcilable together, and this document reconciles them rather than
picking one.

### 1.4 Finding 4 — where growth support is unresolved, a dual-value test (growth-inclusive vs. no-growth/conservative) should block the verdict only when the unresolved assumption could change it

**What the evidence establishes.** Not previously stated in
`docs/verdict-synthesis-research.md`, which withdrew its own closest
analogue (Candidate 3, a trust-conditioned disagreement tolerance) as
incoherent and rule-violating (§4 responses to points 11–13; §5.2). Finding
4 is a different mechanism from Candidate 3, and the distinction matters:
Candidate 3 varied the *tolerance* for disagreement by trust status — struck
because §10.6.2 rule 1 forbids per-company adjustment and because widening
tolerance under degraded trust runs backwards from Morningstar's own logic
(worse evidence should widen the margin of safety, not make agreement
easier). Finding 4 does not vary a tolerance at all: it asks whether a
*specific, named ambiguity* (which growth reading — inclusive or
conservative — to use) is decisive for *this company's* position, computed
identically for every company by the same rule. That is closer in spirit to
§10.6.2's own already-fixed rule 1 than Candidate 3 was, because the test
itself ("does the ambiguity change the answer") is uniform, even though its
outcome (does it fire) differs company to company — the same way Gate 0 and
Gate 1 already apply one uniform test whose result differs company to
company.

**What current frozen §10.6.2 says.** Fixed rule 2 sends every case of
input disagreement, or one input missing, straight to INCONCLUSIVE, with no
intermediate question about whether the disagreement is actually decisive.
Where the growth input is ambiguous rather than genuinely absent, current
§10.6.2 does not distinguish "ambiguous but harmless" from "ambiguous and
decisive" — both currently fail to INCONCLUSIVE identically, per the fixed
rule's own text ("whether the two point in opposite directions or one is
simply not enough to support a finding").

**Agree, silent, or conflict.** Silent, and compatible rather than
conflicting: Finding 4 proposes a refinement *within* fixed rule 2's own
spirit — "fails toward saying less" (§10.6.2's own words) — by adding one
more deterministic, uniformly-applied test before failing to INCONCLUSIVE,
not by relaxing when INCONCLUSIVE is required. It does not touch the "no
per-company adjustment" rule (the *test* for whether ambiguity is decisive
is identical for every company; only its *result* varies, which is true of
every gate and trigger this spec already has). §3 below states this as part
of the smallest final structure, again with no numeric threshold for what
counts as "growth-inclusive" or "conservative" — that magnitude question is
carried to §4 as a house-policy decision.

### 1.5 Finding 5 — Morningstar-style numeric bands and mirrored SELL geometry are house conventions, not portable finance laws; do not adopt them by default

**What the evidence establishes.** `docs/verdict-synthesis-research.md` §2
item 3 already states this directly and at length: Morningstar's
uncertainty-scaled margin of safety is evidence about *how* practitioners
structure a calibration process under thin data, "not evidence for a
specific numeric band, and not a license to reuse its structure directly,"
because Morningstar's rating is itself a single-diagnostic system Calvin has
already forbidden structurally. The adversarial challenge (§4 points 7 and
13) independently confirmed this and additionally found the earlier
Candidate 3 draft had inverted Morningstar's own direction (widening
tolerance with *degraded* trust, when Morningstar widens margin of safety
with *rising* uncertainty, which makes a rating harder, not easier, to
reach).

**What current frozen §10.6.2 and the governing methodology say.** Neither
adopts Morningstar-style bands or mirrored SELL geometry today —
`lib/analyzer/policy.ts`'s `POLICY_THRESHOLD_PROVENANCE` (§6 below) carries
no §10.6.2 entry of any kind, confirmed at this head, and
`docs/frozen/calfinance-methodology-v2.md`'s own "Valuation-position
semantics" section (line 154) already states "numerical valuation-position
cut-points remain TEST/provisional and non-governing until adequately
validated and explicitly approved" — i.e., the governing finance authority
already agrees with Finding 5's caution in general terms, independent of
this reconciliation.

**Agree, silent, or conflict.** Full agreement, already substantially
banked by the prior document and by the governing methodology itself.
Nothing here is new ground; this finding is confirmed rather than
reconciled, and its only live consequence for this document is a **negative
constraint** on §3 and §4 below: the smallest final structure names where a
CHEAP/EXPENSIVE band or a SELL-side geometry choice would eventually need to
be made, but proposes no shape for it (symmetric, asymmetric, or otherwise)
and no numeric width, and states plainly (§4) that symmetry-vs-asymmetry is
itself one of the remaining house-policy decisions, not a default to assume
either way.

---

## 2. KEEP or AMEND

**Determination: AMEND, in structure only — no numeric text changes, and no
change to either fixed rule.**

**What KEEP would cost.** Calvin's own ruling frames the choice as whether
to "spend effort collecting evidence for a mechanism that may be
superseded." KEEPing §10.6.2 exactly as worded would mean: (a) §10.6.2's two
inputs remain price location and a plain growth-*rate* gap, with no place
for Finding 1's growth-*quality* (RONIC-vs-cost-of-capital) test except as a
downstream qualifying flag that never reaches the position itself; (b) any
future calibration of Input B's bands would calibrate a comparison Finding
3 identifies as potentially double-counting the same DCF relationship Input
A already reads, without ever testing that concern; (c) fixed rule 2 would
continue sending every ambiguous-but-possibly-harmless growth reading to
INCONCLUSIVE, with no mechanism to distinguish that case from a genuinely
decisive one (Finding 4); (d) no margin-of-safety overlay for genuine
forecast uncertainty would exist, leaving the underwritability gate to do
work Finding 2 argues belongs to a second, separate layer. None of this
would change today's real-company outcomes (§5.1 of the prior document
still holds — see §5 below), so KEEP's cost is not "MSFT and OKLO stay
`INCOMPLETE`" (they would under AMEND too). Its cost is narrower and more
specific: it would mean beginning real-company evidence-gathering, whenever
that eventually resumes, aimed at calibrating a structure four of Calvin's
own five named findings identify gaps in — precisely the risk his ruling
says he wants to avoid by running this reconciliation first.

**What AMEND would cost.** A more complex final structure than today's
two-clause rule (§3 below has two axes, an underwritability gate, and a
conditional overlay, versus today's two inputs and two fixed rules); more
design surface to eventually get right; and no exact-text improvement is
possible today, because the same evidence gap that blocks calibration under
KEEP (§10.6.2's mechanism) equally blocks specifying AMEND's exact
comparator (§5 below — the minimum evidence needed does not yet exist for
either version). AMEND does not unblock MSFT or OKLO either: MSFT's block is
structural (RONIC NOT MEANINGFUL on every cell, §6.1 below) and untouched by
which growth-comparison shape is eventually adopted; OKLO's block is
upstream of §10.6.2 entirely. AMEND's cost is honestly named as delay and
added design surface, not as a loss the way KEEP's is.

**Why AMEND is the answer notwithstanding that cost.** Four of the five
named findings (1, 2, 3, 4) each identify a genuine, evidence-backed
structural gap or tension in §10.6.2 as currently worded — not a
recalibration of its existing bands (none exist to recalibrate), but a gap
in what the mechanism asks at all. Finding 5 does not itself argue for
AMEND, but it removes the one argument that might have counselled against
naming a new structure now (a fear of importing Morningstar's numbers) by
confirming that no numbers are being imported either way. Calvin's own
ruling text — "before we spend effort collecting evidence for a mechanism
that may be superseded" — states directly that he is not confident §10.6.2
as worded is the right target for that evidence effort, and this document's
own re-verification of the frozen text found no argument in §10.6.2 itself
that would resolve that doubt (§1 above, findings 1 and 3 in particular).
**The condition on this determination is a fact, not a decision Calvin has
not yet made, per SCOPE item 2's requirement:** it is the fact, established
above, that §10.6.2's Input B measures growth rate agreement rather than
growth value, and that its two inputs are not shown to be independent of
one another. That fact does not change based on any future ruling; it is
true of the frozen text today, which is why AMEND — not "AMEND if further
evidence later shows X" — is the determination.

---

## 3. The smallest final methodology structure

**This is a structural recommendation with named open decision points, not
a fully specified mechanism.** No threshold, magnitude, weighting, or
scoring rule appears anywhere below — every place a number would eventually
be needed is named as a house-policy decision in §4, per HARD BOUNDS.

### 3.1 The complete structure, in the order it applies

1. **Gates (unchanged).** Gate 0 (supported profile), Gate 1 (history
   sufficiency), the leverage precondition — exactly as today, before
   anything else runs.
2. **The underwritability gate (Finding 2, first half — renamed, not new).**
   The position may be computed only where the render conditions §10.6.3
   already states hold: a valuation range exists, trust status is CLEAN or
   PARTIAL, and PROFILE NOT CONFIRMED is not active. This is §10.6.3 restated
   as the first half of Finding 2's distinction, not a new gate — the
   frozen contract already builds it, under its own name. Where it fails,
   the position does not render; the state is the output, exactly as §9.5
   already requires.
3. **Dimension 1 — price location within the scenario range (unchanged).**
   §10.2 section G, already computed and already displayed. Exactly as
   today's Input A.
4. **Dimension 2 — growth-quality-adjusted value support (Findings 1 and
   3, combined; replaces today's plain growth-rate gap).** Whether the
   growth the range's scenarios and the reverse-DCF grid describe is growth
   an investor should credit — i.e., expected to earn a return on
   incremental invested capital in excess of the discount rate used for the
   same range (RONIC read against the rate grid, per §7.2 M5's existing
   ladder, now load-bearing on the position rather than only a qualifying
   flag on the diagnostic). The reverse-DCF grid's required-growth figures
   are read for this purpose as a **consistency check on Dimension 2 and on
   the range itself** — explaining what the price already assumes, per
   §10.2's own ordering principle ("what the market assumes" and "what the
   analyst assumes" are never shown alone) — and do **not** cast a second,
   independent classification vote alongside Dimension 1. This is the
   direct answer to Finding 3's double-counting concern: there remain
   exactly two votes (location; growth-quality), not three, and the second
   vote is not the same DCF relationship read twice.
5. **The margin-of-safety overlay (Finding 2, second half; new — a
   dual-value test per Finding 4).** Where Dimension 2's growth input clears
   the underwritability gate but remains estimation-uncertain in a way that
   could plausibly read either direction, compute Dimension 2 twice — once
   on a growth-inclusive reading, once on a conservative/no-growth reading
   of the same range and the same required-growth figures — and compare the
   two resulting positions. **The overlay blocks the position to
   INCONCLUSIVE only where the two readings would produce different
   positions when combined with Dimension 1** — i.e., only where the
   unresolved growth assumption could actually change the answer. Where
   both readings agree, or where Dimension 1 alone is already decisive in
   the same direction under both readings, the overlay does not fire and
   the position renders normally.
6. **The two fixed rules (unchanged in substance, restated over the new
   dimensions).** (a) The same inputs always produce the same position — no
   per-company adjustment, no override, no model in the path; every test
   named above (the underwritability gate, Dimension 2's RONIC-vs-rate
   comparison, the dual-value overlay) is a uniform rule applied
   identically to every company, exactly like Gate 0 and Gate 1 today. (b)
   Every position requires positive agreement from both dimensions — CHEAP
   requires both to read cheap, FAIR requires both fair, EXPENSIVE requires
   both expensive; anything else, including a dual-value disagreement that
   survives step 5's "could it change the answer" test, is INCONCLUSIVE.

### 3.2 What is kept, what is dropped, and why the 17 Sep ruling is still satisfied

**Kept:** both fixed rules, in substance; the vocabulary (CHEAP · FAIR ·
EXPENSIVE · INCONCLUSIVE, and the settled, non-reopened BUY/HOLD/SELL/
INCOMPLETE product-facing mapping `verdict.ts`'s header already documents);
Dimension 1 exactly as today; the underwritability gate exactly as today's
§10.6.3, restated under Finding 2's name; the entry-side-only action clause
(§10.6.4, untouched — §3 does not reach it); determinism and reproducibility
from already-computed fields.

**Dropped:** the plain growth-rate gap as Dimension 2's substance (replaced
by the RONIC-vs-rate reading of the same underlying facts); reverse DCF as
an *independent* second vote (demoted to explanation/consistency-check,
per Finding 3); the single blunt "any disagreement → INCONCLUSIVE" rule as
applied to growth-assumption ambiguity specifically (refined by the
dual-value overlay, which still routes to INCONCLUSIVE, but only when the
ambiguity is shown to matter).

**Why the 17 Sep single-diagnostic ruling is still satisfied.** There remain
exactly two dimensions requiring positive agreement (step 6 above), never
one. Price location alone still cannot determine a position under any
reading of this structure — Dimension 2 (growth-quality-adjusted value
support) is a distinct measurement from Dimension 1 (where today's price
sits in the range), not a restatement of it, precisely because it asks
whether the growth embedded in that range and in the reverse-DCF grid earns
its cost of capital, a question price location does not answer by itself.

### 3.3 Proposed §10.6.2 replacement text (AMEND candidate — not applied; Calvin's to rule on)

The following is precise, quotable proposed text for §10.6.2, offered so
Calvin can rule on the exact words rather than only the shape. **No
`docs/frozen/` byte is edited by this document.** Bracketed items are named
open decisions carried to §4, not filled in here.

> #### 10.6.2 Derivation — deterministic, never a [C] call
>
> The position is derived from exactly two dimensions, both fields the
> analyzer already computes or a load-bearing reading of a field it already
> computes. Nothing new is measured and no model is called.
>
> | Dimension | Source |
> |---|---|
> | **Price location within the scenario range** | §10.2 section G, already computed and already displayed |
> | **Growth-quality-adjusted value support** | Whether the growth the range's scenarios and the M7 reverse-DCF grid describe earns a return on incremental invested capital (RONIC, §7.2 M5) in excess of the discount rate used for the same range. M7's required-growth figures are read as a consistency check on this dimension and on the range, per §10.1's ordering principle, and do not cast an independent vote. |
>
> **The underwritability gate.** The position renders only where §10.6.3's
> three conditions hold (a valuation range exists; trust status is CLEAN or
> PARTIAL; PROFILE NOT CONFIRMED is not active). Where a REQUIRED input of
> either dimension is missing or not evidenced to the same standard §3.7 and
> §3.8 already require, that dimension is UNAVAILABLE and — per fixed rule 2
> below — the position is INCONCLUSIVE.
>
> **The margin-of-safety overlay.** Where the growth-quality dimension
> clears the underwritability gate but [the named estimation-uncertainty
> test — house-policy decision, §4] leaves it genuinely ambiguous between a
> growth-inclusive and a conservative reading, compute the position under
> both readings. The overlay resolves the position to INCONCLUSIVE only
> where the two readings disagree on the resulting position; where they
> agree, or where price location alone is already decisive under both
> readings, the overlay does not fire.
>
> Two rules are fixed here and are not configuration:
>
> 1. The same inputs always produce the same position. No per-company
>    adjustment, no override, no model in the path. [Unchanged from current
>    text.]
> 2. Every position requires positive agreement from both dimensions. CHEAP
>    requires both to read cheap, FAIR requires both fair, EXPENSIVE
>    requires both expensive. Anything else — disagreement that survives the
>    margin-of-safety overlay, or either dimension simply unavailable — is
>    INCONCLUSIVE. [Unchanged in substance from current text.]

---

## 4. The remaining explicit Cal Finance house-policy decisions

Each stated as one closed question, with its options, the consequence of
each, and what it would take to answer it. Per Finding 5, none defaults to
a Morningstar-style shape.

1. **Which of M7's nine reverse-DCF cells (or which combination) supplies
   Dimension 2's required-growth figure, now that Finding 1 attaches RONIC
   to it directly?** Options: a single designated margin/rate cell;
   requiring a direction-of-agreement across all nine; reading the grid's
   range. Consequence: a single cell is simplest but arbitrary (per the
   withdrawn `docs/verdict-synthesis-research.md` §5.2 finding, still
   unanswered here); the grid's range is more defensible but has no
   precedent in the frozen text for how a *range* of required-growth
   figures collapses to one growth-quality reading. Answering it needs
   real observations across companies whose RONIC ladder is not uniformly
   NOT MEANINGFUL — which the current calibration set (§5 below) does not
   supply.

2. **What counts as "genuinely ambiguous" for the margin-of-safety
   overlay's dual-value test (Finding 4)?** Options: a fixed, evidence-based
   band of estimation uncertainty around the achieved/required growth
   figures; a qualitative gate keyed to existing evidence-quality flags
   (SECONDARY, UNVERIFIED, AI-EXTRACTED, SHORT HISTORY); some combination.
   Consequence: a numeric band is exactly the kind of cut-point Finding 5
   forbids adopting by default and HARD BOUNDS forbids inventing here; a
   purely qualitative gate may be under-inclusive for a company with clean
   provenance but genuinely volatile fundamentals. This is Calvin's to set,
   once real observations exist to test either shape against.

3. **Is a "conservative/no-growth" reading a fixed floor (e.g., zero
   growth) or a company-specific lower bound (e.g., the bear scenario's own
   growth path)?** Options named, none ranked. Consequence: a fixed floor is
   simpler and more uniform (favours fixed rule 1) but may be economically
   meaningless for a structurally shrinking company; a company-specific
   bound reuses machinery already in the range (the bear scenario) but ties
   the overlay's second reading to an assumption (the bear case) that
   already feeds Dimension 1, which risks reintroducing a version of
   Finding 3's double-counting concern one layer down. This interaction is
   named because it did not resolve itself in drafting this document, not
   because a defensible answer is already visible.

4. **Any numeric band or cut-point the eventual CHEAP/FAIR/EXPENSIVE
   classification still needs**, on either dimension, once real
   observations exist. Explicitly not answered here, per HARD BOUNDS and per
   `docs/frozen/calfinance-methodology-v2.md`'s own "numerical
   valuation-position cut-points remain TEST/provisional... until adequately
   validated and explicitly approved" (line 154).

5. **The mirrored-versus-asymmetric SELL (EXPENSIVE) geometry question**,
   named directly by Finding 5: whether the eventual EXPENSIVE band is
   symmetric to the CHEAP band around FAIR, or independently set. No default
   is assumed either way — symmetry is a house convention Finding 5 warns
   against adopting without evidence, and asymmetry (e.g., a wider margin
   required to call something EXPENSIVE than CHEAP, or vice versa) is
   equally unevidenced today.

6. **Whether five-year and ten-year observations may share one band**
   (`docs/m8c-calibration-findings.md:151`, restated as its own item because
   it survives unchanged under either KEEP or AMEND): §10.6.2's own text
   already requires this be "answered from observations rather than
   assumed," and nothing in this reconciliation changes that requirement or
   supplies the observations. Still open.

7. **Which reverse-DCF cell (if any) feeds the structure** — restated from
   `docs/verdict-synthesis-research.md` §5.2's demoted open question,
   because Finding 1's attachment of RONIC to Dimension 2 does not by
   itself answer it (RONIC is computed per cell, on the same grid, so the
   cell-choice question survives the AMEND recommendation unchanged; see
   item 1 above, which restates and extends it rather than duplicating it).

---

## 5. The minimum real-company evidence required to validate/calibrate those choices

**The smallest set, and why it is the minimum rather than a comfortable
number.** Per `docs/verdict-synthesis-research.md` §3 item 3 (small-sample
decision theory: a threshold estimated from a handful of observations is
noise-dominated) and §3 item 2 (Cooke's classical model: valid calibration
needs seed questions with ascertainable ground truth, which does not exist
here on any usable timescale, per the adversarial challenge's point 5,
accepted in full), **no number of companies below the point where genuine
seed observations exist is "enough," and naming a company count here would
itself be exactly the numeric policy constant HARD BOUNDS forbids
inventing.** The honest minimum is therefore stated as a **composition
requirement**, not a count:

- At least one company whose RONIC ladder is **not** uniformly NOT
  MEANINGFUL across the 8/10/12% × three-margin-level grid (MSFT fails this
  today — all nine cells return NOT COMPUTABLE, §6.1 below — so MSFT alone
  can never validate Dimension 2 regardless of which structure is ruled).
- At least one company that can produce **both** a ten-year and a five-year
  achieved comparator on the same series (to test item 6 above, the
  horizon-pooling question) — today only MSFT (ten-year) and, separately,
  companies with a five-year-only comparator exist in the calibration set
  (`docs/m8c-calibration-findings.md` §3); none produces both on a clean
  single-tag series today.
- At least one company with authored Step 7 scenarios (the analyst-authored
  bear/base/bull inputs Dimension 1 needs) **and** a resolved §4.4
  non-operating-investments judgment **and** an acquired RONIC ladder **and**
  a set `nopatTaxRate` — i.e., a company that clears every upstream blocker
  `docs/m8c-calibration-findings.md` §5 lists in dependency order, not only
  one of them, because a partial clearance (e.g., §4.4 resolved but RONIC
  unacquired, as the M8-c counterfactual pass directly demonstrated for
  MSFT and COST — "still solve 0 of 9 cells") produces zero additional
  usable observations.
- For the dual-value overlay (item 2 and item 3 above) specifically: at
  least one company where a growth-inclusive and a conservative reading of
  the same evidence would plausibly diverge — which requires the estimation
  uncertainty itself to be real and material for that company, not merely
  present in the abstract.

**What would have to be lifted to obtain this evidence, named without
lifting any of it here.** In dependency order, restating
`docs/m8c-calibration-findings.md` §5 and extending it for this
reconciliation's own needs:

1. The 21 Sep 2026 third-company deferral (a third real company beyond
   MSFT/OKLO) — needed for any composition item above involving more than
   two companies.
2. The no-new-capture/no-EDGAR bound — needed to acquire RONIC's five-year
   deltas (`fiveYearDeltaNopat`, `fiveYearDeltaInvestedCapital`, currently
   null for every company in `companyInputs.ts` per
   `docs/m8c-calibration-findings.md` §3 item B3) for any company beyond
   what is already captured.
3. Command Center's `nopatTaxRate` ruling — one of the four
   `UNDEFINED_POLICY_CONSTANTS` (`lib/analyzer/policy.ts:68-73`); every one
   of the nine reverse-DCF cells returns INCOMPLETE without it, for every
   company, blocking Dimension 2 entirely regardless of which structure is
   ruled.
4. The §4.4 non-operating-investments judgment, recorded per company (a
   one-time, off-run-path research exercise, per
   `docs/verdict-synthesis-research.md` §4's response to point 3 — not a
   live per-user step, and not itself contrary to M9-1's ticker-in/report-out
   contract).
5. Step 7 scenario authorship for more companies than the two the validation
   set already has — the binding constraint on Dimension 1 specifically,
   per `docs/m8c-calibration-findings.md` §2's "A third company cannot be
   run end-to-end today."

None of these is lifted by this document. Lifting any of them is Calvin's,
after this return, per the ruling's own words ("this deferral and the
no-new-capture/no-EDGAR bound are to be reconsidered only after this
reconciliation").

**What the recommended structure would and would not produce for MSFT and
OKLO today, on the real numbers already in the tree.**

- **MSFT.** Unchanged from `docs/verdict-synthesis-research.md` §1.4 and
  §5.1: `INCOMPLETE`, unconditionally, regardless of KEEP or AMEND. All nine
  reverse-DCF cells return `NOT COMPUTABLE — "RONIC not meaningful for this
  company (§7.2 M5 ladder)"` (`lib/analyzer/modules/reverseDcf.ts:187-199`,
  confirmed unchanged at this head; `lib/analyzer/reverseDcfOnRealRun.test.ts:57-69`
  asserts exactly this against a real acquired MSFT run with §4.4 already
  answered and `targetEnterpriseValue` already filled from M1). Dimension
  2's RONIC-vs-rate reading cannot be computed where RONIC itself is NOT
  MEANINGFUL on every cell — the AMEND structure does not create a
  RONIC figure MSFT's own fundamentals do not support; it reads the same
  ladder the frozen contract already computes, per-cell, hardcoded to
  scope "the affected reverse-DCF cell" and never the range
  (`lib/analyzer/assemble.ts:508-520`; `lib/analyzer/suppression.ts:79-91`,
  `:121`, `:175-179` — `SUPPRESSION_SCOPE_BY_STATE`,
  `SCOPE_REMOVES_FAIR_VALUE_RANGE`, and `stateRemovingFairValueRange`
  confirm the range is unaffected, matching the observed real
  `fairValueRange.kind === "range"`). No ruling on this document changes
  that structural fact about MSFT's fundamentals.
- **OKLO.** Unchanged: never reaches §10.6.2 at all, blocked upstream by
  the leverage precondition (`LEVERAGE UNSUPPORTED IN v1`, itself downstream
  of the missing enterprise value — zero tagged non-operating-investment
  candidates plus an independently missing `treasury-method-dilution` tag).
  Closing this needs new capture/EDGAR acquisition, forbidden by this
  outcome's HARD BOUNDS regardless of which structure is ruled.

---

## 6. Carried forward, not resolved here

### 6.1 `lib/analyzer/verdict.ts` re-verified byte-identical to `c99712f`

Read in full at this head. Four branches, unconditionally:

1. `trust.status === "UNUSABLE"` → `INCOMPLETE` (`:53-59`).
2. `range.kind === "suppressed"` → `INCOMPLETE` (`:63-68`).
3. `range.kind === "pre-revenue-distribution"` → `INCOMPLETE` (`:70-75`).
4. Otherwise → `INCOMPLETE`, `COMPARATOR_NOT_YET_AVAILABLE` (`:77-80`,
   message defined `:46-50`).

No branch computes either §10.6.2 input, RONIC, or a position of any kind.
This document's structural recommendation in §3 is not implemented by this
diff and could not be without violating HARD BOUNDS — confirmed by direct
re-read, not merely asserted.

### 6.2 `lib/analyzer/policy.ts` re-verified — no §10.6.2 entry of any kind

`PolicyConstants` (`:10-61`) and `POLICY_THRESHOLD_PROVENANCE` (`:102-144`)
re-read in full. `fcfYieldGrowthPreconditionBand` (`:60`) is M11's §7.2
precondition band, unrelated to §10.6.2. No band, cut-point, or disagreement
constant for either §10.6.2 input, or for the growth-quality dimension or
margin-of-safety overlay this document proposes, exists anywhere in the
file. Confirmed unchanged from `docs/verdict-synthesis-research.md` §1.1's
same finding.

### 6.3 §10.6.3's PROFILE NOT CONFIRMED condition has no corresponding branch in `deriveVerdict`

Restated from `docs/verdict-synthesis-research.md` §1.3, §4 (response to
point 1) and §5.3, re-verified unchanged: `verdict.ts`'s four branches (§6.1
above) check only `trust.status` and `fairValueRange.kind`; none checks a
PROFILE NOT CONFIRMED condition. For both MSFT and OKLO today this makes no
observable difference — `deriveVerdict` already returns `INCOMPLETE` via a
different branch first, and `docs/m9-real-company-validation-findings.md`
lines 79-83 confirm the automatic run's profile resolution behaves exactly
as M9-1 anticipated. **Whether the structure §3 proposes still needs this
branch:** yes, unchanged — the underwritability gate in §3.1 step 2
explicitly restates §10.6.3's three conditions including PROFILE NOT
CONFIRMED, so whichever future outcome implements either KEEP or AMEND
inherits the same standing implementation gap this document does not
resolve. Named here so that outcome does not discover it cold.

### 6.4 `achievedRevenueCagr` remains unwired into `AnalysisResult`

Restated from `docs/verdict-synthesis-research.md` §6 (gap table): confirmed
still true at this head — no reference to `achievedRevenueCagr` or
`calibration/inputs` anywhere in `lib/analyzer/assemble.ts`. **Whether the
structure §3 proposes still needs it:** yes — Dimension 2 as proposed reads
both the achieved side (this function) and the required side (M7's grid via
RONIC), so wiring this figure into `AnalysisResult` remains exactly as
necessary under AMEND as it was under KEEP. This is a non-policy engineering
gap, not a methodology question, and is not touched by this document.

### 6.5 The `CHEAP`/`FAIR`/`EXPENSIVE` ↔ `BUY`/`HOLD`/`SELL` mapping is settled and not reopened

`verdict.ts`'s own header comment (`:14-16`) records that the 18 Sep 2026
ruling explicitly overrides the frozen spec's CHEAP/FAIR/EXPENSIVE wording
"for this slot," keeping the product-facing vocabulary at
BUY/HOLD/SELL/INCOMPLETE. Nothing in this document's §3 proposal touches
that mapping, and Finding 5's caution about house conventions applies to the
*numeric bands and geometry* within that mapping, not to the mapping's
existence, which is not reopened here.

---

## 7. The smallest next action

**First: this document itself is the immediate next action's target — it
requires Calvin's ruling on §2 (KEEP or AMEND) and §4's named house-policy
decisions before any implementation work on this dependency proceeds.**
Per issue #272's CALVIN REQUIRED section, that ruling is not expected as
part of this outcome's own terminal comment; it is the next action for
Calvin to take on this document's return.

**Second, and dependency-safe under either a KEEP or an AMEND ruling: close
the §10.6.3/`deriveVerdict` non-policy implementation gap named in §6.3.**
This is the smallest concrete *outcome* that does not wait on the
methodology ruling above — it adds the missing PROFILE NOT CONFIRMED branch
to `deriveVerdict` (or explains in that outcome's own evidence why it is not
needed, if a future re-read finds it already moot), touches no policy
constant, sets no threshold, and is required identically whether §10.6.2 is
eventually KEPT or AMENDed per §3, per §6.3's own finding. It does not
close `docs/acceptance-matrix.md` row 13 or the M8 growth-comparator
blocker, and does not by itself unblock MSFT's or OKLO's `INCOMPLETE`
verdict — those remain gated on the structural facts §5 restates and on
Calvin's ruling on this document.

No other outcome is named or started here. Analyzer final acceptance
remains withheld until the verdict-methodology dependency this document
addresses is resolved, per the ruling's closing line.

---

## 8. Where a required consideration interacts with a settled ruling

Per the ruling's own instruction, stated explicitly here rather than
silently overriding a settled ruling or stopping: **Finding 3's demotion of
reverse DCF from an independent vote is, on its own, in tension with the 17
Sep 2026 single-diagnostic ruling** (§1.3 above) if it were adopted without
a genuine second dimension. This document resolves that tension by pairing
Finding 3 with Finding 1 (the RONIC-vs-cost-of-capital growth-quality axis)
as the second dimension, per §3.2's explicit statement of why the 17 Sep
ruling is still satisfied under the proposed structure. This is named as an
item for Calvin's ruling on this return, not as a conflict between two
authorities where neither is his newest ruling — both the 17 Sep ruling and
the 24 Sep findings are Calvin's, and `STOP: RECONCILIATION REQUIRED` is
reserved for a case neither of these is.

---

## What this document does and does not do

**Did:** re-verified the current tree at `c99712f`; answered each of
Calvin's five named findings by name, including the two (5, and the
KEEP/AMEND-conditioning half of 1 and 3) that substantially confirm rather
than change the prior document's conclusions; made one determination
(AMEND, structural only) with the evidence for it and what KEEP would have
cost; stated a complete smallest final methodology structure addressing all
four structural ideas the ruling names, with precise proposed §10.6.2 text
for the AMEND case; listed the remaining house-policy decisions as closed
questions with options and consequences, adding none dressed as an answer;
named the minimum real-company evidence as a composition requirement rather
than a count, and the exact bounds that would need lifting to obtain it,
without lifting any; carried forward the two non-policy gaps
`docs/verdict-synthesis-research.md` named, confirming both still apply
under the proposed structure; named the smallest next action as two parts —
Calvin's ruling on this document, and one dependency-safe non-policy code
outcome that does not wait on it.

**Did not:** change `lib/analyzer/verdict.ts` or `lib/analyzer/policy.ts`
(confirmed byte-identical to `c99712f` throughout, §6); introduce any band,
cut-point, horizon rule, disagreement constant, or `POLICY_THRESHOLD_PROVENANCE`
row, anywhere, including inside the proposed §10.6.2 text (every numeric
question there is bracketed to §4, not answered); touch any `docs/frozen/`
byte or `FROZEN_HASHES` entry; recommend price-location-alone or
PVGO-share-of-EV, in any form; recommend a model-authored verdict; gather
additional evidence for the existing §10.6.2 mechanism or run a new
calibration pass; acquire new capture/EDGAR data or add a third real
company; lift the 21 Sep third-company deferral or the no-new-capture/no-EDGAR
bound; reopen the merged Analyzer V2 UI or claim Calvin's acceptance of it;
decide anything — every determination above, KEEP-or-AMEND included, is a
recommendation for Calvin's ruling, not a decision taken.

---
---

# Addendum — `CF-VERDICT-1062-AMEND-TEXT-01`: exact §10.6.2 text under `CALVIN RULING — C`

**This addendum (§§9–14) supersedes §§3.1 and 3.3 above.** It does not
supersede §1, §2, §5 or §6, which it re-reads and re-applies rather than
repeats. Per `docs/product-decisions.md` items 3 and 9, this remains a
recommendation for Calvin's ruling, never a decision taken, and no
`docs/frozen/` byte is edited by this addendum.

Re-verified at `origin/master` = `ed81500`, working tree clean throughout.
`lib/analyzer/verdict.ts` and `lib/analyzer/policy.ts` are byte-identical to
that commit (§13 below cites the exact lines re-read). No `docs/frozen/`
byte and no `FROZEN_HASHES` entry is touched. No threshold, band, cut-point,
zone width, horizon rule, disagreement constant, `PROVISIONAL` entry or
`POLICY_THRESHOLD_PROVENANCE` row is introduced anywhere below, in code or
in prose presented as settled.

---

## 9. `CALVIN RULING — C`, verbatim — this addendum's authorisation

Quoted in full ([PR #273 comment 5808704819](https://github.com/calyeap/Cal-Finance/pull/273#issuecomment-5808704819), 24 Sep 2026 06:08:48Z), because every clause binds and none is paraphrased for the structural work below:

> AMEND §10.6.2, but do **not** adopt §3.3 exactly as written.
>
> Use the simpler single-comparison structure below:
>
> 1. **UNDERWRITABILITY** — a fundamental valuation must be usable. If not, return INCOMPLETE.
> 2. **GROWTH LICENCE** — determine whether going-forward / incremental returns on new capital economically exceed their cost. If YES, growth-inclusive value may count. If NO, use a conservative / no-growth value. If UNKNOWN, compute both.
> 3. **VALUE** — produce one underwritten fundamental value (or both values when the growth licence is unresolved).
> 4. **UNCERTAINTY / MARGIN OF SAFETY** — economic / forecast uncertainty determines the required fair-value zone / margin of safety. Exact policy remains open.
> 5. **VERDICT** — compare current price with the underwritten value / fair zone to derive BUY / HOLD / SELL.
> 6. **FLIP TEST** — when the growth licence is UNKNOWN, if both growth-inclusive and conservative values imply the same verdict, issue it; if they imply different verdicts, return INCOMPLETE.
> 7. **REVERSE DCF** — explanation and consistency check only. It must not cast an independent verdict vote.
>
> Structural clarifications:
> - Do not retain a two-vote classifier where price location is one vote and growth-quality is a second independent vote requiring agreement. Growth quality instead governs what value is allowed to be underwritten; the verdict itself comes from one underwritten value-vs-price comparison.
> - Do not call the growth/no-growth flip test the margin-of-safety overlay. The flip test handles unresolved growth licensing. Margin of safety is separately driven by economic/forecast uncertainty on an already-underwritten valuation.
> - Evidence / estimation confidence remains an underwritability gate; economic / forecast uncertainty remains a separate MOS input. Do not collapse them.
> - Do not adopt Morningstar numeric bands, mirrored SELL geometry, or any new numeric threshold in this ruling.
> - Existing settled constraints remain settled: no price-location-alone verdict, no PVGO shortcut, no model-in-the-path verdict, no default HOLD when evidence is insufficient.
>
> Return next with the smallest exact §10.6.2 replacement text consistent with this ruling, plus only the remaining explicit Cal Finance house-policy decisions and the minimum evidence required to set them. No code implementation or new evidence capture yet.

**One note on vocabulary, not a deviation from the ruling.** Step 5 and
Step 6's plain English says "BUY / HOLD / SELL" and "INCOMPLETE." Those are
the product-facing words (`lib/analyzer/verdict.ts`, `VerdictStatus`); the
frozen text this addendum proposes replacing sits one layer below that, at
§10.6.1's already-fixed **CHEAP / FAIR / EXPENSIVE / INCONCLUSIVE**
vocabulary, and the mapping between the two layers is itself settled and
not reopened here (§6.5 above; `verdict.ts:14-16`). §10 below therefore
writes the proposed §10.6.2 text in §10.6.1's vocabulary — CHEAP / FAIR /
EXPENSIVE where Calvin's Step 5 says BUY / HOLD / SELL, INCONCLUSIVE where
Steps 1 and 6 say INCOMPLETE — because that is the frozen layer being
amended, and the settled mapping is what carries one to the other. This is
not a redesign of the ruled structure; it is the same vocabulary
substitution §6.5 already records as settled, applied consistently.

---

## 10. Proposed §10.6.2 replacement text (ruling C — supersedes §3.3; not applied)

**Smallest-footprint statement.** The text below replaces §10.6.2 alone.
It restates §10.6.3's three render conditions and §7.2 M5's RONIC ladder by
reference rather than duplicating their substance, so that if either of
those subsections is separately edited in the future this text does not
silently drift from them. No other frozen subsection is touched, and §10.4
below states, for each of §10.6.1/§10.6.3/§10.6.4, why none needs its own
amendment to coexist with this text.

**Disposition of every paragraph of current §10.6.2 (spec `:1068–1098`)
this replacement does not restate in the seven steps, stated here so
nothing is dropped by silence.** The heading, the two-input table, fixed
rule 1 and fixed rule 2 are restructured into the seven steps and the
paragraph replacing fixed rule 2 below. Four of the six achieved-versus-
required comparator paragraphs — spec `:1079`, `:1081`, `:1083`, `:1087`
(the horizon and calibration rules) — are orthogonal to the two-vote
structure ruling C drops: they govern the achieved-history comparator
Step 7 reads and cast no vote of their own, so they are carried forward
**verbatim** inside the quoted block below rather than silently lost to a
whole-subsection replacement. The other two — spec `:1077` and `:1085` —
are carried forward verbatim as well, but they are not orthogonal in the
same sense: their consequence clauses name the *position* itself, not
only the comparator, by way of a term ("the gap" / "the growth input")
that only the two-input table this replacement removes used to define.
The quoted block below binds each to Step 7's comparator with a bracketed
gloss so neither sentence refers to a deleted antecedent, and §11 item 8
below opens, without resolving, whether that REQUIRED-comparator gate
still reaches the position under the ruled structure or narrows to
§10.6.4's action clause only — ruling C is silent on this interaction, so
it is named rather than assumed either way. Spec `:1089`'s
bands-are-policy-constants/PROVISIONAL recording requirement is carried
the same way, with its now-dead "and the disagreement rule" clause struck
— that rule does not survive Step 6's flip test above, but the
recording/PROVISIONAL requirement §11 item 5 still depends on does. Spec
`:1098`'s closing rationale is carried forward verbatim as this
replacement's own closing paragraph, since "deterministic, never a [C]
call" is the heading this replacement keeps.

> #### 10.6.2 Derivation — deterministic, never a [C] call
>
> The position is derived from a single underwritten-value-versus-price
> comparison, produced in the seven steps below, in order. Every step reads
> a field the analyzer already computes, or a load-bearing reading of one;
> no step calls a model.
>
> **1 — Underwritability.** The fundamental valuation must be usable before
> anything else runs. This is §10.6.3's three existing conditions (a
> valuation range exists; trust status is CLEAN or PARTIAL; PROFILE NOT
> CONFIRMED is not active), restated here as this derivation's first step,
> not a second gate. Where they do not all hold, or a REQUIRED input this
> derivation depends on is missing or not evidenced to the standard §3.7
> and §3.8 already require, this step fails and the position is
> **INCONCLUSIVE**.
>
> **2 — Growth licence.** Whether the growth the scenario range and the M7
> reverse-DCF grid describe earns a return on incremental invested capital
> in excess of the discount rate used for the same range — RONIC (§7.2 M5),
> read against the rate grid, now load-bearing on the position rather than
> only a qualifying flag on the diagnostic. The reading is:
>
> - **YES** — [the RONIC-vs-rate reading that licenses growth, and how
>   §7.2 M5's existing ladder states (RONIC NOT MEANINGFUL · LOW RONIC —
>   VALUE-DESTROYING GROWTH · computed · RONIC CAPPED AT 200%) map onto
>   YES / NO / UNKNOWN below — house-policy decision, §11 item 2] — the
>   growth-inclusive value (Step 3) may be underwritten.
> - **NO** — growth is not licensed; only the conservative / no-growth
>   value (Step 3) may be underwritten.
> - **UNKNOWN** — [what makes the reading genuinely unresolved rather than
>   YES or NO, including whether a ladder state the RONIC computation
>   itself cannot resolve (e.g. RONIC NOT MEANINGFUL) is read as UNKNOWN
>   here or as a Step 1 failure — house-policy decision, §11 item 2] — both
>   values are computed at Step 3, and Step 6 governs which verdict, if
>   any, may issue.
>
> **3 — Value.** Exactly one underwritten fundamental value is produced
> under Step 2's licence — the growth-inclusive value where YES, the
> conservative / no-growth value where NO, or both where UNKNOWN. [Whether
> the conservative / no-growth value is a fixed floor or a company-specific
> bound (e.g. the bear scenario's own growth path) — house-policy decision,
> §11 item 3.] The M7 reverse-DCF grid's required-growth figures are not a
> third input to this step: they are read at Step 7 as a consistency check
> on this value and on the range, per §10.1's ordering principle, and cast
> no vote of their own here or anywhere else in this derivation.
>
> **4 — Uncertainty / margin of safety.** Economic / forecast uncertainty
> on the Step 3 value — [what this uncertainty is measured from, and how it
> sets the required fair-value zone — house-policy decision, §11 item 1;
> exact policy remains open] — determines the fair-value zone the Step 5
> comparison reads. This is evidence/estimation confidence (Step 1) read a
> second time for a different purpose, not the same test twice: Step 1 asks
> whether the valuation is usable at all and, where it is not, returns
> INCONCLUSIVE; Step 4 asks, given that it is usable, how wide the required
> cushion around it is, and only ever widens or narrows the zone Step 5
> reads. The two are not collapsed into one gate.
>
> **5 — Verdict.** Compare the current price against the Step 3 value (or,
> where Step 2 was UNKNOWN, both values within Step 4's zone) to derive
> CHEAP / FAIR / EXPENSIVE. This is one comparison, not two independent
> votes: Step 2 has already determined which value is being compared before
> this step runs, so this step never reads price location alone (§10.2
> below). Where Step 2 was UNKNOWN, this step's result is provisional on
> Step 6.
>
> **6 — Flip test.** Applies only where Step 2's growth licence is UNKNOWN.
> Compute Step 5 once against the growth-inclusive value and once against
> the conservative value. Where both agree on the resulting position, issue
> it. Where they disagree, the position is **INCONCLUSIVE**. This test, and
> not Step 4's margin-of-safety zone, is what fires here — the two are never
> one another: the flip test resolves unresolved growth licensing; the
> margin of safety widens or narrows an already-licensed value's zone.
>
> **7 — Reverse DCF.** The M7 grid's required-growth figures, read at Step
> 3, are reported alongside the position (§10.6.4) solely as explanation
> and a consistency check on the same underlying DCF relationship the range
> already reflects, per §10.1's ordering principle. They cast no
> independent vote at Step 5, Step 6, or anywhere else in this derivation.
>
> **The achieved-versus-required comparator Step 7 and §10.6.4's action
> clause read, carried forward verbatim from current §10.6.2 — orthogonal
> to the two-vote structure above and not touched by ruling C:**
>
> **The comparator fact is REQUIRED.** The achieved figure must be a
> section B fact **on the same series and the same horizon** as the
> implied-growth figure it is read against. A ten-year implied CAGR is
> compared to a ten-year achieved CAGR of the same series, on the same
> accounting basis, or it is not compared at all. Where no such fact
> exists, the gap [the achieved-versus-required comparator of Step 7] is
> **INCOMPLETE**, and the position and its action clause do not render.
>
> **Two horizons are valid, and the horizon travels with the result**
> (CalFinance Methodology v2, ruled 8 September 2026). Ten years is
> preferred. **A five-year comparator is permitted where a valid ten-year
> one cannot be constructed** — which is the common case rather than the
> exception: ASC 606 split most filers' revenue across two tagged elements
> partway through the decade, and §3.7 refuses to join two series into one
> comparator, so only a minority of companies can produce a ten-year
> figure at all.
>
> **Five-year and ten-year comparators are related but not semantically
> identical**, so the horizon is carried with the figure and is never
> implied. **Both sides must be the same horizon**: a five-year achieved
> comparator is read against a five-year required-growth figure. Mixing
> the two sides is not a fallback, it is a different comparison.
>
> **No cross-series stitching.** §3.7's refusal stands, and a five-year
> window that spans a tag change is not a valid five-year comparator.
>
> **Where neither horizon can be constructed, the growth input [the
> achieved-versus-required comparator of Step 7] is UNAVAILABLE and the
> position is INCONCLUSIVE.** It does not degrade to a
> weaker reading, and it does not fall back to FAIR — FAIR is a positive
> claim, not the absence of one. [Unchanged from current text; consistent
> with Step 1/Step 6 above, neither of which falls back to FAIR either.]
>
> **For calibration:** observations from the two horizons are not pooled
> without evidence that common thresholds hold across them. Whether they
> do is a testable question and must be answered from observations rather
> than assumed. Where they do not, thresholds are calibrated per horizon.
>
> **What replaces the current rule that "every position requires positive
> agreement from both inputs."** That rule does not survive this structure:
> there are no longer two independent votes for a second vote to agree
> with. In its place: **a position issues only where Step 1 clears, Step 3
> produces a value under Step 2's licence, and — where Step 2 was UNKNOWN —
> Step 6's flip test agrees.** Anything else — Step 1 failing, Step 3 unable
> to produce a value, or Step 6 disagreeing — is **INCONCLUSIVE**.
> Determinism does not depend on the dropped rule: every test above (Step
> 1's gate, Step 2's licence reading, Step 4's uncertainty reading, Step 6's
> flip test) is a uniform rule applied identically to every company, exactly
> as fixed rule 1 below already requires and exactly as Gate 0 and Gate 1
> already operate.
>
> **Bands are policy constants** [carried forward from current text, minus
> "and the disagreement rule" — that rule does not survive this structure,
> replaced above by Step 6's flip test; the recording/PROVISIONAL
> requirement below does survive and is restated on its own], recorded in
> `policy` (§10.0.1) and marked **PROVISIONAL** with what they were
> calibrated on.
>
> One rule is fixed here and is not configuration:
>
> 1. **The same inputs always produce the same position.** No per-company
>    adjustment, no override, no model in the path. [Unchanged from current
>    text.]
>
> **Why deterministic and not an AI call, recorded because it will be asked
> again:** an AI-authored headline verdict would be unreproducible and
> unauditable. Two runs on identical inputs could differ, and neither could
> be traced. That is the failure §3 exists to prevent, applied to the
> loudest sentence in the report. [Unchanged from current text.]

### 10.1 Why this is one comparison, not the old two-vote rule, restated plainly

Current §10.6.2 asks two questions that must separately agree (price
location; the growth-rate gap) before it will name a position. The text
above asks one question — is the current price CHEAP, FAIR or EXPENSIVE
relative to a single value the process has already decided is the right
one to underwrite. Step 2 decides *which value* is licensed; Step 5 does
the *only* comparing. This is what "one comparison, not two votes" means in
concrete terms: nowhere does the proposed text compare two independently
computed classifications and require them to concur; it computes one
value (or, transiently, two candidate values pending Step 6) and compares
that against price exactly once.

### 10.2 Why the 17 Sep 2026 single-diagnostic ruling is still satisfied

**Stated explicitly, in this document's own words, because REVIEW checks
it.** The 17 Sep 2026 ruling ([PR #140 comment 5719869973](https://github.com/calyeap/Cal-Finance/pull/140#issuecomment-5719869973))
forbids a fair-value range, or any other single diagnostic, from by itself
determining BUY/HOLD/SELL. Step 5 above compares price against a value —
not against the range's location alone — and that value is never available
to Step 5 until Step 2 has determined, from a second, independent fact
(RONIC read against the discount rate — a statement about whether the
company's incremental capital earns its keep, which price location does
not measure), which value may be underwritten at all. A company whose price
sits cheap within its scenario range but whose growth is NO — not licensed
— is compared against the conservative value, not the growth-inclusive one,
so price location by itself never produces the verdict: it produces a
verdict only in combination with, and licensed by, Step 2's independent
growth-quality finding. This is not price-location-alone with extra
narration; Step 2 changes *what value the price is compared against*,
which is a substantive second input, not a restatement of the range. The
apparent tension between "one comparison" (ruling C) and "not one
diagnostic alone" (17 Sep) is therefore not a conflict: "one comparison"
describes how many times Step 5 runs; "not one diagnostic alone" describes
how many independent facts feed what it compares. Ruling C's structure
satisfies both by construction — one comparison, fed by two independent
findings (Step 2's growth licence and Step 3's resulting value; the price
itself is the third term of the comparison, not a fourth vote).

### 10.3 Reconciliation against §10.6.1, §10.6.3 and §10.6.4

- **§10.6.1 (vocabulary).** **Unchanged.** CHEAP · FAIR · EXPENSIVE ·
  INCONCLUSIVE remain the four values Step 5/Step 1/Step 6 above produce;
  "INCONCLUSIVE is not FAIR" is preserved exactly — nothing in the proposed
  text routes a failed step to FAIR.
- **§10.6.3 (render conditions).** **Consequentially affected in wording
  only, not in substance.** Its three conditions are restated inside Step 1
  above as this derivation's first step rather than a separate subsection
  read before it. §10.6.3 itself needs no amendment to coexist with this
  text — Step 1 points to it rather than duplicating or contradicting it —
  but a future editor implementing this text may find it clearer to cross-
  reference Step 1 from within §10.6.3's own wording. That is a wording
  choice for whoever implements the ruling, not a substantive change this
  addendum proposes or requires.
- **§10.6.4 (the action clause, entry-side-only).** **Unchanged.** Step 7's
  reverse-DCF figures are exactly the required-versus-achieved figures
  §10.6.4 already requires the action clause to name and show; entry-side-
  only (start / do not start / wait for a better price, never trim / add /
  sell / hold) is untouched by this text and not reached by any step above.
- **No adjacent subsection needs its own separate amendment.** The ruled
  structure is expressible as a replacement to §10.6.2 alone.

### 10.4 Where ruling C appears to modify a settled ruling — named, not silently overridden, not stopped on

Per issue #274's own instruction: Calvin's ruling C is newer than every
ruling it touches, so an apparent tension is not the two-authority conflict
`AGENTS.md`'s **If authorities conflict** rule sends to
`STOP: RECONCILIATION REQUIRED` — that rule is for two authorities where
**neither** is Calvin's newest ruling. Two places are named here for his
ruling on the text, not overridden and not stopped on:

1. **The two-dimension structure §3.1/§3.3 above proposed is dropped in
   favour of a one-dimension-plus-licence structure.** §3's own §3.2 argued
   the 17 Sep ruling was satisfied because two dimensions required positive
   agreement; ruling C explicitly forbids that shape ("do not retain a
   two-vote classifier"). §10.2 above shows the newer structure satisfies
   the same 17 Sep ruling by a different mechanism (licensing what is
   compared, not requiring two independent classifications to agree) —
   Calvin's own ruling text anticipates and resolves this by naming both
   constraints together ("Growth quality instead governs what value is
   allowed to be underwritten; the verdict itself comes from one
   underwritten value-vs-price comparison").
2. **Step 5's plain English says BUY/HOLD/SELL; §10.6.1's fixed vocabulary
   says CHEAP/FAIR/EXPENSIVE/INCONCLUSIVE.** §9 above states this is
   resolved by the already-settled product/spec vocabulary mapping (§6.5),
   not a new decision — named here again because it sits at the exact spot
   the ruling's own wording could otherwise be read as reopening it.

Neither is a conflict between two authorities where neither is Calvin's
newest ruling, so `STOP: RECONCILIATION REQUIRED` does not apply to either.

---

## 11. The remaining explicit house-policy decisions — re-derived under ruling C

**Re-derived from the ruled structure, not copied from §4.** Per issue
#274's SCOPE 2, each of §4's seven items above is given a disposition —
**closes**, **changes**, or **stays open unchanged** — before what survives
is carried forward, together with what ruling C newly opens.

**Disposition of §4's seven items:**

| §4 item | Disposition under ruling C | Why |
|---|---|---|
| 1. Which M7 cell supplies the required-growth figure | **Changes** — re-scoped, not closed | No longer "Dimension 2's required-growth figure" (a dropped concept); now Step 2's RONIC-vs-rate reading and Step 7's consistency-check figure. Same open substance, new attachment point. Carried forward as item 4 below. |
| 2. What counts as "genuinely ambiguous" for the dual-value test | **Changes** — splits into two items | Ruling C's own structural clarification forbids calling the flip test the margin-of-safety overlay. What was one question under §3's merged overlay is now two independent ones: what makes Step 2 UNKNOWN (item 2 below) and what Step 4's margin-of-safety input actually measures (item 1 below). Neither is answered by the split itself. |
| 3. Fixed floor vs. company-specific conservative/no-growth reading | **Stays open, unchanged in substance** | Same question, now attached to Step 2's NO branch and Step 3. Carried forward as item 3 below. |
| 4. Numeric band/cut-point for CHEAP/FAIR/EXPENSIVE | **Stays open, unchanged** | Ruling C adopts no numeric threshold ("do not adopt ... any new numeric threshold in this ruling"); the classification still needs one eventually. Carried forward as item 5 below. |
| 5. Mirrored vs. asymmetric SELL (EXPENSIVE) geometry | **Stays open, unchanged** | Ruling C explicitly declines to adopt mirrored SELL geometry; the question of whether it should eventually be adopted is not answered either way. Carried forward as item 6 below. |
| 6. Five-year/ten-year band pooling | **Stays open, unchanged** | §10.6.2's own text on this point is carried forward **verbatim** into the quoted replacement at §10 above (the calibration-pooling paragraph following Step 7); ruling C does not touch it. Carried forward as item 7 below. |
| 7. Which reverse-DCF cell feeds the structure | **Closes as a separate item — absorbed into item 1** | It was already flagged in §4 as restating item 1 rather than adding to it (`docs/verdict-synthesis-research.md` §5.2's demoted question); ruling C's Step 7 clarifies reverse DCF's *role* (explanation only) but does not answer *which cell*, so the substance is unchanged and stays merged with item 4 below rather than listed twice. |

**The re-derived list**, each as one closed question with options, the
consequence of each, and what it would take to answer it. None defaults to
a Morningstar-style shape (Finding 5, still confirmed at §1.5 above), and a
default is named explicitly wherever ruling C's silence could otherwise be
read as adopting one.

1. **What is "economic / forecast uncertainty" for Step 4's margin of
   safety, and what fair-value-zone shape does it produce?** Newly opened
   by ruling C's own "exact policy remains open." Options: a measure of the
   dispersion across the bear/base/bull scenario range itself (reusing
   machinery already computed, but risking the same double-counting concern
   Finding 3 raised about reverse DCF, one layer down, since the range
   already feeds Step 5's comparison); a measure of evidence-quality flags
   already carried (SECONDARY, UNVERIFIED, AI-EXTRACTED, SHORT HISTORY) —
   but those already drive §9.6 trust status and Step 1's gate, so reusing
   them for Step 4 risks collapsing the two Step 1/Step 4 are supposed to
   keep separate; a genuinely new measure of forecast dispersion not yet
   computed anywhere. **A default would otherwise have crept in here** if
   this addendum reused the scenario range's own spread as the uncertainty
   measure without naming that it is a choice — it is not adopted by
   default. Answering it needs Calvin's ruling on which shape, then real
   observations to size it (§12 below); no number is proposed.

2. **What makes Step 2's growth licence UNKNOWN rather than resolved YES or
   NO — and does a ladder state the RONIC computation itself cannot
   resolve (RONIC NOT MEANINGFUL, §7.2 M5) count as UNKNOWN, or as a Step 1
   underwritability failure?** Newly opened by ruling C's three-way YES /
   NO / UNKNOWN split, which names no test for membership. Options: treat
   UNKNOWN as "the RONIC reading is close enough to the rate-grid boundary
   that estimation error could plausibly place it on either side" (an
   estimation-uncertainty test, symmetric with item 1's concern but
   distinct in what it measures); treat any ladder state that is not a
   clean "computed" reading (i.e. RONIC NOT MEANINGFUL as well as a
   boundary-adjacent LOW RONIC reading) as UNKNOWN; or treat RONIC NOT
   MEANINGFUL specifically as a Step 1 failure rather than a Step 2 state,
   on the reasoning that a licence that cannot be computed at all is not
   the same claim as one that is computed but ambiguous. Consequence: the
   first two route MSFT-shaped companies (RONIC NOT MEANINGFUL on every
   cell) through Step 6's flip test; the third routes them to INCONCLUSIVE
   at Step 1 directly. **For MSFT and OKLO today this choice does not
   change the outcome** — see §12 below; it is still Calvin's to make, not
   defaulted here either way.

3. **Is the conservative / no-growth value a fixed floor (e.g. zero growth)
   or a company-specific lower bound (e.g. the bear scenario's own growth
   path)?** Unchanged from §4 item 3 above, restated for Step 2's NO branch
   and Step 3. Consequence unchanged: a fixed floor is simpler and more
   uniform (favours fixed rule 1) but may be economically meaningless for a
   structurally shrinking company; a company-specific bound reuses the
   range's own bear case but ties Step 3's conservative reading to an
   assumption that already feeds Step 5's comparison, which risks
   reintroducing Finding 3's double-counting concern one layer down. Not
   resolved here.

4. **Which of M7's nine reverse-DCF cells (or which combination) supplies
   Step 2's RONIC-vs-rate reading and Step 7's consistency-check figure?**
   Re-scoped from §4 items 1 and 7 (now merged; see the disposition table
   above). Options unchanged: a single designated margin/rate cell;
   requiring direction-of-agreement across all nine; reading the grid's
   range. Consequence unchanged: a single cell is simplest but arbitrary; a
   grid range is more defensible but has no precedent in the frozen text
   for collapsing a *range* of readings into one Step 2 determination.
   Needs real observations across companies whose RONIC ladder is not
   uniformly NOT MEANINGFUL — which the current calibration set (§12
   below) does not supply.

5. **Any numeric band or cut-point the eventual CHEAP / FAIR / EXPENSIVE
   classification at Step 5 still needs**, once real observations exist.
   Unchanged from §4 item 4. Explicitly not answered here, per HARD BOUNDS
   and `docs/frozen/calfinance-methodology-v2.md`'s own "numerical
   valuation-position cut-points remain TEST/provisional... until
   adequately validated and explicitly approved" (line 154).

6. **The mirrored-versus-asymmetric EXPENSIVE geometry question.**
   Unchanged from §4 item 5, named directly by Finding 5 and by ruling C's
   own "do not adopt ... mirrored SELL geometry ... in this ruling." No
   default is assumed either way by that non-adoption; ruling C declining
   to adopt the shape now is not itself a ruling that the shape is wrong,
   only that it is not decided.

7. **Whether five-year and ten-year observations may share one band.**
   Unchanged from §4 item 6 (`docs/m8c-calibration-findings.md:151`). Still
   open, still to be "answered from observations rather than assumed," per
   §10.6.2's own text on this point, carried forward **verbatim** into the
   quoted replacement at §10 above.

8. **Does the REQUIRED-comparator gate (spec `:1077`, `:1085`, carried
   forward into Step 7's paragraphs at §10 above) still reach the position
   itself, or does it narrow to §10.6.4's action clause only, now that no
   step between 2 and 6 reads the comparator?** Newly opened by carrying
   these two paragraphs forward under the ruled structure: their
   consequence clauses ("the position and its action clause do not
   render"; "the position is INCONCLUSIVE") were written for the two-vote
   structure, where the comparator sat inside the vote itself; Step 7
   states the same comparator "cast[s] no independent vote at Step 5, Step
   6, or anywhere else in this derivation," which is in tension with a
   clause that still routes the *position*. Options: keep the
   REQUIRED-comparator gate reaching the position, as a Step 1
   underwritability input "this derivation depends on" (consistent with
   Step 1's own language, but re-admits an explanation-only check as
   position-determining — the shape #274 says reverse DCF must not have);
   or narrow its consequence to §10.6.4's action clause only, so a missing
   or unconstructable comparator suppresses the reverse-DCF explanation
   and action clause without touching Step 5/6's CHEAP/FAIR/EXPENSIVE
   position. **For MSFT and OKLO today this choice does not change the
   outcome** — see §12 below; both are already INCONCLUSIVE upstream of
   Step 7 under either branch, so it is not resolved here.

---

## 12. The minimum evidence required to set them

**The composition requirement is unchanged in shape from §5 above** — the
ruled structure changes what Dimension 2 is called and how it licenses a
value, not the underlying facts that would have to exist to observe it.
Restated against the ruled structure's own steps, not re-derived from
scratch, because the same evidence gaps block both:

- At least one company whose RONIC ladder is **not** uniformly NOT
  MEANINGFUL across the 8/10/12% × three-margin-level grid — needed for
  Step 2 to ever resolve YES or NO rather than the item-2 open question
  above. MSFT fails this today (all nine cells NOT COMPUTABLE, §13 below),
  so MSFT alone can never validate Step 2 regardless of which of item 2's
  options is ruled.
- At least one company producing **both** a ten-year and a five-year
  achieved comparator on the same series — needed for item 7's
  horizon-pooling question, exactly as §5 stated; unchanged.
- At least one company clearing every upstream blocker
  `docs/m8c-calibration-findings.md` §5 lists in dependency order (Step 7
  scenario authorship, the §4.4 non-operating-investments judgment, an
  acquired RONIC ladder, a set `nopatTaxRate`) — a partial clearance
  produces zero usable observations, exactly as the M8-c counterfactual
  pass demonstrated for MSFT and COST ("still solve 0 of 9 cells").
- For Step 6's flip test and item 2's UNKNOWN question specifically: at
  least one company where the RONIC-vs-rate reading is genuinely close to
  the rate-grid boundary, so that YES/NO/UNKNOWN's boundary condition has a
  real case to test against rather than only the two clean extremes
  (uniformly NOT MEANINGFUL, or comfortably above the rate).
- For Step 4's margin-of-safety input specifically (newly opened, item 1
  above): at least one company where forecast/estimation uncertainty is
  material and can be measured independently of the scenario range's own
  spread, so item 1's options can be told apart empirically rather than
  merely argued.

**No number of companies below the point where these facts exist is
"enough,"** for the same reason §5 gave (small-sample decision theory;
Cooke's classical model's ascertainable-ground-truth requirement) — naming
a count here would itself be the numeric policy constant HARD BOUNDS
forbids.

**What would have to be lifted to obtain it — named without lifting any of
it here.** Unchanged from §5's list, in the same dependency order: (1) the
21 Sep 2026 third-company deferral; (2) the no-new-capture/no-EDGAR bound,
needed for RONIC's five-year deltas beyond what is captured; (3) Command
Center's `nopatTaxRate` ruling (one of the four `UNDEFINED_POLICY_CONSTANTS`,
`lib/analyzer/policy.ts:68-73`); (4) the §4.4 non-operating-investments
judgment, recorded per company; (5) Step 7 scenario authorship for more
companies than the validation set already has. None of these is lifted by
this addendum. The ruled structure does not change which bounds gate the
evidence — it changes what the evidence would be used to decide.

**What the ruled structure would and would not produce for MSFT and OKLO
today, on the real numbers already in the tree — and whether that differs
from §5's answer.**

- **MSFT.** RONIC NOT MEANINGFUL on all nine reverse-DCF cells, confirmed
  unchanged at this head (`lib/analyzer/modules/reverseDcf.ts:187-199`;
  `lib/analyzer/reverseDcfOnRealRun.test.ts:57-69`). Step 2 cannot resolve
  YES or NO for MSFT today regardless of which of item 2's options is
  ruled. **Whichever way item 2 is answered, the outcome is the same**: if
  RONIC NOT MEANINGFUL is read as UNKNOWN, Step 3 would need to compute
  both values, but Step 2's own YES/NO/UNKNOWN reading depends on a RONIC
  figure that does not exist for MSFT on any cell, so Step 6's flip test
  has no genuine second reading to test against the first — the position
  is INCONCLUSIVE; if RONIC NOT MEANINGFUL is instead read as a Step 1
  failure, the position is INCONCLUSIVE at Step 1 directly. Either
  resolution of item 2 leaves MSFT INCONCLUSIVE. **This is unchanged from
  §5's answer under the superseded §3.3 structure** (MSFT stays
  `INCOMPLETE` at the product layer, INCONCLUSIVE at the spec layer,
  either way) — the ruled structure does not create a RONIC figure MSFT's
  own fundamentals do not support, and reads the same per-cell ladder the
  frozen contract already computes
  (`lib/analyzer/assemble.ts:508-520`; `lib/analyzer/suppression.ts:79-91,121,175-179`
  confirm the range itself is unaffected — `SUPPRESSION_SCOPE_BY_STATE`,
  `SCOPE_REMOVES_FAIR_VALUE_RANGE` and `stateRemovingFairValueRange` all
  re-read and matching §5's citations).
- **OKLO.** Unchanged: never reaches §10.6.2 at all, blocked upstream at
  Step 1 by the leverage precondition (`LEVERAGE UNSUPPORTED IN v1`,
  downstream of the missing enterprise value). **Identical to §5's
  answer.** No ruling on this addendum changes that structural fact.

---

## 13. Carried forward, still unresolved

Both non-policy gaps §6 above named are re-checked against the ruled
structure, per issue #274 SCOPE 4. **Neither is fixed here** — both remain
frozen under the 24 Sep 2026 04:52:41Z ruling ([#269 comment 5807914821](https://github.com/calyeap/Cal-Finance/issues/269#issuecomment-5807914821)),
which ruling C does not lift.

- **§6.3 — §10.6.3's PROFILE NOT CONFIRMED condition has no `deriveVerdict`
  branch.** **Still needed, unchanged.** Step 1 above restates §10.6.3's
  three conditions including PROFILE NOT CONFIRMED as this derivation's
  first step, so whichever future outcome implements the ruled structure
  inherits the same standing implementation gap this addendum does not
  resolve.
- **§6.4 — `achievedRevenueCagr` remains unwired into `AnalysisResult`.**
  **Still needed, unchanged.** Step 2 as proposed reads the achieved side
  (this figure) against the required side (M7's grid via RONIC), so wiring
  this figure into `AnalysisResult` remains exactly as necessary under the
  ruled structure as it was under either KEEP or the superseded §3.3
  AMEND candidate.
- **`lib/analyzer/verdict.ts` and `lib/analyzer/policy.ts` re-verified
  byte-identical to `ed81500`** at this head — the same four unconditional
  `INCOMPLETE` branches (`verdict.ts:53-59,63-68,70-75,77-80`) and the same
  absence of any §10.6.2 entry in `PolicyConstants` or
  `POLICY_THRESHOLD_PROVENANCE` (`policy.ts:10-61,102-144`) as §6.1/§6.2
  above recorded at `c99712f`. This addendum's structural proposal in §10
  is not implemented by this diff and could not be without violating HARD
  BOUNDS.

---

## 14. The smallest next action

**First: this addendum is itself the immediate target of the next action —
Calvin's ruling on §10's exact text and §11's re-derived house-policy
list.** Per issue #274's own CALVIN REQUIRED section, that ruling is not
expected as part of this outcome's terminal comment; §11's list is the
material for it, delivered here rather than as a terminal gate.

**Second, and dependency-safe under whatever Calvin rules on this text:
close the §10.6.3/`deriveVerdict` non-policy implementation gap named in
§13 (carried from §6.3 above).** This is the same smallest concrete
outcome §7 above already named, restated because it does not change under
ruling C: it adds the missing PROFILE NOT CONFIRMED branch to
`deriveVerdict` (or explains in that outcome's own evidence why it is
already moot), touches no policy constant, sets no threshold, and is
required identically under the superseded §3.3 candidate or the ruled
structure this addendum proposes instead. It does not close
`docs/acceptance-matrix.md` row 13, and it does not by itself unblock
MSFT's or OKLO's `INCOMPLETE` verdict — those stay gated on the structural
facts §12 restates and on Calvin's ruling on §10.

No other outcome is named or started here. Analyzer final acceptance
remains withheld until the verdict-methodology dependency this addendum
addresses is resolved.

---

## What this addendum (§§9–14) does and does not do

**Did:** quoted Calvin's `CALVIN RULING — C` in full as this addendum's
authorisation; wrote the smallest exact proposed §10.6.2 replacement text
expressing its seven ruled steps and all five structural clarifications,
with every numeric slot bracketed to §11 and none filled in; stated, in the
document's own words, how the resulting single value-vs-price comparison
still satisfies the 17 Sep 2026 single-diagnostic ruling; reconciled the
proposed text against §10.6.1's vocabulary, §10.6.3's render conditions and
§10.6.4's action clause, finding none needs its own separate amendment;
named the two places the ruled structure appears to modify a settled
ruling, for Calvin's ruling rather than silently overriding either or
stopping; gave the close/change/open disposition of each of §4's seven
house-policy items above and re-derived the surviving and newly-opened
list under the ruled structure, including the two items ruling C itself
newly opens (the margin-of-safety input, and what makes the growth licence
UNKNOWN — including the RONIC-NOT-MEANINGFUL boundary case) and the one
item newly opened by carrying two comparator paragraphs forward verbatim
(whether the REQUIRED-comparator gate still reaches the position or
narrows to §10.6.4's action clause only); restated the
minimum evidence as the same composition requirement, named against the
ruled structure's own steps, and stated explicitly that MSFT and OKLO
produce the same outcome today as they did under the superseded §3.3
structure, under every open resolution of the newly-opened questions;
carried forward §6.3 and §6.4 unresolved, confirming both are still needed;
named the smallest next action.

**Did not:** change `lib/analyzer/verdict.ts` or `lib/analyzer/policy.ts`
(confirmed byte-identical to `ed81500` throughout, §13); acquire new
evidence or capture; introduce any band, cut-point, horizon rule,
disagreement constant, or `POLICY_THRESHOLD_PROVENANCE` row anywhere,
including inside the proposed §10.6.2 text; touch any `docs/frozen/` byte
or `FROZEN_HASHES` entry; redesign the ruled structure's seven steps or add
an eighth; re-open KEEP-vs-AMEND, restate §1's five findings, or re-argue
§3.3; recommend price-location-alone or PVGO-share-of-EV, in any form;
recommend a model-authored verdict or a default HOLD; resolve any of §11's
open questions with a number, a shape, or a default; lift the 21 Sep
third-company deferral or the no-new-capture/no-EDGAR bound; reopen the
merged Analyzer V2 UI or claim Calvin's acceptance of it; decide anything —
every statement above is a recommendation for Calvin's ruling, not a
decision taken, and §10.6.2 is not amended by this addendum.
