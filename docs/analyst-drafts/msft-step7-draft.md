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

## Correction (CALVIN RULING — CHANGES NEEDED, PR #436 comment #6187049310)

Calvin reviewed the prior head (`11fbfd2b`) and ruled **CHANGES NEEDED**,
naming three specific corrections plus one separately-named blocker that
stays explicitly open. This draft now addresses all three:

1. **Capital intensity and reinvestment** — reconciled the draft's gross
   cash-capex/revenue measure against §7.2 M5's governing lease-inclusive
   net-reinvestment formula. See "Gross capital intensity vs. the governing
   net-reinvestment definition" below: two of that formula's five REQUIRED
   inputs (`acquisitions`, `deltaNwc`) have no tag mapping anywhere in this
   codebase and are never acquired for any company, a real pre-existing gap
   named rather than papered over. The best currently-answerable partial
   reconstruction (capex + finance-lease ROU additions − D&A) is computed
   for the full ten-year window and is materially lower than the gross
   measure throughout, but — because the forward `reinvestmentCapitalIntensity`
   driver is, by §5.4's own existing design, the same gross-style measure
   the runtime scenario function actually consumes — this reconciliation
   does not warrant changing the proposed 12% / 22% / 30% scenario drivers,
   named explicitly rather than defaulted.
