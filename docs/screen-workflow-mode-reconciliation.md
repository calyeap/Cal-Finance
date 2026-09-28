# SCREEN workflow mode — reconciliation

**Outcome:** `CF-SCREEN-LANE-RECON-01` (issue #373).

**This is a definition/reconciliation outcome, not a SCREEN implementation.**
No SCREEN capability — route, page, component, schema, migration, provider,
capture, scheduled job, alert, or monitoring implementation — is introduced
here. Unlike the UPDATE (`docs/update-workflow-mode-reconciliation.md`) and
PORTFOLIO REVIEW (`docs/portfolio-review-workflow-mode-reconciliation.md`)
reconciliations this document is patterned after, **this one cannot reach a
stable job definition from current authority** — see §1. Where those two
documents used `AI DEFAULT`s to narrow open sub-questions once each
capability's core job was already independently anchored, no equivalent
anchor exists for SCREEN's core job, so this document ends with `CALVIN
REQUIRED` rather than a proposed first implementation outcome.

## 0. What was read

`docs/product-roadmap.md` in full; `docs/product-decisions.md` (all 25
items); `docs/CURRENT-AUTHORITY.md`; `AGENTS.md`;
`docs/update-workflow-mode-reconciliation.md` in full;
`docs/portfolio-review-workflow-mode-reconciliation.md` in full;
`docs/acceptance-matrix.md` rows 17–18; `DESIGN.md`; and a repository-wide
grep for `SCREEN` (13 files matched — see §1 for the disposition of each) —
at `origin/master` = `ad14e2b`.

## 1. What SCREEN is

**Current authority names SCREEN in exactly one place, with no accompanying
definition beyond its position in a sequence.** `docs/product-roadmap.md:37-38`
(§1, V2 delivery order): *"bounded proof → M9 → UPDATE → PORTFOLIO REVIEW →
SCREEN → monitoring."* That is the entire textual content current authority
provides for SCREEN. Contrast with UPDATE and PORTFOLIO REVIEW, both of
which had this same delivery-order mention **plus** independent anchors that
let their reconciliations narrow a real job: UPDATE sat unambiguously between
a single-company report (M9) and a cross-company view (PORTFOLIO REVIEW),
and product-decisions item 15's one-company boundary corroborated a
single-company reading; PORTFOLIO REVIEW was independently named, twice
more, in the canonical capability sequence (`docs/product-roadmap.md:45-46`:
*"Foundation → Stock Analysis → Portfolio Review → Calvin Decides"*) and in
product-decisions items 15–16.

**SCREEN has no equivalent corroborating anchor anywhere in current
authority:**

- It does **not** appear in the canonical capability sequence
  (`docs/product-roadmap.md:45-46`).
- It does **not** appear in the capability dependency table
  (`docs/product-roadmap.md:47-49`: *"Foundation → Analyzer → Research
  Memory → Sector Intelligence → What Changed → Portfolio Review → Decision
  Logic → Action Candidates → Calvin"* — the chain runs from Portfolio
  Review straight to Decision Logic / Action Candidates / Calvin, skipping
  SCREEN entirely).
- It does **not** appear in the capability-class priority gate
  (`docs/product-roadmap.md:62-70`, §3 — Research Memory, Sector
  Intelligence, What Changed?, Portfolio Review, post-mortem/learning loop,
  BTC rule, systematic research, methodology onboarding, congressional-
  trading signal; no SCREEN entry).
- No item in `docs/product-decisions.md` (all 25 items read) names SCREEN,
  a screening job, a candidate-evaluation job, or anything that reads as a
  definition of it.
- `DESIGN.md`'s four "screen" hits (`:171-181`) are the ordinary UI sense of
  the word (a page/step of a wizard flow — "one `<h1>` naming the screen or
  step"), unrelated to the SCREEN workflow mode.
- The remaining grep hits for `SCREEN` in code and other docs
  (`scripts/evidence/gates.ts`, `scripts/evidence/config.ts`'s
  `SCREEN1_MARKUP_MARKER`, `lib/analyzer/ai/traceability.ts`'s prose use of
  "reaches the screen," `docs/frozen/calboard-stock-analyzer-v1-spec.md:1547`'s
  "FOUR SCREENS" heading, `docs/frozen/calboard-stock-analyzer-v1-design.md`,
  `docs/frozen/mock-human-steps.html`) are all the Analyzer wizard's
  UI-screen terminology (Screen 1 = ticker entry, etc.) — a different,
  unrelated sense of "screen," read and confirmed unrelated, not silently
  promoted as evidence for the SCREEN workflow mode.
- `docs/acceptance-matrix.md`'s one hit (row 18, `:69`) is the same
  `docs/product-roadmap.md:37-38` delivery-order phrase, quoted, not a new
  fact.

**Conclusion:** beyond "SCREEN is a named, distinct V2 delivery-order item
sitting after PORTFOLIO REVIEW and before monitoring," **what job SCREEN
actually does is UNRESOLVED by current authority.** This is not a case where
an important *sub-question* about an otherwise-anchored capability is
unresolved (as with UPDATE's snapshot-contract dependency or PORTFOLIO
REVIEW's own version of the same question) — it is the capability's entire
substantive definition that is unresolved. Reading a specific job into the
bare name ("stock screener," "idea generator," "ranking table," "watchlist,"
candidate-company evaluation, or anything else) would be inventing a richer
capability because the name sounds obvious, which the issue instructs
against. See §6/§7.

## 2. What SCREEN is explicitly not

What current authority *can* establish, without knowing SCREEN's job, is
what it cannot be — because these constraints bind any new Cal Finance
capability regardless of shape, or because the scope has already been
assigned elsewhere:

- **Not autonomous trading or an action generator.** No automatic
  BUY/ADD/TRIM/SELL of any kind (`docs/product-decisions.md` items 4, 17).
- **Not a universal score or ranking.** No cross-company confidence score,
  screening score, or single ranked "best/worst" output (items 5, 17).
- **Not price- or momentum-triggered.** No streaming tape, ticking figure,
  or mover-driven attention loop; price freshness ≠ information freshness
  (item 18; `docs/product-roadmap.md:98-102`, §6).
- **Not an authoring surface for portfolio-policy numbers.** No target
  weight, cap, rebalance rule, band, cut-point, or threshold (item 14).
- **Not the Analyzer redesigned.** Stock Analyzer stays one-company only —
  no portfolio fit, sizing, cross-company state or ranking is added inside
  it to serve SCREEN (item 15).
- **Not PORTFOLIO REVIEW.** PORTFOLIO REVIEW already owns the cross-company,
  portfolio-level review of *existing holdings*
  (`docs/portfolio-review-workflow-mode-reconciliation.md` §1). SCREEN
  cannot silently absorb that scope — the delivery order names them as two
  distinct, sequenced items (`docs/product-roadmap.md:37-38`).
- **Not monitoring.** Monitoring is a separately named, later delivery-order
  item (`docs/product-roadmap.md:38`); nothing here proposes any scheduled
  job, alert, or background watcher, and SCREEN may not absorb that scope
  either merely by being adjacent to it in the sequence.
- **Not Research Memory, Sector Intelligence, or What Changed?.** These are
  named, separate items in the capability dependency table
  (`docs/product-roadmap.md:47-49`) and the priority gate (§3) — supporting
  research/context capabilities SCREEN may read from once they exist
  (§3 below), but does not own or reimplement.
- **Not Decision Logic or Action Candidates.** These are later
  decision-support layers in the same dependency table, downstream of
  Portfolio Review. SCREEN must not silently become recommendation/action
  machinery under cover of being a "screening" step.

## 3. Boundaries against adjacent capabilities

For each capability the issue names, what SCREEN may read from it (once
SCREEN's own job is defined) and what it must never own:

- **PORTFOLIO REVIEW** — may read the same position-level facts PORTFOLIO
  REVIEW already reads from `lib/portfolio.ts`'s `getPortfolioView()`
  (symbol, quantity, cost basis, market value, weight) if and only if
  SCREEN's eventual job is shown to need portfolio context; must never own
  cross-company review of *existing holdings* — that is PORTFOLIO REVIEW's
  job by name and by `docs/product-decisions.md` items 15–16.
- **Monitoring** — may, once monitoring exists, potentially consume
  whatever monitoring watches as an input signal; must never itself become
  a scheduled watcher, alert, or background job — no such machinery may be
  introduced under this or a future SCREEN outcome without a separate,
  explicit Calvin gate (this document's own HARD BOUNDS forbid it outright).
- **Research Memory / Sector Intelligence / What Changed?** — these sit
  upstream of Portfolio Review in the capability dependency table
  (`docs/product-roadmap.md:47-49`) and are themselves unbuilt (no code
  reference to any of the three exists in this repository beyond planning
  prose — confirmed by the grep in §0). SCREEN may, once built, consume
  whatever they eventually produce as supporting context; it must never
  reimplement their own research/context-gathering job.
- **Decision Logic / Action Candidates** — later decision-support layers,
  also unbuilt, downstream of Portfolio Review. SCREEN must never become a
  substitute recommendation or action-candidate surface; any candidate
  advisor-briefing content (why-it-appeared, strongest reason not to act,
  remaining checks, uncertainty — `docs/product-roadmap.md:50-52`) belongs
  to Action Candidates by name, not to SCREEN.
- **Analyzer** — one-company analysis remains one-company only
  (`docs/product-decisions.md` item 15). SCREEN may, if its job turns out to
  involve per-company output at all, read an existing Analyzer report the
  same narrowly-scoped way PORTFOLIO REVIEW does
  (`lib/analyzer/runStore.ts`'s `getLatestRunForHeldTicker`); it must never
  add portfolio-fit, sizing, cross-company state, or ranking inside the
  Analyzer itself.

## 4. Existing data reality

Independent of which job Calvin selects for SCREEN (§6), the following is
what the current codebase actually provides, read directly rather than
assumed:

- **Position-level data exists and needs no new capture.**
  `lib/portfolio.ts`'s `getPortfolioView()` already computes symbol,
  quantity, cost basis, current price, market value, and allocation weight
  for every current holding — the same data PORTFOLIO REVIEW's first
  outcome reused unchanged (`docs/portfolio-review-workflow-mode-reconciliation.md`
  §4, §6; `lib/portfolioReview.ts`).
- **Per-company Analyzer reports exist, but only for three fixture-backed
  companies.** The acquire → verify → compute pipeline
  (`lib/analyzer/autoRun.ts`) and the recorded-bundle acquisition path
  (`lib/analyzer/acquisition/recordedBundles.ts`,
  `lib/analyzer/acquisition/companyInputs.ts`) support real runs only for
  MSFT, OKLO, and NVDA today — the three companies with committed captures
  (`docs/m9-real-company-validation-findings.md`,
  `docs/nvda-realrun-observation.md`). There is **no general "run any
  ticker" capability**: acquiring a new company's data requires new capture
  work outside this outcome's HARD BOUNDS (the same limitation
  `docs/acceptance-matrix.md` row 10 already records for NVDA's own gaps).
  This matters materially for any SCREEN reading that would require
  evaluating companies **not already captured** — that reading cannot be
  served by existing data without new acquisition/provider work, which is a
  genuine Calvin gate in its own right, separate from and in addition to
  the job-definition question in §6.
- **No watchlist, candidate-list, or screening-criteria schema exists**
  anywhere in this repository (grepped; no migration or table name matches
  any of these concepts).
- **No new background scheduler, monitor, or controller exists or is implied
  by any of the above** — nothing currently in the codebase performs
  anything resembling continuous screening or watching.

## 5. Deterministic vs AI judgement split

The issue asks for this split to be stated "for any proposed first SCREEN
shape." **No first shape is proposed in §7**, because SCREEN's job itself is
undefined (§1) — classifying steps of an undefined job as deterministic vs.
AI judgement vs. external dependency would itself be inventing the job's
shape, which is exactly what this reconciliation is instructed not to do.
What can be stated now, independent of the job: whichever shape SCREEN
eventually takes, `docs/product-decisions.md` items 5 and 17 (no confidence
score, no universal action score, no universal score of any kind) already
forbid any scoring or ranking step from being classified as a "deterministic
calculation" that SCREEN is free to compute — any comparison-across-companies
output would need to stay within the same non-scoring, non-ranking posture
PORTFOLIO REVIEW's first outcome already demonstrated is achievable (named
`REVIEW`/`WITHIN_CAP` states, never a score — `lib/portfolioReview.ts`).

## 6. Unresolved questions

- **SCREEN's core job (the material one).** Current authority names SCREEN
  only as a V2 delivery-order sequence position
  (`docs/product-roadmap.md:37-38`) and nowhere else (§1). Whether SCREEN
  means evaluating candidate companies not currently held, re-filtering or
  re-checking something about existing holdings PORTFOLIO REVIEW does not
  already cover, a data-quality or completeness gate ahead of monitoring,
  or something current authority does not name at all, is a genuine
  product decision that materially changes the first useful job, the data
  SCREEN would depend on (§4), and the deterministic-vs-AI split (§5). This
  is recorded as unresolved and raised as `CALVIN REQUIRED` (§8) rather than
  defaulted, because — unlike UPDATE's or PORTFOLIO REVIEW's own open
  sub-questions, each resolved as an `AI DEFAULT` against an already-settled
  core definition — there is no settled core definition here for a default
  to narrow.
- **The "four workflow modes" count — still unanswered, and further
  complicated by this outcome's own finding.**
  `docs/product-roadmap.md:26-27` states *"Four workflow modes, kept
  distinct rather than collapsed into one generic surface"* without naming
  them. `docs/update-workflow-mode-reconciliation.md` §3 and
  `docs/portfolio-review-workflow-mode-reconciliation.md` §5 both recorded
  this as unanswered given five delivery-order items (bounded proof/M9,
  UPDATE, PORTFOLIO REVIEW, SCREEN, monitoring) against "four." This
  reconciliation adds a further complication rather than resolving it:
  SCREEN — one of the five delivery-order candidates — does not appear in
  either of the other two sequencing statements current authority gives
  (the canonical capability sequence, `docs/product-roadmap.md:45-46`, and
  the capability dependency table, `:47-49`), while PORTFOLIO REVIEW appears
  in all three and UPDATE's identity is independently corroborated outside
  the delivery order. This asymmetry is recorded as evidence, not resolved
  here — it does not by itself answer which four items are the "workflow
  modes," and it is not this outcome's authority to decide by assumption.

No authority conflict exists (no two current sources state incompatible
things about SCREEN) — the problem is absence of definition, not
contradiction, so `STOP: RECONCILIATION REQUIRED` does not apply.

## 7. First bounded SCREEN implementation outcome — not proposed

**Current authority cannot honestly support proposing one bounded first
SCREEN outcome**, because the job the outcome would bound is itself
undefined (§1, §6). Proposing a shape now — even a narrow one — would mean
choosing, on this outcome's own initiative, which of several materially
different jobs SCREEN is, which the issue's DECISION HORIZON reserves to
Calvin when the choice "materially changes the first useful job." Once
Calvin answers §8's question, a future reconciliation update (on this same
document, per BUILD's correction/resume convention) or a fresh outcome can
propose the first bounded SCREEN implementation, subject to the same
constraints already binding every other V2 lane: smallest useful first
capability, no new background scheduler/monitor/controller, no new database
unless the chosen job truly cannot exist without one, no autonomous
trade/action output, no new score or ranking, and reuse of the fixture-bound
data reality recorded in §4 unless Calvin's answer itself authorises new
capture.

## 8. Roadmap update

**Not made.** Per the issue's SCOPE item 7, a `docs/product-roadmap.md`
section is added only if this reconciliation yields a stable definition
supported by current authority. It does not (§1, §6) — forcing a "SCREEN
workflow mode — reconciled definition" section here would misstate the
state of authority the same way inventing a job for SCREEN would. The
unresolved boundary is recorded in this document instead, as instructed.

## `CALVIN REQUIRED`

`CALVIN REQUIRED: docs/product-roadmap.md:37-38 names SCREEN only as a V2
delivery-order sequence position between PORTFOLIO REVIEW and monitoring —
it does not appear in the canonical capability sequence, the capability
dependency table, the capability-class priority gate, or any
product-decisions.md item (§1), so no existing authority defines what job it
does. Which job is SCREEN: (A) evaluating candidate companies not currently
held, using the existing Analyzer pipeline as a pre-portfolio-entry step
(would additionally require new acquisition/provider work beyond the three
fixture-backed companies — §4 — as its own separate gate); (B) some other
cross-company or single-company job not yet named by current authority
(name it); or (C) SCREEN has no settled job yet and should be left
unopened/unnamed in the delivery order until a real investment job requires
it? The answer determines the first bounded SCREEN outcome's data
dependencies (§4) and deterministic-vs-AI split (§5), which this
reconciliation cannot honestly default.`
