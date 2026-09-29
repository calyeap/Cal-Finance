# SCREEN workflow mode — reconciliation

**Outcome:** `CF-SCREEN-LANE-RECON-01` (issue #373).
**Authority:** `CALVIN RULING — SCREEN = OPTION A, DEFINITION NOW; BUILD
NARROWLY LATER`, 28 Sep 2026
([issue #373 comment 5875241672](https://github.com/calyeap/Cal-Finance/issues/373#issuecomment-5875241672)):
*"SCREEN is the pre-portfolio candidate-evaluation capability for companies
Calvin does not currently hold. Its job is to help decide which outside
companies are worth a full Analyzer pass / further portfolio
consideration."*

**This is a definition/reconciliation outcome, not a SCREEN implementation.**
No SCREEN capability — route, page, component, schema, migration, provider,
capture, scheduled job, alert, or monitoring implementation — is introduced
here. Current authority alone (`docs/product-roadmap.md:37-38`'s bare
delivery-order mention, with no corroborating anchor elsewhere — see §1)
could not settle SCREEN's core job; that gap was raised as `CALVIN REQUIRED`
against the original version of this document, and the ruling quoted above
settles it as **Option A**. This update reflects that ruling only. Per the
ruling's own text, it *"settles the definition only"* and does **not**
author or approve a broad screener, ranking engine, watchlist, monitoring
system, provider expansion, acquisition expansion, scoring policy, finance
threshold, or autonomous recommendation layer — those each remain a separate,
explicit future gate. Recorded as `docs/product-roadmap.md` §9.

## 0. What was read

`docs/product-roadmap.md` in full; `docs/product-decisions.md` (all 25
items); `docs/CURRENT-AUTHORITY.md`; `AGENTS.md`;
`docs/update-workflow-mode-reconciliation.md` in full;
`docs/portfolio-review-workflow-mode-reconciliation.md` in full;
`docs/acceptance-matrix.md` rows 17–18; `DESIGN.md`; a repository-wide grep
for `SCREEN` (13 files matched — see §1 for the disposition of each), all at
`origin/master` = `ad14e2b`; plus, for this update, the full comment thread
on issue #373 through and including the `CALVIN RULING` at comment
`5875241672`.

## 1. What SCREEN is

**Settled by `CALVIN RULING` (issue #373, comment 5875241672), not by
textual roadmap anchor.** Unlike UPDATE and PORTFOLIO REVIEW, whose core
jobs were independently corroborated by multiple current-authority sources
(see the original version of this section, preserved in git history), SCREEN
appears in current authority in exactly one place with no accompanying
definition beyond a sequence position: `docs/product-roadmap.md:37-38`,
*"bounded proof → M9 → UPDATE → PORTFOLIO REVIEW → SCREEN → monitoring."*
That gap — SCREEN's absence from the canonical capability sequence
(`:45-46`), the capability dependency table (`:47-49`), the capability-class
priority gate (`:62-70`), and every `product-decisions.md` item — is what
made this a genuine `CALVIN REQUIRED` question rather than an `AI DEFAULT`
narrowing, and is why the answer comes from an explicit ruling rather than
from reading current authority alone.

**The ruling's definition, in full:** SCREEN is **the pre-portfolio
candidate-evaluation capability for companies Cal Finance does not currently
hold**. Its job is to help decide which outside companies are worth a full
Analyzer pass, or further portfolio consideration — i.e. a step that sits
*before* a company would otherwise get a first Analyzer report or be
considered for the portfolio, evaluating candidates from outside the current
holding set. This is Option A of the three the original `CALVIN REQUIRED`
posed (evaluating candidate companies not currently held, using the existing
Analyzer pipeline as a pre-portfolio-entry step).

**What the ruling explicitly does not settle**, stated in its own text and
preserved here rather than read past: it does not author or approve a broad
screener, ranking engine, watchlist, monitoring system, provider expansion,
acquisition expansion, scoring policy, finance threshold, or autonomous
recommendation layer. "Future implementation should begin with the smallest
useful candidate-evaluation job current data can honestly support. Any new
provider/acquisition breadth, screening threshold, ranking rule, score, or
finance/product policy remains a separate explicit gate rather than being
smuggled into this ruling." §7 below proposes exactly one such smallest job,
consistent with that limit.

## 2. What SCREEN is explicitly not

What Option A settles as SCREEN's job also settles several things it is
not, alongside the constraints that bind any new Cal Finance capability
regardless of shape:

- **Not autonomous trading or an action generator.** No automatic
  BUY/ADD/TRIM/SELL of any kind (`docs/product-decisions.md` items 4, 17).
- **Not a universal score or ranking.** No cross-company confidence score,
  screening score, or single ranked "best/worst" output (items 5, 17) —
  explicitly reaffirmed by the ruling's own exclusion list.
- **Not price- or momentum-triggered.** No streaming tape, ticking figure,
  or mover-driven attention loop; price freshness ≠ information freshness
  (item 18; `docs/product-roadmap.md:98-102`, §6).
- **Not an authoring surface for portfolio-policy numbers.** No target
  weight, cap, rebalance rule, band, cut-point, or threshold (item 14).
- **Not the Analyzer redesigned.** Stock Analyzer stays one-company only —
  SCREEN *uses* the existing Analyzer pipeline as its evaluation mechanism
  per Option A, but adds no portfolio fit, sizing, cross-company state, or
  ranking inside it (item 15).
- **Not a general new-ticker acquisition capability.** The ruling is
  explicit that "provider/acquisition breadth" is a separate gate; SCREEN's
  first bounded outcome (§7) must work within whatever companies already
  have real Analyzer data today (§4), not expand that set.
- **Not a watchlist, screening-criteria, or candidate-schema product.** No
  such schema exists today (§4), and the ruling does not authorise one —
  building one is future, separately gated work, not part of the
  definition settled here.
- **Not PORTFOLIO REVIEW.** PORTFOLIO REVIEW already owns the cross-company,
  portfolio-level review of *existing holdings*
  (`docs/portfolio-review-workflow-mode-reconciliation.md` §1); Option A's
  own wording ("companies Calvin does not currently hold") is the mirror
  image of that scope, not an overlap with it.
- **Not monitoring.** Monitoring is a separately named, later delivery-order
  item (`docs/product-roadmap.md:38`); nothing here proposes any scheduled
  job, alert, or background watcher, and the ruling does not authorise one.
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

For each capability the issue names, what SCREEN's first bounded outcome
(§7) may read from it, and what it must never own:

- **PORTFOLIO REVIEW** — evaluates a disjoint company set by definition
  (companies not currently held vs. existing holdings); may read the same
  position data PORTFOLIO REVIEW reads from `lib/portfolio.ts`'s
  `getPortfolioView()` only to determine which symbols are *already held*,
  so they can be excluded from candidate evaluation — never to review or
  re-surface existing-holding content, which stays PORTFOLIO REVIEW's job by
  name and by `docs/product-decisions.md` items 15–16.
- **Monitoring** — may, once monitoring exists, potentially consume
  whatever monitoring watches as an input signal; must never itself become
  a scheduled watcher, alert, or background job — no such machinery may be
  introduced under this or a future SCREEN outcome without a separate,
  explicit Calvin gate (the ruling's own exclusion list forbids it outright
  for this ruling, and this document's HARD BOUNDS forbid it for this
  outcome).
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
  (`docs/product-decisions.md` item 15). Per Option A, SCREEN's first
  bounded outcome reads an existing Analyzer report for a not-currently-held
  company the same narrowly-scoped way PORTFOLIO REVIEW reads a held
  company's report (`lib/analyzer/runStore.ts`'s
  `getLatestRunForHeldTicker` — see §7 for the not-held equivalent); it must
  never add portfolio-fit, sizing, cross-company state, or ranking inside
  the Analyzer itself, and must never trigger a *new* Analyzer run or
  acquisition on SCREEN's own initiative (§2, §4).

## 4. Existing data reality

Independent of the job (now settled, §1), the following is what the current
codebase actually provides, read directly rather than assumed:

- **Position-level data exists and needs no new capture.**
  `lib/portfolio.ts`'s `getPortfolioView()` already computes symbol,
  quantity, cost basis, current price, market value, and allocation weight
  for every current holding — the same data PORTFOLIO REVIEW's first
  outcome reused unchanged (`docs/portfolio-review-workflow-mode-reconciliation.md`
  §4, §6; `lib/portfolioReview.ts`). For SCREEN, this data's only role is
  determining the *held* symbol set to exclude from candidates (§3).
- **Per-company Analyzer reports exist, but only for three fixture-backed
  companies.** The acquire → verify → compute pipeline
  (`lib/analyzer/autoRun.ts`) and the recorded-bundle acquisition path
  (`lib/analyzer/acquisition/recordedBundles.ts`,
  `lib/analyzer/acquisition/companyInputs.ts`) support real runs only for
  MSFT, OKLO, and NVDA today — the three companies with committed captures
  (`docs/m9-real-company-validation-findings.md`,
  `docs/nvda-realrun-observation.md`). There is **no general "run any
  ticker" capability**: acquiring a new company's data requires new capture
  work outside this outcome's HARD BOUNDS and outside the ruling's own
  scope (the same limitation `docs/acceptance-matrix.md` row 10 already
  records for NVDA's own gaps). **This directly bounds §7's proposal**:
  SCREEN's first bounded outcome can only honestly evaluate whichever of
  these three companies are not, at query time, already a current holding —
  it cannot honestly offer to evaluate an arbitrary outside ticker without
  new acquisition/provider work, which the ruling reserves as "a separate
  explicit gate."
- **No watchlist, candidate-list, or screening-criteria schema exists**
  anywhere in this repository (grepped; no migration or table name matches
  any of these concepts), and the ruling does not authorise adding one —
  the first bounded outcome (§7) is read-only and stores nothing new.
- **No new background scheduler, monitor, or controller exists or is implied
  by any of the above**, and the ruling's own exclusion list forbids
  introducing one under this definition.

## 5. Deterministic vs AI judgement split

Stated only as far as current authority — now including the ruling —
supports, for the one first bounded outcome §7 proposes (a read-only
candidate view, no scoring or ranking):

- **Deterministic filter:** identifying the candidate set — companies with
  an existing Analyzer report (`lib/analyzer/runStore.ts`) whose symbol is
  **not** present in `getPortfolioView()`'s current holdings — is a plain
  set-difference computation, not a judgement call.
- **Deterministic display:** surfacing each candidate's already-computed
  Analyzer report fields (thesis narrative, business/evidence content, risk
  flags, verdict state) is direct reuse of existing computed output, the
  same posture PORTFOLIO REVIEW's first outcome already took toward
  per-company Analyzer content.
- **No AI judgement or synthesis is introduced by this proposal.** The
  first bounded outcome adds no new AI call, prompt, or model-driven
  synthesis of its own — it reuses whatever judgement the Analyzer pipeline
  already produced when that report was generated. Whether a *later* SCREEN
  outcome should add cross-candidate AI synthesis is not decided here.
- **External/unresolved dependency:** evaluating a candidate not already
  captured (i.e. not one of the three fixture-backed companies) is not
  supported by current data and is explicitly out of scope per §4 and the
  ruling's own "separate explicit gate" language — not classified as
  deterministic or AI judgement because it cannot honestly be performed at
  all under this outcome.
- **No new policy number, threshold, score, weighting, band, cut-point, or
  ranking rule** is introduced, consistent with `docs/product-decisions.md`
  items 5 and 17 and the ruling's own exclusion list.

## 6. Unresolved questions

- **SCREEN's core job — now resolved, not unresolved.** The original
  version of this document raised this as `CALVIN REQUIRED`; the ruling
  quoted in the header settles it as Option A. This is recorded here for
  continuity with the original document structure, not because a gap
  remains.
- **The "four workflow modes" count — still unanswered**, and this
  reconciliation adds no new information toward resolving it.
  `docs/product-roadmap.md:26-27` states *"Four workflow modes, kept
  distinct rather than collapsed into one generic surface"* without naming
  them. `docs/update-workflow-mode-reconciliation.md` §3 and
  `docs/portfolio-review-workflow-mode-reconciliation.md` §5 both recorded
  this as unanswered given five delivery-order items (bounded proof/M9,
  UPDATE, PORTFOLIO REVIEW, SCREEN, monitoring) against "four." SCREEN now
  having a settled job does not resolve which four items the roadmap means
  — it remains recorded as evidence, not resolved here, and is not this
  outcome's authority to decide by assumption.
- **Whether any of the three fixture-backed companies (MSFT/OKLO/NVDA) are
  currently held, at any given point in time, is a runtime fact, not a
  document fact.** This reconciliation does not assume an answer either
  way; §7's proposal computes the held/candidate distinction live from
  `getPortfolioView()`, so the candidate list may be empty, all three, or
  anywhere between, depending on actual holdings when it runs. That is a
  correct behaviour of the proposal, not a gap in it.

No authority conflict exists (no two current sources state incompatible
things about SCREEN) — the problem the original document raised was absence
of definition, now resolved by ruling rather than by discovering a
contradiction, so `STOP: RECONCILIATION REQUIRED` did not and does not
apply.

## 7. First bounded SCREEN implementation outcome — proposal only

**This is a proposal for a later, separately authorised dispatch. It is not
authorised by this outcome and must not be started here**, per the ruling's
own instruction ("do not implement that SCREEN outcome here... do not
create a follow-on issue automatically").

The smallest bounded thing that would make SCREEN a real capability under
Option A, SIMPLE FIRST, and the data reality in §4: a single new, read-only
view that lists every company with an existing, already-computed Analyzer
report (`lib/analyzer/runStore.ts`) whose symbol is **not** currently present
among the caller's own holdings (`lib/portfolio.ts`'s `getPortfolioView()`),
and for each such candidate shows the same already-computed Analyzer report
content PORTFOLIO REVIEW already links to for held companies — thesis
narrative, business/evidence content, risk flags, and the existing verdict
state (honestly labelled `INCOMPLETE` where that is what the pipeline
produced, per §5) — so an analyst can decide whether a candidate is worth a
first full look or further portfolio consideration, which is exactly the
job Option A names. It would deliberately exclude: any new ticker
acquisition, provider, or capture capability beyond the existing
fixture-backed set; any new watchlist, candidate-list, or screening-criteria
schema or write path; any cross-company score, ranking, or synthesized
judgement of any kind; any new AI call or model-driven synthesis beyond
reusing already-computed Analyzer output; any BUY/HOLD/SELL content; any
scheduled job, alert, or background watcher; any new policy number, band,
cut-point, or threshold; and any change to the existing Dashboard, Holdings,
Analyzer, PORTFOLIO REVIEW, or setup-wizard routes. The decision to dispatch
this, or any other shape, is a later OWNER routing step per the ruling's own
"do not create a follow-on issue automatically" instruction — not a Calvin
gate, and not started by this outcome.

## 8. Roadmap update

**Made.** Per the issue's SCOPE item 7, a `docs/product-roadmap.md` section
is added only if this reconciliation yields a stable definition supported
by current authority. The `CALVIN RULING` quoted in the header now supplies
that stable definition, so a concise `SCREEN workflow mode — reconciled
definition` section has been added as `docs/product-roadmap.md` §9, after
PORTFOLIO REVIEW (§8), following the same pattern (no current-status
marker, no `NOW`/`NEXT` execution position, no task queue, no claim that the
proposed first implementation in §7 above is already authorised or landed).
