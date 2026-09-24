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

**Evidence gap — named, not hand-estimated.** `CALVIN RULING — C` (24 Sep
2026 13:00:02Z, PR #289 comment 5814600108) refused this draft's prior
single-stage hand estimate — an assumed 9.5% required return and a
per-scenario 3% / 4% / 5% terminal growth rate, neither authorised by the
methodology — and required either a re-derivation strictly from the
current approved methodology and the already-drafted scenario assumptions,
or a named gap stating exactly which authorised input is missing.
Reconciling the retrieved authority: two of the three inputs a scenario
DCF needs are already authorised; the third is not, and cannot be
authored inside this outcome's scope.

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

**Not authorised, and not draftable here: terminal ROIC.** A DCF's
terminal value must still be built consistently — methodology §3.5,
stated as a mandatory, software-deterministic [S] rule: *"terminal FCF =
terminal NOPAT × (1 − g ÷ terminal ROIC). Do not take final-year FCF ×
(1+g)."* That rule needs a terminal ROIC, and nothing already authorised
or already drafted supplies one:

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
  fact recoverable from the filings or from `policy.ts`.

  (`lib/analyzer/modules/scenarioOutputs.ts`'s `computeScenarioEnterpriseValue`
  does compute an internal `rate + terminalRoicPremium` for every caller,
  including the scenario-DCF formula it implements — but that is the kind
  of disagreement between the frozen contract and the build the spec's
  own preface calls "a defect to be raised, not drift for a later session
  to correct on its own judgment" [spec.md:1], not authority to borrow the
  reverse-DCF-only premium here. It is also not, in practice, how any
  committed scenario value in this codebase is produced: that function is
  wired only into the M14 sensitivity tables
  [`lib/analyzer/modules/sensitivity.ts`], never into the path that
  produces a company's committed `scenarioValues`. MSFT's own committed
  bundle supplies its three dollar figures directly, with
  `revalueBaseCaseAtRate: null`, because — per that fixture's own comment
  — "No real revaluation-at-rate solver exists for this fixture"
  (CB-AUDIT-01 H2). This draft is naming the same absence for NVDA, not a
  gap specific to it.)
- The already-drafted scenario assumptions (`revenueGrowthOrPath`,
  `operatingMargin`, `reinvestmentCapitalIntensity`, `writtenAnchor` per
  scenario, above) supply no terminal ROIC and no ingredients to compute
  one. Methodology §3.3's computed RONIC (trailing five-year ΔNOPAT ÷
  Δinvested capital) is a company-level, historical, diagnostic-reverse-
  DCF quantity: it needs invested-capital inputs (capex, acquisitions,
  finance-lease ROU additions, ΔNWC) this draft's classification section
  does not carry, and even if computed, is not what §3.5 defines a
  *scenario's* terminal ROIC to be — an authored, forward, per-scenario
  judgment about margin durability, not a trailing historical ratio.

Authoring a terminal ROIC now — a number, a fade path, or a durable-moat
argument, per scenario — would itself be exactly the kind of new,
standalone methodology input `CALVIN RULING — C` forbids ("do not
introduce ... a terminal-growth assumption, valuation shortcut, or other
methodology input unless it is already authorised") and would reopen a
scenario driver Calvin has already reviewed and preserved (HARD BOUNDS:
"No re-opening of anything Calvin preserved: ... scenario drivers and
their written anchors").

**Named gap:** the three scenario dollar values cannot be re-derived from
the current approved methodology and the already-drafted scenario
assumptions alone. **What would close it:** a Calvin-authored terminal
ROIC — a value, a fade rule, or an explicit durable-moat argument — for
each of the three scenarios, entered as its own new analyst input with
its own written anchor (methodology §3.5), which is outside this
outcome's scope to author. Until that input exists, the three values are
left blank — not zero, not a placeholder, not the prior hand estimate —
per `CALVIN RULING — C`'s own named fallback, a success outcome and not a
defect.

| Scenario | growth | reinvestment | terminal ROIC | Value/share |
|---|---|---|---|---|
| Bear | 5% | 2% | *(evidence gap — see above)* | *(evidence gap)* |
| Base | 20% | 4% | *(evidence gap — see above)* | *(evidence gap)* |
| Bull | 35% | 5% | *(evidence gap — see above)* | *(evidence gap)* |

Calvin's decision on this gap — authoring the missing terminal-ROIC input,
or ruling some other basis into scope — is the next step; this draft does
not anticipate it.

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
- **The three scenario dollar values (bear / base / bull) are a named
  evidence gap, not a hand estimate** (see "Scenario values" above): the
  discount rate and terminal growth are authorised (`policy.ts`'s
  `rateGrid[1]` = 10%, `terminalGrowth` = 3%), but the methodology's
  terminal-consistency rule (§3.5) also needs a terminal ROIC, and both
  frozen documents scope the one policy-fixed terminal-ROIC rule (rate + 3
  points) to the diagnostic reverse DCF only — for the scenario DCF they
  require a new per-scenario analyst input with its own written anchor,
  which `CALVIN RULING — C` does not authorise this outcome to add.
  Closing this gap is Calvin's decision, not a derivation this draft can
  complete from what is already authorised and already drafted.

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
