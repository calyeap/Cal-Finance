# UPDATE workflow mode — reconciled definition

**Outcome:** `CF-UPDATE-LANE-RECON-01` (issue #335).
**Authority:** `CALVIN RULING — OPTION B`, 26 Sep 2026
([PR #334 comment 5842994023](https://github.com/calyeap/Cal-Finance/pull/334#issuecomment-5842994023)):
*"Open UPDATE as the next Cal Finance product capability lane… Proceed with
the smallest bounded UPDATE outcome under the current roadmap and existing
authority."*

**This is a definition and reconciliation document, not an implementation.**
No UPDATE capability — route, page, component, schema, migration, job, or
analyzer change — is introduced here. Per the issue's DECISION HORIZON, the
defaults taken below are the smallest reversible defaults under SIMPLE
FIRST; nothing here claims more than a definitional narrowing from existing
authority. Recorded as `docs/product-roadmap.md` §7.

## 0. What was read

`docs/product-roadmap.md` §1–§3, §6 in full; `docs/analyzer-v2-final-acceptance-freeze.md`;
`docs/CURRENT-AUTHORITY.md`; `docs/product-decisions.md` (all 25 items);
`docs/design/analyzer-v2-design-authority.md`; and
`docs/frozen/calboard-stock-analyzer-v1-design.md:90-129`, at
`origin/master` = `632b413`.

## 1. What UPDATE is

UPDATE is the workflow mode that lets an analyst **explicitly initiate a
fresh look at a company Cal Finance has already produced a report for**,
once new evidence exists worth checking against — the step between a first
Analyzer report (M9) and a portfolio-level view of holdings (PORTFOLIO
REVIEW) in the V2 delivery order (`docs/product-roadmap.md:37-38`: *"bounded
proof → M9 → UPDATE → PORTFOLIO REVIEW → SCREEN → monitoring"*). It is a
single-company, analyst-initiated re-look, not a portfolio-wide or
automatic one (`docs/product-decisions.md` item 15 — Stock Analyzer is
one-company only — continues to bound it; PORTFOLIO REVIEW, the next lane,
is where cross-company state belongs).

## 2. What UPDATE is explicitly not

- **Not a refresh control.** It does not add a "price has moved since this
  analysis" indicator, a live-updating report, or any action that mutates
  or supersedes an existing report artefact in place. See §6 below.
- **Not a re-run-with-same-facts shortcut.** It does not let an analyst
  regenerate a report without going through a genuine per-fact decision
  pass again. See §6 below.
- **Not price- or momentum-triggered.** Nothing in UPDATE may let price
  movement alone drive attention or action
  (`docs/product-roadmap.md:99-100`, §6; `docs/product-decisions.md` item 18).
  No streaming tape, notification, or alerting surface is any part of this
  definition.
- **Not a run index, history list, retrieval UI, or listing endpoint.**
  `docs/frozen/calboard-stock-analyzer-v1-design.md:125-127` (ruling R7,
  6 Sep 2026, "settled, not a default awaiting confirmation") already
  forecloses this for the Analyzer surface UPDATE extends; nothing in this
  reconciliation reopens it.
- **Not verdict-completion, M8, or BUY/HOLD/SELL work.** `docs/product-decisions.md`
  item 25 and `docs/analyzer-v2-final-acceptance-freeze.md` hold: no
  BUY/HOLD/SELL position, for any company, until M8 lands. UPDATE producing
  a new report still produces whatever verdict the current pipeline
  produces today (`INCOMPLETE`, dominant, per the freeze record) — UPDATE
  does not change verdict semantics.
- **Not PORTFOLIO REVIEW or SCREEN.** UPDATE names a boundary against them;
  it does not absorb any of their scope (issue #335 HARD BOUNDS 5).

## 3. Which of the four workflow modes UPDATE is

`docs/product-roadmap.md:26-27` states *"Four workflow modes, kept distinct
rather than collapsed into one generic surface"* without naming them. The
V2 delivery order (`docs/product-roadmap.md:37-38`) names UPDATE,
PORTFOLIO REVIEW and SCREEN as distinct sequenced items after M9, and
"monitoring" as a further item after SCREEN — five named items across
{bounded proof / M9 (the existing Analyzer capability), UPDATE, PORTFOLIO
REVIEW, SCREEN, monitoring}, against "four workflow modes." Authority does
not state which four of these are the "workflow modes" (whether the
original Analyzer capability counts as one, whether monitoring is a fifth
mode or a background function of one of the other four, or whether
"bounded proof" and "M9" are the same mode under two names). **This is
recorded as unanswered**, per the issue's instruction to record it as such
rather than assume either way. It does not block the rest of this
definition: UPDATE's scope and boundary do not depend on resolving the
count.

## 4. What UPDATE depends on

- **An existing accepted Analyzer report to revisit.** UPDATE has no
  meaning without a prior report for the same company — it is downstream
  of M9/Analyzer V2 (`docs/analyzer-v2-final-acceptance-freeze.md`), which
  is accepted and frozen as of 26 Sep 2026.
- **The snapshot contract**, once defined. `docs/product-roadmap.md:31-33`
  names a *"defined, stable snapshot boundary that later stages (Portfolio
  Review, monitoring) can depend on without re-deriving upstream state."*
  UPDATE is not named in that sentence's "later stages" list, but sits
  between M9 and Portfolio Review in the same delivery order — whether
  UPDATE itself depends on the snapshot contract, or instead produces a
  fresh run each time independent of it, is not settled by authority and
  is left to the first bounded implementation outcome (§7) to narrow, not
  assumed here.
- **The existing acquire → verify → compute pipeline** (`lib/analyzer/autoRun.ts`,
  per `docs/analyzer-v2-final-acceptance-freeze.md`) — UPDATE re-uses it
  rather than requiring a new one, per SIMPLE FIRST.

## 5. How UPDATE satisfies §6

`docs/product-roadmap.md` §6 (anti-noise / anti-momentum): no streaming
tape or mover-driven attention loops; price freshness ≠ information
freshness; no analysis/surface/signal that doesn't materially improve a
core decision job. UPDATE satisfies this by construction under §2 above:
it is analyst-initiated, not price- or time-triggered; it carries no
notification, alert, or "stale" indicator that could function as an
attention loop; and it costs the same genuine per-fact decision pass as a
first run, which is precisely the anti-momentum mechanism §6 protects (see
§6 below).

## 6. The `:110` / `:125` tension — reconciled

`docs/frozen/calboard-stock-analyzer-v1-design.md:110`: *"The run does not
refresh. A report is an artefact produced at a moment… There is no
refresh control, no 'price has moved since this analysis' indicator, and
no re-run-with-same-facts shortcut. The cost of re-running is Step 2
again, and that cost is the anti-momentum mechanism. It must not be
optimised away."* `:125`: *"There is no index of runs, no history list, no
retrieval UI and no listing endpoint."*

**The question:** does this constraint (a) belong to surface-scoped V1
legacy the V2 lane supersedes, (b) bind UPDATE as a live constraint, or
(c) genuinely conflict with a delivery order that sequences UPDATE at all?

**What supersedes the frozen V1 document, and what it covers.**
`docs/CURRENT-AUTHORITY.md:46-55` routes "Current Analyzer V2
implementation-facing design contract" to
`docs/design/analyzer-v2-design-authority.md`, and states plainly:
*"Existing Portfolio/Holdings visuals,
`docs/design/m9-analyzer-design-contract.md`, and older frozen Analyzer
design artefacts remain legacy/surface-scoped evidence only and cannot
override the current Analyzer V2 contract or linked visual pack."*
`docs/design/analyzer-v2-design-authority.md:193` names the exact document:
*"`docs/frozen/calboard-stock-analyzer-v1-design.md` and frozen mock HTML
files are historical/current-at-source implementation evidence only. They
cannot override Analyzer V2."*

Both statements are scoped, by their own text and their place in a
document titled "design contract" / "Design Authority," to the **design/
visual/shell contract fact class** — screen layout, component hierarchy,
navigation chrome, the seven-tab shell. Neither statement mentions, or by
its wording reaches, product-behavior rules the same frozen document
happens to also state in the same section. `:110` and `:125` are not
design/visual claims — they describe workflow behavior (whether a report
can be regenerated cheaply) and a data-surface decision (no listing
endpoint), not layout.

**That same behavioral principle is independently current authority.**
`docs/product-roadmap.md` §6 (`:96-102`, part of the current, cutover-authorised
roadmap, no supersession claim against it exists anywhere in scope) states:
*"Price freshness is not the same as information freshness — do not let
price movement alone drive attention or action."* `docs/product-decisions.md`
item 18 (`:66-68`, current, unsuperseded) restates the same principle:
*"Market-data posture: EOD-first… no streaming tape, flashing prices, or
mover-driven attention loops; price freshness ≠ information freshness."*
Neither of these citations is frozen, legacy, or design-scoped — both are
part of the currently authoritative roadmap/decisions fact classes this
very outcome is instructed to reconcile into.

**Conclusion: (b), reconciled without conflict.** The frozen V1 document's
own authority over `:110`/`:125` is superseded for **design-contract**
purposes only — Analyzer V2's actual shell, routes and tab structure do
not need to match the V1 spec's route table. But the anti-momentum
*principle* `:110` encodes — no refresh shortcut, re-running costs a real
Step 2 pass, price movement alone does not drive action — survives
independently as current authority via roadmap §6 and decisions item 18,
regardless of the frozen document's own status. It therefore **binds
UPDATE as a live constraint**, sourced from current authority, not from
the frozen document. `:125`'s no-index/no-history-list rule is likewise
still binding under R7's explicit "settled, not a default awaiting
confirmation" status (`:127`), independent of anything design-scoped.
There is no genuine conflict with a delivery order that sequences UPDATE:
UPDATE can exist as "analyst decides to look again, pays the same Step 2
cost, gets a new report artefact" without needing a refresh control, a
history list, or a price-triggered indicator of any kind. No `STOP:
RECONCILIATION REQUIRED` is warranted.

## 7. First bounded UPDATE implementation outcome — implemented

**Outcome:** `CF-UPDATE-FIRST-OUTCOME-01` (issue #337), authorised under
`CALVIN RULING — OPTION B` (26 Sep 2026,
[PR #334 comment 5842994023](https://github.com/calyeap/Cal-Finance/pull/334#issuecomment-5842994023)).

What this section originally proposed is what was built, unchanged in
shape: a single new entry point — **"Look at this company again"**,
surfaced from an existing completed report (`AnalyzerReportFrame`, next to
the existing "Save this version" action) — that starts a **brand-new**
Analyzer run for the same company identity (skipping only Screen 1's ticker
resolution, since the company is already confirmed) while still requiring
the full Screen 2 per-fact spot-check pass unchanged, producing a new,
independent `runId`/report artefact rather than mutating or superseding the
prior one. It reuses the existing acquire → verify → compute pipeline
(`lib/analyzer/autoRun.ts`) and existing data sources verbatim, adds no new
`AnalystSuppliedRange` capture, no run index or history surface (preserving
R7), no notification/alert/scheduled job, and produces whatever verdict the
current pipeline produces today (no BUY/HOLD/SELL requirement, since none is
required or produced by any path today).

**What was built, concretely:**

- `app/actions/analyzer.ts` — `beginUpdateRunAction`, a new server action
  taking only a prior `runId`. It reads that prior run's own server-held
  ticker via `getRun` — never a client-posted ticker or company name — and
  re-resolves it through the same `resolveAnalyzerIdentity` call Screen 1
  uses. Both this action and the existing `beginAnalysisAction` now share one
  `commitAndRunAnalysis(identity)` helper (refuse-if-not-RESOLVED, refuse-if-
  no-fixture, `createRun`, `advanceRunAutomatically`, redirect to the new
  run), extracted verbatim from `beginAnalysisAction`'s prior body — so the
  two entry points cannot drift apart on refusal behaviour or on the
  pipeline they run.
- `app/components/AnalyzerReportFrame.tsx` — a second `<form className="az-
  save">` beside the existing "Save this version" one, posting to
  `beginUpdateRunAction` with this run's own `runId` as its only field.
  Placement follows the smallest-reversible default the design contract
  already accommodates (SCOPE item 4, below) rather than adding a new shell
  region.
- Tests: `app/actions/analyzer.test.ts` (the action's own control flow,
  fully mocked — proves the identity comes only from the prior run's stored
  ticker, never from anything else posted, and that the refusal path is
  shared with `beginAnalysisAction`); `lib/analyzer/updateRunOnRealRun.test.ts`
  (against the real store and the real committed MSFT/OKLO captures — proves
  a re-look gets a distinct `runId`, that the prior run's row/decisions/
  report are untouched, that no fact or judgment is copied forward, and that
  the new run is gated shut until its own automatic pass completes it);
  `app/components/AnalyzerReportFrame.test.tsx` (the button renders, wired to
  this run's id, without disturbing the existing locked shell-order guard).

**SCOPE item 4 — checked against the frozen design contract before
writing it.** `docs/design/analyzer-v2-design-authority.md`'s locked shell
invariants govern the identity row, hero, tab rail and right rail; they say
nothing about the small action row below the tab rail, which already carries
one non-hero, non-tab action ("Save this version", `CF-V2-PROOF-01`). Adding
a second sibling form there is the same accommodated shape, not an amendment
to accepted semantics — no visual pack change, no new shell region, no
change to any locked invariant. No `STOP: RECONCILIATION REQUIRED` applies.

**§4's open question — resolved, `AI DEFAULT`:** UPDATE **produces a fully
independent run**, with no dependency on the snapshot contract
(`docs/product-roadmap.md:31-33`). Concretely: `beginUpdateRunAction` calls
the same `createRun` + `advanceRunAutomatically` pair a first run calls, with
no read of, or write to, anything resembling a snapshot boundary; the only
thing carried from the prior run is the ticker used to re-resolve identity,
which is Screen 1 information, not report content. **Rationale:** this is the
smallest reversible shape under SIMPLE FIRST — it needed no snapshot contract
to exist at all, since none has been defined yet, and defining one here would
have been scope beyond this outcome's SCOPE/HARD BOUNDS. **How to reverse:**
if a later outcome defines the snapshot contract and rules that UPDATE should
key off it instead, `beginUpdateRunAction` is the only touch point — it can
be changed to read from a snapshot rather than from `getRun(priorRunId)`
without touching `AnalyzerReportFrame`'s form, `commitAndRunAnalysis`, or any
existing run's data, since no run created under this outcome depends on a
snapshot in any way that would need migrating.
