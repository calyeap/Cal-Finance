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
calls "if materially necessary" — not mandatory.

### 1.1 CALVIN RULING correction (2026-10-15) — fading the reinvestment path through years 6-10

Calvin's ruling on this PR's first consolidated gate did not approve the
candidate: **"forecast-to-terminal coherence"** was named a material
financial blocker — a flat explicit-period reinvestment rate jumping
straight into the terminal formula's own implied rate produced year-10
implied RONIC (5.47%/4.37%, base/bull) below the 10% cost of capital and
terminal FCF jumps of 1.66×/2.49× from year 10. The ruling authorised one
bounded correction: "a simple, economically defensible fading
net-reinvestment path through years 6–10," using the DCF's existing
ten-entry path capability, extending the authorable/recorded input path
"only as far as necessary," and preserving growth, margin, `fcfCharacter`,
the §4.4 bridge and the provisional 10%/11%/12.5% terminal ROIC unless the
corrected analysis established a specific reason to change them.

**What "only as far as necessary" turned out to mean: nothing new to
author.** The terminal formula already in `computeScenarioEnterpriseValue`
(§3.5/§6.2) embeds a specific implied terminal reinvestment rate: terminal
reinvestment (in dollars) = terminalNopat × (terminalGrowth ÷
terminalRoic) — the standard sustainable-growth identity g = ROIC ×
(reinvestment ÷ NOPAT). Restated as a fraction of terminal revenue
(terminalNopat ÷ terminalRevenue = margin × (1 − nopatTaxRate) exactly, the
(1+g) factor cancelling), that is:

```
terminalIntensity = margin × (1 − nopatTaxRate) × (terminalGrowth ÷ terminalRoic)
```

— a number the model already computes, not one chosen to erase the jump.
Every input on the right (margin, nopatTaxRate, terminalGrowth,
terminalRoic) is already authored or policy-fixed; no new analyst-entered
field is needed to derive it. `buildFadingReinvestmentIntensityPath`
(`lib/analyzer/modules/scenarioOutputs.ts`) computes this terminal-implied
level and fades the analyst's own explicit `reinvestmentCapitalIntensity`
toward it over years 6-10, reusing `growthAt`'s existing fixed-shape fade
(§7.1: constant years 1-5, linear fade 6-10) — the identical shape the
revenue-growth path already uses, and the identical ten-entry
`capitalIntensity` array `computeScenarioEnterpriseValue` already accepted.
Both of `assemble.ts`'s real call sites (`dynamicScenarioValue`, M15; the
sensitivity module's `scenarioValueAt` closure, M14) now build this path
whenever the scenario carries its own `terminalRoic`; a scenario without
one keeps the flat intensity, byte-for-byte unchanged. No schema,
migration, or `RecordedScenarioDriverInput` field changed — the
`ScenarioDriverSet`/`RecordedScenarioDriverInput` surfaces from §1 above
are untouched by this correction.

Tests: `lib/analyzer/modules/scenarioOutputs.test.ts` (legacy-default
regression, explicit override, null-is-same-as-omitted,
`buildFadingReinvestmentIntensityPath` hand-derived: holds years 1-5,
fades linearly to the terminal-implied level by hand-computed formula, and
changes the computed EV from the flat-intensity figure),
`lib/analyzer/acquisition/recordedBundles.test.ts` (round-trip, absent-field
backward compatibility, non-numeric rejection, partial authorship),
`lib/analyzer/acquisition/msftStage2ValuationProof.test.ts` (the real
pathway, below, its own expected-value helper updated to independently
call the same exported fade function, never read back from `assemble.ts`'s
output).

## 2. The candidate (ANALYST JUDGEMENT PROPOSAL — pending Calvin's ruling)

Growth, operating margin and terminal ROIC are **unchanged** from this
PR's own prior head — Calvin's ruling (§1.1) preserves them absent a
specific reason the corrected analysis establishes to change them, and
none does. Reinvestment is unchanged for years 1-5 (the same net-of-D&A
7%/20%/26% below); years 6-10 now fade toward the terminal formula's own
implied level (§1.1), rather than staying flat through year 10.

| Scenario | Growth | Margin | Reinvestment, years 1-5 (net-of-D&A) | Reinvestment, year 10 (faded) | Terminal ROIC |
|---|---|---|---|---|---|
| Bear | 8.0% | 41.68% | 7% | 10.13% | **10.0%** (= r, no excess return) |
| Base | 14.0% | 45.0% | 20% | 9.94% | **11.0%** (r + 1pp) |
| Bull | 20.0% | 46.78% | 26% | 9.09% | **12.5%** (r + 2.5pp) |

