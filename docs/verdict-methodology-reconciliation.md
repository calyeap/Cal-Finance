# Verdict-methodology reconciliation — §10.6.2 against `CF-VERDICT-SYNTHESIS-RND-01`

**Outcome:** `CF-VERDICT-METHODOLOGY-RECON-01` ([issue #272](https://github.com/calyeap/Cal-Finance/issues/272)).
**Authority:** Calvin's `CALVIN RULING — NEITHER A NOR B AS STATED`, 24 Sep 2026
05:33:02Z ([PR #271 comment 5808311255](https://github.com/calyeap/Cal-Finance/pull/271#issuecomment-5808311255)).

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
