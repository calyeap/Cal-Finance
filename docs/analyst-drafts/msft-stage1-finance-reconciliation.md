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
are four genuine definitional/policy gaps, all now reconciled as far as
current authority and real data allow: (1) which reinvestment basis the
scenario driver should use, now narrowed to a concrete proposal with
quantified materiality (≈4–10% per share) rather than left as an abstract
"open item"; (2) `fcfCharacter`, which does **not** survive unchanged under
the sourced, after-real-investment FCF basis issue #437 asks for — real free
cash flow has fallen in each of the last two fiscal years by double digits,
a materially different picture from operating-cash-flow stability; (3) the
scenario-DCF terminal-ROIC divergence, now traced to a specific,
precedented, backward-compatible gap against the **frozen implementation
text** — unverified against the current Notion *Cal Finance — Methodology*
page, which this reconciliation has no access to fetch — with its own
materiality quantified (≈6–8% per scenario), and, conditional on the bull
case's own proposed 20%-unfaded terminal ROIC (not the runtime's actual
13%, under which neither basis breaches), the current cash-capex
reinvestment basis producing a terminal share of value (86.2%) that
breaches the methodology's own 85% caution band, versus 80.5% (no breach)
under the §2.1 net-of-D&A proposal with that same 20% figure held fixed;
and (4) two confirmed scenario/terminal coherence inconsistencies —
a cross-scenario return-on-incremental-capital ranking that reverses under
the §2.1 proposal, and a 1.6×–4.2× discontinuous jump in free cash flow at
the ten-year terminal boundary on every basis checked — neither corrected
nor defaulted here.

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

**Classification consequence.** `docs/frozen/calboard-valuation-methodology.md`'s
`fcfCharacter` options (§2, classification inputs) — implementation
evidence subordinate to the current Notion *Cal Finance — Methodology*
page per `docs/CURRENT-AUTHORITY.md`'s Precedence section ("frozen specs
… implement authority; they do not create it"), and not independently
re-fetched from that page in this reconciliation — are a plain three-way
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

### 2.3 Terminal economics — gap against the frozen implementation text, unverified against current authority

**The frozen implementation spec's text is explicit and not ambiguous on
this point** (`docs/frozen/calboard-valuation-methodology.md` §3.5, line
374, and the Appendix B worked grid at line 448). This is implementation
evidence, subordinate to the current Notion *Cal Finance — Methodology*
page per `docs/CURRENT-AUTHORITY.md`'s Precedence section ("frozen specs
… implement authority; they do not create it"); this reconciliation has
no access to fetch that Notion page and has not independently checked
whether it states the same rule, so what follows is confirmed against the
frozen text only, not against current authority: in the **scenario DCF**,
terminal ROIC *"is an analyst input with a written anchor and must fade
toward the cost of capital unless a durable moat is argued explicitly."*
In the **diagnostic reverse DCF only**, it is *"fixed by rule at r + 3
percentage points (PROVISIONAL)... not an analyst input."* These are two
different rules for two different outputs, stated as such in this one
frozen implementation document covering both. If the current Notion
methodology states something different on this point, that is an open
conflict per Precedence, not something this reconciliation can resolve or
confirm away.

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
fact, and — **conditional on that 20%-unfaded figure itself, not independent
of it** — already produces a terminal share of value **above** the
methodology's own 85% caution threshold on the current cash-capex
reinvestment basis (86.2%, §2.1 above). Under the runtime's actual 13%
terminal ROIC, the same cash-capex basis does **not** breach the band
(84.9%, §5.4); the breach is a joint consequence of the 20% choice and the
basis choice together, not of the basis choice alone. Holding that same 20%
figure fixed, the breach drops to 80.5% (no breach) only if the
reinvestment-basis proposal in §2.1 is also adopted. That compound
sensitivity (two different open items both bearing on the same number, and
the number itself only existing because of a third, the 20% choice) means
the bull case's terminal-ROIC input is the one of the three that is **not
yet sufficiently evidenced** to treat as a settled analyst judgment — not
because 20% is unreasonable, but because its consequences are visibly
contingent on an unresolved companion choice.

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

### 2.4 Scenario and terminal coherence — confirmed inconsistency, not resolved

Per issue #437's requirement to "demonstrate bear/base/bull coherence" and
for REVIEW to validate "terminal coherence," §2.1 and §2.3 above are each
checked against the *other* scenarios and against the explicit/terminal
boundary, independently (§5.5), rather than read only in isolation. Two
coherence problems are confirmed; neither is resolved here.

