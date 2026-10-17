# CF-AR2-GOLDEN-HARNESS-01 — PR draft

OUTCOME-ID: `CF-AR2-GOLDEN-HARNESS-01`
TIER: HEAVY

This file is the PR body as executed. The orchestrating session lifts this
into the actual PR description.

## OUTCOME (verbatim restated)

Outside truth before anything is built around the engine: golden facts for
eight companies captured from the presented statements, closed-form
invariants that can fail, all running in CI, and every existing test
classified — so AR3–AR5 have a RED list to turn GREEN.

## PLAN (as actually executed)

**Files, in the order built:**

1. `lib/analyzer/golden/cyclicalSic.ts` — SIC-prefix cyclical/stable
   classifier (harness-only, not wired into production).
2. `lib/analyzer/golden/tagDrift.ts` + `tagDrift.test.ts` — staleness
   detector, run for real against KO's and NVDA's actual row history
   (transcribed verbatim from the fresh SEC captures).
3. Eight golden-fact JSON files, one per ticker, built from fresh SEC
   `data.sec.gov` captures (fetched by this harness for MSFT/OKLO; supplied
   already-fetched for COST/NVDA/NUE/KO/LLY/JPM): `msft.json`, `cost.json`,
   `nvda.json`, `nue.json`, `ko.json`, `oklo.json`, `lly.json`, `jpm.json`,
   plus a schema README.
