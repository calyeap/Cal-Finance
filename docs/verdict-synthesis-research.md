# Verdict-synthesis methodology R&D — §10.6.2, evidence and a recommendation for ruling

**Outcome:** `CF-VERDICT-SYNTHESIS-RND-01` ([issue #270](https://github.com/calyeap/Cal-Finance/issues/270)).
**Authority:** Calvin's `CALVIN RULING — B`, 24 Sep 2026 04:52:41Z
([#269 comment 5807914821](https://github.com/calyeap/Cal-Finance/issues/269#issuecomment-5807914821)):
*"Run the dedicated verdict-synthesis methodology/R&D outcome first, using
practitioner input, external research, and an independent strong-model
challenger. Return with the smallest evidence-backed methodology decision
needed to complete `BUY` / `HOLD` / `SELL`; do not invent provisional
thresholds or bands before that evidence exists."*

**This is a research and reconciliation document, not an implementation.**
`lib/analyzer/verdict.ts` is unchanged (confirmed byte-identical to
`origin/master` = `d35870b`, §6 below). No threshold, band, cut-point,
horizon rule, disagreement constant, or `POLICY_THRESHOLD_PROVENANCE` row is
introduced anywhere in this diff. Every recommendation below is written for
Calvin's ruling; none is a decision taken.

Re-verified at `origin/master` = `d35870b`, working tree clean throughout.

---

## 1. The problem, from current evidence

### 1.1 What §10.6.2 fixes, and what it deliberately leaves as policy

`docs/frozen/calboard-stock-analyzer-v1-spec.md` §10.6.2 names exactly two
inputs to the position (CHEAP/FAIR/EXPENSIVE, rendered to users as
BUY/HOLD/SELL/INCOMPLETE per `docs/product-decisions.md` item 1 and the
6 Sep 2026 informed override, item 22):

- **Input A** — price location within the bear/base/bull scenario range
  (§10.2 section G, already computed and displayed).
- **Input B** — the required-versus-achieved growth gap: M7's reverse-DCF
  implied growth, read against the company's own achieved history on the
  **same series and the same horizon** (§3.7 consistency, no cross-series
  stitching).

Two rules are fixed by the frozen spec and are **not** configuration
(§10.6.2): (1) the same inputs always produce the same position — no
per-company adjustment, no override, no model in the path; (2) a position
requires **positive agreement from both inputs**; anything else —
disagreement, or one input simply missing — is `INCONCLUSIVE`, never a
default `FAIR`/`HOLD`. The bands that would turn the two raw inputs into a
label, and the disagreement rule's own tolerance, are explicitly **policy
constants**, "marked PROVISIONAL with what they were calibrated on"
(§10.6.2). Today, `lib/analyzer/policy.ts`'s `PolicyConstants` and
`POLICY_THRESHOLD_PROVENANCE` carry **no §10.6.2 entry of any kind** —
confirmed by direct read of the current file (no band, cut-point,
disagreement constant, or provenance row for either input).

### 1.2 The empirical fact this outcome exists to answer

`docs/m8c-calibration-findings.md` ran a ten-company calibration pass and
found:

- **Zero of ten** companies produced a usable §10.6.2 observation (both
  inputs present) — "not a material share — all of them" (§1).
- **Only two of ten** (MSFT, OKLO) could produce *any* Step 7 scenario
  values at all, because Step 7 scenarios are analyst-authored, not
  acquired (§2, "A2"). `analystInputsFor` returns `null` for every other
  company and `buildAcquiredRun` raises `AnalystInputsUnavailableError`.
- **Only two of ten** (MSFT, LLY) could produce the ten-year achieved-growth
  comparator at all, because ASC 606 split most filers' revenue across two
  incompatible tags mid-decade and §3.7 correctly refuses to stitch them
  (§3). This is stated as "a structural finding about the comparator rule,
  not about these ten companies" — it "will stay that way" at a ten-year
  horizon for most large filers.
- The document's own conclusion: recommending a threshold set on this
  evidence "would be the Appendix B failure performed deliberately" (§1) —
  Appendix B is the frozen spec's own recorded example of cut-points set by
  judgment with no observations behind them, later mistaken for measured
  ones.

This finding is unchanged today. `docs/m8c-calibration-findings.md` carries
no edit since the last reconciliation, and its dependency list (§5) — the
§4.4 non-operating-investments judgment, RONIC's five-year deltas,
Command Center's `nopatTaxRate` ruling, defect D1's resolution (now closed
per the file's own 9 Sep amendments), and Step 7 authorship for more than
two companies — remains open except D1.

### 1.3 A structural fact not previously stated together in one place: the normal path suppresses the position independent of either input

`docs/frozen/calboard-stock-analyzer-v1-spec.md` §10.6.3 renders the
position only where **all three** hold: a valuation range exists, trust
status is CLEAN or PARTIAL, **and PROFILE NOT CONFIRMED is not active**.
Amendment M9-1 (§14.8, the 22 Sep 2026 *ticker in → report out* ruling)
made Step 6's profile decision an automatic, unconfirmed resolution in the
normal path: *"the recommended profile is used provisionally... recorded as
not human-confirmed... PROFILE NOT CONFIRMED... and the §10.6.3 position
suppression all behave exactly as they did"* (§14.8, quoting §6.3). Directly
confirmed on the real automatic runs: *"Step 6 is resolved, not confirmed.
Each run records the profile its own inputs recommended... as an automatic
resolution. `profile_human_confirmed` stays FALSE on both [MSFT and OKLO],
so PROFILE NOT CONFIRMED, the §9.6 trust consequence and the §10.6.3
suppression are unchanged"* (`docs/m9-real-company-validation-findings.md`,
CF-ANALYZER-AUTORUN-01 update, lines 79–83).

**This is real and worth naming, but it is not yet a second live blocker in
code today**, and this document corrects an early overstatement of it made
during drafting (see the adversarial challenge, §4, point 1, and the
response there): `lib/analyzer/verdict.ts`'s actual four branches never
check a `PROFILE NOT CONFIRMED` condition explicitly — the function checks
only `trust.status === "UNUSABLE"` and the three `fairValueRange.kind`
cases. For both MSFT and OKLO today, `deriveVerdict` already returns
`INCOMPLETE` via a different branch before any such check would matter, and
`docs/m9-real-company-validation-findings.md` lines 65–71 assert the
automatic run's `verdict.reason` is **identical** to the pre-M9-1,
human-confirmed run's reason — i.e., PROFILE NOT CONFIRMED changes nothing
observable for either real company today. The honest classification (§6
below) is that §10.6.3's third rendering condition is a **real spec
requirement not yet implemented as a distinct `deriveVerdict` branch** — a
standing, non-policy implementation gap for whichever future outcome
completes M8, not a live blocker today, and not something this outcome
should add (`verdict.ts` must stay byte-identical here).

### 1.4 MSFT and OKLO, precisely, today

Re-verified at `d35870b`:

- **MSFT.** Leverage `PASS` (net debt ratio ≈0.81%), trust `PARTIAL`,
  `fairValueRange.kind === "range"` (bear $265.00, bull $650.00, price
  $499.70 — 60.96% of the way from bear to bull). Input A is real. The
  achieved side of Input B is real and clean: 13.79% ten-year CAGR
  (FY2016→FY2026), 14.57% five-year, single-tag, §3.7-clean
  (`docs/m8c-calibration-findings.md` §3) — but this figure is **not wired**
  into `AnalysisResult` (confirmed: no reference to
  `achievedRevenueCagr`/`calibration/inputs` anywhere in `assemble.ts`
  today). The *required* side of Input B is not merely unwired — it is
  **structurally NOT COMPUTABLE**: all nine reverse-DCF cells return
  `NOT COMPUTABLE — "RONIC not meaningful for this company (§7.2 M5
  ladder)"` (`lib/analyzer/modules/reverseDcf.ts:187–199`,
  `reverseDcfOnRealRun.test.ts:25–69`), because MSFT's trailing five-year
  invested-capital or NOPAT change is non-positive — a real fact about this
  company's fundamentals, independent of the missing wiring, and it would
  still fire after wiring is added. Traced directly in `assemble.ts:508–520`:
  this per-cell suppression is pushed with `scope: "the affected reverse-DCF
  cell"`, explicitly hardcoded regardless of cause — confirmed **not** to
  remove the fair-value range (matching the observed real
  `fairValueRange.kind === "range"`), resolving what would otherwise look
  like a contradiction between `lib/analyzer/suppression.ts`'s
  `RONIC NOT MEANINGFUL` → `"the diagnostic reverse DCF"` scope entry (used
  for a different, run-level state this code path never emits) and the
  per-cell reality.
- **OKLO.** Never reaches §10.6.2. Leverage `LEVERAGE UNSUPPORTED IN v1`
  (zero §4.4-taggable non-operating-investment candidates, plus an
  independently missing `treasury-method-dilution` tag), trust `UNUSABLE`,
  `fairValueRange.kind === "suppressed"`. Closing this needs new
  capture/EDGAR acquisition, which this outcome's HARD BOUNDS forbid.

---

## 2. Practitioner evidence

Every claim below is attributed to a named, citable source.

1. **Reverse-DCF implied growth is practitioner-standard as a sanity check
   on price, never as the sole basis for a buy/sell conclusion.**
   Aswath Damodaran (NYU Stern), whose valuation notes and teaching are the
   most widely cited practitioner reference for implied-expectations
   analysis, teaches that "every market price is already a DCF" and that a
   reverse DCF "makes those latent assumptions explicit and falsifiable" —
   the investor's job is then to judge whether the *implied* growth rate is
   reasonable against the company's own demonstrated growth, not to treat
   the comparison as a mechanical verdict.
   ([Aswath Damodaran, DCF valuation notes, NYU Stern](https://pages.stern.nyu.edu/~adamodar/pdfiles/eqnotes/dcfallOld.pdf);
   secondary summaries: [Wall Street Prep, "Reverse DCF Model"](https://www.wallstreetprep.com/knowledge/reverse-dcf-model/),
   [Investing.com Academy, "Reverse DCF: A Smart Way to Decode Stock Valuations"](https://www.investing.com/academy/analysis/reverse-dcf-definition/).)
   This is directly relevant: Cal Finance's Input B is exactly this
   comparison (implied growth vs. achieved growth), and the practitioner
   literature treats it as *one diagnostic to interrogate*, not as a
   self-sufficient decision rule — consistent with §10.6.2's own refusal to
   let either input decide alone.

2. **The CFA Institute curriculum treats implied-growth/implied-return
   analysis as a diagnostic technique, layered onto other evidence, not as
   a standalone classifier.** The CFA Level I/II curriculum covers deriving
   an implied growth rate or implied required return from a model and a
   market price (Gordon growth, residual-income implied growth), explicitly
   framing it as "revealing whether a stock is priced for perfection or for
   pessimism" — a question-generating tool, not an output-generating one.
   ([CFA Institute, "Discounted Dividend Valuation," Refresher Reading, 2026](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/discounted-dividend-valuation);
   [AnalystPrep, "The Implied Dividend Growth Rate," CFA Level II](https://analystprep.com/study-notes/cfa-level-2/the-implied-dividend-growth-rate/);
   [AnalystPrep, "Implied Growth Rate in Residual Income," CFA Level II](https://analystprep.com/study-notes/cfa-level-2/implied-growth-rate-in-residual-income/).)

3. **Morningstar's published equity-research methodology is the closest
   real-world precedent for setting decision bands without per-company
   statistical calibration** — and it is instructive precisely because Cal
   Finance's own authority chain has already rejected its structural shape.
   Morningstar's margin-of-safety requirement (the discount to fair value
   needed to earn a 5-star rating, or the premium that earns 1 star) widens
   as the analyst's own confidence in the fair-value estimate falls, on a
   five-tier Uncertainty Rating (Low/Medium/High/Very High/Extreme) — e.g.
   a 20% discount for 5 stars at Low uncertainty widening to a 75% discount
   at Extreme uncertainty. The rating is seeded by a quantitative measure
   (trailing 12-month return volatility) and then finalized by **analyst
   overlay** — a human judgment, recorded once per company, not a per-run
   computation. ([Morningstar, "An Introduction to the Morningstar
   Uncertainty Rating"](https://www.morningstar.com/stocks/an-introduction-morningstar-uncertainty-rating);
   [Morningstar Equity Research Methodology (PDF)](https://www.morningstar.com/content/dam/marketing/shared/research/methodology/705988Morningstar_Equity_Research_Methodology.pdf).)
   **This precedent is evidence about *how* practitioners set bands under
   thin calibration (structured, analyst-owned, periodically reset — never
   invented in-line by the software), not evidence for a specific numeric
   band, and not a license to reuse its structure directly**: Morningstar's
   rating is a **single-diagnostic** system (price vs. one fair-value
   estimate) precisely of the kind Calvin's 17 Sep 2026 ruling already
   forbids for Cal Finance. It is cited here only as evidence for the
   *calibration process*, never as evidence for adopting a single-diagnostic
   verdict — see the adversarial challenge (§4, point 7) for why even the
   process analogy needs a caveat Cal Finance cannot yet meet.

4. **Deterministic, auditable, multi-signal conjunctive scoring — the
   general shape §10.6.2 already takes — has a direct, well-established
   practitioner/academic precedent: Piotroski's F-Score.** Joseph Piotroski
   (Stanford GSB), "Value Investing: The Use of Historical Financial
   Statement Information to Separate Winners from Losers" (*Journal of
   Accounting Research*, 2000), built a nine-signal binary score from
   already-reported financial-statement facts, explicitly choosing
   simplicity over probability-model estimation, and found it separated
   high- and low-quality value stocks (a documented 13.4%-per-year gap for
   high-F-Score value stocks over the value quintile). This is evidence
   that a deterministic, reproducible, no-model combination rule over
   already-computed facts — §10.6.2's whole design philosophy — is a
   credentialed, precedented approach, independent of whether any
   *particular* numeric threshold within it is yet defensible.
   ([Piotroski F-Score, Wikipedia summary of the 2000 paper](https://en.wikipedia.org/wiki/Piotroski_F-score);
   [StableBread, "How to Identify Financially Strong Companies With the
   Piotroski F-Score"](https://stablebread.com/piotroski-f-score/).)

---

## 3. External research

1. **The reliability of an implied-versus-achieved growth gap as a decision
   input is genuinely contested in the literature — which bears directly on
   whether Input B, even where computable, is a reliable classifier at any
   fixed threshold.** The closest-studied relative, the PEG ratio
   (price/earnings ÷ growth — the same "is the market paying for more
   growth than the company can show" question, in ratio rather than gap
   form), has mixed empirical support. Easton (2003) found PEG-based
   ranking more reliable than plain P/E ranking; Sareewiwatthana (2012)
   found PEG-based portfolios outperforming in emerging markets — but
   Schnabel (2009) directly challenged the universal applicability of any
   single PEG benchmark value, arguing that firm-specific growth risk and
   sector dynamics materially change what the "right" ratio should be, and
   other research finds plain P/E more directly related to returns than PEG
   in some samples. (Summarized with citations in the arXiv working paper
   ["A growth adjusted price-earnings ratio"](https://arxiv.org/pdf/2001.08240)
   and the [PEG ratio Wikipedia summary of the academic literature](https://en.wikipedia.org/wiki/PEG_ratio).)
   **This is evidence against, not for, rushing to any single universal
   §10.6.2 gap threshold even once observations exist** — the literature's
   own message is that context (sector, growth stage) conditions how a
   growth-gap should be read, which argues for caution in exactly the
   direction Candidate 3 in §5.2 below gestures toward, and against
   pretending a bare handful of calibration companies could settle it.

2. **Cooke's classical model is the recognized decision-science method for
   defensibly setting a threshold under genuinely scarce empirical data —
   and it requires machinery Cal Finance does not have.** Roger Cooke's
   "classical model" of structured expert judgment (Cooke, 1991;
   summarized and updated in Colson & Cooke, *Review of Environmental
   Economics and Policy*, 2018) validates expert judgments by testing them
   against **seed/calibration questions with known true values** before
   weighting their judgments on the real unknowns — used in 30+ real
   regulatory applications, and empirically shown to out-perform simple
   equal-weighting of experts. ([Colson & Cooke, "Expert Elicitation: Using
   the Classical Model to Validate Experts' Judgments"](https://strathprints.strath.ac.uk/62172/8/Colson_Cooke_REEP_2018_Expert_elicitation_using_the_classical_model_to_validate_experts_judgments.pdf);
   [Research Outreach summary](https://researchoutreach.org/articles/structured-expert-judgment-using-classical-method/).)
   This is cited as evidence that "ask a human, once, to set a policy
   constant" is not an evasion of methodology — it is itself a named,
   validated, rigorous methodology, when done with real seed questions. The
   adversarial challenge (§4) correctly presses on whether Cal Finance can
   actually construct valid seed questions for this domain today; §5.2
   records that answer honestly rather than assuming the precedent
   transfers cleanly.

3. **General statistical decision theory counsels against calibrating a
   hard cut-point from zero, or very few, observations.** Small-sample
   shrinkage methods (beta-binomial and empirical-Bayes approaches) exist
   specifically because a threshold or rate estimated from a handful of
   observations is dominated by noise unless deliberately pulled toward a
   population baseline — with common rules of thumb requiring on the order
   of tens of observations before an entity's own data outweighs a prior at
   all. ([Overview: "Bayesian Shrinkage Scoring: Finding Real
   Under-performers in Noisy Metrics"](https://medium.com/@aminroudaki/bayesian-shrinkage-scoring-finding-real-under-performers-in-noisy-metrics-f0df1a205a89).)
   Zero observations is not a hard case for this family of methods — it is
   the degenerate case where there is nothing to shrink *toward the data*
   at all, only the prior itself, dressed as a calibration. This is
   independent, general statistical confirmation of `docs/m8c-calibration-findings.md`
   §1's own conclusion that recommending a threshold on the current
   evidence "would be the Appendix B failure performed deliberately."

---

## 4. Independent strong-model adversarial challenge — recorded verbatim, with responses

Per SCOPE item 4, the emerging recommendation was put to an independent
model instance, adversarially, before this document was finalized. Its
full challenge is recorded below verbatim (spelling/formatting as
delivered), followed by this document's response to each numbered point.
Points 1 and 2 below caused this document's problem statement (§1.3, §1.4)
to be rewritten; nothing in the challenge went unanswered.

> **1.** The primary finding misses the blocker that matters most. In the
> normal flow the position cannot render under the spec as written,
> whatever the inputs are. Spec §10.6.3 renders the position only if
> "PROFILE NOT CONFIRMED is not active." ... So on every normal-path run,
> for every company, including a hypothetical one where both inputs were
> perfect, §10.6.2 is suppressed before any band or disagreement rule is
> consulted. ... It is a conflict between two of Calvin's own rulings, and
> it is his to resolve.
>
> **2.** The draft gets MSFT's status wrong. It says MSFT "has a real,
> computable price-location input" ... RONIC NOT MEANINGFUL is a §9.3
> suppressing state. `lib/analyzer/suppression.test.ts` asserts "RONIC NOT
> MEANINGFUL removes the range" ... So MSFT is blocked at least three times
> over ... Calling the price-location input "real" invites the reader to
> see MSFT as half a verdict away. It is not.
>
> **3.** The primary finding's own "dependency chain" breaks hard
> constraint 5 and never says so. Two of its five items are human steps
> under the spec: §4.4's non-operating-investments judgment ... and Step 7
> scenarios ("an act of authorship"). ... The chain as presented cannot be
> completed within ticker-in/report-out.
>
> **4.** Candidate 1 manufactures policy from silence by replacing
> observations with opinions. §10.6.2 says the cross-horizon threshold
> question "must be answered from observations rather than assumed." ...
> Calibrated expert elicitation is aggregated judgment, not observation.
>
> **5.** Candidate 1's Cooke model cannot work as described, because the
> seed questions it needs do not exist. ... For "is this company
> CHEAP/FAIR/EXPENSIVE," the only ground truth is realised forward returns,
> years later. That is a backtest, not a seed question. ... Without a
> gradable answer the performance weighting collapses to equal weighting,
> and the method reduces to exactly "get a human to eyeball it."
>
> **6.** Candidate 1 creates a standing dependency the product may never
> discharge. Its trigger is "once enough real companies clear both inputs."
> ... "Enough" is not defined, and defining it would itself be a numeric
> policy constant.
>
> **7.** Candidate 1 misuses its Morningstar analogy. Morningstar's
> Uncertainty Rating is reset by analysts who own and author the ratings,
> backed by a large covered universe and a long record of realised
> outcomes. Cal Finance has neither.
>
> **8.** Candidate 1's use of PEG-ratio literature argues against itself.
> ... If [the growth-gap literature] is contested, the literature is also a
> reason to doubt that §10.6.2's Input B is a reliable verdict input at
> all. ... Either the evidence bears on Input B's validity ... or it does
> not bear on anything.
>
> **9.** Candidate 2 settles an arbitrary 1-of-9 choice on thin,
> unevidenced grounds. "Practitioner reverse-DCF writing conventionally
> reports a single base-case figure" cites no specific source ... Practitioners
> report a base case for communication, not because the base cell is the
> statistically right input to a threshold rule.
>
> **10.** Candidate 2 also closes off legitimate alternatives without
> saying so ... such as requiring all nine cells to agree in direction, or
> using the grid's range. ... Also, the draft admits Candidate 2 unblocks
> nothing reachable today, so it is not the "smallest defensible decision."
>
> **11.** Candidate 3 violates §10.6.2 fixed rule 1 outright and should be
> struck, not ranked third. Rule 1 says "No per-company adjustment, no
> override." A tolerance that varies with each run's trust status ... is a
> per-company adjustment of the disagreement rule by definition.
>
> **12.** Candidate 3 is incoherent when Input B is absent, and every
> reachable case today has Input B absent. ... Candidate 3 either does
> nothing (INCONCLUSIVE regardless), or ... becomes price-location-alone in
> all but name.
>
> **13.** Candidate 3 inverts the Morningstar logic it cites. Morningstar
> widens the margin of safety as uncertainty rises, which makes a rating
> **harder** to reach. Any "tolerance widening" with degraded trust makes
> agreement **easier** to reach.
>
> **14.** Candidate 3 fails the draft's own new-scope test, and so, less
> obviously, does Candidate 1. ... Candidate 1 is new verdict-synthesis
> policy about how verdict policy is set. The draft never tests it against
> [Calvin's] ruling [forbidding new verdict-synthesis policy].
>
> **15.** The primary finding is right in direction but becomes an evasion
> because it is paired with three candidates. ... Ranking three methodology
> candidates beneath that finding signals that a methodology decision is
> nearly framable. That is a confident claim the evidence does not support.
> It also gives a later session an anchor to implement Candidate 1 or 2
> "because the research recommended it."
>
> **16.** Overall verdict: the draft is over-engineered relative to the
> honest answer. ... Present the evidence and these gaps, name the
> structural conflicts as CALVIN REQUIRED questions, and drop Candidates
> 1–3. At most, keep Candidate 2 as a one-line note ... with no recommended
> answer.

### Responses

**On 1 (PROFILE NOT CONFIRMED) — accepted as a real finding, corrected on
scope.** The spec requirement is real and is now stated in §1.3. But traced
directly in code (`lib/analyzer/verdict.ts`'s four branches), it is **not**
a live second blocker today: the function never checks a PROFILE NOT
CONFIRMED condition, and `docs/m9-real-company-validation-findings.md`
lines 65–71 assert the automatic run's `verdict.reason` is identical to the
pre-automation, human-confirmed run's reason for both companies. This is
not "a conflict between two of Calvin's rulings" requiring
`STOP: RECONCILIATION REQUIRED` — M9-1 explicitly anticipated and accepted
this exact consequence when it was ruled (*"the §10.6.3 position
suppression all behave exactly as they did"*, §14.8, quoting the ruling
itself), so it is a known, already-ruled trade-off, not a fresh conflict.
What is genuinely new and worth naming: §10.6.3's third condition is **spec
law with no corresponding code branch yet** — a real, non-policy
implementation gap for whichever future outcome builds out M8 (§6).

**On 2 (MSFT's status) — the "range suppressed by RONIC" claim does not
hold under this code; corrected with the trace.** `suppression.test.ts:74`
tests `stateRemovingFairValueRange` against a synthetic top-level
`"RONIC NOT MEANINGFUL"` state entry — a state `lib/analyzer/assemble.ts`'s
actual per-cell loop (`:508–520`) never emits: it pushes `cell.fiveYearGrowth.state`
(which `reverseDcf.ts:190` sets to `"NOT COMPUTABLE"`, not
`"RONIC NOT MEANINGFUL"`) with `scope: "the affected reverse-DCF cell"`
**hardcoded**, explicitly commented *"never the grid and never the range"*.
This matches the repeatedly-reconfirmed real-run observation
(`fairValueRange.kind === "range"` for MSFT, across three independent
reconciliations at three different commits) rather than contradicting it.
The point that Input A being "real" invites the reader to think MSFT is
"half a verdict away" is fair and is corrected: §1.4 now states plainly
that MSFT is blocked by a structural, non-fixable §7.2 M5 finding on the
required-growth side, independent of wiring, independent of bands, and (per
point 1's resolution) not currently affected by profile confirmation either
— MSFT is not close to a verdict on any axis a ruling could move.

**On 3 (the dependency chain requires human steps) — accepted, and
narrowed rather than dropped.** §4.4's classification and Step 7's
scenario authorship are human acts under the frozen spec (`docs/frozen/...:273,402`
"software flags it; the human confirms"; `:129` "an act of authorship").
Recommending these be done "at scale" as a live, per-user-run prerequisite
would indeed contradict M9-1. This document does not recommend that. The
distinction that matters: a **one-time, off-path research/calibration
exercise** — recording a handful of companies' §4.4 judgments and
Step 7 bundles once, as `docs/m8c-calibration-findings.md`'s own M8-c pass
already did for MSFT and OKLO, to build a calibration set — is not a
per-run human step in the product's normal path; it is the same kind of
work M8-c already did and that this document is analyzing, not proposing
afresh. What is honestly, permanently true, and is now stated as its own
finding rather than folded into a "dependency chain" that implies it will
someday finish: **the live, per-user ticker-in→report-out path has no
mechanism for Step 7 authorship on an arbitrary entered ticker today, and
none is proposed here** — so §10.6.2 may remain structurally unreachable
for most companies a user might actually enter, independent of any bands
ruling, for as long as that remains true. That is a product/engineering
question for a different outcome, not a methodology finding this one can
resolve, and it is named rather than smoothed over.

**On 4 (manufacturing policy from silence) — accepted as the correct
standard, and Candidate 1 is re-labeled accordingly.** §10.6.2's own text
is unambiguous that the horizon-pooling question "must be answered from
observations rather than assumed," and the same standard should be read
onto the bands generally. Candidate 1 is not a numeric band — it recommends
a *process* — but the challenge is right that the process still needs to
produce genuine observations, not aggregated opinion dressed as one. §5.2
now states plainly that Candidate 1 is a recommendation to authorize a
**method for producing real calibration questions**, not a substitute for
observations, and is explicit that it is not ready to execute today (point
5's objection, below, is why).

**On 5 (no valid seed questions exist) — accepted in full; this is the
decisive objection against Candidate 1 being actionable now.** Cooke's
classical model requires seed/calibration questions with ascertainable
ground truth. "Which of these companies is cheap" has no such ground truth
on any usable timescale — only realized forward returns, years out. A more
careful version of Candidate 1 could in principle use *historical*,
already-realized price/growth-gap-at-T0 vs. realized-return-at-T0+N cases
as seed questions — but constructing such a set is itself new empirical
work, and this outcome's HARD BOUNDS forbid new financial-data capture.
**Conclusion adopted:** Candidate 1 is not a decision Calvin can rule on
today; it is, at most, a scope note for a future outcome to evaluate,
recorded honestly as such in §5.2 rather than presented as ready.

**On 6 (undefined "enough," itself a numeric constant) — accepted.** Naming
a company count is exactly the kind of number this outcome may not invent.
§5.2 no longer implies "enough" is knowable in advance; it says only that a
threshold constant, if pursued later, is itself Calvin's to set.

**On 7 (Morningstar analogy overreaches) — accepted, and the practitioner
evidence in §2 item 3 is rewritten to state the limitation directly**:
Morningstar's process rests on a covered universe and a long realized-return
record Cal Finance does not have, and its rating is a single-diagnostic
system Calvin has already ruled out structurally. The citation is retained
only as evidence for *how* practitioners structure a calibration process,
not as license to import its numbers or its single-input shape.

**On 8 (the PEG literature cuts against Input B's own validity) — accepted,
and the framing corrected.** §3 item 1 now states this directly: the
literature bears on whether a fixed universal Input-B threshold is
defensible *at all*, not merely on how to phase it in. This is folded into
the primary finding as an additional reason for caution, not left as a
one-sided argument against Candidate 1 alone.

**On 9 and 10 (Candidate 2's cell choice is thin and forecloses
alternatives) — accepted; Candidate 2 is demoted to an open question with
no recommended answer.** The "practitioner convention" citation was a
gesture, not a source, and the challenge is correct that a base case is
reported for communication, not because it is the statistically privileged
cell for a threshold rule. §5.2 now presents the nine-cell ambiguity as a
named open question for Calvin, lists the plausible options (a designated
cell; requiring all nine to agree in direction; reading the grid's range)
without ranking one, and states plainly that resolving it would not
complete a verdict for either real company today regardless.

**On 11, 12, 13 (Candidate 3 is invalid, not merely weak) — accepted in
full; Candidate 3 is withdrawn, not ranked.** §10.6.2 rule 1 ("no
per-company adjustment... not configuration") forecloses a trust-conditioned
tolerance by the frozen spec's own text. Independent of that, the objection
that disagreement-tolerance is not a coherent concept when Input B is
simply *absent* (not merely noisy) is correct and decisive: on every
reachable case today, "widening tolerance" either does nothing
(INCONCLUSIVE either way) or degenerates into exactly the single-diagnostic
verdict Calvin has already forbidden. The Morningstar-direction error
(widening tolerance should track *rising* confidence, not degraded trust)
confirms the idea was not thought through against its own cited precedent.
It is dropped from the ranked list entirely rather than presented as the
"weakest surviving candidate."

**On 14 (Candidate 1 as new verdict-synthesis policy) — accepted as a
required caveat, not a reason to omit the finding.** Calvin's rejection of
#211's PVGO proposal ("do not introduce... any other new verdict-synthesis
finance policy under this lane") and M9-1's "do not reopen finance
methodology, verdict synthesis" both apply to *implementing* new policy
under a live product lane. This document implements nothing; it is the
explicitly-authorized R&D outcome those very rulings said should happen
first, so it is not barred from *naming* a candidate process for Calvin to
weigh — but the challenge is right that Candidate 1's process is itself a
policy-setting mechanism, which is exactly why it is presented in §5.2 as a
question for Calvin's ruling and not adopted as a recommendation to build.

**On 15 and 16 (three ranked candidates overstate how close a decision is)
— substantially accepted; the document's structure is changed accordingly.**
The primary finding is promoted to lead §5 outright, stated without hedging:
no §10.6.2 methodology decision, ruled today, would change either real
company's outcome. Candidate 3 is withdrawn (11–13). Candidate 2 is demoted
to a named open question with no recommended answer (9–10). Only Candidate 1
survives as a labeled, heavily caveated **research recommendation for a
possible future outcome**, explicitly stated as not actionable today
(point 5), so as not to read as "nearly framable." This is closer to, but
not identical to, the challenge's own recommended shape (drop all three
outright) — the remaining half-step is that Candidate 1, precisely *because*
it recommends a calibration **method** rather than a number, does not
violate the "do not invent thresholds" bound the same way Candidates 2 and 3
would have, and SCOPE item 5 asks this document to name candidates "if the
evidence supports more than one" with their evidence for and against, which
this document does honestly rather than by omission — but it is named
clearly as a research question, not as a recommendation that a decision is
close.

---

## 5. Recommendation

### 5.1 Primary finding — no §10.6.2 methodology decision is framable today that would change either real company's outcome

This is stated first because it is what the evidence actually supports, not
as a preface to a methodology recommendation. Three independent facts each
separately sufficient:

1. **MSFT's required-growth input is not a data gap; it is a structural
   fact about the company.** All nine reverse-DCF cells return
   `NOT COMPUTABLE — RONIC not meaningful for this company (§7.2 M5
   ladder)` because MSFT's trailing five-year invested-capital or NOPAT
   change is non-positive. No band, cut-point, disagreement rule, or
   comparator-cell choice changes this. Ruling every open §10.6.2 policy
   question today would still leave MSFT `INCOMPLETE`.
2. **OKLO never reaches §10.6.2.** Its enterprise value is blocked upstream
   by acquisition gaps (§1.4) — closing this needs new EDGAR capture, which
   this outcome's HARD BOUNDS forbid, and no verdict-derivation ruling
   touches it either.
3. **Zero of ten calibration companies produced a usable observation**, so
   any numeric band ruled today would be, in `docs/m8c-calibration-findings.md`'s
   own words, "the Appendix B failure performed deliberately" — confirmed
   independently by general small-sample decision theory (§3 item 3) and by
   Calvin's own 24 Sep ruling forbidding exactly this.

**What would actually have to close first, and its classification:**
non-policy, structural/acquisition work — recording the §4.4 judgment for
more companies, acquiring RONIC's five-year deltas, Command Center ruling
`nopatTaxRate`, and (bounded to a research calibration exercise, not the
live per-user path, per §4's response to point 3) authoring Step 7 bundles
for more companies. None of it is a methodology question this outcome, or
any ruling Calvin could make on this document, resolves.

### 5.2 What was surveyed, ranked, and why nothing here is a recommendation to implement

Two of three originally-drafted candidates did not survive the adversarial
challenge (§4) and are not being offered:

- **Struck outright — a trust-conditioned disagreement tolerance.** Violates
  §10.6.2 fixed rule 1 ("no per-company adjustment... not configuration")
  by the frozen spec's own text, and is incoherent on every case reachable
  today, where Input B is simply absent rather than merely noisy — it
  either does nothing or collapses into the single-diagnostic verdict
  Calvin has already forbidden. Not presented as a weak candidate; presented
  as invalid.

- **Demoted to an open question, no answer recommended — which reverse-DCF
  cell supplies Input B's required-growth figure.** §10.6.2 itself does not
  choose among the nine margin/rate cells. Plausible options exist (a
  designated base cell; requiring all nine to agree in direction; reading
  the grid's range) and none is evidenced strongly enough by anything found
  in this research to rank above the others — the "practitioner convention"
  argument for a single base cell is a communication convention, not a
  statistical justification for a threshold rule, per the challenge (§4,
  points 9–10). Resolving this would not complete a verdict for MSFT (whose
  block applies identically to all nine cells) or OKLO (blocked upstream)
  today regardless. Named here so Calvin can rule on it if useful, without
  this document picking a side.

- **The one candidate offered as a genuine, if distant, research
  direction — a structured, Cooke-style expert-elicitation process to set
  the §10.6.2 bands, once real seed observations exist.** Evidence for:
  Calvin's own ruling already forbids zero-observation bands invented to
  make the mechanism "implementation-ready"; the calibration pass concluded
  the same; Cooke's classical model (§3 item 2) is the recognized,
  validated decision-science method for defensible threshold-setting under
  genuinely scarce data, and it is a one-time, off-run-path exercise (like
  Morningstar's periodic analyst-driven Uncertainty Rating reset), so it
  does not reintroduce a mandatory human step into the normal ticker-in →
  report-out path. Evidence against, decisive for today: valid seed
  questions for this domain (cases with ascertainable ground truth on a
  usable timescale) do not currently exist in Cal Finance's evidence base,
  and constructing them would require new empirical work this outcome's
  HARD BOUNDS forbid. **This document does not recommend Calvin act on this
  today.** It is named because SCOPE item 5 asks for ranked candidates with
  their evidence for and against when more than one exists, and because
  omitting a real, if currently inactionable, research direction would
  itself understate what the practitioner and academic evidence supports.
  If Calvin wants this pursued, the next step is a separate, explicitly
  scoped outcome to design a valid seed-question set — not a ruling on
  numbers.

### 5.3 The narrower, honestly-named tension worth flagging

§10.6.3's third rendering condition (PROFILE NOT CONFIRMED must not be
active) has no corresponding branch in `lib/analyzer/verdict.ts` today
(§1.3, §4 response to point 1). This is not a live blocker for either real
company today, and it is not a methodology question — it is a concrete,
non-policy implementation gap for whichever future outcome completes the
M8 build-out. It is named here, rather than left for that outcome to
discover cold, because it interacts directly with the moment a genuine
§10.6.2 methodology ruling is eventually implemented: that implementation
will need to add the missing branch, or explain why it is not needed, and
this document did not find that reasoning stated anywhere in the current
tree.

---

## 6. Gap classification

Continuing, not repeating, `CF-VERDICT-COMPLETION-RECON-01`'s (#269)
classification, each re-verified at `d35870b`:

| Gap | Classification | Still holds? |
|---|---|---|
| Achieved-growth side (`calibration/inputs.ts:achievedRevenueCagr`) not wired into `AnalysisResult` | **Non-policy** — real, computable, unwired engineering gap | **Yes** — confirmed no reference to it in `assemble.ts` today |
| MSFT's `RONIC not meaningful` suppression | **Non-policy, and not a fixable implementation gap** — a §7.2 M5 structural finding about this company's real fundamentals | **Yes** — `reverseDcf.ts:187–199` and `reverseDcfOnRealRun.test.ts:25–69` unchanged |
| OKLO's EV block | **Non-policy (acquisition)**, out of this outcome's bounds | **Yes** — unchanged; needs new EDGAR capture, forbidden here |
| §10.6.2 bands and disagreement rule | **Policy** — Calvin's, explicitly not to be set on zero observations (his own 24 Sep ruling) | **Yes**, and now further evidenced (§3) rather than merely asserted |
| Which of the nine reverse-DCF cells feeds Input B | **Policy** (a synthesis choice §10.6.2 leaves open) — newly named as its own item, not previously separated from the bands question | New this outcome; unresolved, no answer recommended (§5.2) |
| §10.6.3's PROFILE NOT CONFIRMED condition missing from `deriveVerdict` | **Non-policy** — implementation gap for a future outcome, not live today | New this outcome; not previously stated in one place |
| Whether a five-year and ten-year §10.6.2 threshold can share one band | **Not settled** — `docs/m8c-calibration-findings.md:151` names this "a methodology question for Command Center," and §10.6.2 itself requires evidence, not assumption, before pooling | Unchanged; not addressed further here, as doing so would require the same absent observations |

---

## 7. What this document does and does not do

**Did:** re-verified the current tree at `d35870b`; gathered and cited
practitioner and external evidence; ran a genuine, recorded adversarial
challenge that changed the document's own primary finding and withdrew two
of three draft candidates; classified every gap touched as policy or
non-policy; named one small, real, non-policy code gap
(§10.6.3/`deriveVerdict`) not previously stated in one place.

**Did not:** change `lib/analyzer/verdict.ts` (confirmed byte-identical to
`d35870b` throughout, §1.4/§4); change `lib/analyzer/policy.ts` or add any
`POLICY_THRESHOLD_PROVENANCE` row; introduce any band, cut-point, horizon
rule, or disagreement constant, anywhere, including as a "for now"
placeholder; recommend price-location-alone or PVGO-share-of-EV, in any
form; recommend a model-authored verdict (Candidate 1 is explicitly a
human-elicitation process, never an AI call, and is explicitly not
recommended for adoption today in any case); reopen M8-c's calibration or
run a new one; touch any `docs/frozen/` byte or `FROZEN_HASHES` entry;
touch the merged Analyzer V2 UI; fetch EDGAR or capture new financial data;
write to Notion; or claim Calvin's acceptance of anything.
