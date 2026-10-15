# MSFT — Step-7 / §6.3 analyst-input bundle (DRAFT)

> **DRAFT — NOT APPROVED — NOT RUNTIME-RESOLVABLE.** This document is not read
> by any runtime module and changes no code or policy. MSFT already resolves
> through `BUNDLES.MSFT` (`lib/analyzer/acquisition/analystInputs.ts`), which
> carries the M5/M7 **fixture-carried validation set** — not this draft, and
> not touched by it. Nothing here is written to
> `analyzer_recorded_analyst_bundles`; `recordAnalystBundle("MSFT", ...)` is
> not called by this outcome (HARD BOUNDS). Typing or pasting the values
> below into the (not-yet-built) entry screen, after Calvin's ruling, is what
> would make this draft operative — this file alone does not.

Prepared under `CF-MSFT-STEP7-SOURCED-DRAFT-01` (issue #435), the immediate
bounded successor to merged PR #434 / closed issue #433
(`CF-ANALYZER-REAL-VALUATION-UNBLOCK-01`). TIER: HEAVY.

## What this draft is built from

`lib/analyzer/acquisition/captures/msft-companyfacts.json` — real SEC XBRL
company facts for **MICROSOFT CORPORATION** (CIK 0000789019), captured
**2026-09-24T18:40:18.211Z**, trimmed to the tags `tagMap.ts` reads and to
periods ending in the last twelve calendar years. Every figure below marked
**OBSERVED FACT** is reproduced using the same selection rules
`history.ts` (`annualSeries`/`instantAnnualSeries`/`preferCurrentSeries`)
already applies at acquisition time — the same facts a real acquired MSFT run
reading this same capture would select — not re-derived by a different
method, and independently extracted from the raw capture, never read off
`lib/analyzer/fixtures/msft.ts` (the M5/M7 **synthetic reconstruction** of a
frozen UI mock, whose own file header says so explicitly) or off that
fixture's `scenarioValues: { bear: 265, base: 510, bull: 650 }` / `price:
510.12`, none of which appear anywhere below. Independent evidence that the
real capture and the fixture's EV-bridge reconstruction happen to agree
almost exactly is noted inline where relevant, but every figure below is
sourced to the capture, not to the fixture.

Real FY2026 figures in this draft also agree, field for field, with the
already-committed, already-reviewed
[`docs/proof/cf-analyzer-msft-valuation-phase-b-proof-01.md`](../proof/cf-analyzer-msft-valuation-phase-b-proof-01.md)
(`CF-ANALYZER-MSFT-VALUATION-PHASE-B-PROOF-01`, PR #428), which reads the
same capture for a different purpose (a non-governing shadow WACC/Damodaran-
style DCF, explicitly "not to be promoted to policy"). That proof's
Damodaran-style framework (WACC, CAPM beta, externally-sourced risk-free
rate/ERP) is **not reused here** — this draft's scenario DCF strictly follows
the existing approved M15 shape (`r` = `policy.ts`'s `rateGrid[1]`, `g` =
`policy.ts`'s `terminalGrowth`, analyst-authored per-scenario terminal ROIC),
per the HARD BOUNDS against introducing a bespoke DCF model. Where the same
raw fact appears in both documents (revenue, operating income, capex, debt,
leases, cash, shares), the two agree exactly, which is cited below as a
cross-check, not as this draft's source.

## Field-by-field draft, in the order `/analyzer/inputs/MSFT` would present them

### Profile

| Field | Value | Provenance |
|---|---|---|
| `profile` | `MATURE_PROFITABLE_STABLE_FCF` | **AI INFERENCE** — no classifier exists for this field in this codebase (`AnalystBundleForm.tsx`'s own text: "No classifier recommends a profile... this is the analyst's own classification"). Reasoning: FY2026 revenue growth of 17.79% (see `revenueGrowthBand` below) sits mid-band, not high-growth; the ten-year operating-margin history below is unusually tight (16.73pt range, essentially no single-year decline) — the "stable, durable margin structure through a cycle" this profile's name requires. This matches MSFT's already-committed classification (`lib/analyzer/fixtures/msft.ts`) — not inherited from it, independently reasoned from the real capture, and landing in the same place. **Flagged for Calvin regardless**: FY2026 cash capex is 34.94% of revenue, roughly triple the FY2016–2023 historical range (8–13%, see `capitalIntensity` below) — the single largest real change since that fixture was built. It does not change this profile recommendation on its own (margin stability is what the profile mainly reads), but it is the fact most likely to force a different classification at a future review if the elevated reinvestment pace persists and begins pressuring margin. |

### Classification inputs (§6.3 evidence beside the profile)

| Field | Value | Provenance |
|---|---|---|
| `revenueScale` | `large` | **AI INFERENCE** — no scale thresholds are defined anywhere in this codebase; informed by the OBSERVED FY2026 revenue figure below ($331,839M), "large" under any plausible reading. |
| `fcfCharacter` | `positive_stable` | **AI INFERENCE**, reasoned from the OBSERVED margin-history statistics below: a 16.73pt ten-year operating-margin range and a 0.28pt worst single-year decline (FY2022→FY2023) — every one of the ten years operating-income-positive, and the "decline" is close to flat. This is a materially TIGHTER, more stable record than the one `lib/analyzer/fixtures/msft.ts`'s own synthetic reconstruction carries (21.4pt range / 4.1pt worst decline, built from the frozen design mock, not from real filings) — named here as a real, material difference between the fixture and the current real record, not a defect in either: the fixture reproduces a 2026-09-04 design mock's disclosed numbers; this draft reads the real filings directly. |
| `revenueGrowthBand` | `10-30%` | **OBSERVED FACT** — computed from `us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax` (current for this filer; MSFT has not stopped reporting it, unlike NVIDIA's retired-tag case in the companion NVDA draft): FY2025 revenue $281,724M (period 2025-06-30, one year) → FY2026 revenue $331,839M (period 2026-06-30), both accession 0001193125-26-323660 (FY2026 10-K). Growth = (331,839 − 281,724) / 281,724 = **17.7887%**. |
| `capitalIntensity` | `0.3494` | **OBSERVED FACT**, FY2026: `us-gaap:PaymentsToAcquirePropertyPlantAndEquipment` $115,948M (period 2025-07–2026-06, accession 0001193125-26-323660) ÷ `us-gaap:Revenues` candidate's winning tag, same period/accession, revenue $331,839M = **34.94%**. This is a real, disclosed step-up — not a data artifact: the same ratio was 8.42%–13.26% every year FY2017–FY2023, then 18.14% (FY2024), 22.91% (FY2025), 34.94% (FY2026) — a three-year acceleration consistent with the AI/datacenter capex buildout, the same figure the Phase B shadow-DCF proof already cites and flags identically ("real, disclosed step-up ... not a data artifact"). Flagged as a limitation of the ratio, not resolved: this is cash PP&E capex only; it does not capture off-balance-sheet, lease- or supply-agreement-financed datacenter capacity, which is not tagged under any candidate this mapping reads (the same limitation the companion NVDA draft names for its own capex ratio). |
| `cyclicality.tenYearMarginRange` | `0.1673` (16.73pt) | **OBSERVED FACT**, derived from `us-gaap:OperatingIncomeLoss` ÷ the winning revenue tag for the ten most recent fiscal years both tags cover: FY2017–FY2026 (FY2016 is the eleventh year both tags cover and is excluded to keep exactly ten, per the same "ten most recent" rule the companion NVDA draft applies). Margins: FY2017 30.06%, FY2018 31.77%, FY2019 34.14%, FY2020 37.03%, FY2021 41.59%, FY2022 42.06%, FY2023 41.77%, FY2024 44.64%, FY2025 45.62%, FY2026 46.78%. Max 46.78% (FY2026) − min 30.06% (FY2017) = **16.73pt**. |
| `cyclicality.worstSingleYearChange` | `0.0028` (0.28pt) | **OBSERVED FACT**, same ten-year series: the only year-over-year decline in the window is FY2022 (42.06%) → FY2023 (41.77%) = **0.28pt** — computed the same way `lib/analyzer/marginMath.ts`'s `worstSingleYearDecline` computes it (largest positive decline between adjacent entries). Every other year-over-year change in the window is an increase. |
| `balanceSheetNature` | `asset-light` | **AI INFERENCE** — the entry form's own label is exact: "ASSUMPTION not FACT (§6.3)." Reasoning: total OBSERVED equity ($442,387M) dwarfs OBSERVED total debt + finance leases ($40,294M + $66,594M = $106,888M), and MSFT remains overwhelmingly equity-financed. **Counterargument, named rather than resolved**: `us-gaap:FinanceLeaseLiability` ($66,594M) now EXCEEDS `us-gaap:LongTermDebt` ($40,294M) for the first time in this window, and cash capex is 34.94% of revenue (see above) — both real, disclosed signs of a structurally more capital-intensive, infrastructure-owning business than the pre-FY2024 record shows. This draft still calls it asset-light because the balance-sheet composition test (equity vs. debt-equivalent liabilities) has not flipped, only trended — but a reviewer who weighs the capex/lease trend more heavily than the balance-sheet snapshot could reasonably call this asset-heavy instead, and nothing in this codebase adjudicates between the two readings. |

### Scenarios

Each scenario's growth/margin/reinvestment drivers and its resulting
scenario value are the analyst's own forward judgment — Step 7 has no
classifier or solver behind this entry form. None of the three drivers
below is asserted as fact; each is **ANALYST JUDGEMENT PROPOSAL**, reasoned
from the OBSERVED historical series above, and every one of them is exactly
what Calvin's review is for.

**`shareCount` (all three scenarios): `7425545491`** (absolute raw share
count, not billions) — **OBSERVED FACT**: `dei:EntityCommonStockSharesOutstanding`
(cover-page shares, §3.5's "most recent... from the filing COVER PAGE"),
7,425,545,491 shares, as of **2026-07-23**, from the FY2026 10-K (filed
2026-07-29, accession 0001193125-26-323660) — the most recent cover-page
count in this capture. Held constant across all three scenarios, the same
convention MSFT's own committed fixture and the companion NVDA/OKLO drafts
all use. **Mechanical check (DO item 5, #434's fail-closed contract):** this
is this run's own real, current absolute share count, not a buyback/dilution
multiple — the `RECORDED_SHARE_COUNT_SANITY_BAND` (`assemble.ts:727`, 0.8x–1.2x
of a real run's own `marketCap ÷ price` diluted-share estimate) would pass
trivially here, because the value proposed IS the same cover-page count a
real run's own share-count fact would read.

#### Bear

| Field | Value | Provenance |
|---|---|---|
| `revenueGrowthOrPath` | `0.08` | ANALYST JUDGEMENT PROPOSAL — a slowdown from the OBSERVED FY2026 rate (17.79%) toward the bottom of the "10-30%" band, consistent with Trigger A having fired (see `writtenAnchor`), but not a contraction. |
| `operatingMargin` | `0.4168` | ANALYST JUDGEMENT PROPOSAL — reverts fully to the OBSERVED ten-year median (41.68%, computed above), the same "reverts to the historical median" convention the companion NVDA draft and MSFT's own committed bear case both use. |
| `reinvestmentCapitalIntensity` | `0.12` | ANALYST JUDGEMENT PROPOSAL — reverts most of the way toward the pre-AI-buildout historical range (FY2016–FY2023: 8.4%–13.3% of revenue, see `capitalIntensity` evidence above), reflecting a pullback in AI/datacenter capacity investment in a demand correction. |
| `writtenAnchor` | "Trigger A has fired on this run's own real data: current margin (46.78%) sits exactly at the ten-year window's own max, and the window range (16.73pt) exceeds the 15pt policy threshold (`policy.ts` `triggerAWindowRangePoints`). Trigger B has not fired — the worst single-year decline in the window is 0.28pt, nowhere near the 10pt policy threshold — so this is a margin-reversion case, not a margin-collapse case: growth slows and margin reverts to its ten-year median, but does not contemplate a sharp single-year deterioration, because none is in the real record to anchor one to. The capex pullback mirrors this: a demand correction plausibly reduces AI/datacenter capacity investment back toward the pre-buildout range." | Analyst's own stated reasoning (ANALYST JUDGEMENT PROPOSAL), same convention as the companion NVDA draft's `writtenAnchor` fields. |

#### Base

| Field | Value | Provenance |
|---|---|---|
| `revenueGrowthOrPath` | `0.14` | ANALYST JUDGEMENT PROPOSAL — a moderate deceleration from the OBSERVED FY2026 rate (17.79%), remaining in the "10-30%" band, reflecting some normalization of AI/cloud demand growth off a much larger base. |
| `operatingMargin` | `0.45` | ANALYST JUDGEMENT PROPOSAL — below the OBSERVED FY2026 level (46.78%) but well above the ten-year median (41.68%). Reasoned from real evidence, not a round-number guess: OBSERVED depreciation + amortization nearly tripled from $20.0B (FY2024: $15.2B + $4.8B) to $39.0B (FY2026: $34.3B + $4.7B) as the capex supercycle begins depreciating — a real, disclosed mechanical drag on margin this scenario anticipates continuing, partially offset by revenue growth and operating leverage elsewhere. |
| `reinvestmentCapitalIntensity` | `0.22` | ANALYST JUDGEMENT PROPOSAL — close to the OBSERVED FY2025 ratio (22.91%), reflecting continued elevated but not accelerating capacity investment, a step down from FY2026's 34.94% peak. |
| `writtenAnchor` | "AI/datacenter demand continues but the growth rate normalizes materially off the FY2026 base; the real, disclosed D&A step-up from the FY2024–FY2026 capex supercycle (see `operatingMargin` provenance) continues to compress margin somewhat as those assets depreciate, while growth stays in the middle of the '10-30%' band rather than reverting to bear-case levels. Capital intensity steps down from FY2026's peak but stays well above the pre-FY2024 historical range, reflecting that at least some of the AI buildout is durable, not purely cyclical." | Analyst's own stated reasoning (ANALYST JUDGEMENT PROPOSAL). |

#### Bull

| Field | Value | Provenance |
|---|---|---|
| `revenueGrowthOrPath` | `0.20` | ANALYST JUDGEMENT PROPOSAL — slightly above the OBSERVED FY2026 rate (17.79%), assuming AI/cloud monetization accelerates faster than the FY2026 realized pace, crossing into the top of the "10-30%" band. |
| `operatingMargin` | `0.4678` | ANALYST JUDGEMENT PROPOSAL — holds at the OBSERVED FY2026 level (46.78%, the ten-year window max), assuming revenue growth and software-margin mix outpace the D&A step-up named in the base case. |
| `reinvestmentCapitalIntensity` | `0.30` | ANALYST JUDGEMENT PROPOSAL — near, but below, the OBSERVED FY2026 peak (34.94%), reflecting sustained aggressive capacity investment continuing near its current pace rather than decelerating. |
| `writtenAnchor` | "AI/cloud demand sustains and accelerates past the FY2026 realized rate; margin holds at its current real ten-year high because revenue growth and favorable mix outrun the depreciation step-up the base case concedes. Capital intensity stays near its FY2026 real peak rather than reverting, reflecting continued large-scale, high-conviction capacity investment." | Analyst's own stated reasoning (ANALYST JUDGEMENT PROPOSAL). |

### Terminal ROIC — a new required scenario driver, not a fact

Methodology §3.5 [S]: *"terminal FCF = terminal NOPAT × (1 − g ÷ terminal
ROIC)."* For the **scenario** DCF (as distinct from the diagnostic reverse
DCF, where it is fixed by rule at `r + 3pp`, PROVISIONAL, and scoped only to
that diagnostic): *"terminal ROIC is an analyst input with a written anchor
and must fade toward the cost of capital unless a durable moat is argued
explicitly."* Nothing already authorised or already committed supplies this
for MSFT — the committed fixture's `revalueBaseCaseAtRate: null` and its own
header ("No real revaluation-at-rate solver exists for this fixture")
confirm it was never computed for MSFT either. The three values below are
**ANALYST JUDGEMENT PROPOSAL**, exactly the kind of number
`CALVIN RULING — A, WITH AI DRAFT` (the companion NVDA precedent, issue #292)
expects Calvin to review, approve or correct — not yet reviewed or approved
for MSFT.

`lib/analyzer/modules/scenarioOutputs.ts`'s `computeScenarioEnterpriseValue`
is **not called** for any of the three figures below: its internal terminal
ROIC (`rate.plus(POLICY.terminalRoicPremium)`, i.e. a hardcoded `r + 3pp` for
every caller) is the diagnostic-reverse-DCF-only shortcut, not the scenario
driver this section drafts — the same defect the companion NVDA draft names
and leaves raised, not resolved, per the HARD BOUNDS (no bespoke DCF model,
no edit to that function).

A rough, non-authoritative cross-check only (not RONIC, not a proposed
input): current-year NOPAT ÷ (equity + debt + leases − cash & securities) =
$122,637M ÷ $472,432M ≈ **25.96%** — context for judging whether the three
proposed figures below are in a plausible range, not a computed driver and
not the methodology's own 5-year-delta RONIC definition (which this
classification does not carry the invested-capital-change inputs for).

| Scenario | `terminalRoic` | `terminalRoicAnchor` |
|---|---|---|
| Bear | Fades from 12% in year 1 linearly to `r` = 10% by year 10, held at 10% thereafter. No durable-moat exception invoked. | "The bear world is the Trigger-A margin-reversion case: growth slows and margin reverts to its real ten-year median. A correction broad enough to force that reversion plausibly compresses returns on incremental capital too, so terminal ROIC fades fully to the cost of capital by the terminal year — the §3.5 default — starting only modestly above `r` since the correction is already underway from year 1." |
| Base | Fades from 16% in year 1 linearly to `r` = 10% by year 10, held at 10% thereafter. No durable-moat exception invoked. | "The base case holds a materially higher margin through the explicit period (45% vs. bear's 41.68%) and a faster growth rate off a higher base, so the starting level is drafted above bear's — but the base case's own written anchor already concedes a real, disclosed D&A-driven margin compression is underway, which is the reason this scenario does not invoke the durable-moat exception either: a moat strong enough to hold terminal returns permanently above the cost of capital is a bull-case claim. Fades fully to `r` = 10% by the terminal year, the §3.5 default." |
| Bull | **20%, held (not faded) through the terminal year** — the §3.5 durable-moat exception, invoked explicitly. | "Durable-moat argument, made explicitly, per §3.5's own exception clause: Microsoft's Azure/Microsoft 365/Copilot ecosystem, its enterprise switching costs and scale economics in hyperscale infrastructure are AI INFERENCE from the OBSERVED ten-year margin record (a real, sustained expansion to 46.78%, the top of the ten-year window, with no material single-year decline anywhere in it) — not a fact this capture's tags can source directly, and not asserted as one. The bull scenario's own written anchor already argues margin 'holds at its current real ten-year high'; a moat strong enough to sustain that margin durably is the same moat that should sustain excess returns on incremental capital, so this scenario departs from the §3.5 default and does not fade to `r`. 20% is a judgment anchor, not a derived number: below the rough current-ROIC cross-check above (25.96%) and comfortably above `r` = 10%, reflecting sustained but bounded excess returns — exactly the kind of number this section expects Calvin to review, approve or sharpen by targeted correction, not accept as a computed fact." |

### Net debt / EV bridge inputs (FY2026, 2026-06-30, accession 0001193125-26-323660)

| Component | Value | Provenance |
|---|---|---|
| Total debt (`us-gaap:LongTermDebt`) | $40,294M | **OBSERVED FACT**. `us-gaap:CommercialPaper` and `us-gaap:ShortTermBorrowings` carry no FY2026 (2026-06-30) observation in this capture (both last reported $0 at 2025-06-30) — treated as $0 additions, not omitted, per the mapping's own `withPlus` convention. |
| Finance lease liabilities (`us-gaap:FinanceLeaseLiability`) | $66,594M | **OBSERVED FACT** — now exceeds total debt (see `balanceSheetNature` counterargument above). |
| Cash and marketable debt securities (`us-gaap:CashAndCashEquivalentsAtCarryingValue` + `us-gaap:ShortTermInvestments`) | $20,935M + $55,908M = $76,843M | **OBSERVED FACT**, same period/accession. |
| **Net debt** = total debt + finance leases − cash and securities | **$30,045M** (a net **debt** position of $30.045B) | **Computed**, from the three OBSERVED rows above. Independently reproduces `lib/analyzer/fixtures/msft.ts`'s own reconstructed $30.0B figure almost exactly — a cross-check that the fixture's EV-bridge reconstruction, though labelled synthetic, was built consistently with the real filing, not evidence that any OTHER fixture-carried figure (e.g. `scenarioValues`) is similarly grounded. |

**Leverage precondition test (§3.4 safeguard 4), computed, not asserted:**
net debt ÷ EV is small and positive in all three scenarios below — Bear
2.11%, Base 1.67%, Bull 1.12% — every reading comfortably inside the <10%
PASS band (`policy.ts`'s `leverageThreshold`), so `r` = 10% applies to firm
cash flows directly with no leverage refusal.

**§4.4 non-operating-investments judgment is explicitly not made here**
(HARD BOUNDS), same as the companion NVDA draft. The candidates this
capture carries, at book, as of 2026-06-30: `EquityMethodInvestments`
$12,000M, `EquitySecuritiesWithoutReadilyDeterminableFairValueAmount`
$12,400M, `LongTermInvestments` $36,348M (the Phase B proof's own treatment
notes the first two are subsets of the third — not separately additive).
This draft neither selects among them nor proposes a value.

### §7.1 constants

| Field | Value | Provenance |
|---|---|---|
| `nopatTaxRate` | `0.21` | ANALYST JUDGEMENT PROPOSAL — approximates the U.S. federal statutory corporate rate, the same convention and the same value the companion NVDA draft proposes and OKLO's committed bundle already carries. **Named alternative, not resolved**: the companion Phase B proof cites MSFT's actual FY2026 **effective** tax rate as 19% (10-K text, via WebSearch, not this XBRL capture — no tax-provision tag is in `tagMap.ts`), closer to the fixture's own 0.20 than to 0.21. Both are judgment calls for Calvin, not facts this capture can resolve directly; 0.21 is proposed only for consistency with the one existing cross-company convention. |
| `stressMarginLevel` | `0.3006` | ANALYST JUDGEMENT PROPOSAL — set at MSFT's own OBSERVED worst realized margin in the ten-year window (FY2017: 30.06%), the same "most severe genuinely-observed case rather than a hypothetical worse one" convention the companion NVDA draft uses. Differs materially from the fixture's own 0.38 (reconstructed from the frozen mock's disclosed "stress margin" line, not from this real series). |
| `preRevenueUnleveredRate` | *(blank — not applicable)* | This constant is read only by the pre-revenue module, which neither profile this entry surface offers ever invokes. MSFT's own committed bundle and the companion NVDA draft both leave this null for the identical reason. |
| `projectDebtCost` | *(blank — not applicable)* | Not applicable, same reason as above — a project-finance-only constant (OKLO's funding-stack module), never read for MSFT's profile. |

## Scenario values — an isolated, non-persistent plausibility calculation

**Not computed, not approved, and not an Analyzer output.** DO item 5
explicitly permits "an isolated, non-persistent calculation using labelled
hypothetical draft assumptions ... for internal plausibility checking"; this
section is exactly that, computed by hand outside any production module,
using the already-drafted drivers above and the two authorised policy
constants — never via `computeScenarioEnterpriseValue` (see "Terminal
ROIC" above) and never written anywhere runtime code reads. It exists so
Calvin can see what the proposed assumptions imply before ruling on them,
not as a claim that MSFT has a computed fair-value range today.

**Authorised, not invented:** `r` = `policy.ts`'s `rateGrid[1]` = **10%**
(the one company-level rate `assemble.ts` already commits to for every
company — not chosen for MSFT specifically); `g` = `policy.ts`'s
`terminalGrowth` = **3%** (policy default, not PROVISIONAL). Base revenue =
the OBSERVED FY2026 figure, $331,839M. Path shape: constant growth years
1–5, linear fade to `g` by year 10, terminal thereafter (`growthPath.ts`'s
one shared shape). Formula, per year *t*: NOPAT_t = Revenue_t × margin ×
(1 − `nopatTaxRate`); Reinvestment_t = Revenue_t × capital intensity; FCFF_t
= NOPAT_t − Reinvestment_t; PV_t = FCFF_t ÷ (1.10)^t — the same formula
`computeScenarioEnterpriseValue` implements, applied by hand with each
scenario's own proposed (not yet approved) terminal ROIC rather than that
function's hardcoded `r + 3pp`.

#### Bear — value per share

| Year | Growth | Revenue ($B) | NOPAT ($B) | Reinvestment ($B) | FCFF ($B) | PV @ 10% ($B) |
|---|---|---|---|---|---|---|
| 1 | 8.00% | 358.4 | 118.0 | 43.0 | 75.0 | 68.2 |
| 2 | 8.00% | 387.1 | 127.4 | 46.4 | 81.0 | 66.9 |
| 3 | 8.00% | 418.0 | 137.6 | 50.2 | 87.5 | 65.7 |
| 4 | 8.00% | 451.5 | 148.7 | 54.2 | 94.5 | 64.5 |
| 5 | 8.00% | 487.6 | 160.5 | 58.5 | 102.0 | 63.4 |
| 6 | 7.00% | 521.7 | 171.8 | 62.6 | 109.2 | 61.6 |
| 7 | 6.00% | 553.0 | 182.1 | 66.4 | 115.7 | 59.4 |
| 8 | 5.00% | 580.7 | 191.2 | 69.7 | 121.5 | 56.7 |
| 9 | 4.00% | 603.9 | 198.8 | 72.5 | 126.4 | 53.6 |
| 10 | 3.00% | 622.0 | 204.8 | 74.6 | 130.2 | 50.2 |

Sum of explicit-period PV = **$610.2B**. Terminal: NOPAT₁₀ = $204.8B, EBIT₁₀
= $259.3B. Terminal identity [S]: terminal NOPAT (year 11) = $204.8B × 1.03
= $211.0B; proposed terminal ROIC = **10%** (bear fade reaches `r` exactly
by year 10) ⇒ 1 − 0.03÷0.10 = 0.70 ⇒ terminal FCF = $211.0B × 0.70 =
**$147.7B**. Terminal value at year 10 = $147.7B ÷ 0.07 = **$2,109.5B**; PV
= $2,109.5B ÷ (1.10)^10 = **$813.3B**.

Enterprise value = $610.2B + $813.3B = **$1,423.5B**. Equity value = EV −
net debt $30.045B = **$1,393.5B**. **Value per share = $1,393.5B ÷
7,425,545,491 = $187.66.**

Companions (§3.5, [S]): terminal share of value = $813.3B ÷ $1,423.5B =
**57.1%** — below the 60–75% normal band for a ten-year explicit period
(neither the >75% caution nor the >85% multiple-in-disguise band applies);
a low terminal share says the bear case's value sits mostly in the explicit
decade, not in perpetuity. Implied exit multiple = terminal value at year 10
÷ EBIT₁₀ = $2,109.5B ÷ $259.3B = **8.14× EV/EBIT**. Net debt ÷ EV = 2.11%
(PASS, <10%). ±1% rate sensitivity: r = 9% ⇒ $222.19 (**+18.4%**); r = 11%
⇒ $161.90 (**−13.7%**).

#### Base — value per share

| Year | Growth | Revenue ($B) | NOPAT ($B) | Reinvestment ($B) | FCFF ($B) | PV @ 10% ($B) |
|---|---|---|---|---|---|---|
| 1 | 14.00% | 378.3 | 134.5 | 83.2 | 51.3 | 46.6 |
| 2 | 14.00% | 431.3 | 153.3 | 94.9 | 58.4 | 48.3 |
| 3 | 14.00% | 491.6 | 174.8 | 108.2 | 66.6 | 50.0 |
| 4 | 14.00% | 560.5 | 199.2 | 123.3 | 75.9 | 51.9 |
| 5 | 14.00% | 638.9 | 227.1 | 140.6 | 86.6 | 53.8 |
| 6 | 11.80% | 714.3 | 253.9 | 157.2 | 96.8 | 54.6 |
| 7 | 9.60% | 782.9 | 278.3 | 172.2 | 106.1 | 54.4 |
| 8 | 7.40% | 840.8 | 298.9 | 185.0 | 113.9 | 53.2 |
| 9 | 5.20% | 884.6 | 314.5 | 194.6 | 119.9 | 50.8 |
| 10 | 3.00% | 911.1 | 323.9 | 200.4 | 123.5 | 47.6 |

Sum of explicit-period PV = **$511.2B**. Terminal: NOPAT₁₀ = $323.9B, EBIT₁₀
= $410.0B. Terminal NOPAT (year 11) = $323.9B × 1.03 = $333.6B; proposed
terminal ROIC = **10%** (base also fades to `r` exactly by year 10) ⇒ 1 −
0.03÷0.10 = 0.70 ⇒ terminal FCF = $333.6B × 0.70 = **$233.5B**. Terminal
value at year 10 = $233.5B ÷ 0.07 = **$3,336.1B**; PV = $3,336.1B ÷
(1.10)^10 = **$1,286.2B**.

Enterprise value = $511.2B + $1,286.2B = **$1,797.4B**. Equity value = EV −
$30.045B = **$1,767.4B**. **Value per share = $1,767.4B ÷ 7,425,545,491 =
$238.01.**

Companions: terminal share of value = $1,286.2B ÷ $1,797.4B = **71.6%** —
inside the 60–75% normal band. Implied exit multiple = $3,336.1B ÷ $410.0B
= **8.14× EV/EBIT** — identical to bear's, because both scenarios' terminal
ROIC fades fully to the same `r` = 10%, a direct consequence of the [S]
terminal identity (the ratio depends only on the after-tax rate, `g`,
terminal ROIC and `r`), not a coincidence. Net debt ÷ EV = 1.67% (PASS).
±1% sensitivity: r = 9% ⇒ $289.81 (**+21.8%**); r = 11% ⇒ $199.90
(**−16.0%**).

#### Bull — value per share

| Year | Growth | Revenue ($B) | NOPAT ($B) | Reinvestment ($B) | FCFF ($B) | PV @ 10% ($B) |
|---|---|---|---|---|---|---|
| 1 | 20.00% | 398.2 | 147.2 | 119.5 | 27.7 | 25.2 |
| 2 | 20.00% | 477.8 | 176.6 | 143.4 | 33.2 | 27.5 |
| 3 | 20.00% | 573.4 | 211.9 | 172.0 | 39.9 | 30.0 |
| 4 | 20.00% | 688.1 | 254.3 | 206.4 | 47.9 | 32.7 |
| 5 | 20.00% | 825.7 | 305.2 | 247.7 | 57.4 | 35.7 |
| 6 | 16.60% | 962.8 | 355.8 | 288.8 | 67.0 | 37.8 |
| 7 | 13.20% | 1,089.9 | 402.8 | 327.0 | 75.8 | 38.9 |
| 8 | 9.80% | 1,196.7 | 442.3 | 359.0 | 83.2 | 38.8 |
| 9 | 6.40% | 1,273.3 | 470.6 | 382.0 | 88.6 | 37.6 |
| 10 | 3.00% | 1,311.5 | 484.7 | 393.4 | 91.2 | 35.2 |

Sum of explicit-period PV = **$339.3B**. Terminal: NOPAT₁₀ = $484.7B, EBIT₁₀
= $613.5B. Terminal NOPAT (year 11) = $484.7B × 1.03 = $499.2B; proposed
terminal ROIC = **20%, held, not faded** (the durable-moat exception) ⇒ 1 −
0.03÷0.20 = 0.85 ⇒ terminal FCF = $499.2B × 0.85 = **$424.3B**. Terminal
value at year 10 = $424.3B ÷ 0.07 = **$6,061.9B**; PV = $6,061.9B ÷
(1.10)^10 = **$2,337.1B**.

Enterprise value = $339.3B + $2,337.1B = **$2,676.4B**. Equity value = EV −
$30.045B = **$2,646.3B**. **Value per share = $2,646.3B ÷ 7,425,545,491 =
$356.38.**

Companions: terminal share of value = $2,337.1B ÷ $2,676.4B = **87.3%** —
**candidly flagged**: this is ABOVE the 85% "multiple in disguise" band
(methodology §3.4, same band the companion NVDA draft's bear case sat well
inside of). This is a direct, mechanical consequence of this scenario's own
proposed assumptions — a low explicit-period reinvestment efficiency (FCFF
is small relative to NOPAT in the early years because reinvestment
intensity is proposed at 30% of revenue) combined with an un-faded,
elevated terminal ROIC — not a sign of a calculation error, and not resolved
by this draft: it is reported, per methodology's own "report it every time"
instruction, precisely so Calvin can see it before ruling, and is one
reason the bull case's proposed drivers deserve particular scrutiny, not
just approval. Implied exit multiple = $6,061.9B ÷ $613.5B = **9.88×
EV/EBIT** — higher than bear/base's 8.14×, from the durable-moat exception
holding terminal ROIC at 20% instead of fading to 10%. Net debt ÷ EV =
1.12% (PASS). ±1% sensitivity: r = 9% ⇒ $446.46 (**+25.3%**); r = 11% ⇒
$290.87 (**−18.4%**).

**Provenance.** All three value-per-share figures are **computed**, not AI
inference and not sourced fact: computed deterministically from authorised
policy constants (`r`, `g`), already-OBSERVED figures (FY2026 revenue, the
net-debt bridge, share count), and the already-drafted, **not yet
approved**, ANALYST JUDGEMENT PROPOSAL drivers (growth, margin, capital
intensity, terminal ROIC per scenario) — every input is individually
labelled above at its own source.

| Scenario | growth | margin | reinvestment | terminal ROIC | Terminal share | Implied exit multiple | ±1% sensitivity | Value/share |
|---|---|---|---|---|---|---|---|---|
| Bear | 8% | 41.68% | 12% | 10% (fades to `r`) | 57.1% | 8.14× EV/EBIT | +18.4% / −13.7% | **$187.66** |
| Base | 14% | 45.0% | 22% | 10% (fades to `r`) | 71.6% | 8.14× EV/EBIT | +21.8% / −16.0% | **$238.01** |
| Bull | 20% | 46.78% | 30% | 20% (durable-moat exception) | 87.3% ⚠️ above 85% band | 9.88× EV/EBIT | +25.3% / −18.4% | **$356.38** |

## Evidence gaps — named, not defaulted

- **This capture carries no segment-level revenue breakdown** (e.g. Azure /
  Intelligent Cloud vs. More Personal Computing). `tagMap.ts` reads only
  total-company tags, so every growth/margin assumption above is reasoned
  from consolidated figures, not from the cloud-specific growth trajectory
  that would ordinarily sharpen a forward view of an AI-era hyperscaler.
  Named as a real limitation of what this capture and this mapping can
  support, not resolved by inventing a segment split.
- **MSFT's FY2026 effective tax rate (19%, per the Phase B proof's 10-K-text
  citation) differs from this draft's proposed 21% convention figure** — see
  `nopatTaxRate` above. Neither is a fact this capture's tags can resolve
  (no tax-provision tag is in `tagMap.ts`); both are named, and the choice
  between them is left to Calvin.
- **The AI/datacenter capex step-up (FY2024–FY2026) is too recent for this
  draft to say whether it is cyclical or structural** — three data points
  (18.14%, 22.91%, 34.94% of revenue) show acceleration, not yet a new
  steady state. Every scenario's `reinvestmentCapitalIntensity` above is a
  judgment about where on that curve the business settles, explicitly named
  as such, not read off a stabilized multi-year average that does not yet
  exist in the real record.
- **The §4.4 non-operating-investments judgment is explicitly not made
  here** (HARD BOUNDS) — see the net-debt/EV-bridge section above for the
  three candidate tags and their FY2026 book values.
- **Off-balance-sheet / lease- and supply-agreement-financed AI capacity is
  not captured by the cash-capex ratio** used for `capitalIntensity` and for
  each scenario's `reinvestmentCapitalIntensity` — the same limitation the
  companion NVDA draft names for its own capex ratio, and the same one the
  Phase B shadow-DCF proof names for its reinvestment rate. Not resolved
  here; flagged as a likely understatement of true reinvestment, if
  anything.

## What approving and running this draft would, and would not, unlock

**Would unlock:** nothing new for MSFT's achieved-growth comparator that
isn't already available — `us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax`
is current (not retired, unlike NVIDIA's case) and reaches back to FY2016,
giving both a five-year and a ten-year window with no gap. This draft does
not compute or state the resulting CAGR figures (that would be an
achieved-comparator finding, out of scope for an unapproved draft, same
HARD BOUNDS the companion NVDA draft observes).

**Would not unlock, on its own:** a genuine production fair-value range.
MSFT already has a committed fixture bundle and `prices.json` carries a row
for it, so (unlike NVDA) MSFT is already resolvable today — through the
fixture, not through this draft. What this draft's approval and recording
WOULD change, per issue #435's own OUTCOME: the recorded-bundle path
(`CF-ANALYZER-REAL-VALUATION-UNBLOCK-01`, PR #434) already prefers a
recorded row over the committed fixture, so recording the inputs below
(after Calvin rules on them) would be what makes MSFT's own real run stop
reading the fixture's synthetic scenario values and start reading real,
sourced, Calvin-approved ones — the next phase, explicitly downstream of
this ruling, not performed by this outcome.

## What this draft does not do

No call to `recordAnalystBundle`. No change to `BUNDLES` or
`TICKERS_WITH_ANALYST_INPUTS`. No row written to
`analyzer_recorded_analyst_bundles`. No change to
`lib/analyzer/fixtures/msft.ts`, to any runtime module, to `policy.ts`, or
to any other company's bundle. No report run, no verdict, no BUY/HOLD/SELL,
no new finance-policy threshold. No §4.4 non-operating-investments
selection made. The scenario values above are an isolated, non-persistent,
clearly-labelled plausibility calculation — not a confirmed live valuation,
not consumed by any Analyzer output today.

## The single closed Calvin approval question

Per issue #435 DO item 6: **approve all specified draft scenario/assumption
choices above as written? Yes / changes needed.**

This covers, as one consolidated decision: the `profile` and classification
inputs; all three scenarios' `revenueGrowthOrPath` / `operatingMargin` /
`reinvestmentCapitalIntensity` / `shareCount` / `writtenAnchor`; all three
scenarios' proposed `terminalRoic` / `terminalRoicAnchor`; the two proposed
§7.1 constants (`nopatTaxRate`, `stressMarginLevel`); and, as the
isolated plausibility calculation these approvals would make meaningful,
the three resulting scenario dollar values (Bear $187.66, Base $238.01,
Bull $356.38) under the current approved scenario-DCF methodology. A
**"changes needed"** answer may name specific fields to correct rather than
rejecting the whole draft; nothing here is recorded, resolvable, or binding
until Calvin rules.
