# NVDA — Step-7 / §6.3 analyst-input bundle (DRAFT)

> **DRAFT — NOT APPROVED, NOT RUNTIME-RESOLVABLE.** This document is not read
> by any runtime module. NVDA has no recorded bundle in
> `analyzer_recorded_analyst_bundles` and no entry in `BUNDLES`
> (`lib/analyzer/acquisition/analystInputs.ts`); `TICKERS_WITH_ANALYST_INPUTS`
> is unchanged (`["MSFT","OKLO"]`) and a run for NVDA still fails closed at
> `gate.ts:loadGateState` (`RunNotFoundError`, via `isSupportedTicker`). This
> file exists so Calvin can review, correct or approve it at
> `/analyzer/inputs/NVDA` — typing or pasting the values below into that
> screen is what would make NVDA resolvable, not this file.

Prepared under `CALVIN RULING — AMEND A` (24 Sep 2026 12:10:38Z, PR #287
comment 5813805300), issue #288 (`CF-ANALYST-DRAFT-NVDA-01`).

## What this draft is built from

`lib/analyzer/acquisition/captures/nvda-companyfacts.json` — real SEC XBRL
company facts for NIVIDIA CORP (CIK 0001045810), captured 2026-09-09,
trimmed to the tags `lib/analyzer/acquisition/tagMap.ts` (`TAG_MAPPING_VERSION
calboard-secmap-2026-09-2`) reads and to periods ending in the last twelve
calendar years. Every figure below that is marked **OBSERVED FACT** is
reproduced directly from this capture using the same tag-selection rules
`lib/analyzer/acquisition/history.ts` (`annualSeries`/`preferCurrentSeries`)
already applies at acquisition time — not re-derived by a different method —
so a real acquired run reading the same capture would select the same
underlying series this draft cites.

**One thing worth flagging up front, because the codebase's own comments
already name it (`lib/analyzer/calibration/inputs.ts:146-152`, Defect D):**
NVDA's `us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax` element
— the mapping's *first* revenue candidate — stops at FY2022 in this capture
(6 annual observations, FY2017–FY2022). Taking it would silently read a
four-year-stale series. `preferCurrentSeries` in `history.ts` correctly
rejects it (its last observation, FY2022, is behind the filer's own latest
annual period, FY2026) and falls through to the second candidate,
`us-gaap:Revenues`, which is current through FY2026. Every revenue figure
below is taken from **`us-gaap:Revenues`**, the tag the real acquisition
pipeline would actually select for this filer, not the one that resolves
first.

## Field-by-field draft, in the order `/analyzer/inputs/NVDA` presents them

### Profile

