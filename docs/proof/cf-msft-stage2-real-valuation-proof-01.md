# CF-MSFT-STAGE2-REAL-VALUATION-PROOF-01 — MSFT Stage 2 proof

**STAGE 2 PROOF — NOT APPROVAL. NOT A DURABLE MSFT BUNDLE. NOT STAGE 3.**

This document proves one bounded, specific MSFT valuation candidate through
the real production pathway, on real sourced SEC facts, against an
independent oracle. It does **not** approve any numeric input, does **not**
record a durable `recordAnalystBundle("MSFT", ...)` call against any
database this repository's real Analyzer reads from, and does **not**
perform or authorise Stage 3 (BUY/HOLD/SELL synthesis). One consolidated
question for Calvin is at the end — nothing above it is a ruling.

## 0. Authority

Issue [#439](https://github.com/calyeap/Cal-Finance/issues/439)
(`CF-MSFT-STAGE2-REAL-VALUATION-PROOF-01`, TIER HEAVY) authorises Stage 2
of the three-stage Cal Finance finish-line plan, following accepted,
merged [Stage 1 PR #438](https://github.com/calyeap/Cal-Finance/pull/438) /
[issue #437](https://github.com/calyeap/Cal-Finance/issues/437). It adopts
four bounded Stage-2 financial directions (quoted in full in the issue; not
restated here) covering: (a) net-of-D&A reinvestment basis, as a starting
point, not final; (b) reassessing `fcfCharacter` using real after-investment
FCF, with `positive_volatile` as the working recommendation; (c) rejecting
both a 20%-unfaded bull terminal ROIC and a universal 13% scenario terminal
ROIC without supported economics; (d) coherent growth/margin/reinvestment
scenarios through the forecast/terminal boundary, treating a reversed
cross-scenario RONIC ranking as a diagnostic to explain, not a new hard
rule.

[Stage 1's reconciliation](../analyst-drafts/msft-stage1-finance-reconciliation.md)
and its [independent oracle](../../scripts/evidence/msft-stage1-reconciliation/independent_oracle.py)
are reviewed evidence this proof builds on, not approved policy.
[PR #436](https://github.com/calyeap/Cal-Finance/pull/436) (pinned evidence
head `fdbc2975abfa50f998c78b0c58302a4af5a90e66`) stays preserved, open and
untouched by this outcome. Calvin's
[NO ruling on PR #430](https://github.com/calyeap/Cal-Finance/pull/430#issuecomment-6167808992)
(don't retire the 22 Sep V1 bands; direction C is temporary; no new verdict
policy) is unaffected — this outcome makes no BUY/HOLD/SELL or `deriveVerdict`
change.

## 1. The software gap this outcome closes

Confirmed gap (traced in `recordedBundles.ts`, `analystInputs.ts`,
`companyInputs.ts`, `assemble.ts`, `scenarioOutputs.ts`, `growthPath.ts`,
`types.ts`): `computeScenarioEnterpriseValue`
(`lib/analyzer/modules/scenarioOutputs.ts`) already accepted a ten-entry
intensity array, but every layer of the authored-input chain —
`ScenarioDriverSet` (types.ts) → `RecordedScenarioDriverInput`
(recordedBundles.ts) → `ScenarioDriverInputs` (assemble.ts) — carried
exactly three nullable drivers (growth, margin, reinvestment intensity) and
had **no slot for a per-scenario terminal ROIC at all**. Terminal ROIC was
unconditionally `rate.plus(POLICY.terminalRoicPremium)` — the diagnostic
reverse-DCF's own fixed r+3pp convention (§3.5/§6.2, PROVISIONAL),
incorrectly the ONLY terminal-ROIC path the scenario DCF could reach, for
every company and every scenario. An optional function parameter alone
would not have closed this — nothing upstream could have reached it.

**The fix** (minimal, backward-compatible, mirrors the existing optional
`terminalGrowth` parameter's own precedent):

- `ScenarioDriverSet.terminalRoic?: Decimal | null` (types.ts) — optional at
  every layer; every existing fixture/test object literal needs no edit.
- `RecordedScenarioDriverInput.terminalRoic?: string | null`
  (recordedBundles.ts) — validated as an independently-optional decimal
  (`optionalDecimal`), separate from the three keys that gate
  `recordedScenarioValuesComputeFromDrivers`; absent on every bundle
  recorded before this field existed (NVDA's migration-008 seed included)
  and round-trips to `null`.
- `computeScenarioEnterpriseValue`'s new optional 8th parameter,
  `terminalRoic?: Decimal | null`, resolved as
  `terminalRoic ?? rate.plus(POLICY.terminalRoicPremium)` — every existing
  caller (both of `assemble.ts`'s own call sites, every test file) that
  omits it gets EXACTLY the prior hardcoded behaviour.
- `assemble.ts`'s `dynamicScenarioValue` (the function
  `analystInputsFor`'s dynamic-recomputation path actually calls) now
  forwards `driver.terminalRoic` through.

No array-shaped ten-year reinvestment-intensity path was added to the
authored-input schema. `computeScenarioEnterpriseValue` already supports
one internally (exercised by M14's sensitivity module and by existing
tests); exposing it through the recorded/authorable surface would touch
the AI-proposal schema, `companyInputs.ts`'s classification assembly and a
much larger test surface for a capability issue #439 authority item (d)
calls "if materially necessary" — not mandatory — and names the reversed
RONIC ranking a diagnostic to explain, not a rule to correct by inventing a
new feature. This candidate explains that diagnostic below (§4) instead.

Tests: `lib/analyzer/modules/scenarioOutputs.test.ts` (legacy-default
regression, explicit override, null-is-same-as-omitted),
`lib/analyzer/acquisition/recordedBundles.test.ts` (round-trip, absent-field
backward compatibility, non-numeric rejection, partial authorship),
`lib/analyzer/acquisition/msftStage2ValuationProof.test.ts` (the real
pathway, below).

## 2. The candidate (ANALYST JUDGEMENT PROPOSAL — pending Calvin's ruling)

Growth and operating margin are **unchanged** from PR #436's reviewed,
SEC-anchored draft — issue #439 scopes this correction to reinvestment
basis, `fcfCharacter`, and terminal ROIC, not growth/margin.

| Scenario | Growth | Margin | Reinvestment (net-of-D&A) | Terminal ROIC |
|---|---|---|---|---|
| Bear | 8.0% | 41.68% | 7% | **10.0%** (= r, no excess return) |
| Base | 14.0% | 45.0% | 20% | **11.0%** (r + 1pp) |
| Bull | 20.0% | 46.78% | 26% | **12.5%** (r + 2.5pp) |

Written anchors (verbatim from the proof test's own candidate — the typed
input a real analyst would have to author):

- **Bear reinvestment (7%)**: just below the pre-AI-buildout (FY2017–23)
  net-of-D&A top of 8.37% — same relative positioning Stage 1's §2.1
  proposal already used, carried forward as a starting point.
- **Base reinvestment (20%)**: at the FY2025 observed net-of-D&A ratio
  (20.25%).
- **Bull reinvestment (26%)**: ~14% relatively below the FY2026 net-of-D&A
  peak (30.60%), mirroring the same relative discount the original
  cash-capex driver (30%) took off its own FY2026 peak (34.94%).
- **Terminal ROIC** (item (c)): bear fades fully to the 10% cost of
  capital — no durable excess-return claim is independently substantiated
  under this scenario's own assumed deterioration. Base carries a modest,
  explicitly-argued durable-moat credit (Azure/Microsoft 365 enterprise
  switching costs and recurring-subscription economics), deliberately
  **half** the diagnostic reverse-DCF's own r+3pp convention, not a
  universal default and not this scenario's own much higher 25.5%
  explicit-period RONIC (see §4). Bull carries a larger but still-faded
  credit reflecting continuing AI-driven Azure capacity monetization —
  **12.5%, a number deliberately different from both** the diagnostic
  r+3pp convention (13%) and bull's own original unfaded 20% ask, chosen
  because this candidate's own terminal share at 12.5% is already a §3.5
  >75% caution (§3below) — a materially higher terminal ROIC would push it
  further from normal.

Classification inputs:

| Field | Value | Status |
|---|---|---|
| `fcfCharacter` | `positive_volatile` | Item (b)'s working recommendation — Stage 1 §1(b): real FCF-after-cash-capex-and-lease-funded-capacity fell −18.16% (FY2025) and −17.07% (FY2026), margin compressed 31.43%→12.77% of revenue, even as OCF grew every year. |
| `capitalIntensity` | 0.4236 (42.36%) | Unchanged — PR #436's reviewed lease-inclusive-gross figure, named lower bound (acquisitions untagged). |
| `balanceSheetNature` | `asset-heavy` | Unchanged — PR #436's corrected call. |
| `cyclicality.tenYearMarginRange` | 0.1673 | Stage 1's independently re-verified figure (16.7252%, rounded). |
| `cyclicality.worstSingleYearChange` | 0.0028 | Stage 1's independently re-verified figure (0.2824%, rounded). |
| `nopatTaxRate` | 0.19 | FACT — MSFT's own disclosed FY2026 effective rate, Stage 1 §1. |
| `profile` | `MATURE_PROFITABLE_STABLE_FCF` | Unchanged — a growth-stage/durability classification, not gated by `fcfCharacter`'s own value (NVDA uses the other enum despite also being `positive_volatile`; MSFT remains mature, not high-growth-uncertain-durability). |

§4.4 non-operating-investments: **reused**, not re-decided — Calvin's
existing 2026-09-21 ruling (issue #188, `us-gaap:LongTermInvestments`),
recorded via `recordJudgment` exactly as `msftRealValuationUnblock.test.ts`
already does. No new §4.4 choice is made by this outcome.

Acquisitions / ΔNWC: still **missing, not zero**, in `companyInputs.ts` —
no SEC tag mapping exists for either (`tagMap.ts`), confirmed unchanged by
this outcome. This is a whole-pipeline prerequisite (every acquiring
company, not MSFT-specific), named but not built here. Materiality is
tested in §5.

## 3. Results — real production pathway (proved, not a stand-in)

`lib/analyzer/acquisition/msftStage2ValuationProof.test.ts` records this
exact candidate into a throwaway `*_test` database (never a production
database — deleted in `afterEach`/`afterAll`, same pattern
`msftRealValuationUnblock.test.ts` already uses), runs the real
`createRun` → `computeAnalysisForRun` pipeline on the committed MSFT SEC
capture (`ANALYZER_OFFLINE=1`), and independently recomputes each
scenario's expected per-share value by calling
`computeScenarioEnterpriseValue` directly (the identical production
function `assemble.ts`'s own `dynamicScenarioValue` calls) — never reading
the result back from `assemble.ts` itself. Both figures matched exactly on
this run:

| Scenario | Per-share fair value | Terminal value share of EV |
|---|---|---|
| Bear | $217.54 | 51.7% (independent-oracle figure; see §6 reconciliation note) |
| Base | $268.08 | 68.8% |
| Bull | $366.31 | 78.7% — **§3.5 >75% caution**, not a >85% "multiple in disguise" breach |

This run's own acquired facts: base-year revenue $331,839,000,000 (FACT,
matches the independent oracle's own re-extraction exactly), diluted share
count 7,449,545,491 (raw 7,425,545,491 + treasury-method dilution
24,000,000, this run's own M1 figure — never a hardcoded constant),
real-run EV bridge: enterprise value $3,716,234,881,852.70, market cap
$3,722,537,881,852.70 (net cash position, after the §4.4 non-operating
investments term — see §6). **Observed current price: $499.70** — above
all three scenario values under this candidate; this candidate's own
reinvestment/terminal-ROIC choices do not bracket the current price. Stated
plainly, not adjusted toward the price: this is exactly the kind of
analyst judgement Calvin's exact-number ruling is for, not something this
outcome backsolves to a desired answer.

A second test in the same file proves the **negative** — a bundle recorded
with no `terminalRoic` on any scenario (matching every other
existing/fixture bundle in this codebase) computes identically to the
pre-existing r+3pp default, confirming the new field changes nothing for
anyone who doesn't supply it.

## 4. Diagnostics disclosed, not hidden or silently "fixed" (item (d))

Independent oracle
(`scripts/evidence/msft-stage2-valuation-proof/independent_oracle.py`,
written fresh from the raw capture, imports no TypeScript module), on this
exact candidate:

| Scenario | Explicit-period RONIC (lagged) | Year-10 RONIC (lagged) | Terminal FCF ÷ year-10 FCF |
|---|---|---|---|
| Bear | 38.58% | 14.47% | ×0.91 |
| Base | 25.52% | 5.47% | ×1.66 |
| Bull | 29.15% | 4.37% | ×2.49 |

**Reversed cross-scenario RONIC ranking** (bear's 38.58% explicit-period
RONIC exceeds bull's 29.15% and base's 25.52%) is the SAME diagnostic
Stage 1 found under the net-of-D&A basis: holding reinvestment intensity
constant while growth fades toward the 3% terminal rate makes a smaller
reinvestment base (bear's 7%) look more return-efficient than a larger one
(bull's 26%) under otherwise-similar margins. Issue #439 authority item (d)
names this a diagnostic to explain, not a newly invented hard ranking
rule — explained here, not corrected by inventing a new ten-year
reinvestment-intensity-path feature in this bounded outcome (§1).
Year-10 lagged RONIC falling well below the 10% cost of capital for
base/bull is the same underlying mechanism. The terminal/year-10 FCF
multiples (×0.91/×1.66/×2.49) are smaller than Stage 1's own
constant-intensity examples (1.6×–4.2×) specifically because this
candidate's lower, scenario-differentiated terminal ROIC choices (§2)
already reduce — without eliminating — the discontinuity: a lower terminal
ROIC increases the implied terminal reinvestment rate (g ÷ terminal ROIC),
which lowers terminal FCF relative to the explicit period. Bear's own
ratio (×0.91, a slight *decline* at the boundary) is a direct, visible
consequence of its full fade to 10%.

## 5. Materiality — unmapped acquisitions / ΔNWC (item (a))

Same method as Stage 1 §3 (a flat +1pp / +2pp of revenue addition to the
reinvestment intensity, approximating the missing acquisitions/ΔNWC
components), re-run on this candidate's own final drivers:

| Scenario | Baseline | +1pp | +2pp |
|---|---|---|---|
| Bear | $213.34 | $209.42 (−1.84%) | $205.49 (−3.68%) |
| Base | $264.05 | $258.97 (−1.92%) | $253.89 (−3.85%) |
| Bull | $362.60 | $356.03 (−1.81%) | $349.46 (−3.62%) |

(Independent-oracle figures, simplified net-debt bridge — see §6.) A few
percent per scenario at a generous +2pp assumption; does not change the
relative ordering or materially alter the candidate. Consistent with Stage
1's own finding that this gap doesn't flip the basis-adoption conclusion.

## 6. Independent-oracle reconciliation note

The Python oracle's net-debt figure (used for §4/§5's sensitivity/
diagnostic tables above) is a simplified bridge (debt + finance leases −
cash − short-term investments, matching Stage 1's own oracle) and does
**not** net the §4.4 non-operating-investments term the real production
EV bridge applies (Calvin's existing ruling, §2 above) — the real run's
own net position is a **net cash** position of $6,303,000,000 after that
term, materially different in sign from the oracle's simplified
+$30,045,000,000 net-debt figure. This is why §3's real per-share figures
($217.54/$268.08/$366.31) differ slightly (a few dollars per share, same
order of magnitude, same ordering) from the independent oracle's own
EV→equity conversion using its simpler bridge ($213.34/$264.05/$362.60) —
disclosed here rather than silently reconciled. The EV figures themselves
(before the net-debt bridge, which is bridge-formula-independent) and the
terminal-value-share percentages are corroborated to the basis point
between the TypeScript run and the independent oracle; only the final
equity/per-share step differs by bridge formula, as expected and as named.

## 7. Compared with the two rejected alternatives (item (c))

| Scenario | This candidate | Universal r+3pp=13% | Bull's own unfaded 20% ask |
|---|---|---|---|
| Bear (troic=10%) | $213.34 | $224.45 (+4.95%) | n/a |
| Base (troic=11%) | $264.05 | $274.70 (+3.88%) | n/a |
| Bull (troic=12.5%) | $362.60 | $366.10 (+0.96%) | $396.77 (+9.42%, terminal share 80.5%) |

(Independent-oracle figures, simplified bridge per §6.) This candidate is
below the universal-13% alternative in every scenario and well below
bull's own unfaded-20% ask, consistent with item (c)'s instruction to
reject both without supported economics.

## 8. Verification

- `npx tsc --noEmit`: clean.
- `npx vitest run`: full suite green (see PR for the exact count on the
  final head); the only pre-existing failure every prior PR in this repo
  names (`scripts/evidence/selfTest.test.ts`, a Playwright browser-binary
  gap unrelated to this change) reproduces identically on `master`.
- `python3 -I scripts/evidence/msft-stage2-valuation-proof/independent_oracle.py`:
  reproduces every figure in §4/§5/§7 above (simplified bridge, as noted in
  §6).
- `git diff --stat` against `master`: this outcome's own files only — see
  the PR description for the exact list; no `deriveVerdict`, `policy.ts`
  BUY/HOLD/SELL logic, `docs/frozen/`, or UI file touched.
- No `recordAnalystBundle("MSFT", ...)` call reaches any database this
  repository's real Analyzer reads from — the one call in
  `msftStage2ValuationProof.test.ts` targets `TEST_DATABASE_URL` only and
  is deleted in `afterEach`/`afterAll`.

## 9. The one consolidated question for Calvin

**Approve this candidate's four Stage-2 choices as the exact MSFT
assumptions, or name which to change?**

1. **Reinvestment basis**: net-of-D&A, 7% / 20% / 26% (bear/base/bull) —
   Stage 1's own §2.1 starting point, carried forward unchanged.
2. **`fcfCharacter`**: `positive_volatile`.
3. **Terminal ROIC**: 10% / 11% / 12.5% (bear/base/bull) — none equal to
   the old universal 13% rule or bull's own unfaded 20% ask.
4. **Acquisitions/ΔNWC**: accept as missing (not zero), with the §5
   materiality sensitivity (≈2–4% per scenario at +1pp/+2pp) as the
   disclosed limitation, pending a future whole-pipeline SEC-tag-mapping
   fix (out of this outcome's scope).

**Separately named, not part of that question**: §4's RONIC-ranking
reversal and terminal/year-10 FCF-multiple diagnostics are disclosed as
Stage 1 found them (smaller under this candidate's own terminal-ROIC
choices, not eliminated) — item (d) treats this as a diagnostic to
explain, not a defect this outcome is asked to correct. If Calvin judges
it does need correcting (e.g. a growth-consistent fading reinvestment
path), that is new scope beyond this outcome's HARD BOUNDS, not something
already decided here.

No persistent MSFT bundle exists anywhere in this repository as a result
of this outcome. Recording one, and any BUY/HOLD/SELL synthesis (Stage 3),
stay explicitly unauthorised until Calvin rules on the above.
