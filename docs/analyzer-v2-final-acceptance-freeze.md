# Analyzer V2 — final acceptance / freeze record

**Outcome:** `CF-ANALYZER-V2-FINAL-ACCEPTANCE-FREEZE-01` (issue #333).

**Frozen state:** `origin/master` = `2e870772587d9449c1e1267ed20f40ae726b8d04`
(`CF-ANALYZER-V2-FINAL-REALRUN-PROOF-01`, PR #332). This document records a
status change against that state; it re-derives no figure — every number
below is a pointer into `docs/analyzer-v2-final-realrun-proof.md`, which
reproduced them from the runs themselves, not a re-transcription.

**Authority:** `CALVIN RULING — A`, [PR #332 comment 5842778329](https://github.com/calyeap/Cal-Finance/pull/332#issuecomment-5842778329)
(2026-09-26T03:28:38Z), answering the OWNER final-acceptance gate
([comment 5842578864](https://github.com/calyeap/Cal-Finance/pull/332#issuecomment-5842578864)).
This ruling **narrows** Calvin's 24 Sep 2026 condition
([issue #210 comment 5807320616](https://github.com/calyeap/Cal-Finance/issues/210#issuecomment-5807320616)),
narrowed by its own author, not reinterpreted here. Recorded as
`docs/product-decisions.md` item 25 and `docs/acceptance-matrix.md` row 11
(Analyzer V2 half).

**In one sentence:** the product accepted here produces a complete
real-company report and **no BUY/HOLD/SELL position, for any company,
until M8 lands.**

## What is accepted

Analyzer V2's shipped UI and data pipeline, as independently reproduced at
`2e87077` by `docs/analyzer-v2-final-realrun-proof.md` across three real
companies (MSFT, OKLO, NVDA): the unified `/analyzer/[runId]` route and its
seven-tab rail (`app/analyzer/[runId]/page.tsx`), the shared
`AnalyzerReportFrame` shell, the automatic acquire → verify → compute
pipeline (`lib/analyzer/autoRun.ts`), and every diagnostic/state-handling
surface `docs/acceptance-matrix.md` rows 3–10 and 15 already record as
`IMPLEMENTED`. This grants **Analyzer V2**, not M9 as a whole milestone —
see "What this does not grant" below.

## The known limitation — recorded plainly and permanently

Every real run at `2e87077`, and every foreseeable run until M8 lands,
shows a dominant `INCOMPLETE` verdict:

- MSFT: `INCOMPLETE`, cause `COMPARATOR_NOT_YET_AVAILABLE`
  (`docs/analyzer-v2-final-realrun-proof.md`, MSFT table, `deriveVerdict(result)` row).
- OKLO: `INCOMPLETE`, cause `LEVERAGE UNSUPPORTED IN v1` cascade (same
  document, OKLO table).
- NVDA: `INCOMPLETE`, same `LEVERAGE UNSUPPORTED IN v1` cascade (same
  document, NVDA table).

Cause in code: `lib/analyzer/verdict.ts:61-109` — five unconditional
branches (`trust.status === "UNUSABLE"`, `range.kind === "suppressed"`,
`range.kind === "pre-revenue-distribution"`, `PROFILE NOT CONFIRMED`
active, otherwise `COMPARATOR_NOT_YET_AVAILABLE`), every one returning
`INCOMPLETE`; no branch computes a position of any kind
(`docs/analyzer-v2-final-realrun-proof.md` §2, "Row 13 — `deriveVerdict` is
still unconditional"). This is an **accepted, permanently recorded known
limitation pending M8** — not a claim that verdict completion is solved,
and not a silent waiver.

## What stays parked

- **No new `AnalystSuppliedRange` capture.**
- **No Steps 2/3/5/6 completion work in Analyzer V2.**
  `docs/verdict-methodology-reconciliation.md` §11 items 2–7
  (`verdict-methodology-reconciliation.md:1296-1417`) remain open and
  unimplemented; item 1's shape question is closed
  (`verdict-methodology-reconciliation.md:1278-1294`) but its capture
  question stays open (`docs/verdict-decision-pack.md` §1). Item 8 alone is
  closed (`CALVIN RULING — B`, `verdict-methodology-reconciliation.md:1440-1451`).
- **The two `PROVISIONAL` Step 4 tier boundaries**
  (`lib/analyzer/policy.ts:157-177`, `docs/product-decisions.md` item 24) —
  still labelled non-governing, still read by no valuation, position, gate
  or verdict computation (re-verified fresh at `2e87077`'s immediate
  predecessor by `docs/analyzer-v2-final-realrun-proof.md` §4's grep: zero
  non-test hits for `.tier` under `lib/` or `app/`, and the only
  non-test hits for `forecastDispersion` are the field being written and
  its `unknown` type). This freeze does not validate, retire, or promote
  either boundary, and no consumer may begin reading `tier` or
  `forecastDispersion` under this outcome.
- **`docs/verdict-decision-pack.md`'s own drafted options** (and the three
  options `docs/analyzer-v2-final-realrun-proof.md` itself drafted) are not
  adopted by this freeze — row 11's condition was narrowed by Calvin
  directly (`CALVIN RULING — A`), not by choosing option (a), (b), or (c)
  from either draft.

## What is deferred to M8

`docs/acceptance-matrix.md` row 13 — `deriveVerdict` / §10.6.2's growth
comparator — stays `OPEN`, blocked on M8's comparator and on §11's
remaining house-policy items (row 13's own cell, unedited by this outcome).
Design-contract §8 items 2 and 4 (`docs/acceptance-matrix.md` row 14) stay
dispositioned, not closed (unedited by this outcome). Verdict completion
belongs to M8 unless a new explicit Calvin ruling reopens it
(`CALVIN RULING — A`'s own last sentence).

## What this does not grant

- **Not M9 as a whole milestone.** `docs/m9-acceptance-record.md`'s own
  whole-milestone finding is unchanged and not rewritten by this outcome;
  `docs/acceptance-matrix.md` row 11's whole-milestone half of its STATUS
  cell states this explicitly.
- **Not row 12** (V1.5 presentation polish, #118 item 12) — #118 gates that
  item on accepted M9 as a whole milestone, which this ruling does not
  grant; row 12 is not started, planned, or authorised by this record.
- **No number, band, cut-point, or `POLICY_THRESHOLD_PROVENANCE` entry** —
  none is added anywhere by this outcome. In particular, no
  CHEAP/FAIR/EXPENSIVE band is set, proposed, or sketched.
- **No settled ruling is reopened** — the unconditional `INCOMPLETE`
  verdict (FINAL OWNER RULING #205), price-location-alone, PVGO as a
  verdict input, ruling C's shape closure, `CALVIN RULING — B` on §11 item
  8, OPTION 1, the finance-lease nesting limitation (`NONE FOR NOW`, #311),
  the *ticker in → report out* path, and the merged V2 UI's locked design
  contract all stand exactly as they were.

## On "freeze"

Freezing here means recording the accepted state, not manufacturing a new
frozen artefact under `docs/technical-specs.md`'s "Current implementation
contract" / `docs/frozen/` + `FROZEN_HASHES` convention. That convention
exists to pin an *implementation contract* (a spec or methodology snapshot
code is checked against for byte-consistency) — see
`scripts/evidence/config.ts`. This record is a decision/status document,
the same class as `docs/m9-acceptance-record.md` and
`docs/nvda-realrun-observation.md`, neither of which is hash-registered
either; it requires no new `docs/frozen/` artefact or `FROZEN_HASHES` entry,
and none is added. `docs/frozen/` is left byte-untouched by this outcome.

## Evidence of record (cited, not rewritten)

- `docs/analyzer-v2-final-realrun-proof.md` — the fact set: every figure
  above is reproduced there, not re-derived here.
- `docs/m9-acceptance-record.md` — whole-milestone PASS/FAIL findings,
  unaffected by this freeze.
- `docs/m9-real-company-validation-findings.md` — MSFT/OKLO real runs.
- `docs/nvda-realrun-observation.md` — NVDA's real run.
- `docs/verdict-methodology-reconciliation.md` §11, §12 — the parked
  house-policy items and their evidence requirements.
- `docs/verdict-decision-pack.md` — the drafted, not-adopted, decision
  options.
- `docs/acceptance-matrix.md` row 11 — the acceptance-matrix record of this
  same grant.
- `docs/product-decisions.md` item 25 — the settled-decision record of this
  same grant.