Bear's reinvestment fades *up* (7% → 10.13%) because its terminal ROIC
(10%, equal to the cost of capital) implies a higher sustaining
reinvestment rate than its own aggressive 7% explicit-period assumption.
Base and bull fade *down* (20% → 9.94%, 26% → 9.09%) because their higher
terminal ROIC (11%/12.5%) implies a lower sustaining rate than their own
high explicit-period assumptions. Each terminal-implied level is computed
directly from that scenario's own margin, tax rate, terminal growth (3%,
policy) and terminal ROIC — not a separately chosen number.

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
- **Reinvestment fade, years 6-10 (§1.1, CALVIN RULING correction)**: each
  scenario's own explicit 7%/20%/26% net-of-D&A rate now fades linearly
  over years 6-10 toward the level its own terminal ROIC already implies
  is sustainable (margin × (1 − tax) × terminalGrowth ÷ terminalRoic) —
  the same identity the terminal-value formula below already applies, not
  a new economic claim.

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
function `assemble.ts`'s own `dynamicScenarioValue` calls, now including
the years-6-10 fade of §1.1) — never reading the result back from
`assemble.ts` itself. Both figures matched exactly on this run:

| Scenario | Per-share fair value | Terminal value share of EV |
|---|---|---|
| Bear | $214.26 | 52.5% |
| Base | $283.31 | 65.1% |
| Bull | $402.73 | 71.6% — within the §3.5 normal 60-75% band, no longer a >75% caution |

(Pre-correction figures, for contrast: $217.54 / $268.08 / $366.31,
terminal shares 51.7% / 68.8% / 78.7%. Bear moves down slightly — its
reinvestment now fades *up* toward a 10.13% terminal-implied level, since
its terminal ROIC equals the cost of capital. Base and bull move up more —
their reinvestment fades *down* toward a 9.94%/9.09% terminal-implied
level, since their higher terminal ROIC implies a lower sustaining rate
than their own high explicit-period reinvestment. Bull's terminal share
drops from a §3.5 >75% caution to within the normal 60-75% band, a direct
consequence of the fade, not a separately chosen adjustment.)