4. `lib/analyzer/golden/goldenFacts.test.ts` — validates the JSON files'
   own shape/provenance and the structural special cases (OKLO pre-revenue,
   JPM refused, KO's tag-drift decision, the eight-company SIC split).
5. `lib/analyzer/golden/valuationInvariants.test.ts` — the six closed-form
   invariants, run against the real exported `reverseDcf.ts` functions.
6. Test-transition classification of all 124 pre-existing test files:
   `docs/superpowers/plans/ar2-golden-harness-test-transition.md`.
7. This PR draft.

**Order rationale:** classification and drift-detection first (pure
functions, no external data needed to design), then the golden facts they
get validated against, then the invariants (which needed the golden facts'
real numbers for the one cross-company check that uses them), then the
test-transition sweep (needed the invariants file to exist so it could be
excluded from "existing tests"), then this document last.

**Risks identified and how they were handled:**
- *Risk:* golden facts captured from `data.sec.gov` could be subtly wrong
  (wrong tag, wrong period, stale row) without independent confirmation.
  *Handled:* every captured figure carries its real accession number,
  exact period and form type; several are independently cross-checked
  against pre-existing pins already in the repo (MSFT debt 40294000000
  matches `acquisition/acquire.test.ts`; MSFT/NVDA revenue match
  `acquisition/selectTagged.test.ts`) — agreement with numbers this repo
  already trusted, not merely "the API returned a number."
- *Risk:* writing a vitest assertion that happens to match today's
  (possibly wrong) behavior, so a real future fix would silently not be
  caught. *Handled:* every invariant that currently fails is written as
  the DESIRED (correct) assertion wrapped in `it.fails`, never as an
  assertion of the wrong number — if the engine is ever fixed, these start
  failing the suite (confirmed directly: see VERIFY below) and must be
  promoted to plain `it(...)`.
- *Risk:* forcing a result either way instead of reporting what was
  actually observed. *Handled:* every invariant was run for real before
  deciding `it` vs `it.fails`; two findings surfaced that are NOT on the
  issue's own named RED list (the terminal÷year-10-FCF ratio failing
  specifically at the 8% rate cell; the pure-math reproducibility
  invariant PASSING, contradicting a literal reading of "runs not
  reproducible") — both reported plainly below, not silently matched to
  the nearest named item.
- *Risk:* breaking a pre-existing test while building this. *Handled:* no
  existing file was edited; `npx tsc --noEmit` and `npm test` were run
  after every new file to catch any regression immediately (see VERIFY).

**Proof:** see VERIFY below for the exact commands and results.

## RED list — observed, not predicted

Every one of these was decided by running
`npx vitest run lib/analyzer/golden/valuationInvariants.test.ts
--reporter=verbose` and reading the actual result, then (for the two
items below not reachable by a vitest assertion in this engine file)
by direct code reading with file:line citations.

| # | Invariant / claim | Observed | Mechanism |
|---|---|---|---|
| 1 | Zero growth, zero terminal growth ⇒ EV = NOPAT ÷ r | **GREEN** (`it`) | A flat perpetuity decomposes exactly into the 10-year explicit annuity + its own year-10 terminal continuation — an identity of the formula, confirmed to <1e-6 numerically. |
| 2 | Single-stage Gordon equivalence (growth = terminalGrowth = g, g < r) | **RED** (`it.fails`) | `projectReverseDcfValue`'s terminal segment always uses `terminalRoic = rate + POLICY.terminalRoicPremium` (reverseDcf.ts, the `projectReverseDcfValue` terminal block), never the `ronic` argument years 1–10 actually used for reinvestment. With MSFT's real RONIC (17.8%) ≠ rate+3pp, the engine's EV is ~9% off the textbook Gordon value. Confirmed as the cause: setting `ronic = rate + 0.03` exactly (so the two conventions coincide) makes the engine match Gordon exactly, diff < 1e-6. |
| 3 | RONIC = r ⇒ value independent of growth | **RED** (`it.fails`) | Confirmed exactly as the issue's own parenthetical predicts: two growth rates with identical RONIC=rate give materially different EVs (observed diff ≈ −138 on a ~3,600–3,700 base, synthetic fixture). |
| 4 | Reverse-DCF round-trips to the price | **GREEN** (`it`) | `computeReverseDcfGrid`'s bisection solver recovers the exact growth rate `projectReverseDcfValue` was run forward at, to 3+ decimal places. |
| 5 | Terminal ÷ year-10 FCF within [0.95, 1.10], for every golden company the engine can be run against | **MIXED, by rate cell** — only MSFT is runnable at all (see ESCALATE). At r=8%: **RED** (`it.fails`, ratio ≈0.901, same terminalRoic/RONIC mismatch as #2). At r=10% and r=12%: **GREEN** (`it`, ratios ≈0.953 and ≈0.991). **Not on the issue's own named RED list** — an honest new finding from running the real numbers, not matched to the nearest named item. |
| 6 | Same snapshot+policy+code ⇒ identical outputs (reproducibility) | **GREEN at this function's level** (`it`) — Decimal math is deterministic, byte-identical across two calls. **Scope caveat, stated plainly:** the issue's own RED list separately names "runs not reproducible" — that almost certainly means the FULL system run (acquisition timing, AI drafting, policy-version resolution), which this harness has no tooling to exercise and does NOT claim to have cleared. Both things are true: the core formula is reproducible; the full pipeline has not been shown to be, one way or the other, by this harness. |

**Issue's own named RED list — status by direct code reading (not all are closed-form invariants a vitest test in THIS file can exercise; cited by file:line):**

| Named RED | Status | Evidence |
|---|---|---|
| RONIC = r growth-invariance fails | **CONFIRMED RED** (above, #3) | `lib/analyzer/golden/valuationInvariants.test.ts` |
| reverse-DCF-only r+3pp terminal (non-MSFT tickers) | **CONFIRMED, but broader than stated** — `reverseDcf.ts`'s `projectReverseDcfValue` (line ~346) computes `terminalRoic = rate.plus(POLICY.terminalRoicPremium)` unconditionally — **every** company, MSFT included, gets the flat r+3pp terminal from this module; there is no company-specific or moat-based branch anywhere in it. The "non-MSFT" qualifier in the issue's phrasing likely refers to MSFT's separate recorded-bundle/manual valuation path elsewhere in the codebase (`lib/analyzer/acquisition/recordedBundles.ts`, `msftStage2ValuationProof.test.ts`) giving MSFT an alternate route that NVDA/others don't have — not to any difference inside this module itself. | `lib/analyzer/modules/reverseDcf.ts:346` |
| runs not reproducible | **NOT reproduced as stated at this harness's level** — see invariant #6's scope caveat. Not independently confirmed OR refuted at the full-system level; this harness lacks the tooling (AI calls, acquisition timing) to test that claim. | — |
| reinvestment unlinked to growth | **NOT independently confirmed for M7 specifically** — `reverseDcf.ts`'s own reinvestment (`reinvestment = nopat.mul(nextGrowth).dividedBy(ronic)`) IS linked to growth by construction; this RED most likely refers to a different module (the explicit scenario/analyst-authored path, M15, out of this outcome's engine-reading scope) or to AR0-3's not-yet-built fading-reinvestment convention, not to M7 as read here. Flagged, not resolved. | `lib/analyzer/modules/reverseDcf.ts:338` |
| profile band not applied; end-of-year timing with no stub; terminal share never computed; unconfirmed facts used | **Not independently investigated by this outcome** — out of this outcome's scope (DO NOT forbids engine changes; investigating these fully would mean reading large parts of `assemble.ts`/`gates.ts`/the report-assembly pipeline this outcome did not need to touch for golden-facts/invariants work). Left for AR3's own RED-list work, not silently marked resolved. | — |

## Test-transition classification

Full table (124 pre-existing files, one row each):
[`docs/superpowers/plans/ar2-golden-harness-test-transition.md`](./ar2-golden-harness-test-transition.md)

Summary: **4 files pin a SOLVED output** (candidates for AR3+ invariant
replacement, never touched by this outcome):
`lib/analyzer/assemble.test.ts` (a weighted fair-value figure),
`lib/analyzer/acquisition/msftStage2ValuationProof.test.ts` (fair-value
range, per-scenario terminal ROIC, a full sensitivity-matrix grid),
`lib/analyzer/modules/reverseDcf.test.ts`'s GOLDEN block specifically (not
the rest of that file), and
`lib/analyzer/modules/reverseDcf.independentVerification.test.ts` (the same
grid's solved/degenerate cell counts). **120 files encode a ruling** — a
gate, a suppression state, a sourced-fact extraction, or a tooling
contract — and are classified "keep," grouped by directory pattern with a
reason on each row.

## D1 SIC classification table and its validation

`lib/analyzer/golden/cyclicalSic.ts` — confirmed cyclical classes only
(steel SIC 331x, semiconductors 367x, autos 371x, chemicals-ex-pharma 28xx
excluding 283x pharmaceutical preparations); everything else defaults to
"stable" (see the file's own doc comment for why that default direction was
chosen, and its documented risk for an industry this table has not yet
confirmed).

| Ticker | Real SIC (from `data.sec.gov/submissions`) | `classifyCyclicality` output | Expected (this outcome's brief) | Match |
|---|---|---|---|---|
| MSFT | 7372 Services-Prepackaged Software | stable | stable | ✓ |
| COST | 5331 Retail-Variety Stores | stable | stable | ✓ |
| NVDA | 3674 Semiconductors & Related Devices | cyclical (367x) | cyclical | ✓ |
| NUE | 3312 Steel Works... | cyclical (331x) | cyclical | ✓ |
| KO | 2080 Beverages | stable | stable | ✓ |
| LLY | 2834 Pharmaceutical Preparations | stable (283x excluded from 28xx) | stable | ✓ |
| OKLO | 4911 Electric Services | stable (literal); special-cased to pre-revenue | pre-revenue | ✓ (special case, not by this table) |
| JPM | 6021 National Commercial Banks | stable (literal); special-cased to refused | refused | ✓ (special case, not by this table) |

All eight reproduce exactly (asserted by `goldenFacts.test.ts`, 54 passing
tests covering this and the schema/provenance checks).

**CALVIN REQUIRED — one closed question.** DO item 2 asks this table be
"validated on a wider company set." The confirmed classes (steel,
semiconductors, autos, chemicals-ex-pharma) all check out against this
golden set, but the full D1 cyclical SIC list is explicitly Methodology
v2.1's own authority (`docs/product-decisions.md` item 26: "Finance
semantics... cyclical classes: Cal Finance Methodology v2.1, D1 — not
here"), which this sandbox cannot reach (confirmed blocked: only
`data.sec.gov` is reachable). **Question:** which other industries (SIC
prefixes) does Methodology v2.1 D1 actually name as cyclical beyond the
four this outcome could confirm? Airlines, homebuilders, oil & gas E&P,
mining and shipping are all plausible candidates this table currently
defaults to "stable" for, which would be the wrong rate band if any of
them is actually on D1's list. This outcome does not guess — flagged here
rather than invented.

## ESCALATE

**Page citations — the smallest substitute, used honestly.** `www.sec.gov`
(the as-filed 10-K/10-Q document host) is confirmed blocked from this
sandbox; only `data.sec.gov`'s structured XBRL API is reachable. No page
number is obtainable anywhere in this harness. Every captured fact instead
carries its real SEC accession number, the XBRL concept's own official
label, the exact fiscal period (`periodStart`/`periodEnd`), and the form
type (`10-K`) — and every golden JSON file says this explicitly in its own
`provenance.pageCitationNote` field, honestly, rather than inventing a page
number or silently dropping the citation requirement.

**Live stock prices — the same honest substitution.** `query1/query2.finance.yahoo.com`
is confirmed blocked. MSFT and OKLO reuse the real, already-captured
offline price fixture (`lib/analyzer/acquisition/captures/prices.json`,
captured 2026-09-08 from the live provider, used only in
`ANALYZER_OFFLINE` mode — a genuine recorded price, not invented). The
other five companies (COST, NVDA, NUE, KO, LLY, JPM) have `price: null`
with an honest `priceNote` explaining why, rather than a fabricated number.

**One golden fact genuinely not independently reachable from this
sandbox:** the issue's brief names LLY's case as "nested finance leases"
tied to issue #311's EV double-count defect. Checked directly against
LLY's real captured XBRL facts: LLY has **no** `us-gaap:FinanceLease*`
tag anywhere in its history — only ordinary operating-lease tags. So no
finance-lease-nesting figure is derivable for LLY from `data.sec.gov` at
all; either LLY's finance leases are immaterial/undisclosed separately
under that tag family, or the issue's LLY tie-in is to the #311 defect
CLASS generically (whose own worked numeric example, confirmed in
`docs/ev-lease-nesting-doublecount-reconciliation.md`, is actually Union
Pacific, not LLY) rather than a reproducible LLY-specific number. Not
fabricated — flagged in `lly.json`'s own notes. The Elanco-restatement half
of that same LLY case IS independently confirmed from real data: LLY's own
`NetIncomeLoss` jumps from $3.232B (FY2018) to $8.3184B (FY2019, the
Elanco spin-off year) then falls to $6.1937B (FY2020) — exactly the shape
`docs/superpowers/plans/2026-10-17-analyzer-reset-master-plan.md` (line 46)
describes as having wrongly flagged LLY under an earlier, rejected
purely-data-driven cyclicality test, which is itself the reason D1's
classifier is SIC-based rather than margin-trend-based.

**KO's "IRS case"** (named in this outcome's brief alongside tag drift) is
captured as a genuine bonus golden fact, not fabricated: `ko.json` adds
`unrecognizedTaxBenefits` ($857M, FY2025, live tag) and its companion
penalties/interest accrual ($708M) — KO's real, current balance-sheet
contingency reserve tied to its long-running IRS transfer-pricing dispute.
This is explicitly noted as a PARTIAL capture (the reserve balance, not the
full disputed deficiency amount, which lives in filing text this sandbox
cannot reach).

## What I could not do, and why

- Could not fetch any as-filed 10-K/10-Q document (page numbers) — `www.sec.gov`
  confirmed blocked; substituted per ESCALATE above.
- Could not fetch live prices for COST/NVDA/NUE/KO/LLY/JPM — Yahoo
  confirmed blocked; omitted with an honest note rather than invented.
- Could not independently derive LLY's "nested finance lease" figure — no
  `FinanceLease*` XBRL tag exists for LLY at all; flagged, not guessed.
- Did not investigate the "profile band not applied," "end-of-year timing
  with no stub," "terminal share never computed," or "unconfirmed facts
  used" named REDs beyond what's stated in the RED-list table above — these
  require reading the report-assembly pipeline (`assemble.ts`, `gates.ts`)
  well beyond this outcome's golden-facts/invariants scope, and DO NOT
  forbids any engine change here regardless. Left open for AR3.
- Did not validate the D1 cyclical SIC table beyond the four confirmed
  classes — see the CALVIN REQUIRED question above; Methodology v2.1's own
  full list is unreachable from this sandbox.
- Did not run the full `npm test` suite's DB-integration ("OnRealRun") or
  `scripts/evidence/**` tests as part of building THIS code (no new file
  here touches the database) — they were, however, run as part of the full
  protected-evaluator check below, exactly as CI would.
- Could not get `scripts/evidence/selfTest.test.ts` to pass in this
  sandbox — it needs a Playwright Chromium binary this sandbox's egress
  allowlist will not let `npx playwright install` download
  (`cdn.playwright.dev` blocked). Confirmed this is an environment gap, not
  a code defect: CI's own workflow installs this browser as a dedicated
  step before `npm test`. Not touched, not worked around, not silenced.

## VERIFY

- `npx tsc --noEmit`: **clean, zero errors**, after fixing one JSON-import
  typing issue in `goldenFacts.test.ts` (the `facts` object's dynamically-
  named `"<key>Note"` honesty fields needed an index signature rather than
  a fixed `Record<string, GoldenFact | null>`).
- `npm test` (= `vitest run`, the full suite, no project/group split, run
  against a real local Postgres `calboard_test` database exactly as CI's
  own `TEST_DATABASE_URL` does): **211 test files, 2526 tests. 210 files /
  2525 tests PASSED. Exactly 1 file / 1 test FAILED**, and it is
  pre-existing, untouched by this outcome, and environment-only —
  `scripts/evidence/selfTest.test.ts` calls Playwright's `chromium.launch()`,
  and this sandbox's egress allowlist blocks `cdn.playwright.dev` (confirmed
  directly: `npx playwright install` fails with "request blocked: no rule
  or allowlist entry allows host cdn.playwright.dev"), so the browser
  binary cannot be downloaded here. CI's own workflow
  (`.github/workflows/ci.yml:98-99`) runs `npx playwright install --with-deps
  chromium` as its own setup step before `npm test` — something this
  sandbox's network policy does not allow this session to do — so this
  failure is specific to this sandbox and is expected to pass in CI. This
  outcome did not touch `scripts/evidence/selfTest.ts` or anything it
  depends on, and the failure's one-line cause (a missing browser
  executable path) has nothing to do with any file this outcome added.
  This harness's own 69 new tests (`lib/analyzer/golden/*.test.ts`, 3
  files) are all among the 2525 passes, including the `it.fails` cases
  reporting as expected failures (confirmed directly with a standalone
  sanity check: `it.fails` correctly FAILS the suite if its wrapped
  assertion unexpectedly passes, and correctly reports a suite PASS when
  the wrapped assertion fails as predicted — real, confirmed vitest
  behavior, not assumed from documentation).
- No pre-existing test file was edited. `git status` shows only new files
  under `lib/analyzer/golden/` and `docs/superpowers/plans/`.

## DONE WHEN / RECOVERY

Harness runs in CI via the existing `npm test` (no new CI config needed —
`.github/workflows/ci.yml` and `.github/ai-routines/*` were not touched,
per the BOUNDARIES constraint). RED list matches the defects named above,
with two honest additions beyond the issue's own list (the 8%-rate
terminal/FCF ratio failure; the pure-formula reproducibility pass) and two
honest "not independently confirmed from this engine file" findings
(reinvestment-unlinked, non-MSFT-r+3pp's precise scope). Test-transition
list and D1 classification are both in this document. Recovery: revert —
this PR touches only new files under `lib/analyzer/golden/` and
`docs/superpowers/plans/`; nothing else changes, so a revert is a plain
file-removal with no migration or data-recovery concern.
