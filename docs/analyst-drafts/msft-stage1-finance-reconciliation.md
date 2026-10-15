# MSFT Step-7 economics — Stage 1 finance reconciliation

> **STAGE 1 RECONCILIATION — NOT APPROVAL. NOT STAGE 2. NOT STAGE 3.** This
> document does not approve, merge, edit or supersede [PR #436](https://github.com/calyeap/Cal-Finance/pull/436)
> (`CF-MSFT-STEP7-SOURCED-DRAFT-01`, head `fdbc2975`), which stays preserved,
> open and unapproved, with its own `CALVIN REQUIRED` gate untouched. It makes
> no runtime, policy, `deriveVerdict`, or `docs/frozen/` change, calls no
> `recordAnalystBundle`, and states no BUY/HOLD/SELL. Calvin has authorised
> only this Stage-1 reconciliation (15 Oct 2026); Stage 2 (production
> valuation corrections + live MSFT proof) and Stage 3 (completed verdict
> synthesis + final acceptance) remain **not authorised**.

OUTCOME-ID: `CF-MSFT-FINANCE-CONSISTENCY-01`
TIER: HEAVY

Prepared under issue [#437](https://github.com/calyeap/Cal-Finance/issues/437).
Reuses, and does not duplicate, PR #436's own sourced extraction of the real
SEC capture; re-derives nothing already soundly established there. Where
this document repeats a figure from #436, it is because an independent
second extraction (§5 below) reproduced it, not because it is copied.

## 0. What this document found, in one paragraph

Every fact-labelled figure in #436's draft reproduces, to the dollar and the
basis point, under a second, independently-coded extraction of the same raw
SEC capture (§5) — **the arithmetic is not in question**. What remains open
are three genuine definitional/policy gaps, all now reconciled as far as
current authority and real data allow: (1) which reinvestment basis the
scenario driver should use, now narrowed to a concrete proposal with
quantified materiality (≈4–10% per share) rather than left as an abstract
"open item"; (2) `fcfCharacter`, which does **not** survive unchanged under
the sourced, after-real-investment FCF basis issue #437 asks for — real free
cash flow has fallen in each of the last two fiscal years by double digits,
a materially different picture from operating-cash-flow stability; and (3)
the scenario-DCF terminal-ROIC divergence, now traced to a specific,
precedented, backward-compatible software gap rather than a pure policy
question, with its own materiality quantified (≈6–8% per scenario) and one
of the three proposed terminal-ROIC inputs (bull, 20% unfaded) shown to
independently breach the methodology's own 85% terminal-share caution band
on today's reinvestment-basis choice alone, before the ROIC question is
even reached.

## 1. Retained — unchanged by this reconciliation

No material new evidence changes these from #436's own (already-reviewed)
conclusions. Carried forward, not re-derived, except where the independent
re-extraction in §5 serves as an additional cross-check:

- `profile = MATURE_PROFITABLE_STABLE_FCF` — AI INFERENCE, unchanged. The
  reasoning (tight ten-year margin history, mid-band growth) is not
  disturbed by anything below; §2 narrows *which* FCF label applies, not
  whether the company is mature and profitable.
- `balanceSheetNature = asset-heavy` — unchanged. Independently
  re-confirmed in §5: capital intensity is 30.6–42.4% of revenue on every
  basis checked, all far above the codebase's own 10% `aiProposedBundle.ts`
  threshold for this field.
- `revenueScale = large`, `revenueGrowthBand = 10-30%` (17.79% FY2026,
  independently reproduced in §5) — unchanged.
- `nopatTaxRate = 0.19` — unchanged. This is MSFT's own disclosed FY2026
  effective rate; nothing in this reconciliation's scope (real filings,
  current code) bears on it differently than #436 already found.
- `stressMarginLevel = 0.3006` (FY2017 real low) — unchanged.
- The net-debt/EV-bridge inputs ($30.045B net debt FY2026) and the
  `shareCount` (7,425,545,491, FY2026 10-K cover page) — unchanged,
  independently reproduced exactly in §5.
- The §4.4 non-operating-investments judgment stays unmade (HARD BOUNDS,
  unchanged from #436).

## 2. Reconciled — changes proposed, with provenance

### 2.1 Reinvestment driver basis — concrete proposal, materiality quantified

**The gap, restated precisely.** #436 (REVIEW-38703686322-1) correctly
withdrew an uncited claim that the §6.3 classification `capitalIntensity`
field and the forward scenario driver `reinvestmentCapitalIntensity` share
a basis, and left *which basis the driver should use* as a named open item.
Three bases exist in this capture, none invented here:

| Basis | FY2026 value | Historical range (FY2017–2023, pre-buildout) |
|---|---|---|
| Gross cash-capex (`capex ÷ revenue`) — #436's current driver basis | 34.94% | 8.42%–13.26% |
| Lease-inclusive gross (methodology §1's own `capitalIntensity` definition, named lower bound — `acquisitions` untagged) | 42.36% | 10.25%–14.74% |
| Net-of-D&A partial (`(capex + lease ROU additions − D&A) ÷ revenue`) | 30.60% | 2.18%–8.37% |

**Why this is not a free choice.** `computeScenarioEnterpriseValue`
(`lib/analyzer/modules/scenarioOutputs.ts:54-56`) computes `FCFF_t =
NOPAT_t − Revenue_t × intensity`, and NOPAT is already post-D&A (`NOPAT =
EBIT × (1 − tax)`, and EBIT already expenses D&A). The term the formula
actually subtracts is therefore structurally a **net-of-D&A** reinvestment
rate — closer in shape to the third row above than to the gross cash-capex
range the current 12%/22%/30% drivers are anchored to. This is not a new
observation (#436 names it); what this reconciliation adds is a concrete
restatement and its quantified consequence.

**Concrete proposal (ANALYST JUDGEMENT PROPOSAL, applying #436's own stated
reasoning for each scenario to the net-of-D&A series instead of the
cash-capex series — not a new judgment method):**

| Scenario | Current driver (cash-capex basis) | Proposed driver (net-of-D&A basis) | Same reasoning, restated |
|---|---|---|---|
| Bear | 12% | **7%** | Reverts most of the way toward the pre-buildout net-of-D&A range (2.18%–8.37%), landing just below its own top — the same relative position 12% holds in the cash-capex range (just below its 13.26% top). |
| Base | 22% | **20%** | At the OBSERVED FY2025 net-of-D&A ratio (20.25%) — the same "at FY2025's realized level" anchor 22% uses on the cash-capex series (22.91%). |
| Bull | 30% | **26%** | Below the FY2026 net-of-D&A peak (30.60%) by the same ~14% relative discount 30% takes off the FY2026 cash-capex peak (34.94%). |

**Materiality (computed in §5, independent engine, runtime terminal ROIC =
13% held constant so only the basis changes):**

| Scenario | Cash-capex basis (current) | Net-of-D&A basis (proposed) | Δ per share |
|---|---|---|---|
| Bear | $204.82 | $224.45 | **+9.6%** |
| Base | $264.54 | $274.70 | **+3.8%** |
| Bull | $339.83 | $366.10 | **+7.7%** |

This is not a rounding-level difference — it moves the bear case by nearly
$20/share. **This is the exact, named open item for Calvin** (§6): adopt the
net-of-D&A basis above (restates 12/22/30 → 7/20/26, same reasoning,
different series), or confirm the gross cash-capex basis is intended despite
the formula mismatch. Not defaulted either way here.

**One more concrete consequence, not previously surfaced:** switching only
the reinvestment basis (cash-capex → net-of-D&A), holding the bull case's
own proposed 20%-unfaded terminal ROIC fixed, moves the bull terminal share
of value from **86.2%** (breaching the methodology's own >85%
"multiple-in-disguise" band, §3.5) to **80.5%** (inside the 75–85% caution
band, not breaching it) — see §5.4. The reinvestment-basis choice and the
terminal-ROIC choice are not independent of each other's consequences; a
reviewer evaluating the bull case's 85% breach should know it is partly an
artifact of which reinvestment basis is in force, not only of the terminal
ROIC.

**What this proposal does not touch:** `acquisitions` and `deltaNwc` remain
untagged anywhere in this codebase (`tagMap.ts` — independently confirmed in
§5, zero entries), so the full §7.2 M5 net-reinvestment formula stays
structurally `INCOMPLETE` for MSFT and every other acquired company. The
named lower-bound caveat on the lease-inclusive-gross `capitalIntensity`
classification field (42.36%) is unchanged and is not itself in question
here — only the *forward scenario driver's* basis is.

### 2.2 FCF classification — does not survive unchanged

**#436's basis, restated.** PR #436 (CALVIN RULING — CHANGES NEEDED, item 2)
correctly moved `fcfCharacter`'s primary evidence from margin stability to
real operating-cash-flow: ten years OCF-positive, one shallow single-year
decline (FY2022→FY2023, −1.63%), concluding `positive_stable` is supported.

**What issue #437 asks for instead, and what it finds.** DO item 3 asks for
`fcfCharacter` to be re-assessed from **sourced FCF after cash capex and
material lease-funded capacity** — not operating cash flow or margin alone.
This codebase already has exactly that figure, already implemented, not
invented for this reconciliation: `lib/analyzer/modules/fcf.ts`'s M4 module,
`fcfAfterLeaseFundedCapacity = (operatingCashFlow − cashCapex) −
financeLeaseRouAdditions` (§2.6/§3.5/§7.2 of the frozen methodology
implementation). All three of that field's REQUIRED inputs are present for
MSFT in the committed capture — this is not a figure MSFT's own data would
leave `INCOMPLETE`.

Independently computed for the same ten-year window (§5.3; dollars, millions):

| FY | OCF | FCF after cash capex | **FCF after cash capex + lease-funded capacity** | As % of revenue | YoY change |
|---|---|---|---|---|---|
| 2017 | 39,507 | 31,378 | 29,605 | 30.66% | — |
| 2018 | 43,884 | 32,252 | 30,319 | 27.47% | +2.41% |
| 2019 | 52,185 | 38,260 | 35,728 | 28.39% | +17.85% |
| 2020 | 60,675 | 45,234 | 41,767 | 29.20% | +16.90% |
| 2021 | 76,740 | 56,118 | 52,828 | 31.43% | +26.48% |
| 2022 | 89,035 | 65,149 | 60,915 | 30.72% | +15.31% |
| 2023 | 87,582 | 59,475 | 56,347 | 26.59% | **−7.50%** |
| 2024 | 118,548 | 74,071 | 62,438 | 25.47% | +10.81% |
| 2025 | 136,162 | 71,611 | 51,100 | 18.13% | **−18.16%** |
| 2026 | 182,935 | 66,987 | 42,379 | 12.77% | **−17.07%** |

**This is a materially different picture from OCF alone.** The sign never
flips — FCF after real capacity investment is positive in all ten years,
consistent with `positive_*` rather than `negative` — but it declines in
**three** of the nine year-over-year comparisons (not one), and the two
most recent declines are **double-digit, back-to-back, and concentrated
exactly in the AI-buildout years the rest of this document is about**: −18.2%
(FY2025) and −17.1% (FY2026), while headline OCF grew every single year
across the same window. The FCF margin (this measure ÷ revenue) has
compressed from a ten-year high of 31.43% (FY2021) to 12.77% (FY2026) — its
lowest point in the entire window — even as revenue and operating margin
both reached their own ten-year highs in FY2026. A reader of OCF alone would
see uninterrupted strength; a reader of sourced FCF after real investment
sees a company whose cash generation is growing in absolute OCF terms but
whose *free* cash is shrinking, in both relative and (for two years running)
absolute terms, exactly because the capacity investment behind that same
growth has outpaced it.

**Classification consequence.** The governing methodology's own
`fcfCharacter` options (§2, classification inputs) are a plain three-way
choice — *negative / positive but volatile / positive and stable (3+
years)* — with no quantified boundary given anywhere in the current
authority between "volatile" and "stable." That absence of a quantified
threshold is itself a real, named gap (§3), not resolved by this document.
Within that gap, this reconciliation's own reading: `positive_stable` is
the **weaker-supported** of the two positive labels once "stable" is tested
against sourced FCF rather than OCF — two consecutive double-digit declines
and a halving of FCF margin in the two most recent years is not what
"stable" ordinarily describes, even though "positive" is unambiguous. This
reconciliation does not override #436's `positive_stable` call outright
(the boundary is genuinely unquantified in current authority, and overriding
a classification without a quantified rule would be inventing one by
inference), but it does not endorse it as the better-supported reading
either: `positive_volatile` is at least as defensible on this sourced FCF
basis, and arguably the more honest one given the magnitude and recency of
the two declines. This is the second item carried into §6 for Calvin.

### 2.3 Terminal economics — confirmed implementation gap, not a pure policy question

**The methodology's own text is explicit and not ambiguous on this point**
(`docs/frozen/calboard-valuation-methodology.md` §3.5, line 374, and the
Appendix B worked grid at line 448): in the **scenario DCF**, terminal ROIC
*"is an analyst input with a written anchor and must fade toward the cost
of capital unless a durable moat is argued explicitly."* In the
**diagnostic reverse DCF only**, it is *"fixed by rule at r + 3 percentage
points (PROVISIONAL)... not an analyst input."* These are two different
rules for two different outputs, stated as such in the one document that
governs both.

**What the runtime actually does** (`scenarioOutputs.ts:63`,
independently re-read line-by-line in §5): `computeScenarioEnterpriseValue`
— the function `assemble.ts`'s `dynamicScenarioValue` calls for any fully-driven
recorded bundle — sets `terminalRoic = rate.plus(POLICY.terminalRoicPremium)`
unconditionally, for every scenario, with **no parameter through which a
per-scenario analyst-specified terminal ROIC could ever reach it**. The
diagnostic reverse-DCF's own rule is applied to the scenario-DCF path too.
This is not an open interpretation of ambiguous policy text; it is a
confirmed gap between what §3.5 specifies for the scenario DCF and what the
one function serving that path implements. `POLICY_THRESHOLD_PROVENANCE`
(`policy.ts:116-120`) independently confirms `terminalRoicPremium` itself is
labelled PROVISIONAL ("assumes a permanent 3-point return premium for every
company") — i.e. even the diagnostic rule this function borrows is marked
as a placeholder, not a calibrated company-specific figure.

**Materiality** (§5.4, independent engine, cash-capex reinvestment basis
held constant so only terminal ROIC changes):

| Scenario | Proposed terminal ROIC (methodology §3.5 as written) | Value/share | Runtime's actual terminal ROIC (13%, every scenario) | Value/share | Δ |
|---|---|---|---|---|---|
| Bear | 10% (fades fully to `r`) | $193.71 | 13% | $204.82 | **+5.7%** |
| Base | 10% (fades fully to `r`) | $246.97 | 13% | $264.54 | **+7.1%** |
| Bull | 20% (durable-moat exception, unfaded) | $370.49 | 13% | $339.83 | **−8.3%** |

**Whether a company-specific terminal ROIC has sufficient evidence — answered
per scenario, not as one blanket yes/no.** Bear and base both fade fully to
`r` = 10% by year 10 — the §3.5 default behavior, requiring no moat argument
and no new evidence; the only live question for those two is whether the
runtime's 13% (not fading, because it never had a fade schedule to fail) is
closer or further from right, and §5.4 shows it is not neutral (+5.7% to
+7.1%). The bull case is different in kind: its 20%-unfaded figure rests on
an **AI INFERENCE** durable-moat argument (#436's own label), not a sourced
fact, and — independent of the terminal-ROIC question — already produces a
terminal share of value **above** the methodology's own 85% caution
threshold on the current cash-capex reinvestment basis (86.2%, §2.1 above),
dropping to 80.5% only if the reinvestment-basis proposal in §2.1 is also
adopted. That compound sensitivity (two different open items both bearing on
the same number) means the bull case's terminal-ROIC input is the one of
the three that is **not yet sufficiently evidenced** to treat as a settled
analyst judgment — not because 20% is unreasonable, but because its
consequences are visibly contingent on an unresolved companion choice.

**Exact software consequence for a future, separately authorised Stage 2
— not performed here (HARD BOUNDS).** `computeScenarioEnterpriseValue`
already has a precedent for exactly this kind of extension: its
`terminalGrowth` parameter (`scenarioOutputs.ts:34`) is already optional,
defaulting to the policy constant, added specifically so a caller could vary
it "without duplicating this function's formula." The smallest, same-shaped
change for Stage 2 would add an analogous optional `terminalRoic` parameter
(defaulting to today's `rate.plus(POLICY.terminalRoicPremium)`, so every
existing caller — the M14 sensitivity tables, the diagnostic reverse DCF's
own use of this shape — is behavior-identical unless it opts in), letting a
recorded bundle's own per-scenario `terminalRoic` field (already present on
the bundle schema per #436's draft) flow through instead of being silently
discarded. This is named as the minimal delta, not implemented, per the HARD
BOUNDS against runtime changes in this outcome.

## 3. Remaining unknowns and consequences — named, not defaulted

- **`acquisitions` and `deltaNwc` have no SEC tag mapping anywhere in this
  codebase** (independently confirmed in §5.1 — zero `tagMap.ts` matches for
  either). §7.2 M5's own governing net-reinvestment formula
  (`computeReinvestment`) is structurally `INCOMPLETE` for MSFT and every
  other company this codebase acquires. Consequence: the lease-inclusive
  `capitalIntensity` classification figure (42.36%) stays a named lower
  bound, and no basis proposed in §2.1 can be verified against the "true"
  five-component net-reinvestment formula — only against the three
  three-component proxies this capture actually supports.
- **No quantified boundary exists in current authority between
  `fcfCharacter`'s "positive but volatile" and "positive and stable (3+
  years)" labels.** §2.2's finding is reported against that gap, not
  against a rule that resolves it. Closing this gap (a quantified
  volatility threshold, e.g. on YoY FCF decline magnitude or frequency)
  would be a genuine methodology addition, out of this outcome's scope to
  propose as a number.
- **This capture carries no segment-level revenue breakdown** (Azure /
  Intelligent Cloud vs. More Personal Computing) — every driver above is
  reasoned from consolidated figures only, same limitation #436 already
  names.
- **Off-balance-sheet / supply-agreement-financed AI capacity** (capacity
  not under a finance lease and not a traditional capex outlay) is not
  captured by any of the three reinvestment bases in §2.1. If material, it
  would push every basis's true figure higher than shown — a likely
  understatement, not resolved here.
- **§4.4 non-operating-investments selection** stays unmade (HARD BOUNDS) —
  the three book-value candidates (§4.4 of #436) are unchanged.
- **MSFT's 19% effective tax rate is 10-K prose, not an XBRL-tagged fact**
  in this capture — unchanged from #436, cross-checked again independently
  in §5.2 against the provision/net-income back-solve (19.4%).

## 4. Minimal future implementation delta — named, not performed

Per the HARD BOUNDS, nothing below is implemented by this outcome. Named so
a future, separately authorised Stage 2 does not have to re-discover it:

1. Add an optional `terminalRoic` parameter to `computeScenarioEnterpriseValue`
   (`scenarioOutputs.ts`), defaulting to today's `rate.plus(POLICY.terminalRoicPremium)`
   — mirroring the existing `terminalGrowth` optional-parameter precedent in
   the same function, so no existing caller's behavior changes. This is
   what would let a recorded bundle's per-scenario `terminalRoic` actually
   reach the valuation, closing the §2.3 gap.
2. Add `acquisitions` and `deltaNwc` SEC tag mappings to `tagMap.ts` —
   a whole-pipeline prerequisite (not MSFT-specific) for §7.2 M5's
   net-reinvestment formula ever resolving for any company, and for
   verifying which of §2.1's three reinvestment-basis proxies is closest to
   the governing formula's true five-component figure.
3. Resolve the `fcfCharacter` quantified-threshold gap named in §3, if
   Calvin judges it worth a standing rule rather than a per-company call.

No other runtime, policy, `deriveVerdict`, or `docs/frozen/` change is
named or implied.

## 5. Independent calculation evidence

A second, independently-coded extraction and arithmetic path
(`scripts/evidence/msft-stage1-reconciliation/independent_oracle.py` — pure
Python standard library, no network access, no import of any TypeScript
production module) reads the same committed raw capture
(`lib/analyzer/acquisition/captures/msft-companyfacts.json`) directly and
implements its own period-selection and formula logic from the governing
methodology and issue text, not by porting `history.ts`, `tagMap.ts`,
`computeReinvestment`, or `computeScenarioEnterpriseValue`. Agreement
between this independent path and #436's figures is genuine corroboration,
not the same code checking itself (per DO item 5's own instruction).

### 5.1 Verification matrix — independent oracle vs. PR #436's draft

| Item | PR #436 draft | Independent oracle (this doc) | Match |
|---|---|---|---|
| FY2026 revenue | $331,839M | $331,839,000,000 | **PASS** |
| FY2026 revenue growth | 17.7887% | 17.7887% | **PASS** |
| FY2026 operating margin | 46.78% | 46.7808% | **PASS** |
| Ten-year margin range | 16.73pt | 16.7252pt | **PASS** |
| Worst single-year margin decline | 0.28pt | 0.2824pt | **PASS** |
| Gross cash-capex/revenue FY2026 | 34.94% | 34.9410% | **PASS** |
| Lease-inclusive gross capital intensity FY2026 | 42.36% | 42.3567% | **PASS** |
| Net-of-D&A partial reinvestment/revenue FY2026 | 30.60% | 30.6040% | **PASS** |
| Net debt FY2026 | $30.045B | $30,045,000,000 | **PASS** |
| Share count | 7,425,545,491 | 7,425,545,491 | **PASS** |
| `acquisitions`/`deltaNwc` tag mapping | "no entry... anywhere" | zero matches, `tagMap.ts` searched directly | **PASS** |
| Scenario value/share, methodology-as-written (bear/base/bull) | $193.71 / $246.97 / $370.49 | $193.71 / $246.97 / $370.49 | **PASS** |
| Scenario value/share, runtime-equivalent (13% terminal ROIC) | ≈$204.82 / ≈$264.54 / ≈$339.83 | $204.82 / $264.54 / $339.83 | **PASS** |

No discrepancy found between the two independently-produced sets of
figures. The open items in §2 are definitional/policy, not arithmetic.

### 5.2 Operating cash flow ten-year series (independent)

Reproduces #436's own cited figures exactly: FY2017 $39,507M … FY2026
$182,935M, nine of nine year-over-year changes positive, the sole decline
FY2022→FY2023 at **−1.63%**. Tax check: FY2026 provision-implied effective
rate = $32,185M ÷ ($133,749M + $32,185M) = **19.4%**, consistent with the
10-K's own stated 19% and #436's Phase-B cross-check (not an XBRL-tagged
fact in this capture — §3).

### 5.3 FCF-after-real-investment series (independent) — see §2.2 for the full table and reading

### 5.4 Scenario DCF re-derivation (independent)

Same formula shape as `scenarioOutputs.ts` (constant growth years 1–5,
linear fade to `g` = 3% by year 10, terminal thereafter; `r` = `rateGrid[1]`
= 10%; `nopatTaxRate` = 0.19), coded from scratch against the governing
methodology's own text rather than calling the TypeScript function, for
four driver combinations:

| Run | Bear | Base | Bull |
|---|---|---|---|
| Methodology-as-written (analyst terminal ROIC 10/10/20%, cash-capex basis) | $193.71 (TS 56.8%) | $246.97 (TS 70.8%) | $370.49 (TS 86.2% ⚠️ breaches 85%) |
| Runtime-equivalent (terminal ROIC fixed 13%, cash-capex basis) | $204.82 (TS 59.1%) | $264.54 (TS 72.7%) | $339.83 (TS 84.9%) |
| Runtime-equivalent (terminal ROIC fixed 13%, **net-of-D&A basis proposed in §2.1**) | $224.45 (TS 54.0%) | $274.70 (TS 70.0%) | $366.10 (TS 78.9%) |
| Methodology-as-written terminal ROIC, **net-of-D&A basis**, bull only | — | — | $396.77 (TS 80.5%, no longer breaches 85%) |

TS = terminal share of value. All four rows independently reproduce or
extend #436's own figures (row 1 and row 2 match §5.1's matrix exactly; rows
3–4 are this reconciliation's own extension, computed the same way).

## 6. The one consolidated decision question

Per issue #437's own framing ("one consolidated decision question only if
actually necessary") — these three are packaged as one Calvin ruling because
each is independently material (§2) and none can be defaulted without
either inventing policy or silently picking one reading over another:

**(a) Reinvestment basis.** Adopt the net-of-D&A reinvestment-driver
restatement in §2.1 (12/22/30% → 7/20/26%, same reasoning applied to the
basis the runtime formula actually implies), or keep the current cash-capex
basis despite the formula mismatch? Materiality: ≈4–10% per share (§2.1),
and it changes whether the bull case's terminal share independently
breaches the methodology's 85% band (§2.1, last paragraph).

**(b) `fcfCharacter`.** Does `positive_stable` survive under the sourced,
after-cash-capex-and-lease-funded-capacity FCF basis (§2.2), given two
consecutive double-digit declines and a halving of FCF margin in the two
most recent fiscal years — or is `positive_volatile` the better-supported
reading? Not resolved by this document because current authority states no
quantified volatility threshold (§3); this is squarely the kind of judgment
call that threshold's absence leaves to Calvin.

**(c) Terminal ROIC treatment.** Confirm the §4 software delta
(precedented, backward-compatible optional parameter) as the right minimal
fix for a future Stage 2, and separately: is the bull case's 20%-unfaded,
durable-moat-argued terminal ROIC sufficiently evidenced to carry forward,
given its visible sensitivity to the still-open reinvestment-basis question
in (a)? Materiality: ≈6–8% per scenario (§2.3).

None of (a)–(c) is this outcome's to decide; each is named here precisely,
with its own quantified consequence, so a ruling on it is a closed
yes/no/which-of per item, not a re-opening of the whole draft.

---

Independent evidence script:
[`scripts/evidence/msft-stage1-reconciliation/independent_oracle.py`](../../scripts/evidence/msft-stage1-reconciliation/independent_oracle.py)
(pure Python stdlib, no network, no production-code import; reproduces §5).