| Field | Value | Provenance |
|---|---|---|
| `profile` | `HIGH_GROWTH_PROFITABLE_UNCERTAIN_DURABILITY` | **AI INFERENCE** — no classifier exists for this field in this codebase (`AnalystBundleForm.tsx`'s own text: "No classifier recommends a profile... this is the analyst's own classification"). Reasoning: FY2026 revenue growth of 65.5% (see `revenueGrowthBand` below) is far outside "mature/stable," and the operating-margin history below (47.5pt ten-year range, a 21.6pt single-year decline in FY2023) shows the business has not yet demonstrated a stable, durable margin structure through a full cycle — exactly the "uncertain durability" half of this profile's name. `MATURE_PROFITABLE_STABLE_FCF` (MSFT's profile) does not fit a company still growing this fast off this large a base. |

### Classification inputs (§6.3 evidence beside the profile)

| Field | Value | Provenance |
|---|---|---|
| `revenueScale` | `large` | **AI INFERENCE** — no scale thresholds are defined anywhere in this codebase; informed by the OBSERVED FY2026 revenue figure below ($215.938B), which is "large" under any plausible reading. |
| `fcfCharacter` | `positive_volatile` | **AI INFERENCE**, reasoned from the OBSERVED margin-history statistics below: a 47.51pt ten-year operating-margin range and a 21.65pt single-year decline (FY2022→FY2023) are roughly double MSFT's committed bundle (21.4pt / 4.1pt) for the same fields — the historical record shows real volatility, not a stable margin structure, even though every year in the window was operating-income-positive. |
| `revenueGrowthBand` | `>30%` | **OBSERVED FACT** — computed from `us-gaap:Revenues`: FY2025 revenue $130,497M (period 2024-01-29–2025-01-26, accession 0001045810-26-000021) → FY2026 revenue $215,938M (period 2025-01-27–2026-01-25, same accession, same 10-K). Growth = (215,938 − 130,497) / 130,497 = **65.47%**. |
| `capitalIntensity` | `0.028` | **OBSERVED FACT**, FY2026: `us-gaap:PaymentsToAcquireProductiveAssets` $6,042M (period 2025-01-27–2026-01-25, accession 0001045810-26-000021) ÷ `us-gaap:Revenues` $215,938M (same period/accession) = 2.80%. Note on tag selection: the capex mapping's *first* candidate, `us-gaap:PaymentsToAcquirePropertyPlantAndEquipment`, carries **no annual (10-K) rows at all** in this capture — only quarterly 10-Q rows — so `annualSeries` falls through to the second candidate, `us-gaap:PaymentsToAcquireProductiveAssets`, exactly as the mapping's ordered-candidate rule intends. This ratio captures only PP&E-style cash capex; it does not capture NVIDIA's off-balance-sheet compute commitments (lease- and supply-agreement-financed datacenter capacity), which are not tagged under any candidate this mapping reads. Flagged here as a limitation of the ratio, not resolved. |
| `cyclicality.tenYearMarginRange` | `0.4751` (47.51pt) | **OBSERVED FACT**, derived from `us-gaap:OperatingIncomeLoss` ÷ `us-gaap:Revenues` for the ten most recent fiscal years both tags cover: FY2016, FY2017, FY2018, FY2020, FY2021, FY2022, FY2023, FY2024, FY2025, FY2026 (FY2019 is absent from `us-gaap:Revenues` in this capture — see evidence gap below). Margins: FY2016 14.91%, FY2017 27.99%, FY2018 33.05%, FY2020 26.07%, FY2021 27.18%, FY2022 37.31%, FY2023 15.66%, FY2024 54.12%, FY2025 62.42%, FY2026 60.38%. Max 62.42% (FY2025) − min 14.91% (FY2016) = 47.51pt. |
| `cyclicality.worstSingleYearChange` | `0.2165` (21.65pt) | **OBSERVED FACT**, same ten-year series: the largest year-over-year decline is FY2022 (37.31%) → FY2023 (15.66%) = 21.65pt, computed the same way `lib/analyzer/marginMath.ts:worstSingleYearDecline` computes it (largest positive decline between adjacent entries in the ordered series). Because FY2019 is absent from the series, FY2018→FY2020 are adjacent *entries* in this ordered list though not adjacent *calendar* years — the same array-index behavior the real acquired pipeline's `operatingMarginSeries`/`marginMath.ts` would exhibit on this same capture, not an artefact introduced by this draft. |
| `balanceSheetNature` | `asset-light` | **AI INFERENCE** — the entry form's own label is exact: "ASSUMPTION not FACT (§6.3)". Reasoning: NVIDIA is a fabless semiconductor designer (manufacturing is outsourced to foundry partners); the OBSERVED capital-intensity ratio above (2.80% of revenue) is low, and OBSERVED `us-gaap:LongTermDebt` is $8,468M against $215,938M of FY2026 revenue — minimal balance-sheet leverage. Neither `Assets` nor `PropertyPlantAndEquipmentNet` is a tag this mapping reads, so this is not confirmed against total-asset composition; named as an evidence gap below. |

### Scenarios

Each scenario's growth/margin/reinvestment drivers and its resulting
scenario value are the analyst's own forward judgment — Step 7 has no
classifier or solver behind this entry form (`recordedBundles.ts`'s own
header: "a required share count and written anchor, and three drivers that
may be left blank"). None of the three drivers below is asserted as fact;
each is **AI INFERENCE**, reasoned from the OBSERVED historical series
above, and every one of them is exactly what Calvin's review is for.

**`shareCount` (all three scenarios): `24.1`** — **OBSERVED FACT**:
`dei:EntityCommonStockSharesOutstanding` (cover-page shares, §3.5's own
"most recent... from the filing COVER PAGE"), 24,100,000,000 shares, as of
2026-08-21, from the 10-Q filed 2026-08-26 (accession
0001045810-26-000075) — the most recent cover-page count in this capture.
Held constant across all three scenarios, the same convention MSFT's and
OKLO's committed bundles both use.

#### Bear

| Field | Value | Provenance |
|---|---|---|
| `revenueGrowthOrPath` | `0.05` | AI INFERENCE — a cyclical correction in AI/datacenter capex spending, echoing the magnitude of the OBSERVED FY2023 correction (revenue grew only 0.2% that year under the same `Revenues` tag: $26,914M → $26,974M), but not assumed to repeat exactly. |
| `operatingMargin` | `0.30` | AI INFERENCE — reverts toward the OBSERVED ten-year median (30.52% over the same ten-year window above), the same "reverts to the historical median" convention MSFT's committed bear case uses. |
| `reinvestmentCapitalIntensity` | `0.02` | AI INFERENCE — near the OBSERVED FY2026 capital-intensity ratio (2.80%), reflecting reduced capacity investment in a demand correction. |
| `writtenAnchor` | "AI/datacenter capex cycle corrects and operating margin reverts toward its ten-year median, echoing the FY2023 correction (margin fell to 15.7% that year on inventory and export-control effects); growth slows sharply but stays positive, not a revenue contraction." | Analyst's own stated reasoning (not a separate provenance category — same convention as MSFT/OKLO's `writtenAnchor` fields). |

#### Base

| Field | Value | Provenance |
|---|---|---|
| `revenueGrowthOrPath` | `0.20` | AI INFERENCE — materially decelerated from the OBSERVED FY2026 growth rate (65.47%) as the hyperscaler AI-capex cycle normalizes off a much larger base, while remaining in the "10–30%" band rather than falling to bear-case levels. |
| `operatingMargin` | `0.50` | AI INFERENCE — below the OBSERVED FY2026 level (60.38%) but well above the ten-year median (30.52%), reflecting some give-back of recent margin expansion under competitive and pricing pressure. |
| `reinvestmentCapitalIntensity` | `0.04` | AI INFERENCE — above the OBSERVED FY2026 ratio (2.80%), reflecting continued capacity investment at a growth company's pace. |
| `writtenAnchor` | "AI-driven datacenter demand continues but decelerates materially off the FY2026 base as the hyperscaler capex cycle normalizes; margin gives back some of its recent expansion but stays well above the historical median." | Analyst's own stated reasoning. |

#### Bull

| Field | Value | Provenance |
|---|---|---|
| `revenueGrowthOrPath` | `0.35` | AI INFERENCE — sustained high growth, still well below the OBSERVED FY2026 rate (65.47%), assuming the AI/accelerated-computing demand cycle continues at a high but decelerating level. |
| `operatingMargin` | `0.60` | AI INFERENCE — holds near the OBSERVED FY2026 level (60.38%). |
| `reinvestmentCapitalIntensity` | `0.05` | AI INFERENCE — above base, reflecting aggressive continued capacity investment. |
| `writtenAnchor` | "AI/accelerated-computing demand sustains at a high level, operating margin holds near its current elevated level, and NVIDIA continues investing aggressively in capacity." | Analyst's own stated reasoning. |

### Scenario values

**Computed — 24 Sep 2026, following Calvin's approval.** `CALVIN RULING — C`
(24 Sep 2026 13:00:02Z, PR #289 comment 5814600108) refused this draft's
prior single-stage hand estimate — an assumed 9.5% required return and a
per-scenario 3% / 4% / 5% terminal growth rate, neither authorised by the
methodology — and required either a re-derivation strictly from the
current approved methodology and the already-drafted scenario assumptions,
or a named gap stating exactly which authorised input is missing.
`CF-ANALYST-DRAFT-NVDA-SCENARIO-02` (issue #290, PR #291) reconciled the
retrieved authority and found two of the three inputs a scenario DCF needs
already authorised, with the third — terminal ROIC — missing and not
draftable inside that outcome's scope. `CALVIN RULING — A, WITH AI DRAFT`
(24 Sep 2026 15:46:31Z, PR #291 comment 5817385859) authorised exactly the
missing piece to be **prepared** — drafted as labelled AI judgment with a
written anchor, for Calvin to review, approve or correct — without
authoring the three scenario dollar values themselves, which stayed gated
behind that approval. `CF-ANALYST-DRAFT-NVDA-TERMINAL-ROIC-01` (issue #292,
PR #293) prepared the three terminal-ROIC assumptions below.
**`CALVIN RULING — APPROVE AS DRAFTED`, 24 Sep 2026 16:14:25Z** (PR #293
comment 5817834576) approved all three exactly as prepared, with no
correction, closing the one remaining gate. This section now computes the
three scenario dollar values the approval unlocked, strictly from the
already-authorised r and g, the already-drafted scenario drivers above, and
the now-approved terminal-ROIC assumptions — under the current approved
scenario DCF, not the disputed `computeScenarioEnterpriseValue` helper
(see below).

**Authorised, not invented:**

- **Discount rate — r = 10%.** `docs/frozen/calboard-valuation-methodology.md`
  §3.4 safeguard 1 requires "the same rate ... used in the DCF, the
  reverse DCF and the steady-state value for a given company — never
  change the rate to move the answer." `lib/analyzer/policy.ts`'s
  `rateGrid` fixes that rate's three possible cells at `[0.08, 0.10,
  0.12]`, and `lib/analyzer/assemble.ts:368` is the one place the app's
  own assembly already commits to a single cell — `rateGrid[1]`, **10%**
  — as *the* company-level rate for this purpose, for every company,
  never chosen per company. **OBSERVED FACT**, cited to `policy.ts`'s
  `rateGrid[1]` and its one existing use at `assemble.ts:368` — not
  chosen for NVDA specifically.
- **Terminal growth — g = 3%, one figure, not per-scenario.** Methodology
  §3.5: "Policy default: 3.0%." `policy.ts`'s `terminalGrowth` is `0.03`
  and carries no `POLICY_THRESHOLD_PROVENANCE` entry — fixed by policy,
  not PROVISIONAL, and not one of the four undefined §7.1 constants. This
  replaces the prior draft's unauthorised per-scenario 3% / 4% / 5%
  invention with the single policy figure. **OBSERVED FACT**, cited to
  `policy.ts:11`.

**Approved: terminal ROIC.** A DCF's terminal value must still be built
consistently — methodology §3.5, stated as a mandatory,
software-deterministic [S] rule: *"terminal FCF = terminal NOPAT × (1 − g
÷ terminal ROIC). Do not take final-year FCF × (1+g)."* That rule needs a
terminal ROIC. Nothing already authorised or already drafted before
`CF-ANALYST-DRAFT-NVDA-TERMINAL-ROIC-01` supplied one; the three
per-scenario values below, now approved as drafted, do:

- The one terminal-ROIC shortcut this methodology fixes by rule — rate +
  3 points (`terminalRoicPremium`, `policy.ts:14`) — is scoped, in both
  frozen documents, to the **diagnostic reverse DCF only**. Methodology
  §3.5: "In the diagnostic reverse DCF (§6.2) it is not an input at all:
  it is fixed by rule at r + 3 percentage points (PROVISIONAL)." Spec
  §7.1's own constants table, row "Terminal ROIC **(diagnostic reverse
  DCF only)**." For the **scenario** DCF, both documents instead require:
  "terminal ROIC is an **analyst input with a written anchor** and must
  fade toward the cost of capital unless a durable moat is argued
  explicitly" (methodology §3.5) — a new required scenario driver, not a
  fact recoverable from the filings or from `policy.ts`. That is exactly
  the driver drafted below, per scenario, per `CALVIN RULING — A, WITH AI
  DRAFT`'s "lazy-man path": AI drafts, Calvin approves or corrects.

  (`lib/analyzer/modules/scenarioOutputs.ts`'s `computeScenarioEnterpriseValue`
  does compute an internal `rate + terminalRoicPremium` for every caller,
  including the scenario-DCF formula it implements — but that stays the
  kind of disagreement between the frozen contract and the build the
  spec's own preface calls "a defect to be raised, not drift for a later
  session to correct on its own judgment" [spec.md:1], not authority to
  borrow the reverse-DCF-only premium here. `CALVIN RULING — A, WITH AI
  DRAFT` explicitly refuses broadening `r + terminalRoicPremium` into the
  scenario DCF and leaves this defect raised, not resolved, not edited.
  It is also not, in practice, how any committed scenario value in this
  codebase is produced: that function is wired only into the M14
  sensitivity tables [`lib/analyzer/modules/sensitivity.ts`], never into
  the path that produces a company's committed `scenarioValues`. MSFT's
  own committed bundle supplies its three dollar figures directly, with
  `revalueBaseCaseAtRate: null`, because — per that fixture's own comment
  — "No real revaluation-at-rate solver exists for this fixture"
  (CB-AUDIT-01 H2). This draft is naming the same absence for NVDA, not a
  gap specific to it.)
- The already-drafted scenario assumptions (`revenueGrowthOrPath`,
  `operatingMargin`, `reinvestmentCapitalIntensity`, `writtenAnchor` per
  scenario, above) supply no terminal ROIC and no ingredients to compute
  one, and stay unchanged here — they are not re-opened by preparing the
  new driver below. Methodology §3.3's computed RONIC (trailing five-year
  ΔNOPAT ÷ Δinvested capital) is a company-level, historical, diagnostic-
  reverse-DCF quantity: it needs invested-capital inputs (capex,
  acquisitions, finance-lease ROU additions, ΔNWC) this draft's
  classification section does not carry, and even if computed, is not
  what §3.5 defines a *scenario's* terminal ROIC to be — an authored,
  forward, per-scenario judgment about margin durability, not a trailing
  historical ratio. It is cited here only to explain why it cannot supply
  the number below; the three terminal-ROIC assumptions that follow are
  authored judgment, not a RONIC computation.

**The three approved assumptions**, in `/analyzer/inputs/NVDA`'s field
order (after `reinvestmentCapitalIntensity`, alongside `writtenAnchor`),
each labelled **AI JUDGMENT — APPROVED AS DRAFTED** (`CALVIN RULING —
APPROVE AS DRAFTED`, 24 Sep 2026 16:14:25Z, PR #293 comment 5817834576) —
an analyst's judgment Calvin has reviewed and approved with no correction,
never sourced fact — and each either fading toward r = 10% or carrying an
explicit durable-moat argument, per methodology §3.5. Their `terminalRoic`
and `terminalRoicAnchor` values are unchanged from preparation — this
outcome consumes them, it does not re-draft them:

#### Bear — terminal ROIC

| Field | Value | Provenance |
|---|---|---|
| `terminalRoic` | Fade rule: **13% in the first explicit year, linearly to r = 10% by year 10, held at 10% thereafter.** No durable-moat exception invoked. | **AI JUDGMENT — APPROVED AS DRAFTED** |
| `terminalRoicAnchor` | "The bear world is a cyclical AI/datacenter capex correction (§3.5's own default case): growth slows to 5% and operating margin reverts to its ten-year OBSERVED median (30.52%), echoing the OBSERVED FY2023 trough. A correction broad enough to force that margin reversion plausibly compresses returns on *incremental* capital too, as customers diversify suppliers and pricing power narrows — this scenario's own narrative is the reason no durable-moat argument is made for it. Terminal ROIC therefore fades to the cost of capital by the terminal year, the §3.5 default, starting modestly above r rather than at an elevated level because the correction is already underway from year 1 of the explicit period." | Analyst's own stated reasoning (AI JUDGMENT — APPROVED AS DRAFTED), same convention as the scenario's existing `writtenAnchor`. |

#### Base — terminal ROIC

| Field | Value | Provenance |
|---|---|---|
| `terminalRoic` | Fade rule: **18% in the first explicit year, linearly to r = 10% by year 10, held at 10% thereafter.** No durable-moat exception invoked. | **AI JUDGMENT — APPROVED AS DRAFTED** |
| `terminalRoicAnchor` | "The base world holds a materially higher margin through the explicit period (50% operating margin, versus the bear case's 30%) and decelerates from a higher OBSERVED FY2026 base (65.47% growth to 20%), so the starting level here is drafted above the bear case's, reflecting the stronger near-term economics this scenario's own drivers already assume. But base's own written anchor already concedes 'margin gives back some of its recent expansion,' and its `operatingMargin` provenance attributes that give-back to 'competitive and pricing pressure' — that conceded pressure is the reason this scenario does not invoke the durable-moat exception either: a moat strong enough to hold terminal returns permanently above the cost of capital is a bull-case claim, not a base-case one. Terminal ROIC fades fully to r = 10% by the terminal year, the §3.5 default, from a higher starting point than bear rather than from a different treatment." | Analyst's own stated reasoning (AI JUDGMENT — APPROVED AS DRAFTED), same convention as the scenario's existing `writtenAnchor`. |

#### Bull — terminal ROIC

| Field | Value | Provenance |
|---|---|---|
| `terminalRoic` | **22%, held (not faded) through the terminal year** — the §3.5 durable-moat exception, invoked explicitly. | **AI JUDGMENT — APPROVED AS DRAFTED** |
| `terminalRoicAnchor` | "Durable-moat argument, made explicitly, per §3.5's own exception clause: NVIDIA's CUDA software stack, its multi-generation architecture lead and the resulting switching costs for developers, framework maintainers and hyperscaler customers are AI INFERENCE from the OBSERVED ten-year margin record (a 60%+ operating margin sustained through FY2025–FY2026, the top of the ten-year range) and from NVIDIA's position as the default platform for AI training and inference — not a fact this capture's tags can source directly, and not asserted as one. The bull scenario's own written anchor already argues demand 'sustains at a high level' and margin 'holds near its current elevated level' (60%, OBSERVED FY2026); a moat strong enough to sustain that margin durably is the same moat that should sustain excess returns on incremental capital, so this scenario departs from the §3.5 default and does not fade to r. 22% is a judgment anchor, not a derived number: set below the scenario's own 60% operating margin (a margin, not a return on capital, and not comparable to ROIC without an invested-capital base this draft does not carry) and comfortably above r = 10%, reflecting sustained but bounded excess returns. This is precisely the kind of number `CALVIN RULING — A, WITH AI DRAFT` expects Calvin to review, approve or sharpen by targeted correction, not accept as a computed fact." | Analyst's own stated reasoning (AI JUDGMENT — APPROVED AS DRAFTED), same convention as the scenario's existing `writtenAnchor`. |

**Net cash and share count for the enterprise-value → equity bridge.**
The three inputs the scenario DCF needs are now all authorised (r, g,
terminal ROIC); the one remaining ingredient — net cash/debt, to bridge
computed enterprise value to value per share — is not yet stated
explicitly anywhere in this draft's prose, though `balanceSheetNature`'s
reasoning above already cites one of its two components. Sourced here
from the same already-committed capture this whole draft is built from
(`lib/analyzer/acquisition/captures/nvda-companyfacts.json`, no new
fetch), using the same tag-selection convention and the same FY2026
period/accession already cited throughout this draft
(period 2025-01-27–2026-01-25, accession 0001045810-26-000021):

| Component | Value | Provenance |
|---|---|---|
| Total debt (`us-gaap:LongTermDebt`, already current) | $8,468M | **OBSERVED FACT** — same figure already cited above for `balanceSheetNature`. `us-gaap:CommercialPaper` is $0 in every year this capture reports it and carries no FY2026 observation; `us-gaap:ShortTermBorrowings` is not a tag this capture carries — both treated as $0 additions, not omitted. |
| Cash and marketable debt securities (`us-gaap:CashAndCashEquivalentsAtCarryingValue`) | $10,605M | **OBSERVED FACT**, same period/accession. `us-gaap:ShortTermInvestments` — the mapping's second candidate for this line (`tagMap.ts`) — is not a tag this capture carries at all, so this figure is cash alone; named here as the same kind of tag-availability limitation already flagged above for `capitalIntensity` and `balanceSheetNature`, not resolved differently. |
| Finance lease liabilities (`us-gaap:FinanceLeaseLiability`) | not carried by this capture | Treated as a $0 addition to net debt, on the same tag-availability basis as the two rows above — not confirmed absent from NVIDIA's actual balance sheet, only absent from this mapping's capture of it. |
| **Net debt** = total debt + finance leases − cash and securities | **−$2,137M** (a net **cash** position of $2,137M) | **Computed**, from the three OBSERVED rows above. |

**Leverage precondition test (§3.4 safeguard 4), computed, not asserted:**
net debt ÷ EV is negative (net cash) in all three scenarios below —
Bear −0.32%, Base −0.09%, Bull −0.03% — every reading comfortably inside
the <10% PASS band, so the r = 10% band applies to firm cash flows
directly with no leverage refusal. (NVIDIA's own worked example in
methodology §3.4 records a similarly small negative ratio, −0.4%, on a
different EV base — not reproduced exactly here, and not expected to be,
since these are three new scenario-specific EVs, not the single
current-price EV the frozen example used.)

`shareCount` — **24.1B**, **OBSERVED FACT**, already committed above
(`dei:EntityCommonStockSharesOutstanding`, cover page), held constant
across all three scenarios, unchanged.

**Computing the three scenario values, per methodology §3.1–§3.5.** Each
scenario is projected over the ten-year explicit period using its own
already-drafted, already-approved revenue growth, operating margin and
reinvestment capital intensity (unchanged, cited above), its own
now-approved terminal ROIC (unchanged, cited above), the authorised r =
10% and g = 3%, and the already-committed `nopatTaxRate` = 21% (§7.1
constants, below). **Not** via `computeScenarioEnterpriseValue` — that
function is not called, and its internal `rate + terminalRoicPremium`
line is not used for any of these three terminal ROICs, per the HARD
BOUNDS. The one piece of that module's math this outcome does reuse is
the policy path shape itself: methodology §7.1's fixed shape — constant
growth years 1–5, linear fade to terminal growth by year 10, terminal
thereafter — is named as shared between M7 and M15 in `growthPath.ts`'s
own header, so each scenario's single drafted growth rate is expanded
into that shape (not held flat for all ten years), the same shape any
correct scenario-DCF implementation must use; this is the undisputed
general path-shape rule, not the disputed terminal-ROIC-premium line.

For each year *t*: NOPAT_t = Revenue_t × margin × (1 − 21%); Reinvestment_t
= Revenue_t × capital intensity; FCFF_t = NOPAT_t − Reinvestment_t;
PV_t = FCFF_t ÷ (1.10)^t.

#### Bear — value per share

| Year | Growth | Revenue ($B) | NOPAT ($B) | Reinvestment ($B) | FCFF ($B) | PV @ 10% ($B) |
|---|---|---|---|---|---|---|
| 1 | 5.00% | 226.7 | 53.7 | 4.5 | 49.2 | 44.7 |
| 2 | 5.00% | 238.1 | 56.4 | 4.8 | 51.7 | 42.7 |
| 3 | 5.00% | 250.0 | 59.2 | 5.0 | 54.2 | 40.8 |
| 4 | 5.00% | 262.5 | 62.2 | 5.2 | 57.0 | 38.9 |
| 5 | 5.00% | 275.6 | 65.3 | 5.5 | 59.8 | 37.1 |
| 6 | 4.60% | 288.3 | 68.3 | 5.8 | 62.6 | 35.3 |
| 7 | 4.20% | 300.4 | 71.2 | 6.0 | 65.2 | 33.4 |
| 8 | 3.80% | 311.8 | 73.9 | 6.2 | 67.7 | 31.6 |
| 9 | 3.40% | 322.4 | 76.4 | 6.4 | 70.0 | 29.7 |
| 10 | 3.00% | 332.1 | 78.7 | 6.6 | 72.1 | 27.8 |

Sum of explicit-period PV = **$362.0B**. Terminal: NOPAT₁₀ = $78.7B, EBIT₁₀
(NOPAT₁₀ ÷ (1−21%)) = $99.6B. Terminal identity [S]: terminal NOPAT
(year 11) = NOPAT₁₀ × (1+g) = $81.1B; approved terminal ROIC = **10%** (the
bear fade reaches r exactly by year 10) ⇒ 1 − g÷ROIC = 1 − 0.03÷0.10 =
0.70 ⇒ terminal FCF = $81.1B × 0.70 = **$56.7B**. Terminal value at year 10
= terminal FCF ÷ (r−g) = $56.7B ÷ 0.07 = **$810.6B**; PV of terminal value =
$810.6B ÷ (1.10)^10 = **$312.5B**.

Enterprise value = $362.0B + $312.5B = **$674.5B**. Equity value = EV +
net cash $2.137B = **$676.7B**. **Value per share = $676.7B ÷ 24.1B =
$28.08.**

Companions (§3.5, [S]): terminal share of value = $312.5B ÷ $674.5B =
**46.3%** — below the 60–75% normal band for a ten-year explicit period
(neither the >75% caution nor the >85% multiple-in-disguise band applies);
a low terminal share here says the bear case's value sits mostly in the
explicit decade, not in perpetuity, the same shape methodology §3.5 notes
for NVIDIA's own historical reverse-DCF reading. Implied exit multiple =
terminal value at year 10 ÷ EBIT₁₀ = $810.6B ÷ $99.6B = **8.14× EV/EBIT**
— the metric it actually divides, not revenue or FCF. Comparison against
today's actual EV/EBIT is **INCOMPLETE**: `prices.json` carries no NVDA
row, so no current EV can be computed (FINAL OWNER RULING #205); the
reverse direction (growth implied by a chosen "reasonable" exit multiple)
is not performed either, since naming a reasonable multiple without a
price anchor would be new judgment beyond this outcome's approved scope,
not a computation. ±1% rate sensitivity: r = 9% ⇒ $32.40 (**+15.4%**);
r = 11% ⇒ $24.80 (**−11.7%**) — both above the 10% sensitivity-display
threshold, reported per §3.5/§5, not used as a standalone signal.

#### Base — value per share

| Year | Growth | Revenue ($B) | NOPAT ($B) | Reinvestment ($B) | FCFF ($B) | PV @ 10% ($B) |
|---|---|---|---|---|---|---|
| 1 | 20.00% | 259.1 | 102.4 | 10.4 | 92.0 | 83.6 |
| 2 | 20.00% | 311.0 | 122.8 | 12.4 | 110.4 | 91.2 |
| 3 | 20.00% | 373.1 | 147.4 | 14.9 | 132.5 | 99.5 |
| 4 | 20.00% | 447.8 | 176.9 | 17.9 | 159.0 | 108.6 |
| 5 | 20.00% | 537.3 | 212.2 | 21.5 | 190.7 | 118.4 |
| 6 | 16.60% | 626.5 | 247.5 | 25.1 | 222.4 | 125.5 |
| 7 | 13.20% | 709.2 | 280.1 | 28.4 | 251.8 | 129.2 |
| 8 | 9.80% | 778.7 | 307.6 | 31.1 | 276.4 | 129.0 |
| 9 | 6.40% | 828.6 | 327.3 | 33.1 | 294.1 | 124.7 |
| 10 | 3.00% | 853.4 | 337.1 | 34.1 | 303.0 | 116.8 |

Sum of explicit-period PV = **$1,126.6B**. Terminal: NOPAT₁₀ = $337.1B,
EBIT₁₀ = $426.7B. Terminal identity [S]: terminal NOPAT (year 11) =
$337.1B × 1.03 = $347.2B; approved terminal ROIC = **10%** (base also
fades to r exactly by year 10) ⇒ 1 − 0.03÷0.10 = 0.70 ⇒ terminal FCF =
$347.2B × 0.70 = **$243.0B**. Terminal value at year 10 = $243.0B ÷ 0.07 =
**$3,472.1B**; PV = $3,472.1B ÷ (1.10)^10 = **$1,338.7B**.

Enterprise value = $1,126.6B + $1,338.7B = **$2,465.3B**. Equity value =
EV + $2.137B = **$2,467.4B**. **Value per share = $2,467.4B ÷ 24.1B =
$102.38.**

Companions: terminal share of value = $1,338.7B ÷ $2,465.3B = **54.3%** —
also below the 60–75% normal band, neither caution band applies. Implied
exit multiple = $3,472.1B ÷ $426.7B = **8.14× EV/EBIT** — identical to
bear's, because both scenarios' terminal ROIC fades fully to the same
r = 10%, and the ratio terminal value ÷ EBIT₁₀ depends only on the
after-tax rate, g, terminal ROIC and r — not on the scenario's own growth
or margin path; a direct consequence of the [S] terminal identity, not a
coincidence to read further into. Comparison against today's multiple:
**INCOMPLETE**, same reason as bear (no NVDA price row). ±1% sensitivity:
r = 9% ⇒ $120.41 (**+17.6%**); r = 11% ⇒ $88.85 (**−13.2%**).

#### Bull — value per share

| Year | Growth | Revenue ($B) | NOPAT ($B) | Reinvestment ($B) | FCFF ($B) | PV @ 10% ($B) |
|---|---|---|---|---|---|---|
| 1 | 35.00% | 291.5 | 138.2 | 14.6 | 123.6 | 112.4 |
| 2 | 35.00% | 393.5 | 186.5 | 19.7 | 166.9 | 137.9 |
| 3 | 35.00% | 531.3 | 251.8 | 26.6 | 225.3 | 169.2 |
| 4 | 35.00% | 717.2 | 340.0 | 35.9 | 304.1 | 207.7 |
| 5 | 35.00% | 968.3 | 459.0 | 48.4 | 410.5 | 254.9 |
| 6 | 28.60% | 1,245.2 | 590.2 | 62.3 | 528.0 | 298.0 |
| 7 | 22.20% | 1,521.6 | 721.3 | 76.1 | 645.2 | 331.1 |
| 8 | 15.80% | 1,762.1 | 835.2 | 88.1 | 747.1 | 348.5 |
| 9 | 9.40% | 1,927.7 | 913.7 | 96.4 | 817.3 | 346.6 |
| 10 | 3.00% | 1,985.5 | 941.1 | 99.3 | 841.9 | 324.6 |

Sum of explicit-period PV = **$2,531.0B**. Terminal: NOPAT₁₀ = $941.1B,
EBIT₁₀ = $1,191.3B. Terminal identity [S]: terminal NOPAT (year 11) =
$941.1B × 1.03 = $969.4B; approved terminal ROIC = **22%, held, not
faded** (the durable-moat exception) ⇒ 1 − 0.03÷0.22 = 0.8636 ⇒ terminal
FCF = $969.4B × 0.8636 = **$837.2B**. Terminal value at year 10 = $837.2B
÷ 0.07 = **$11,959.7B**; PV = $11,959.7B ÷ (1.10)^10 = **$4,611.0B**.

Enterprise value = $2,531.0B + $4,611.0B = **$7,142.0B**. Equity value =
EV + $2.137B = **$7,144.1B**. **Value per share = $7,144.1B ÷ 24.1B =
$296.44.**

Companions: terminal share of value = $4,611.0B ÷ $7,142.0B = **64.6%** —
inside the 60–75% normal band this time, because the un-faded 22%
terminal ROIC keeps the terminal FCF conversion factor materially higher
than bear/base's. Implied exit multiple = $11,959.7B ÷ $1,191.3B =
**10.04× EV/EBIT** — higher than bear/base's 8.14×, entirely because
terminal ROIC is held at 22% instead of fading to 10%, the direct effect
of the durable-moat exception on the terminal identity, not of the
scenario's higher near-term growth. Comparison against today's multiple:
**INCOMPLETE**, same reason. ±1% sensitivity: r = 9% ⇒ $356.05
(**+20.1%**); r = 11% ⇒ $252.13 (**−14.9%**).

**Provenance.** All three value-per-share figures are **computed**, not
AI inference and not sourced fact: computed deterministically from
authorised policy constants (r = `policy.ts` `rateGrid[1]` = 10%, g =
`policy.ts` `terminalGrowth` = 3%), already-committed OBSERVED figures
(FY2026 revenue $215,938M, `nopatTaxRate` 21%, share count 24.1B, and the
net-cash figures derived above from the same capture), and the
already-drafted / now-approved AI-judgment scenario drivers (growth,
margin, capital intensity, terminal ROIC per scenario) — every input is
individually labelled above at its own source; the arithmetic combining
them carries no separate judgment of its own.

| Scenario | growth | reinvestment | terminal ROIC (approved) | Terminal share | Implied exit multiple | ±1% sensitivity | Value/share |
|---|---|---|---|---|---|---|---|
| Bear | 5% | 2% | 13% → 10% (fade to r) | 46.3% | 8.14× EV/EBIT | +15.4% / −11.7% | **$28.08** |
| Base | 20% | 4% | 18% → 10% (fade to r) | 54.3% | 8.14× EV/EBIT | +17.6% / −13.2% | **$102.38** |
| Bull | 35% | 5% | 22% (durable-moat exception) | 64.6% | 10.04× EV/EBIT | +20.1% / −14.9% | **$296.44** |

This outcome computes the three scenario values and stops here, per
`CALVIN RULING — A, WITH AI DRAFT`'s own scoping: it does not run the
report, does not produce the §12 observation, and does not take up the
Analyzer finish-line work — all a separate, later continuation. NVDA
still has no `BUNDLES` entry, no recorded row, and still fails closed at
`gate.ts`; nothing here makes it resolvable. No price comparison is made
and none is implied — NVDA's absent price row keeps any downstream
verdict `INCOMPLETE`, the expected result under FINAL OWNER RULING #205,
not a defect these three numbers change.

### §7.1 constants

| Field | Value | Provenance |
|---|---|---|
| `nopatTaxRate` | `0.21` | AI INFERENCE — approximates the U.S. federal statutory corporate rate; the same value OKLO's committed bundle already carries for this constant. Proposed for NVDA's own runs only — `policy.ts`'s `UNDEFINED_POLICY_CONSTANTS` is untouched (HARD BOUNDS). |
| `stressMarginLevel` | `0.15` | AI INFERENCE — set at NVDA's own OBSERVED worst realized margin in the ten-year window (FY2023: 15.66%, the crypto/gaming-inventory and export-control correction), the most severe genuinely-observed case rather than a hypothetical worse one. |
| `preRevenueUnleveredRate` | *(blank — evidence gap)* | Not applicable. This constant is read only by the pre-revenue module (`PreRevenueFixture`), which neither profile this entry surface offers ever invokes (`MATURE_PROFITABLE_STABLE_FCF` / `HIGH_GROWTH_PROFITABLE_UNCERTAIN_DURABILITY`). MSFT's own committed bundle leaves this null for the identical reason. |
| `projectDebtCost` | *(blank — evidence gap)* | Not applicable, same reason as above — a project-finance-only constant (OKLO's funding-stack module), never read for NVDA's profile. |

## Evidence gaps — named, not defaulted

- **FY2019 revenue is absent from `us-gaap:Revenues`** in this capture (NVIDIA
  tagged that year's revenue solely under the now-retired
  `RevenueFromContractWithCustomerExcludingAssessedTax` element, per
  `calibration/inputs.ts`'s own Defect D comment). This creates a one-year
  gap inside the ten-year margin-history window used above — not at either
  endpoint, so it does not block the classification statistics themselves
  (§3.7 is a same-basis concern, not a no-gaps concern), but it is why
  FY2018 and FY2020 sit as adjacent *entries* in the series above despite
  not being adjacent calendar years.
- **`balanceSheetNature`'s "asset-light" reasoning is not confirmed against
  total-asset composition** — neither `Assets` nor
  `PropertyPlantAndEquipmentNet` is a tag `tagMap.ts` reads, so this capture
  carries no total-assets or net-PP&E figure to check the classification
  against directly. Reasoned instead from capital intensity and total debt,
  both of which are cited above.
- **The §4.4 non-operating-investments judgment is explicitly not made
  here** (HARD BOUNDS) — `CANDIDATE_NON_OPERATING_INVESTMENT_TAGS`
  (`EquityMethodInvestments`, `EquitySecuritiesWithoutReadilyDeterminableFairValueAmount`,
  `EquitySecuritiesFvNiCurrentAndNoncurrent`, `LongTermInvestments`) are the
  candidates a real acquired run would present to whoever makes this
  judgment; this draft neither selects among them nor proposes a value, per
  `CALVIN RULING — A` and issue #188's MSFT precedent. This is a run-time
  judgment outside the recorded-bundle shape this draft covers, named here
  for completeness rather than left implicit.
- **The three scenario dollar values (bear / base / bull) are now computed**
  (see "Scenario values" above), following `CALVIN RULING — APPROVE AS
  DRAFTED`'s approval of the three prepared terminal-ROIC assumptions:
  Bear $28.08, Base $102.38, Bull $296.44 per share, under the current
  approved scenario DCF (r = 10%, g = 3%, per-scenario terminal ROIC),
  with the working, the [S] terminal identity, and the terminal-share /
  implied-exit-multiple / ±1% sensitivity companions all shown. This
  closes the evidence gap named by `CF-ANALYST-DRAFT-NVDA-SCENARIO-02`;
  it does not run the report, produce the §12 observation, or make NVDA
  resolvable — those remain separate, later outcomes.

## What approving and running this draft would, and would not, unlock (SCOPE item 7)

**Would unlock:** NVDA's capture carries the single-tag revenue series
needed for **both** a five-year and a ten-year achieved-growth comparator
(§10.6.2/§13's `achievedRevenueCagr`) — `us-gaap:Revenues` reaches back to
FY2016 (ten years before the filer's current FY2026) and to FY2021 (five
years before), both present as real annual observations, so neither horizon
would be blocked by the "endpoint gap" refusal `calibration/inputs.ts`
implements. (This draft does not compute or state the resulting CAGR
figures themselves — that would be an achieved-comparator finding, which
the HARD BOUNDS place out of scope for an unapproved draft.) This is a
genuine difference from MSFT (no multi-year single-tag series exists at
all — its fixture is a synthetic reconstruction) and from OKLO (blocked
upstream at Gate 1, `HISTORY INSUFFICIENT`, 3 filed years).

**Would not unlock:** every price-dependent output. `prices.json`
(`lib/analyzer/acquisition/captures/prices.json`) carries rows for `MSFT`
and `OKLO` only — no `NVDA` row. Enterprise value, every multiple, the
reverse-DCF grid's target-EV side, and the fair-value-range-vs-price
comparison would all report `INCOMPLETE` on a real run, for exactly the
same honest reason OKLO's pre-revenue profile already reports `INCOMPLETE`
on several outputs today — an expected result this draft's approval does
not change, never a defect to fix (HARD BOUNDS; issue #205's FINAL OWNER
RULING on the unconditional `INCOMPLETE` front-end verdict).

## What this draft does not do

No entry in `BUNDLES`. No change to `TICKERS_WITH_ANALYST_INPUTS`. No row
seeded in `analyzer_recorded_analyst_bundles`. No fixture. No import of
this file by any runtime module. No §7.1 `policy.ts` constant set,
defaulted or calibrated. No §4.4 non-operating-investments selection made.
No report run, no verdict, no RONIC-ladder reading, no achieved-comparator
result reported as a finding. See the companion PR for the assertions
pinning all of the above and for the throwaway-database validation this
draft's field values were checked against.