**(i) Cross-scenario return on incremental capital.** Implied
explicit-period RONIC (ΔNOPAT_t ÷ Reinvestment_{t−1}, constant for years
1–5 under each scenario's own constant growth; §5.5):

| Basis | Bear | Base | Bull |
|---|---|---|---|
| Cash-capex (current driver, 12/22/30%) | 22.51% | 23.20% | 25.26% |
| Net-of-D&A (§2.1 proposed driver, 7/20/26%) | **38.58%** | 25.52% | 29.15% |

On the current cash-capex basis the ranking is monotonic with optimism
(bear < base < bull) — the shape the "same reasoning, restated" framing in
§2.1 implicitly assumes still holds. The §2.1 net-of-D&A restatement breaks
it: bear's implied return on incremental capital (38.6%) is higher than
base's (25.5%) and bull's (29.1%) — the most pessimistic growth/margin
scenario shows the best return on the marginal reinvested dollar. §2.1
reasoned each driver against its own basis's historical range,
scenario-by-scenario; it did not check the resulting ranking across
scenarios, and that ranking reverses. Current authority states no rule for
what cross-scenario ranking is required, so this is reported as found, not
corrected or defaulted.

**(ii) Year-10 return and the terminal boundary.** Both bases put base's
and bull's year-10 (lagged) RONIC below the 10% cost of capital — base
4.97% (cash-capex) / 5.47% (net-of-D&A), bull 3.79% / 4.37% — far below
their own years 1–5 RONIC above. Growth fades linearly to 3% over years
6–10 (the policy path shape), but reinvestment intensity is held constant
through year 10 on both the current and proposed basis; only the terminal
step applies the terminal reinvestment rate g ÷ terminal ROIC (15% at 20%
terminal ROIC, 23% at 13%, 30% at 10%). The result is a discontinuous jump
in free cash flow at the explicit/terminal boundary, not a fade:

| Basis, terminal ROIC (methodology-as-written) | Bear | Base | Bull |
|---|---|---|---|
| Cash-capex (10% / 10% / 20%) | ×1.12 | ×1.82 | **×4.20** |
| Net-of-D&A (10% / 10% / 20%) | ×0.91 | ×1.60 | **×2.79** |

(Terminal-year FCF ÷ year-10 FCF.) Year-10 reinvestment is 35.5%/60.4%/79.2%
of NOPAT (bear/base/bull, cash-capex) and 20.7%/54.9%/68.6% (net-of-D&A);
the terminal rate it drops to is 15–30% depending on terminal ROIC. The
§2.1 reinvestment-basis materiality (≈4–10%/share) and the §2.3
terminal-ROIC materiality (≈6–8%/scenario) are each measured holding this
discontinuity fixed — neither figure is wrong about its own isolated
effect, but both rest on a ten-year path that is not itself
growth-consistent at the horizon.

**Not resolved here.** Fixing (i) or (ii) would mean proposing
growth-consistent, ten-entry reinvestment-intensity paths per scenario
(`computeScenarioEnterpriseValue` already accepts a ten-entry path,
`scenarioOutputs.ts:18-20`) — itself a new analyst-judgment proposal, not a
restatement of one already made in #436 or here, and out of this outcome's
HARD BOUNDS against inventing a new finance rule. Both are carried into
§6(d) as a named, quantified decision item instead.

## 3. Remaining unknowns and consequences — named, not defaulted

- **`acquisitions` and `deltaNwc` have no SEC tag mapping anywhere in this
  codebase** (independently confirmed in §5.1 — zero `tagMap.ts` matches for
  either). §7.2 M5's own governing net-reinvestment formula
  (`computeReinvestment`) is structurally `INCOMPLETE` for MSFT and every
  other company this codebase acquires. Consequence: the lease-inclusive
  `capitalIntensity` classification figure (42.36%) stays a named lower
  bound, and no basis proposed in §2.1 can be verified against the "true"
  five-component net-reinvestment formula — only against the three
  three-component proxies this capture actually supports. **Exact missing
  evidence:** the 10-K cash-flow-statement lines for business acquisitions
  (net of cash acquired) and the change in net working capital — neither is
  present as an XBRL fact anywhere in the committed capture, so this is a
  genuinely *missing* input, not one this capture or codebase treats as
  zero by a judgment call.

  **Sensitivity, independently computed (§5 oracle, new section): what if
  the missing components are not negligible?** Approximating their combined
  size as a flat addition to the reinvestment intensity (the only way to
  test materiality without inventing a specific acquisitions or ΔNWC
  figure neither this capture nor #436 sources), holding growth, margin,
  and terminal ROIC fixed exactly as in §5.4's runtime-equivalent (13%)
  rows — i.e. varying only the one input in question:

  | Scenario | Basis | Baseline (0pp) | +1pp of revenue | +2pp of revenue |
  |---|---|---|---|---|
  | Bear | Cash-capex | $204.82 | $200.89 (−1.9%) | $196.96 (−3.8%) |
  | Base | Cash-capex | $264.54 | $259.46 (−1.9%) | $254.37 (−3.8%) |
  | Bull | Cash-capex | $339.83 | $333.26 (−1.9%) | $326.69 (−3.9%) |
  | Bear | Net-of-D&A | $224.45 | $220.52 (−1.8%) | $216.60 (−3.5%) |
  | Base | Net-of-D&A | $274.70 | $269.62 (−1.9%) | $264.54 (−3.7%) |
  | Bull | Net-of-D&A | $366.10 | $359.53 (−1.8%) | $352.97 (−3.6%) |

  **Does this range flip §6(a)'s ≈4–10%-per-share basis-adoption
  conclusion? No, on this approximation.** A flat per-revenue addition moves
  both the cash-capex and the net-of-D&A baseline down by nearly the same
  relative amount in every scenario (≈1.8–1.9pp at +1pp, ≈3.5–3.9pp at
  +2pp), so the *difference between the two bases* — which is what §6(a)
  asks Calvin to rule on — is essentially unchanged: recomputing the §2.1
  basis-adoption delta at +1pp gives bear +9.8%, base +3.9%, bull +7.9%
  (baseline: +9.6%/+3.8%/+7.7%), and at +2pp gives bear +10.0%, base +4.0%,
  bull +8.0% (table below). The missing-component sensitivity and the reinvestment-basis
  question move largely independently of each other at this size, because
  both bases absorb the same flat addition in roughly the same proportion.
  This does not establish that the true acquisitions/ΔNWC size is actually
  1–2% of revenue — that remains unsourced — only that *if* it were in that
  range, it would not change which basis §6(a) should prefer, though it
  would still lower every scenario's absolute value/share by a few percent
  in its own right.

  | Scenario | Baseline delta (0pp) | +1pp delta | +2pp delta |
  |---|---|---|---|
  | Bear | +9.6% | +9.8% | +10.0% |
  | Base | +3.8% | +3.9% | +4.0% |
  | Bull | +7.7% | +7.9% | +8.0% |
- **No quantified boundary exists in current authority between
  `fcfCharacter`'s "positive but volatile" and "positive and stable (3+
  years)" labels.** §2.2's finding is reported against that gap, not
  against a rule that resolves it. Closing this gap (a quantified
  volatility threshold, e.g. on YoY FCF decline magnitude or frequency)
  would be a genuine methodology addition, out of this outcome's scope to
  propose as a number.
- **Exact missing evidence for §2.3 and §2.2 alike: what the current Notion
  *Cal Finance — Methodology* page itself states.** This reconciliation has
  no access to fetch that page, so §2.3's terminal-ROIC fade rule and §2.2's
  `fcfCharacter` stability boundary are each confirmed only against
  `docs/frozen/calboard-valuation-methodology.md` (implementation evidence,
  subordinate per `docs/CURRENT-AUTHORITY.md`'s Precedence), not against the
  document that actually governs. Until that page is checked, (c)'s and the
  volatility-threshold half of (b) stay conditional on the frozen text
  matching current authority — not confirmed outright — and any divergence
  would be an open conflict per Precedence, not something resolved here.
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

### 5.5 Scenario and terminal coherence (independent) — see §2.4 for the full tables and reading

Per-year NOPAT and reinvestment are recomputed from the same §5.4 formula
shape for each scenario, on both reinvestment bases; lagged RONIC is
ΔNOPAT_t ÷ Reinvestment_{t−1} (return in year *t* on the capital reinvested
in year *t−1*), and the terminal-boundary step is terminal FCF (§5.4's
formula) ÷ year-10 FCF. Both the cross-scenario RONIC ranking reversal
under the net-of-D&A basis and the 1.6×–4.2× terminal-boundary FCF jump
reproduce exactly against a second, independently-coded pass over the same
formula shape (not a port of §5.4's code).

### 5.6 Unmapped net-reinvestment sensitivity (independent) — see §3 for the full tables and reading

A flat +1pp/+2pp-of-revenue addition to each scenario's reinvestment
intensity, on both bases, with terminal ROIC held at the runtime-equivalent
13% exactly as in §5.4's second row — approximating the materiality of the
unmapped `acquisitions`/`deltaNwc` components named in §3, not a sourced
figure for either. Reproduces the §3 per-scenario value/share figures and
the basis-adoption-delta comparison exactly.

## 6. The one consolidated decision question

Per issue #437's own framing ("one consolidated decision question only if
actually necessary") — these four are packaged as one Calvin ruling because
each is independently material (§2) and none can be defaulted without
either inventing policy or silently picking one reading over another:

**(a) Reinvestment basis.** Adopt the net-of-D&A reinvestment-driver
restatement in §2.1 (12/22/30% → 7/20/26%, same reasoning applied to the
basis the runtime formula actually implies), or keep the current cash-capex
basis despite the formula mismatch? Materiality: ≈4–10% per share (§2.1).
Separately, conditional on the bull case's own proposed 20%-unfaded
terminal ROIC being held fixed (not on the basis choice alone — under the
runtime's actual 13% terminal ROIC, neither basis breaches the band), the
basis choice determines whether that case's terminal share breaches the
methodology's 85% band: 86.2% (cash-capex, breaches) vs. 80.5% (net-of-D&A,
does not) (§2.1, last paragraph; §2.3).

**(b) `fcfCharacter`.** Does `positive_stable` survive under the sourced,
after-cash-capex-and-lease-funded-capacity FCF basis (§2.2), given two
consecutive double-digit declines and a halving of FCF margin in the two
most recent fiscal years — or is `positive_volatile` the better-supported
reading? Not resolved by this document because current authority states no
quantified volatility threshold (§3); this is squarely the kind of judgment
call that threshold's absence leaves to Calvin.

**(c) Terminal ROIC treatment.** This item is conditional on evidence this
reconciliation does not have: §2.3's gap is confirmed only against the
frozen implementation text (`docs/frozen/calboard-valuation-methodology.md`
§3.5), not against the current Notion *Cal Finance — Methodology* page,
which this reconciliation has no access to fetch (§2.3, §3). If that page
states the same scenario-DCF fade rule, confirm the §4 software delta
(precedented, backward-compatible optional parameter) as the right minimal
fix for a future Stage 2, and separately rule: is the bull case's
20%-unfaded, durable-moat-argued terminal ROIC sufficiently evidenced to
carry forward, given its visible sensitivity to the still-open
reinvestment-basis question in (a)? If the current Methodology instead
states something different, that is an open conflict per
`docs/CURRENT-AUTHORITY.md`'s Precedence section, to be resolved before
either sub-question is actionable, not deferred by assuming the frozen
text controls. Materiality: ≈6–8% per scenario (§2.3).

**(d) Scenario and terminal coherence.** §2.4 confirms the net-of-D&A
reinvestment-basis proposal in (a) reverses the bear/base/bull
return-on-incremental-capital ranking (bear highest at 38.6% vs. base
25.5%/bull 29.1%), and that both reinvestment bases hold intensity
constant through year 10 while growth fades, producing a 1.6×–4.2× jump in
free cash flow at the terminal boundary rather than a fade. Is a
growth-consistent, per-scenario reinvestment-intensity path (fading
alongside growth, not held constant) required before (a) and (c)'s
figures are relied on, or is the current constant-intensity shape an
accepted simplification? Not resolved by this document; no cross-scenario
ranking rule or intensity-fade rule exists in current authority to settle
it mechanically.

None of (a)–(d) is this outcome's to decide; each is named here precisely,
with its own quantified consequence, so a ruling on it is a closed
yes/no/which-of per item, not a re-opening of the whole draft.

---

Independent evidence script:
[`scripts/evidence/msft-stage1-reconciliation/independent_oracle.py`](../../scripts/evidence/msft-stage1-reconciliation/independent_oracle.py)
(pure Python stdlib, no network, no production-code import; reproduces §5).