2. **Classification** — `fcfCharacter` is now justified primarily from real
   `us-gaap:NetCashProvidedByUsedInOperatingActivities` cash-flow evidence
   (ten years positive, one shallow single-year decline), not operating-margin
   stability alone; the classification itself is unchanged
   (`positive_stable`). `balanceSheetNature` is reassessed against real
   capital-intensity evidence — including the datacenter investment
   cycle — using the one existing mechanical precedent this codebase already
   has for this exact field (`aiProposedBundle.ts`'s capital-intensity
   threshold, `CALVIN RULING — A`, issue #399) rather than the equity-vs-debt
   snapshot alone, and now reads `asset-heavy`, not `asset-light`.
3. **Tax** — `nopatTaxRate` changes from 0.21 (a generic cross-company
   convention) to **0.19**, MSFT's own real, disclosed FY2026 effective tax
   rate, a company-specific, smallest-justified correction. Every scenario
   value and runtime-equivalent figure below is recomputed at 0.19 — the
   drivers themselves (growth, margin, reinvestment, terminal ROIC) are
   unchanged.

**Separately named blocker, left exactly as open as before, per Calvin's own
instruction**: the governing scenario-DCF methodology's scenario-specific
terminal ROIC vs. the runtime's fixed 13% (`r + 3pp`) divergence is
unresolved and untouched — no runtime or policy file is edited by this
correction, consistent with the HARD BOUNDS.

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
| `fcfCharacter` | `positive_stable` | **OBSERVED FACT (primary) + AI INFERENCE (corroborating).** **Correction (CALVIN RULING — CHANGES NEEDED, item 2):** the original draft reasoned this field from operating-margin stability alone; margin stability is evidence of earnings quality, not of cash-flow character, so it is demoted here to corroborating. The primary evidence is `us-gaap:NetCashProvidedByUsedInOperatingActivities` itself, the real cash-flow-statement line, for the same ten-year window used elsewhere in this draft: FY2017 $39,507M, FY2018 $43,884M, FY2019 $52,185M, FY2020 $60,675M, FY2021 $76,740M, FY2022 $89,035M, FY2023 $87,582M, FY2024 $118,548M, FY2025 $136,162M, FY2026 $182,935M — every single year operating-cash-flow-POSITIVE, with exactly one year-over-year decline in the whole window (FY2022→FY2023, $89,035M→$87,582M, **−1.63%**) and nine years of growth, including the three-year AI-buildout acceleration. This is now direct cash-flow evidence for `positive_stable` (positive throughout, materially stable, one shallow dip), not an inference from margin alone. The corroborating margin-stability reasoning (16.73pt ten-year range, 0.28pt worst single-year decline, below) is retained as a second, consistent signal, not the sole basis. |
| `revenueGrowthBand` | `10-30%` | **OBSERVED FACT** — computed from `us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax` (current for this filer; MSFT has not stopped reporting it, unlike NVIDIA's retired-tag case in the companion NVDA draft): FY2025 revenue $281,724M (period 2025-06-30, one year) → FY2026 revenue $331,839M (period 2026-06-30), both accession 0001193125-26-323660 (FY2026 10-K). Growth = (331,839 − 281,724) / 281,724 = **17.7887%**. |
| `capitalIntensity` | `0.3494` | **OBSERVED FACT**, FY2026: `us-gaap:PaymentsToAcquirePropertyPlantAndEquipment` $115,948M (period 2025-07–2026-06, accession 0001193125-26-323660) ÷ `us-gaap:Revenues` candidate's winning tag, same period/accession, revenue $331,839M = **34.94%**. This is a real, disclosed step-up — not a data artifact: the same ratio was 8.42%–13.26% every year FY2017–FY2023, then 18.14% (FY2024), 22.91% (FY2025), 34.94% (FY2026) — a three-year acceleration consistent with the AI/datacenter capex buildout, the same figure the Phase B shadow-DCF proof already cites and flags identically ("real, disclosed step-up ... not a data artifact"). **This is a GROSS, cash-capex-only measure — see "Gross capital intensity vs. the governing net-reinvestment definition" below (CALVIN RULING — CHANGES NEEDED, item 1) for the reconciliation against §7.2 M5's lease-inclusive net reinvestment formula.** Flagged as a limitation of the ratio, not resolved: this is cash PP&E capex only; it does not capture off-balance-sheet, lease- or supply-agreement-financed datacenter capacity, which is not tagged under any candidate this mapping reads (the same limitation the companion NVDA draft names for its own capex ratio). |
| `cyclicality.tenYearMarginRange` | `0.1673` (16.73pt) | **OBSERVED FACT**, derived from `us-gaap:OperatingIncomeLoss` ÷ the winning revenue tag for the ten most recent fiscal years both tags cover: FY2017–FY2026 (FY2016 is the eleventh year both tags cover and is excluded to keep exactly ten, per the same "ten most recent" rule the companion NVDA draft applies). Margins: FY2017 30.06%, FY2018 31.77%, FY2019 34.14%, FY2020 37.03%, FY2021 41.59%, FY2022 42.06%, FY2023 41.77%, FY2024 44.64%, FY2025 45.62%, FY2026 46.78%. Max 46.78% (FY2026) − min 30.06% (FY2017) = **16.73pt**. |
| `cyclicality.worstSingleYearChange` | `0.0028` (0.28pt) | **OBSERVED FACT**, same ten-year series: the only year-over-year decline in the window is FY2022 (42.06%) → FY2023 (41.77%) = **0.28pt** — computed the same way `lib/analyzer/marginMath.ts`'s `worstSingleYearDecline` computes it (largest positive decline between adjacent entries). Every other year-over-year change in the window is an increase. |
| `balanceSheetNature` | `asset-heavy` | **AI INFERENCE — corrected (CALVIN RULING — CHANGES NEEDED, item 2).** The original draft called this `asset-light` from a pure equity-vs-debt balance-sheet snapshot (equity $442,387M vs. debt+leases $106,888M), which Calvin's ruling asked to be reassessed against genuine asset/capital-intensity evidence rather than that snapshot alone. This codebase already has exactly one other place that classifies this same field from real data, mechanically: `lib/analyzer/acquisition/aiProposedBundle.ts:144-145`'s AI-proposed-bundle path (authorised by `CALVIN RULING — A`, issue #399, `CF-ANALYZER-V1-SETTLE-01`) sets `balanceSheetNature = "asset-light"` only when the company's own reinvestment/capital-intensity figure is **below 10% of revenue**, and `"asset-heavy"` otherwise — capital intensity alone, not the equity/debt composition test. Applying that SAME approved, mechanical, already-in-production threshold to MSFT's own real capital intensity — 34.94% FY2026 gross (above), or 30.60% even on the lease-inclusive net-of-D&A reconstruction below — both land far above the 10% line. On the one existing codebase convention for this exact judgment, MSFT is `asset-heavy`, not `asset-light`; this draft now calls it that. **Named alternative, not silently dropped**: the equity-vs-debt snapshot (equity dwarfing debt-equivalent liabilities) is real and still true, and is retained below as the named counter-reading a reviewer could instead weigh more heavily — but it is no longer this draft's own call, because Calvin's instruction was specifically to weigh capital-intensity evidence, including the datacenter investment cycle, over that snapshot. `us-gaap:FinanceLeaseLiability` ($66,594M) now EXCEEDS `us-gaap:LongTermDebt` ($40,294M) for the first time in this window, and finance-lease ROU additions have grown from $3,128M (FY2023) to $24,608M (FY2026) — real, disclosed, accelerating evidence of a structurally more capital-intensive, infrastructure-owning business, consistent with flipping this classification. |

### Gross capital intensity vs. the governing net-reinvestment definition (CALVIN RULING — CHANGES NEEDED, item 1)

**What `capitalIntensity` above is, and is not.** The §6.3 classification field
above (34.94% FY2026) and each scenario's `reinvestmentCapitalIntensity`
driver below (12% / 22% / 30%) are both the **gross, cash-capex-only**
measure: `capex ÷ revenue`, no other component. This codebase's own governing
net-reinvestment definition is a different, materially more complete
formula, implemented in production today for a different diagnostic (M5,
§7.2, `lib/analyzer/modules/reinvestmentRonic.ts`'s `computeReinvestment`):

> Reinvestment = capex + acquisitions + finance-lease ROU assets obtained −
> D&A + ΔNWC

**This is not computable for MSFT today — a pre-existing codebase gap, not
one this draft introduces or can fix (HARD BOUNDS: no runtime change).**
Two of that formula's five REQUIRED inputs, `acquisitions` and `deltaNwc`,
have no entry at all in `lib/analyzer/acquisition/tagMap.ts` — no SEC tag is
mapped for either — and are hardcoded `null` at every call site in
`lib/analyzer/acquisition/companyInputs.ts`. `computeReinvestment` refuses to
produce a value when any REQUIRED input is missing (`"missing REQUIRED
input(s): acquisitions, deltaNwc"`), so M5's own reinvestment figure is
structurally `INCOMPLETE` for MSFT, and for every other company this
codebase acquires — this is not an MSFT-specific gap this draft found, it is
true of the whole acquisition pipeline today.

**Best currently-answerable reconciliation**, using the three components
this capture does carry — capex, finance-lease ROU additions obtained
(`us-gaap:RightOfUseAssetObtainedInExchangeForFinanceLeaseLiability`, §3.6 —
explicitly the ROU-assets-obtained disclosure, not the year-over-year change
in the lease liability, which nets off principal repayments and understates
the period's investment) and D&A (`us-gaap:Depreciation` +
`us-gaap:AmortizationOfIntangibleAssets`) — computed for the same ten-year
window as `capitalIntensity` above, all from the same committed capture:

| FY | Capex | Finance-lease ROU additions | D&A | Net reinvestment (partial — excludes acquisitions, ΔNWC) | Revenue | Gross capex/revenue | Net/revenue (partial) |
|---|---|---|---|---|---|---|---|
| 2017 | $8,129M | $1,773M | $7,800M | $2,102M | $96,571M | 8.42% | 2.18% |
| 2018 | $11,632M | $1,933M | $9,900M | $3,665M | $110,360M | 10.54% | 3.32% |
| 2019 | $13,925M | $2,532M | $11,600M | $4,857M | $125,843M | 11.07% | 3.86% |
| 2020 | $15,441M | $3,467M | $12,300M | $6,608M | $143,015M | 10.80% | 4.62% |
| 2021 | $20,622M | $3,290M | $10,900M | $13,012M | $168,088M | 12.27% | 7.74% |
| 2022 | $23,886M | $4,234M | $14,600M | $13,520M | $198,270M | 12.05% | 6.82% |
| 2023 | $28,107M | $3,128M | $13,500M | $17,735M | $211,915M | 13.26% | 8.37% |
| 2024 | $44,477M | $11,633M | $20,000M | $36,110M | $245,122M | 18.14% | 14.73% |
| 2025 | $64,551M | $20,511M | $28,000M | $57,062M | $281,724M | 22.91% | 20.25% |
| 2026 | $115,948M | $24,608M | $39,000M | $101,556M | $331,839M | 34.94% | 30.60% |

The lease-inclusive, D&A-net partial reconstruction is **materially LOWER**
than the gross cash-capex ratio in every single year of the window — roughly
half, in most years — because D&A (now a large, fast-growing subtraction as
the AI-buildout capex itself starts depreciating) outweighs the finance-lease
ROU add-back. It does not reverse the acceleration finding: FY2026's partial
net figure (30.60%) is still the highest in the window by a wide margin, and
the three-year AI-buildout step-up is visible on either measure. Omitting
acquisitions and ΔNWC leaves a genuine, named gap in both directions (an
acquisition-funded capacity addition would push the net figure up; a
working-capital release, e.g. from growing deferred/unearned revenue, would
likely push it down further) — not resolved here, flagged as missing
evidence, consistent with the Phase B shadow-DCF proof naming the identical
ΔNWC gap for its own reinvestment-rate calculation.

**Does this change the proposed scenario drivers? No — named explicitly,
not defaulted.** `lib/analyzer/modules/scenarioOutputs.ts`'s
`computeScenarioEnterpriseValue` (the function that would actually run
against a recorded, fully-driven bundle — see "Terminal ROIC" below) drives
its forward reinvestment term directly off `reinvestmentCapitalIntensity` as
`revenue × intensity` — the same simple, gross, capex-style convention
§5.4's scenario matrix was designed around, not M5's net-reinvestment
formula. The two were never meant to be the same number: §6.3's historical
classification and §5.4's forward scenario driver are both, by this
codebase's own existing design, the simpler gross measure, and M5's
lease-inclusive net formula is a separate historical diagnostic feeding a
different module (RONIC) entirely. Reconciling the definitions, as Calvin's
ruling asks, therefore does not by itself warrant changing the bear/base/bull
12% / 22% / 30% proposals below — they already express gross capital
intensity, which is the input the runtime driver this bundle would actually
feed is built to consume. The net-reinvestment reconstruction above is cited
as fuller context for judging true reinvestment intensity, not as a
replacement driver.

### Scenarios

Each scenario's growth/margin/reinvestment drivers and its resulting
scenario value are the analyst's own forward judgment — Step 7 has no
classifier or solver behind this entry form. None of the three drivers
below is asserted as fact; each is **ANALYST JUDGEMENT PROPOSAL**, reasoned
from the OBSERVED historical series above, and every one of them is exactly
what Calvin's review is for.

**Distinct from M14's existing MSFT sensitivity axes (DO item 4).** MSFT
already has a growth axis (10.0% / 13.7% / 18.5%) and an operating-margin
axis (38.0% / 41.8% / 46.8%) captured for M14's tornado/two-way sensitivity
tables (`analystInputs.ts`'s `MSFT_GROWTH_RANGE` / `MSFT_OPERATING_MARGIN_RANGE`,
`CALVIN RULING — A`, issue #324). Those three-point axes are cited directly
from `MSFT_FIXTURE`'s own committed bear/base/bull scenario values and
already-acquired M3 diagnostics (median/current margin) — they are **not**
this draft's real-data-sourced Step-7 forecasts below (growth 8% / 14% /
20%, margin 41.68% / 45% / 46.78%), which propose different drivers
entirely. Approving this draft does not change M14's existing
fixture-sourced sensitivity capture; the two live side by side until a
future outcome reconciles them, if ever.

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

**Correction (REVIEW-38696980049-1).** The companion NVDA draft's claim that
`computeScenarioEnterpriseValue` is "wired only into the M14 sensitivity
tables, never into the path that produces a company's committed
`scenarioValues`" was accurate when written, but PR #434
(`CF-ANALYZER-REAL-VALUATION-UNBLOCK-01`) changed that: `assemble.ts`'s
`dynamicScenarioValue` now calls this exact function to recompute a
**recorded** bundle's scenario values whenever every scenario's three
drivers are authored (`recordedScenarioValuesComputeFromDrivers`,
`recordedBundles.ts:341`) — true for all three scenarios proposed below. So
`computeScenarioEnterpriseValue` is not a diagnostic-only shortcut this
draft can set aside; it is the actual function that would run against these
drivers once this bundle is recorded. Its terminal ROIC
(`rate.plus(POLICY.terminalRoicPremium)` = `r + 3pp` = **13% for every
scenario**) is hardcoded and has no parameter for a per-scenario value to
flow into — it would override, not consume, the three proposed terminal
ROIC values below. This is a real, unresolved divergence between
methodology §3.5's "terminal ROIC is an analyst input" rule for the
scenario DCF and what the runtime actually computes once a bundle is both
recorded and fully driven; it is named here, not resolved (per the HARD
BOUNDS, `computeScenarioEnterpriseValue` is not edited by this outcome).
See "Runtime-equivalent values" below for what recording this bundle, as
proposed, would actually produce per share.

A rough, non-authoritative cross-check only (not RONIC, not a proposed
input): current-year NOPAT ÷ (equity + debt + leases − cash & securities) =
$125,742M ÷ $472,432M ≈ **26.61%** (NOPAT recomputed at the corrected
`nopatTaxRate` = 0.19: $155,237M × (1 − 0.19) = $125,742M, matching the Phase
B proof's own EBIT×(1−19%) figure exactly) — context for judging whether the
three proposed figures below are in a plausible range, not a computed driver
and not the methodology's own 5-year-delta RONIC definition (which this
classification does not carry the invested-capital-change inputs for).

| Scenario | `terminalRoic` | `terminalRoicAnchor` |
|---|---|---|
| Bear | Fades from 12% in year 1 linearly to `r` = 10% by year 10, held at 10% thereafter. No durable-moat exception invoked. | "The bear world is the Trigger-A margin-reversion case: growth slows and margin reverts to its real ten-year median. A correction broad enough to force that reversion plausibly compresses returns on incremental capital too, so terminal ROIC fades fully to the cost of capital by the terminal year — the §3.5 default — starting only modestly above `r` since the correction is already underway from year 1." |
| Base | Fades from 16% in year 1 linearly to `r` = 10% by year 10, held at 10% thereafter. No durable-moat exception invoked. | "The base case holds a materially higher margin through the explicit period (45% vs. bear's 41.68%) and a faster growth rate off a higher base, so the starting level is drafted above bear's — but the base case's own written anchor already concedes a real, disclosed D&A-driven margin compression is underway, which is the reason this scenario does not invoke the durable-moat exception either: a moat strong enough to hold terminal returns permanently above the cost of capital is a bull-case claim. Fades fully to `r` = 10% by the terminal year, the §3.5 default." |
| Bull | **20%, held (not faded) through the terminal year** — the §3.5 durable-moat exception, invoked explicitly. | "Durable-moat argument, made explicitly, per §3.5's own exception clause: Microsoft's Azure/Microsoft 365/Copilot ecosystem, its enterprise switching costs and scale economics in hyperscale infrastructure are AI INFERENCE from the OBSERVED ten-year margin record (a real, sustained expansion to 46.78%, the top of the ten-year window, with no material single-year decline anywhere in it) — not a fact this capture's tags can source directly, and not asserted as one. The bull scenario's own written anchor already argues margin 'holds at its current real ten-year high'; a moat strong enough to sustain that margin durably is the same moat that should sustain excess returns on incremental capital, so this scenario departs from the §3.5 default and does not fade to `r`. 20% is a judgment anchor, not a derived number: below the rough current-ROIC cross-check above (26.61%) and comfortably above `r` = 10%, reflecting sustained but bounded excess returns — exactly the kind of number this section expects Calvin to review, approve or sharpen by targeted correction, not accept as a computed fact." |

### Net debt / EV bridge inputs (FY2026, 2026-06-30, accession 0001193125-26-323660)

| Component | Value | Provenance |
|---|---|---|
| Total debt (`us-gaap:LongTermDebt`) | $40,294M | **OBSERVED FACT**. `us-gaap:CommercialPaper` and `us-gaap:ShortTermBorrowings` carry no FY2026 (2026-06-30) observation in this capture (both last reported $0 at 2025-06-30) — treated as $0 additions, not omitted, per the mapping's own `withPlus` convention. |
| Finance lease liabilities (`us-gaap:FinanceLeaseLiability`) | $66,594M | **OBSERVED FACT** — now exceeds total debt (see `balanceSheetNature` counterargument above). |
| Cash and marketable debt securities (`us-gaap:CashAndCashEquivalentsAtCarryingValue` + `us-gaap:ShortTermInvestments`) | $20,935M + $55,908M = $76,843M | **OBSERVED FACT**, same period/accession. |
| **Net debt** = total debt + finance leases − cash and securities | **$30,045M** (a net **debt** position of $30.045B) | **Computed**, from the three OBSERVED rows above. Independently reproduces `lib/analyzer/fixtures/msft.ts`'s own reconstructed $30.0B figure almost exactly — a cross-check that the fixture's EV-bridge reconstruction, though labelled synthetic, was built consistently with the real filing, not evidence that any OTHER fixture-carried figure (e.g. `scenarioValues`) is similarly grounded. |

**Leverage precondition test (§3.4 safeguard 4), computed, not asserted:**
net debt ÷ EV is small and positive in all three scenarios below — Bear
2.05%, Base 1.61%, Bull 1.08% (recomputed at the corrected `nopatTaxRate` =
0.19, CALVIN RULING — CHANGES NEEDED item 3) — every reading comfortably
inside the <10% PASS band (`policy.ts`'s `leverageThreshold`), so `r` = 10%
applies to firm cash flows directly with no leverage refusal.

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
| `nopatTaxRate` | `0.19` | ANALYST JUDGEMENT PROPOSAL — **corrected (CALVIN RULING — CHANGES NEEDED, item 3).** The original draft proposed 0.21, the U.S. federal statutory rate, carried over from the companion NVDA draft and OKLO's committed bundle purely for cross-company consistency — not a company-specific rationale, which is what Calvin's ruling asked for. MSFT's own FY2026 real, disclosed **effective** tax rate is **19%** (FY2025: 18%), stated directly in the 10-K's tax-provision note (10-K text, via WebSearch, not this XBRL capture — no tax-provision tag is in `tagMap.ts`) and independently cross-checked in the already-committed, already-reviewed Phase B shadow-DCF proof (`docs/proof/cf-analyzer-msft-valuation-phase-b-proof-01.md`, PR #428): provision-implied effective rate = tax provision ÷ (net income + tax provision) = $32,185M ÷ ($133,749M + $32,185M) = **19.4%**, consistent with the 10-K's own stated 19%. This is a real, company-specific, disclosed figure, not a generic convention — the smallest justified correction is to adopt it directly: **0.19**, not 0.21. The 0.21 federal-statutory convention is named below as the superseded alternative, not silently dropped. All "Scenario values" and "Runtime-equivalent values" figures below are recomputed at 0.19. |
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
function's hardcoded `r + 3pp`. **Recomputed throughout at the corrected
`nopatTaxRate` = 0.19 (CALVIN RULING — CHANGES NEEDED, item 3; was 0.21)** —
every figure in this section and in "Runtime-equivalent values" below
differs from the figures a prior head of this draft showed, for that reason
alone; no driver (growth, margin, reinvestment intensity, terminal ROIC) changed.

#### Bear — value per share

| Year | Growth | Revenue ($B) | NOPAT ($B) | Reinvestment ($B) | FCFF ($B) | PV @ 10% ($B) |
|---|---|---|---|---|---|---|
| 1 | 8.00% | 358.4 | 121.0 | 43.0 | 78.0 | 70.9 |
| 2 | 8.00% | 387.1 | 130.7 | 46.4 | 84.2 | 69.6 |
| 3 | 8.00% | 418.0 | 141.1 | 50.2 | 91.0 | 68.3 |
| 4 | 8.00% | 451.5 | 152.4 | 54.2 | 98.2 | 67.1 |
| 5 | 8.00% | 487.6 | 164.6 | 58.5 | 106.1 | 65.9 |
| 6 | 7.00% | 521.7 | 176.1 | 62.6 | 113.5 | 64.1 |
| 7 | 6.00% | 553.0 | 186.7 | 66.4 | 120.3 | 61.8 |
| 8 | 5.00% | 580.7 | 196.0 | 69.7 | 126.4 | 58.9 |
| 9 | 4.00% | 603.9 | 203.9 | 72.5 | 131.4 | 55.7 |
| 10 | 3.00% | 622.0 | 210.0 | 74.6 | 135.4 | 52.2 |

Sum of explicit-period PV = **$634.5B**. Terminal: NOPAT₁₀ = $210.0B, EBIT₁₀
= $259.3B. Terminal identity [S]: terminal NOPAT (year 11) = $210.0B × 1.03
= $216.3B; proposed terminal ROIC = **10%** (bear fade reaches `r` exactly
by year 10) ⇒ 1 − 0.03÷0.10 = 0.70 ⇒ terminal FCF = $216.3B × 0.70 =
**$151.4B**. Terminal value at year 10 = $151.4B ÷ 0.07 = **$2,162.9B**; PV
= $2,162.9B ÷ (1.10)^10 = **$833.9B**.

Enterprise value = $634.5B + $833.9B = **$1,468.4B**. Equity value = EV −
net debt $30.045B = **$1,438.4B**. **Value per share = $1,438.4B ÷
7,425,545,491 = $193.71.**

Companions (§3.5, [S]): terminal share of value = $833.9B ÷ $1,468.4B =
**56.8%** — below the 60–75% normal band for a ten-year explicit period
(neither the >75% caution nor the >85% multiple-in-disguise band applies);
a low terminal share says the bear case's value sits mostly in the explicit
decade, not in perpetuity. Implied exit multiple = terminal value at year 10
÷ EBIT₁₀ = $2,162.9B ÷ $259.3B = **8.34× EV/EBIT**. Net debt ÷ EV = 2.05%
(PASS, <10%). ±1% rate sensitivity: r = 9% ⇒ $229.17 (**+18.3%**); r = 11%
⇒ $167.24 (**−13.7%**).

#### Base — value per share

| Year | Growth | Revenue ($B) | NOPAT ($B) | Reinvestment ($B) | FCFF ($B) | PV @ 10% ($B) |
|---|---|---|---|---|---|---|
| 1 | 14.00% | 378.3 | 137.9 | 83.2 | 54.7 | 49.7 |
| 2 | 14.00% | 431.3 | 157.2 | 94.9 | 62.3 | 51.5 |
| 3 | 14.00% | 491.6 | 179.2 | 108.2 | 71.0 | 53.4 |
| 4 | 14.00% | 560.5 | 204.3 | 123.3 | 81.0 | 55.3 |
| 5 | 14.00% | 638.9 | 232.9 | 140.6 | 92.3 | 57.3 |
| 6 | 11.80% | 714.3 | 260.4 | 157.2 | 103.2 | 58.3 |
| 7 | 9.60% | 782.9 | 285.4 | 172.2 | 113.1 | 58.1 |
| 8 | 7.40% | 840.8 | 306.5 | 185.0 | 121.5 | 56.7 |
| 9 | 5.20% | 884.6 | 322.4 | 194.6 | 127.8 | 54.2 |
| 10 | 3.00% | 911.1 | 332.1 | 200.4 | 131.7 | 50.8 |

Sum of explicit-period PV = **$545.2B**. Terminal: NOPAT₁₀ = $332.1B, EBIT₁₀
= $410.0B. Terminal NOPAT (year 11) = $332.1B × 1.03 = $342.1B; proposed
terminal ROIC = **10%** (base also fades to `r` exactly by year 10) ⇒ 1 −
0.03÷0.10 = 0.70 ⇒ terminal FCF = $342.1B × 0.70 = **$239.4B**. Terminal
value at year 10 = $239.4B ÷ 0.07 = **$3,420.6B**; PV = $3,420.6B ÷
(1.10)^10 = **$1,318.8B**.

Enterprise value = $545.2B + $1,318.8B = **$1,863.9B**. Equity value = EV −
$30.045B = **$1,833.9B**. **Value per share = $1,833.9B ÷ 7,425,545,491 =
$246.97.**

Companions: terminal share of value = $1,318.8B ÷ $1,863.9B = **70.8%** —
inside the 60–75% normal band. Implied exit multiple = $3,420.6B ÷ $410.0B
= **8.34× EV/EBIT** — identical to bear's, because both scenarios' terminal
ROIC fades fully to the same `r` = 10%, a direct consequence of the [S]
terminal identity (the ratio depends only on the after-tax rate, `g`,
terminal ROIC and `r`), not a coincidence. Net debt ÷ EV = 1.61% (PASS).
±1% sensitivity: r = 9% ⇒ $300.23 (**+21.6%**); r = 11% ⇒ $207.75
(**−15.9%**).

#### Bull — value per share

| Year | Growth | Revenue ($B) | NOPAT ($B) | Reinvestment ($B) | FCFF ($B) | PV @ 10% ($B) |
|---|---|---|---|---|---|---|
| 1 | 20.00% | 398.2 | 150.9 | 119.5 | 31.4 | 28.6 |
| 2 | 20.00% | 477.8 | 181.1 | 143.4 | 37.7 | 31.2 |
| 3 | 20.00% | 573.4 | 217.3 | 172.0 | 45.3 | 34.0 |
| 4 | 20.00% | 688.1 | 260.7 | 206.4 | 54.3 | 37.1 |
| 5 | 20.00% | 825.7 | 312.9 | 247.7 | 65.2 | 40.5 |
| 6 | 16.60% | 962.8 | 364.8 | 288.8 | 76.0 | 42.9 |
| 7 | 13.20% | 1,089.9 | 413.0 | 327.0 | 86.0 | 44.1 |
| 8 | 9.80% | 1,196.7 | 453.4 | 359.0 | 94.4 | 44.1 |
| 9 | 6.40% | 1,273.3 | 482.5 | 382.0 | 100.5 | 42.6 |
| 10 | 3.00% | 1,311.5 | 496.9 | 393.4 | 103.5 | 39.9 |

Sum of explicit-period PV = **$384.9B**. Terminal: NOPAT₁₀ = $496.9B, EBIT₁₀
= $613.5B. Terminal NOPAT (year 11) = $496.9B × 1.03 = $511.8B; proposed
terminal ROIC = **20%, held, not faded** (the durable-moat exception) ⇒ 1 −
0.03÷0.20 = 0.85 ⇒ terminal FCF = $511.8B × 0.85 = **$435.1B**. Terminal
value at year 10 = $435.1B ÷ 0.07 = **$6,215.3B**; PV = $6,215.3B ÷
(1.10)^10 = **$2,396.3B**.

Enterprise value = $384.9B + $2,396.3B = **$2,781.2B**. Equity value = EV −
$30.045B = **$2,751.1B**. **Value per share = $2,751.1B ÷ 7,425,545,491 =
$370.49.**

Companions: terminal share of value = $2,396.3B ÷ $2,781.2B = **86.2%** —
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
just approval. Implied exit multiple = $6,215.3B ÷ $613.5B = **10.13×
EV/EBIT** — higher than bear/base's 8.34×, from the durable-moat exception
holding terminal ROIC at 20% instead of fading to 10%. Net debt ÷ EV =
1.08% (PASS). ±1% sensitivity: r = 9% ⇒ $463.13 (**+25.0%**); r = 11% ⇒
$303.07 (**−18.2%**).

**Provenance.** All three value-per-share figures are **computed**, not AI
inference and not sourced fact: computed deterministically from authorised
policy constants (`r`, `g`), already-OBSERVED figures (FY2026 revenue, the
net-debt bridge, share count), and the already-drafted, **not yet
approved**, ANALYST JUDGEMENT PROPOSAL drivers (growth, margin, capital
intensity, terminal ROIC per scenario) — every input is individually
labelled above at its own source.

| Scenario | growth | margin | reinvestment | terminal ROIC | Terminal share | Implied exit multiple | ±1% sensitivity | Value/share |
|---|---|---|---|---|---|---|---|---|
| Bear | 8% | 41.68% | 12% | 10% (fades to `r`) | 56.8% | 8.34× EV/EBIT | +18.3% / −13.7% | **$193.71** |
| Base | 14% | 45.0% | 22% | 10% (fades to `r`) | 70.8% | 8.34× EV/EBIT | +21.6% / −15.9% | **$246.97** |
| Bull | 20% | 46.78% | 30% | 20% (durable-moat exception) | 86.2% ⚠️ above 85% band | 10.13× EV/EBIT | +25.0% / −18.2% | **$370.49** |

*(Recomputed at the corrected `nopatTaxRate` = 0.19, CALVIN RULING — CHANGES
NEEDED item 3; no driver above changed.)*

### Runtime-equivalent values — what recording this bundle would actually produce

**Not the figures above.** Per the correction in "Terminal ROIC" above,
recording this bundle (once approved) with all three scenarios' drivers
authored makes `assemble.ts`'s `dynamicScenarioValue` recompute scenario
values through `computeScenarioEnterpriseValue` itself, whose terminal ROIC
is fixed at `r + 3pp` = **13%** for every scenario — never this draft's
proposed per-scenario 10% / 10% / 20%. Recomputing the same drivers
(growth, margin, reinvestment, revenue, `r`, `g`, corrected
`nopatTaxRate` = 0.19) through that exact function, with terminal ROIC = 13%
instead of the proposed values, gives:

| Scenario | Terminal ROIC the runtime actually uses | Value/share |
|---|---|---|
| Bear | 13% (not the proposed 10%) | **≈$204.82** |
| Base | 13% (not the proposed 10%) | **≈$264.54** |
| Bull | 13% (not the proposed 20%; durable-moat exception not honoured) | **≈$339.83** |

Computed by running the real `computeScenarioEnterpriseValue` function
(`lib/analyzer/modules/scenarioOutputs.ts`) against this draft's own
proposed drivers — not a second hand calculation. **Caveat, not resolved
here:** this reuses this section's own net-debt figure ($30.045B), which
(per the EV-bridge section above) does not select among the three §4.4
non-operating-investments candidates. A real run's own `netDebtBridge` is
`assemble.ts`'s own M1 inversion, which does subtract whichever §4.4
candidate is eventually selected — a judgment this draft explicitly does
not make (HARD BOUNDS) — so a live run's actual figure could differ
further from the ≈ values above once that selection is made. These ≈
figures are the best currently-answerable illustration of what recording
would produce; they are not a second set of proposed values for Calvin to
choose between, and not an Analyzer output today.

## Evidence gaps — named, not defaulted

- **This capture carries no segment-level revenue breakdown** (e.g. Azure /
  Intelligent Cloud vs. More Personal Computing). `tagMap.ts` reads only
  total-company tags, so every growth/margin assumption above is reasoned
  from consolidated figures, not from the cloud-specific growth trajectory
  that would ordinarily sharpen a forward view of an AI-era hyperscaler.
  Named as a real limitation of what this capture and this mapping can
  support, not resolved by inventing a segment split.
- **MSFT's FY2026 effective tax rate (19%, now this draft's own proposed
  `nopatTaxRate`, per CALVIN RULING — CHANGES NEEDED item 3) is not a fact
  this capture's own tags can resolve** — no tax-provision tag is in
  `tagMap.ts`; it is 10-K text via WebSearch, cross-checked against the
  provision/net-income back-solve (19.4%) in the already-reviewed Phase B
  proof, not an XBRL-tagged fact. The superseded 0.21 federal-statutory
  convention is named above as the alternative this draft no longer
  proposes.
- **`acquisitions` and `deltaNwc` have no SEC tag mapped anywhere in this
  codebase** (`lib/analyzer/acquisition/tagMap.ts` has no entry for either;
  both are hardcoded `null` in `companyInputs.ts`), so §7.2 M5's own
  governing net-reinvestment formula (`computeReinvestment`) is structurally
  `INCOMPLETE` for MSFT, and for every other company this codebase acquires
  — a pre-existing acquisition-pipeline gap this draft surfaces (see "Gross
  capital intensity vs. the governing net-reinvestment definition" above),
  not one it can fix (HARD BOUNDS: no runtime change) or that is specific to
  MSFT.
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
sourced, analyst-authored drivers — **not** the hand-calculated per-share
figures in "Scenario values" above. Because all three scenarios' drivers
are proposed as fully authored, recording would make the real run
recompute scenario values itself (`computeScenarioEnterpriseValue`,
terminal ROIC fixed at 13%), producing figures close to the
"Runtime-equivalent values" table above, not the $193.71 / $246.97 /
$370.49 figures — the next phase, explicitly downstream of this ruling,
not performed by this outcome.

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
`reinvestmentCapitalIntensity` / `shareCount` / `writtenAnchor`; and the two
proposed §7.1 constants (`nopatTaxRate`, `stressMarginLevel`). A
**"changes needed"** answer may name specific fields to correct rather than
rejecting the whole draft; nothing here is recorded, resolvable, or binding
until Calvin rules.

**Named open item, not folded into the question above
(REVIEW-38696980049-1).** The three proposed per-scenario `terminalRoic`
values (10% / 10% / 20%) are methodology §3.5's required scenario-DCF
input, but the runtime function that would actually recompute a recorded,
fully-driven bundle's scenario values (`computeScenarioEnterpriseValue`)
ignores any per-scenario terminal ROIC and fixes it at `r + 3pp` = 13% for
every scenario instead — see "Terminal ROIC" and "Runtime-equivalent
values" above. This draft does not choose between the two: the $193.71 /
$246.97 / $370.49 figures follow methodology §3.5 as written (per-scenario
terminal ROIC); the ≈$204.82 / ≈$264.54 / ≈$339.83 figures are what the
live `computeScenarioEnterpriseValue` path would actually produce if this
bundle were recorded as drafted. Calvin's approval of the drivers above
does not by itself resolve which treatment governs a recorded MSFT bundle
— that is a separate, still-open question this draft surfaces but does not
answer, left for the next phase (recording) or a follow-up ruling, not a
silent default to either figure.