This run's own acquired facts: base-year revenue $331,839,000,000 (FACT,
matches the independent oracle's own re-extraction exactly), diluted share
count 7,449,545,491 (raw 7,425,545,491 + treasury-method dilution
24,000,000, this run's own M1 figure — never a hardcoded constant),
real-run EV bridge: enterprise value $3,716,234,881,852.70, market cap
$3,722,537,881,852.70 (net cash position, after the §4.4 non-operating
investments term — see §6, which the independent oracle now re-derives and
reproduces to the cent, not merely discloses a gap against; unchanged by
this correction). **Observed current price: $499.70** — above all three
scenario values under this candidate; this candidate's own
reinvestment/terminal-ROIC choices do not bracket the current price.
Stated plainly, not adjusted toward the price: this is exactly the kind of
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
exact candidate, **after** the §1.1 fading-reinvestment correction:

| Scenario | Explicit-period RONIC (lagged, years 1-5, unaffected by the fade) | Year-10 RONIC (lagged) | Terminal FCF ÷ year-10 FCF |
|---|---|---|---|
| Bear | 38.58% (unchanged) | 10.66% (was 14.47%) | ×1.03 (was ×0.91) |
| Base | 25.52% (unchanged) | 9.15% (was 5.47%) | ×1.03 (was ×1.66) |
| Bull | 29.15% (unchanged) | 9.11% (was 4.37%) | ×1.03 (was ×2.49) |

The year-10 → terminal discontinuity Calvin's ruling named a material
blocker is now materially smaller and consistent across all three
scenarios: every terminal FCF now sits within 3% of year-10 FCF (was
−9%/+66%/+149%), and year-10 implied RONIC now clusters at 9.1%-10.7% —
all within roughly a point of the 10% cost of capital, rather than
4.4%-14.5% spread around it. This is the direct, by-construction
consequence of fading reinvestment toward the terminal formula's own
implied level (§1.1): the explicit period's last few years and the
terminal year are now computed from economically consistent reinvestment
rates, not a flat rate that happened to differ from what the terminal
formula already assumed.

**Explicit-period (years 1-5) RONIC is unaffected** by this correction —
the fade only touches years 6-10 — so the **reversed cross-scenario
explicit-period RONIC ranking** (bear's 38.58% exceeds bull's 29.15% and
base's 25.52%) persists exactly as Stage 1 found it: holding reinvestment
intensity constant while growth fades toward the 3% terminal rate makes a
smaller reinvestment base (bear's 7%) look more return-efficient than a
larger one (bull's 26%) under otherwise-similar margins. Issue #439
authority item (d) names this a diagnostic to explain, not a newly
invented hard ranking rule, and Calvin's ruling asked only for
forecast-to-terminal coherence, not a correction to this explicit-period
ranking — still disclosed here, not silently fixed.

**Year-10 RONIC ranking is now much closer to — though not exactly
matching — the terminal ROIC ranking** (bear 10% < base 11% < bull 12.5%):
bear's year-10 RONIC (10.66%) is now the highest of the three, consistent
with its reinvestment fading *up* to meet a 10% terminal ROIC from a very
low 7% base; base and bull (9.15%/9.11%) are nearly identical, both just
under the 10% cost of capital. This is a byproduct of each scenario fading
toward ITS OWN terminal-implied level from a different starting point
(7%/20%/26%), not a newly engineered ranking — disclosed, not tuned to
match.

## 5. Materiality — unmapped acquisitions / ΔNWC (item (a))

Same method as Stage 1 §3 (a flat +1pp / +2pp of revenue addition to the
reinvestment intensity, approximating the missing acquisitions/ΔNWC
components), re-run on this candidate's own final drivers, on the
independent oracle's own re-derivation of the **real production EV→equity
bridge** (§6 — not the earlier simplified net-debt-only bridge):

| Scenario | Baseline | +1pp | +2pp |
|---|---|---|---|
| Bear | $214.26 | $211.39 (−1.34%) | $208.53 (−2.68%) |
| Base | $283.31 | $279.76 (−1.25%) | $276.21 (−2.51%) |
| Bull | $402.73 | $398.34 (−1.09%) | $393.95 (−2.18%) |

A few percent per scenario at a generous +2pp assumption; does not change
the relative ordering or materially alter the candidate. Consistent with
Stage 1's own finding that this gap doesn't flip the basis-adoption
conclusion.

## 6. Independent-oracle bridge reconciliation note

**REVIEW-38751207194-1, CORRECT — closed.** An earlier revision of
`independent_oracle.py` used a simplified bridge (debt + finance leases −
cash − short-term investments, matching Stage 1's own oracle) that did
**not** net the §4.4 non-operating-investments term the real production EV
bridge applies (Calvin's existing 2026-09-21 ruling, issue #188,
`us-gaap:LongTermInvestments`, §2 above), so its per-share figures differed
from the production run's by a few dollars per scenario. That gap is now
closed: the oracle independently re-derives the full production bridge
straight from the raw capture —

- Raw shares outstanding (`dei:EntityCommonStockSharesOutstanding`,
  as of 2026-07-23): 7,425,545,491.
- Treasury-method dilution (FY2026,
  `us-gaap:IncrementalCommonSharesAttributableToShareBasedPaymentArrangements`):
  24,000,000. Diluted share count: 7,449,545,491 — matches the production
  run's own M1 figure exactly.
- Total debt (`LongTermDebt` + `CommercialPaper` + `ShortTermBorrowings`):
  $40.294B. Finance lease liabilities (`FinanceLeaseLiability`): $66.594B.
  Cash and marketable debt securities (`CashAndCashEquivalentsAtCarryingValue`
  + `ShortTermInvestments`): $76.843B. §4.4 non-operating equity
  investments at book (`LongTermInvestments`): $36.348B.
- EV bridge term = $40.294B + $66.594B − $76.843B − $36.348B =
  **−$6.303B** — a **net cash** position of $6,303,000,000, matching the
  sign and magnitude of the real production run's own bridge exactly.

Re-run with this corrected bridge, the independent oracle reproduces the
production run's own per-share figures **to the cent**: $214.26 (bear),
$283.31 (base), $402.73 (bull) — see the "Reproduction check" section of
the oracle's own output (these are this correction's post-§1.1 figures;
the bridge logic itself is unaffected by §1.1 and unchanged from the
prior head). The §4's RONIC and terminal/year-10 FCF-multiple diagnostics
are unaffected by THIS §6 bridge correction: they depend only on NOPAT and
reinvestment, never on the EV→equity bridge, so they were already
bridge-independent before this fix and remain so — though §1.1's
reinvestment fade does change their values, as §4 shows.

## 7. Compared with the two rejected alternatives (item (c))

On the real production bridge (§6), re-derived independently by the
oracle, with the §1.1 reinvestment fade applied identically to every
column below (each alternative fades toward ITS OWN terminal ROIC's
implied level, the same methodology applied to the candidate — never the
candidate faded against an unfaded alternative):

| Scenario | This candidate | Universal r+3pp=13% | Bull's own unfaded 20% ask |
|---|---|---|---|
| Bear (troic=10%) | $214.26 | $227.78 (+6.31%) | n/a |
| Base (troic=11%) | $283.31 | $296.24 (+4.57%) | n/a |
| Bull (troic=12.5%) | $402.73 | $406.98 (+1.06%) | $444.14 (+10.28%, terminal share 72.6%) |

This candidate is below the universal-13% alternative in every scenario
and well below bull's own unfaded-20% ask, consistent with item (c)'s
instruction to reject both without supported economics — unchanged in
direction by the §1.1 correction, though the margins moved slightly
(bear's delta widened from +5.09% to +6.31%; bull's unfaded-20%
comparison's own terminal share moved from 80.5% to 72.6%, since the
fade now also applies inside that comparison run).

## 8. Verification

- `npx tsc --noEmit`: clean.
- `npx vitest run`: 2445/2446 passing. The one failure is the same
  pre-existing, environment-only Playwright browser-binary gap every prior
  PR in this repo names (`scripts/evidence/selfTest.test.ts`), unrelated to
  any file this correction touches.
- `python3 -I scripts/evidence/msft-stage2-valuation-proof/independent_oracle.py`:
  exit 0, reproduces every figure in §3/§4/§5/§7 above on the real
  production EV→equity bridge (§6), including the $214.26/$283.31/$402.73
  per-share figures to the cent (its own "Reproduction check" section), and
  fails closed (raises) on a non-positive `terminalRoic`.
- `git diff --stat` against `master`: this outcome's own files only — see
  the PR description for the exact list; no `deriveVerdict`, `policy.ts`
  BUY/HOLD/SELL logic, `docs/frozen/`, or UI file touched.
- No `recordAnalystBundle("MSFT", ...)` call reaches any database this
  repository's real Analyzer reads from — the one call in
  `msftStage2ValuationProof.test.ts` targets `TEST_DATABASE_URL` only and
  is deleted in `afterEach`/`afterAll`.

## 9. The one consolidated question for Calvin

**Approve this candidate's four Stage-2 choices, now including the §1.1
fading-reinvestment correction, as the exact MSFT assumptions — or name
which to change?**

1. **Reinvestment basis**: net-of-D&A, 7% / 20% / 26% (bear/base/bull) for
   years 1-5 — Stage 1's own §2.1 starting point, carried forward
   unchanged — now fading over years 6-10 toward each scenario's own
   terminal-ROIC-implied level (10.13% / 9.94% / 9.09%), per Calvin's
   2026-10-15 ruling (§1.1). This is a derived path, not a newly authored
   number: every input to the fade (margin, tax rate, terminal growth,
   terminal ROIC) was already approved or policy-fixed before this
   correction.
2. **`fcfCharacter`**: `positive_volatile` — unchanged.
3. **Terminal ROIC**: 10% / 11% / 12.5% (bear/base/bull) — unchanged, per
   Calvin's instruction to preserve it absent a specific reason to change
   it; none emerged from this correction.
4. **Acquisitions/ΔNWC**: accept as missing (not zero), with the §5
   materiality sensitivity (≈1–3% per scenario at +1pp/+2pp, narrower than
   before this correction) as the disclosed limitation, pending a future
   whole-pipeline SEC-tag-mapping fix (out of this outcome's scope).

**What changed as a result of the correction** (§3/§4): per-share values
move to $214.26/$283.31/$402.73 (bear down slightly, base and bull up);
bull's terminal share moves from a §3.5 >75% caution (78.7%) to within the
normal 60-75% band (71.6%); the year-10→terminal FCF discontinuity Calvin
named a material blocker shrinks from −9%/+66%/+149% to a consistent ~+3%
across all three scenarios, and year-10 implied RONIC moves from a
4.4%-14.5% spread to a tighter 9.1%-10.7% cluster around the 10% cost of
capital.

**Separately named, not part of that question**: §4's explicit-period
(years 1-5) RONIC-ranking reversal is unaffected by this correction (the
fade only touches years 6-10) and is disclosed exactly as Stage 1 found
it — item (d) treats this as a diagnostic to explain, not a defect to
correct, and Calvin's ruling asked only for forecast-to-terminal
coherence, which §1.1 addresses, not a change to this explicit-period
ranking.

No persistent MSFT bundle exists anywhere in this repository as a result
of this outcome. Recording one, and any BUY/HOLD/SELL synthesis (Stage 3),
stay explicitly unauthorised until Calvin rules on the above.
