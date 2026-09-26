# PORTFOLIO REVIEW workflow mode — reconciled definition

**Outcome:** `CF-PORTFOLIO-REVIEW-LANE-RECON-01` (issue #350).
**Authority:** `CALVIN RULING — LIFT OPTION E`, 26 Sep 2026
([issue #349](https://github.com/calyeap/Cal-Finance/issues/349)): *"Resume Cal
Finance product continuation from current native GitHub authority and the
current roadmap… Based on the previously returned product gate, **PORTFOLIO
REVIEW is the expected next lane**."*

**This is a definition and reconciliation document, not an implementation.**
No PORTFOLIO REVIEW capability — route, page, component, schema, migration,
job, holdings capture, or analyzer change — is introduced here. Per the
issue's DECISION HORIZON, the defaults taken below are the smallest
reversible defaults under SIMPLE FIRST; nothing here claims more than a
definitional narrowing from existing authority, following the shape
precedent `docs/update-workflow-mode-reconciliation.md` set for the UPDATE
lane (issue #335 / PR #336). Recorded as `docs/product-roadmap.md` §8.

## 0. What was read

`docs/product-roadmap.md` §1–§3, §6, §7 in full; `docs/product-decisions.md`
(all 25 items); `docs/update-workflow-mode-reconciliation.md` in full;
`docs/analyzer-v2-final-acceptance-freeze.md`; `docs/CURRENT-AUTHORITY.md`;
`DESIGN.md`; `docs/design/analyzer-v2-design-authority.md`; the existing
Portfolio-era code — `lib/portfolio.ts`, `lib/holdings.ts`,
`app/actions/holdings.ts`, `app/components/DashboardHoldingsTable.tsx`,
`app/components/HoldingsShell.tsx`; `docs/acceptance-matrix.md` (grepped for
any existing Portfolio Review row — none exists; row 17 is UPDATE); and, as
historical/frozen evidence only (not restated as current authority),
`docs/frozen/calboard-stock-analyzer-v1-spec.md:79,1377,1409-1424` and
`docs/frozen/calfinance-methodology-v2.md:1-8,394-416` — at `origin/master`
= `3911833`.

## 1. What PORTFOLIO REVIEW is

PORTFOLIO REVIEW is the **cross-company, portfolio-level review step** in the
canonical capability sequence Foundation → Stock Analysis → Portfolio Review
→ Calvin (`docs/product-decisions.md` item 16; `docs/product-roadmap.md:45-46`
restates the identical chain). It is the step between a company already
having a Stock Analyzer report (M9, and now UPDATE re-looks) and a Calvin
decision — the smallest definition current authority actually supports, not
the most capable one imaginable. It is exactly the cross-company view that
`docs/product-decisions.md` item 15 (*"Stock Analyzer is one-company only —
no portfolio fit, sizing, cross-company state or ranking inside the
Analyzer"*) explicitly excludes from the Analyzer itself: PORTFOLIO REVIEW is
where that excluded cross-company concern belongs, not the Analyzer. It sits
immediately after UPDATE and before SCREEN in the V2 delivery order
(`docs/product-roadmap.md:37-38`: *"bounded proof → M9 → UPDATE → PORTFOLIO
REVIEW → SCREEN → monitoring"*), and appears again, independently, in the
capability dependency table (`docs/product-roadmap.md:47-49`: *"Foundation →
Analyzer → Research Memory → Sector Intelligence → What Changed → Portfolio
Review → Decision Logic → Action Candidates → Calvin"*) and in the priority
gate's capability-class list (`docs/product-roadmap.md:65`).

Consistent, corroborating historical evidence (not itself binding, since
`docs/frozen/calboard-stock-analyzer-v1-spec.md` is superseded-for-design-
purposes legacy evidence per `docs/CURRENT-AUTHORITY.md:53-55`): that frozen
v1 spec independently named the identical boundary — *"Portfolio fit and
Portfolio Review are out of scope for v1"* (`:79`), listed "Portfolio Review
and Portfolio Intelligence" among the not-built-in-v1 exclusions (`:1409-
1413`), and named "Portfolio fit and Portfolio Review, in any form... See
§1.4" as an additionally-excluded settled boundary (`:1420-1423`). This is
the same one-company-only boundary current authority (item 15) states
independently; there is no tension to reconcile here (unlike the `:110`/
`:125` tension the UPDATE document resolved), since both the frozen and the
current source agree.

## 2. What PORTFOLIO REVIEW is explicitly not

- **Not autonomous trading or an action generator.** No automatic
  BUY/ADD/TRIM/SELL of any kind (`docs/product-decisions.md` item 17; item 4
  — *"REVIEW ≠ automatic action"*).
- **Not a universal score or ranking.** No cross-company confidence score or
  single ranked "best/worst holding" output (items 5, 17).
- **Not a price- or momentum-triggered surface.** Nothing in PORTFOLIO REVIEW
  may let price movement alone drive attention or action, and no streaming
  tape, ticking figure, or mover-driven attention loop is any part of this
  definition (item 18; `docs/product-roadmap.md:98-102`, §6).
- **Not an authoring surface for portfolio-policy numbers.** No target
  weight, cap, rebalance rule, band, cut-point, or threshold is set, proposed
  or sketched here or by a first implementation under this definition — that
  belongs to INVESTING, a separate project (item 14; see §4 below).
- **Not SCREEN, monitoring, Research Memory, Sector Intelligence, What
  Changed?, Decision Logic, Action Candidates, or any other later
  delivery-order item.** PORTFOLIO REVIEW names a boundary against them; it
  does not absorb any of their scope (`docs/product-roadmap.md:37-38,47-49`;
  issue #350 HARD BOUNDS 5).
- **Not a replacement for, or an extension of, the existing Dashboard /
  Holdings / setup-wizard monitoring surfaces.** See §3.
- **Not verdict-completion, M8, or new BUY/HOLD/SELL work**, and it does not
  reopen the accepted, frozen `INCOMPLETE`-by-default state
  (`docs/analyzer-v2-final-acceptance-freeze.md`; item 25; FINAL OWNER RULING
  #205). See §4.

## 3. Reconciliation against the existing Portfolio-era surfaces

**Two distinct capabilities of the same name-adjacent domain exist in this
repository's authority, and they must not be conflated.**

The existing Dashboard (`/`), Holdings (`/holdings`) and setup wizard
(`/accounts/new`) are a **portfolio-value monitoring tool**: `DESIGN.md:31-32`
states plainly *"a private, single-user portfolio monitoring tool"* tracking
*"value, holdings, cost basis, unrealised gain/loss, allocation, data
freshness."* Their data layer is `lib/portfolio.ts`'s `getPortfolioView()`
(positions, market value, cost basis, unrealised P&L, allocation) and
`lib/holdings.ts` (raw quantities feeding the Dashboard table and the
`/holdings` editor). A direct grep of `lib/portfolio.ts`, `lib/holdings.ts`,
`app/actions/holdings.ts`, `app/components/DashboardHoldingsTable.tsx`, and
`app/components/HoldingsShell.tsx` for `runId`/`analyzer`/`Analyzer` returns
zero hits: this money-tracking layer carries no connection whatsoever to the
Analyzer's report/verdict layer today. `DESIGN.md:39-41` states this
surface's own hard behavioural posture: *"Cal Finance describes; it never
prescribes — no suggested actions, no buy/sell/hold framing... State what is
true and stop."*

**PORTFOLIO REVIEW, as named by the roadmap and decisions authority, is a
different capability** — the analysis-layer step in Foundation → Stock
Analysis → Portfolio Review → Calvin (§1 above), necessarily involving
*per-company Analyzer output* (theses, verdicts once M8 lands, evidence)
reviewed across companies, not merely the money figures Dashboard/Holdings
already show. **PORTFOLIO REVIEW therefore does not extend, replace, or
supersede Dashboard, Holdings, or the setup wizard — it is simply distinct
from them.** A first implementation would not need to modify any of the
three existing routes/components; at most it would *read* the same
position-level data `lib/portfolio.ts` already computes (symbol, quantity,
weight, cost basis) as one input among others, without changing what
Dashboard or Holdings display or how they behave.

This distinctness is a genuine boundary worth naming, not a coincidence: the
"describes, never prescribes" posture that governs Dashboard/Holdings
(`DESIGN.md:39-41`) is, independently, also how the roadmap/decisions
authority already constrains any portfolio-level judgement — item 4's *"REVIEW
≠ automatic action"*, item 5's no-universal-score rule, and item 17's
no-autonomous-action rule apply to PORTFOLIO REVIEW on their own terms,
regardless of `DESIGN.md`'s own surface-scoped claim (which, by its own
text at `DESIGN.md:3-10`, governs only the Portfolio surfaces and explicitly
does not extend to "any other surface with no approved design contract yet"
— *"treat that as open, not silently covered"*). Both routes reach the same
non-prescriptive constraint independently, the same structure the UPDATE
reconciliation used for its own `:110`/`:125` analysis — no genuine conflict,
so no `STOP: RECONCILIATION REQUIRED` is needed on this point.

**No design-contract conflict exists either.** `DESIGN.md:3-10` scopes
itself to the three named Portfolio surfaces and explicitly disclaims
authority over anything else; `docs/design/analyzer-v2-design-authority.md:191`
states *"`DESIGN.md` remains the Portfolio-era / Portfolio-surface design
router. It does not govern Analyzer V2."* Neither document claims to govern
a new, distinct PORTFOLIO REVIEW surface — its design contract is simply
**open**, exactly as `DESIGN.md:9-10` anticipates for any surface with no
approved contract yet. This is an open gap, not a conflict between the two
existing authorities, so again no `STOP: RECONCILIATION REQUIRED` is
warranted.

**`AI DEFAULT`:** the relationship above (distinct from, not built on top of,
Dashboard/Holdings/wizard; a first implementation would read existing
position data but change no existing route) is the smallest defensible
reading of `DESIGN.md` and the code as read. **Rationale:** the two
capabilities answer different questions (current money value vs.
cross-company analytical review) and nothing in current authority names one
as subsuming the other. **Reversal:** if a later implementation outcome finds
a concrete reason to surface PORTFOLIO REVIEW content from within the
existing Dashboard route rather than a new one, that is a decision for that
later, separately authorised outcome — this document does not foreclose it,
it only states that no existing surface needs to change to define PORTFOLIO
REVIEW today.

## 4. What PORTFOLIO REVIEW depends on

**The snapshot contract — `AI DEFAULT`, not required to exist for this
definition.** `docs/product-roadmap.md:31-33` names *"a defined, stable
snapshot boundary that later stages (Portfolio Review, monitoring) can
depend on without re-deriving upstream state"* — PORTFOLIO REVIEW is named
explicitly in that sentence, unlike UPDATE (which was not named there and
was resolved, `docs/update-workflow-mode-reconciliation.md` §7, as *not*
depending on the snapshot contract). A repo-wide search confirms the phrase
"snapshot contract" appears nowhere except this roadmap section and the
UPDATE reconciliation document — **no snapshot contract exists in code
today, under any name.** Whether PORTFOLIO REVIEW is blocked on it is
answered here as: **not blocked, for the purposes of this definition.**
Roadmap §1 says later stages *"can depend on"* the snapshot contract, not
that they must; no stage has adopted one yet, since none exists; and the
same reasoning `docs/update-workflow-mode-reconciliation.md` §7 applied to
UPDATE applies with equal or greater force here — PORTFOLIO REVIEW's first
bounded implementation could read directly from existing per-company
Analyzer state and `lib/portfolio.ts` position data, exactly as UPDATE reads
directly from a prior run's own stored ticker (`getRun`) rather than from any
snapshot boundary. **Whether a first PORTFOLIO REVIEW implementation should
instead key off a snapshot, if one is defined by then, is left to that first
bounded implementation outcome to narrow — not assumed here**, consistent
with how the UPDATE lane left, and then resolved, its own version of this
question. **Reversal path:** if a later ruling defines the snapshot contract
and requires PORTFOLIO REVIEW to depend on it, the touch point is scoped
entirely to that first implementation outcome; this definition names no
implementation detail that would need migrating.

**M8 / verdict completion stays deferred — say plainly what this means for
PORTFOLIO REVIEW.** Every real Analyzer run today, and every foreseeable run
until M8 lands, produces a dominant `INCOMPLETE` verdict
(`docs/analyzer-v2-final-acceptance-freeze.md`, "the known limitation";
item 25). A portfolio-level review **can** honestly aggregate and cross-check
facts that do not depend on a completed verdict: position-level facts
already computed today (quantity, cost basis, current price, market value,
allocation weight — `lib/portfolio.ts`'s `getPortfolioView()`), and whatever
qualitative Analyzer content already exists per company (thesis narrative,
business/evidence content, risk flags) where a report exists. A portfolio
review **cannot** honestly offer any BUY/HOLD/SELL-informed synthesis across
holdings, any verdict-based ranking, or any judgement that presumes a
completed verdict — because verdict computation itself returns `INCOMPLETE`
unconditionally for every company today (`lib/analyzer/verdict.ts:61-109`,
cited by `docs/acceptance-matrix.md` row 13). **This gap is not proposed to
be closed here** — closing it belongs to M8, and nothing in this document
or its proposed first outcome (§6) attempts to synthesize a position where
none is supported.

**Item 14's boundary — named plainly, including the uncomfortable
terminology collision.** A portfolio review would need, at minimum, the
target-weight/cap/rebalance-rule inputs `docs/product-decisions.md` item 14
reserves to INVESTING (*"a separate project"*): normal portfolio guideline
(approximately 12–20 stocks), position caps (5% initial, 10% mature),
sector/theme cap (25%), speculative-sleeve limits (5–10%, hard ceiling 10%,
individual position max 3%), and the associated breach semantics (appreciation
above the 10%/25% caps triggers a **review** state, never an automatic trim)
— all currently recorded, as Calvin-approved figures, in the frozen repo
snapshot `docs/frozen/calfinance-methodology-v2.md:399-410`. That same
document's own promotion-boundary text already names this exact consuming
relationship independently of this outcome's authority: *"Portfolio Review is
the consuming capability and remains THEN on the roadmap"*
(`docs/frozen/calfinance-methodology-v2.md:414`) — written before the current
roadmap/decisions cutover, and consistent with it.

**Terminology note, flagged rather than corrected (the file is
byte-untouched, per HARD BOUNDS 8):** `docs/frozen/calfinance-methodology-v2.md:6`
uses "CalFinance" to name the *separate methodology-owning entity* — *"CalFinance
owns finance methodology... Calboard implements approved product-facing
rules"* — legacy, pre-rename terminology from before this repository's own
`CF-SOT-NAMING-CLOSEOUT-01` rename (issue #348, `3911833`) made "Cal Finance"
this **product's** current name and "Calboard" the legacy one. Read literally
today, that sentence would misleadingly suggest this product repo owns its
own portfolio-policy numbers. It does not: per `docs/technical-specs.md:17-24`,
this frozen file is a **repo snapshot for reproducible implementation
evidence only**, whose **semantic owner is the current Cal Finance Methodology
in Notion** — the external, separate entity `docs/product-decisions.md` item
14 now names **INVESTING**. This document's own use of "Cal Finance" follows
item 14's current terminology throughout: **Cal Finance (this product)
consumes and checks these numbers; it never authors or invents them.** A first
PORTFOLIO REVIEW implementation may check a position's weight against these
existing approved caps but must not invent a new cap, band, or threshold of
its own — the same caution item 24 already applies to the Step 4 dispersion
tiers.

**Holdings data — what a first implementation needs, and what already
exists.** Position-level facts (symbol, quantity, cost basis, latest price,
computed market value and weight) already exist and are already produced by
`lib/portfolio.ts`'s `getPortfolioView()`, consumed today by Dashboard and
Holdings — **no new capture is needed for that layer.** What does **not**
exist today is any link between a `positions_current` row and the
corresponding Analyzer `runId`/report for that company — the grep in §3
confirms zero such references anywhere in the Portfolio-era code. Building
that link is implementation work, reserved to the first bounded outcome, not
this document. **No new external data source, provider, external call, or
scheduled job is identified as necessary by this reconciliation** — if a
later, first implementation outcome discovers it needs one, that is a
genuine Calvin gate at that time, not a default taken here.

## 5. The open "four workflow modes" question

`docs/update-workflow-mode-reconciliation.md` §3 left unanswered which of the
"four workflow modes" (`docs/product-roadmap.md:26-27`) UPDATE is, since
authority names five candidate items (bounded-proof/M9, UPDATE, PORTFOLIO
REVIEW, SCREEN, monitoring) against "four," without ever enumerating them or
saying where monitoring fits. The same authority gap applies identically to
PORTFOLIO REVIEW, for the same reason — nothing new resolves it here. **This
is recorded as unanswered, and left open**, exactly as the UPDATE
reconciliation recorded it. It does not block this definition: PORTFOLIO
REVIEW's scope and boundary (§§1–4 above) do not depend on resolving the
count.

## 6. First bounded PORTFOLIO REVIEW implementation outcome — proposal only

**This is a proposal for a later, separately authorised dispatch. It is not
authorised by this outcome and must not be started here.**

The smallest bounded thing that would make PORTFOLIO REVIEW a real capability
rather than a definition, under SIMPLE FIRST: a single new, read-only view
that, for each current holding already surfaced by `getPortfolioView()`,
states its position weight (already computed) alongside the existing
approved concentration policy figures (`docs/frozen/calfinance-methodology-v2.md:399-408`)
and names — never resolves, never trims — a **review** state where a
position's weight exceeds the existing 10% mature-position or 25%
sector/theme caps, consistent with those caps' own "mandatory concentration
review, not automatic trim" semantics; plus, for any holding that already has
an accepted Analyzer report, a plain link to it. It would deliberately
exclude: any new holdings/position capture, source, or provider; any
cross-company score, ranking, or synthesized judgement; any BUY/HOLD/SELL
content of any kind; any write path or mutation of holdings, positions, or
Analyzer data; any new policy number, band, cut-point, or threshold; and any
change to the existing Dashboard, Holdings, or setup-wizard routes. The
decision to dispatch this, or any other shape, is a later OWNER routing
step, not a Calvin gate raised here.
