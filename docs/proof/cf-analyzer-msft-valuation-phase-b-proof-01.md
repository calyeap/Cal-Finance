# CF-ANALYZER-MSFT-VALUATION-PHASE-B-PROOF-01 — one shadow MSFT DCF, independent oracle attempt, sensitivity

**Outcome:** `CF-ANALYZER-MSFT-VALUATION-PHASE-B-PROOF-01` ([issue #427](https://github.com/calyeap/Cal-Finance/issues/427)), TIER: HEAVY.

**What this document is.** A one-off, non-governing, shadow-mode MSFT intrinsic-value
evidence proof. It is evidence for a *later*, separate Calvin methodology decision —
**it is not that decision**, it is not a BUY/HOLD/SELL call, and it authorizes no
Phase C/D/E, no production change, and no automatic successor. Nothing under `lib/`
or `app/` was read for its numbers, changed, or used as an oracle. Production DCF
function `lib/analyzer/modules/scenarioOutputs.ts` was not opened, run, or reused.

## Headline result

> **PASS / NOT PROVEN: NOT PROVEN.**
>
> The shadow DCF itself — real-sourced inputs, a fully specified 10-year FCFF model,
> an explicit cash-flow/formula trace, and candid one-variable sensitivity — is
> delivered to the issue's spec. **The independent-oracle requirement specifically is
> not fully satisfied**: Damodaran's externally-authored `fcffsimpleginzu.xlsx` (the
> issue's first-choice oracle) could not be fetched or executed from this execution
> environment (see "Why the primary oracle could not be used" below), and the
> fallback this proof substitutes is a second, independently-*coded* implementation
> of the *same* disclosed model definition, not a separately-opinionated
> externally-authored one. That is weaker evidence than the issue asked for, and this
> report says so rather than relabeling it as a pass. See "Independent oracle" below
> for exactly what the fallback does and does not establish, and "What would move this
> to PASS."

## Authority

- Calvin approved one bounded Phase B MSFT valuation proof on 14 Oct 2026 (issue #427).
- Real-source/capture path and the A1 corrected period logic are from
  [Phase A PR #426](https://github.com/calyeap/Cal-Finance/pull/426)
  (`lib/analyzer/acquisition/history.ts`'s `quarterlySeriesWithDerivedQ4`); this proof
  uses the same already-corrected FY2026 TTM revenue figure PR #426 produced
  ($331,839M — see "Real inputs" below), not the pre-fix naive-sum TTM.
- [Analyzer V2 freeze](https://github.com/calyeap/Cal-Finance/blob/master/docs/analyzer-v2-final-acceptance-freeze.md)
  remains in force and is not touched by this proof.
- The [Opus read-only review of 14 Oct](https://github.com/calyeap/Cal-Finance/issues/424)
  was not treated as authority; every number below is independently re-derived from
  the committed SEC capture or a freshly cited external source, not carried over from
  that review.

## Why the primary oracle could not be used

Tested directly from this run's execution environment, not assumed:

```
$ curl -sS -o ginzu.xlsx "https://pages.stern.nyu.edu/~adamodar/pc/fcffsimpleginzu.xlsx"
curl: (56) CONNECT tunnel failed, response 403
$ (WebFetch) https://pages.stern.nyu.edu/~adamodar/pc/fcffsimpleginzu.xlsx
getaddrinfo ENOTFOUND pages.stern.nyu.edu
$ (WebFetch) https://www.sec.gov/cgi-bin/browse-edgar?...
getaddrinfo ENOTFOUND www.sec.gov
```

The sandboxed network proxy's status endpoint confirms this as a policy denial
(`"kind":"connect_rejected","detail":"gateway answered 403 to CONNECT (policy denial
or upstream failure)","host":"pages.stern.nyu.edu:443"`), not a transient outage.
`WebSearch` (a different, Anthropic-side backend, not this sandbox's egress) remained
usable throughout and is the source for every externally-sourced figure below — but it
returns search snippets, not an executable spreadsheet. There is no credible way to
execute or control Damodaran's actual spreadsheet from this environment. Per the
issue's own instruction ("If the spreadsheet cannot be executed/controlled reliably,
select one demonstrably independent oracle... or... return an honest evidence/blocker
finding"), this proof does both: it names the blocker precisely, and it still runs the
best available fallback cross-check (below) rather than stopping.

## Real inputs (committed capture + primary-filing facts), as of FY2026 (FYE 2026-06-30)

All of the following come from `lib/analyzer/acquisition/captures/msft-companyfacts.json`
(real SEC XBRL `companyfacts` API response, CIK 0000789019, `capturedAt`
2026-09-24T18:40:18.211Z) unless marked "10-K text (WebSearch)." Full citations and
exact XBRL tag names are recorded per-field in
[`scripts/evidence/msft-phase-b/inputs.json`](../../scripts/evidence/msft-phase-b/inputs.json).

| Item | Value | Source |
|---|---|---|
| Revenue FY2024 / FY2025 / FY2026 | $245,122M / $281,724M / $331,839M | XBRL `RevenueFromContractWithCustomerExcludingAssessedTax`; FY2026 figure matches PR #426's A1-corrected derived-Q4 TTM exactly |
| Operating income FY2026 | $155,237M (46.78% margin) | XBRL `OperatingIncomeLoss` |
| Net income FY2026 | $133,749M (diluted EPS $17.95) | 10-K text via WebSearch, cross-checked against Note 11 tax provision below |
| Effective tax rate FY2026 | 19% (FY2025: 18%) | 10-K Note 11 text, quoted directly via WebSearch |
| Depreciation / Amortization of intangibles FY2026 | $34,300M / $4,700M | XBRL `Depreciation`, `AmortizationOfIntangibleAssets` |
| Capex FY2026 (FY2025, FY2024) | $115,948M ($64,551M, $44,477M) | XBRL `PaymentsToAcquirePropertyPlantAndEquipment` — real, disclosed step-up from the AI/datacenter buildout, not a data artifact |
| Cash / short-term investments / long-term investments (2026-06-30) | $20,935M / $55,908M / $36,348M | XBRL, respective tags |
| Equity-method + other non-marketable equity investments (2026-06-30) | $12,000M + $12,400M | XBRL `EquityMethodInvestments`, `EquitySecuritiesWithoutReadilyDeterminableFairValueAmount` |
| Long-term debt, total (2026-06-30) | $40,294M ($9,227M current + $31,067M noncurrent) | XBRL; current+noncurrent reconciles exactly to the total, an internal consistency check |
| Finance lease liability, total (2026-06-30) | $66,594M | XBRL `FinanceLeaseLiability` — larger than long-term debt; consistent with disclosed sale-leaseback-financed AI capacity, treated as debt-equivalent (Damodaran convention) |
| Operating lease liability, total (2026-06-30) | $21,925M | XBRL `OperatingLeaseLiability`, treated as debt-equivalent |
| Shares outstanding (10-K cover page) | 7,425,545,491 as of **2026-07-23** | XBRL `dei:EntityCommonStockSharesOutstanding` |
| Historical closing price | **$499.70 on 2026-09-04** (HISTORICAL, not current) | `lib/analyzer/acquisition/captures/prices.json`, Yahoo, recorded 2026-09-08 |

**Internal consistency checks that passed:** `LongTermDebtCurrent + LongTermDebtNoncurrent`
= `LongTermDebt` total exactly (9,227 + 31,067 = 40,294); provision-implied effective tax
rate (tax provision ÷ (net income + tax provision), using the two independently
WebSearch-sourced figures $32,185M and $133,749M) = 19.4%, consistent with the 10-K's
own stated "19%."

**Explicitly not treated as the answer:** `lib/analyzer/fixtures/msft.ts`'s
`scenarioValues: { bear: 265, base: 510, bull: 650 }` and its `price = 510.12` anchor are
a synthetic reconstruction from a frozen UI mock (file header says so explicitly), not
acquired SEC facts — none of those three numbers appear anywhere in this proof's inputs
or outputs.

## Externally-sourced assumptions (disclosed, disputable, test-only)

None of these could be pulled from a primary filing or spreadsheet in this network-
restricted environment; each is a judgment call, sensitivity-tested below, and must
not be promoted to policy. Full detail and uncertainty ranges in `inputs.json`.

| Assumption | Value used | Range seen | Source |
|---|---|---|---|
| Risk-free rate (10yr UST) | 4.6% | 4.4%–4.8% | Most recent real readings found (4.79% on 2026-09-02; 4.66% weekly H.15, week of 2026-07-24); no exact 2026-10-14 quote retrievable |
| Equity risk premium | 4.2% | — | Damodaran's own published implied ERP, 4.23% (Jan 2026) / 4.20% (Jul 2026, post-Moody's-downgrade adjustment) |
| Beta | 1.00 | 0.87–1.13 | GuruFocus 1.11 (Jun 2026), Google Finance ~1.13 (Jul 2026), Infront 1-yr 0.87 (likely stale); 1.00 is a rounded midpoint, a judgment call |
| Pre-tax cost of debt | 5.0% | 4.6%–5.9% | Damodaran synthetic-rating method: EBIT/cash-interest coverage ≈103x → top-tier spread ≈0.4–0.5pp over Rf; cross-checked (not primarily sourced) against GuruFocus's 5.90% computed figure |
| Terminal growth rate | 4.0% | — | Set below the risk-free rate, per the stable-growth constraint g ≤ risk-free rate |
| Stable terminal ROIC | 18% | — | Judgment call: comfortably above terminal WACC (~8.6%), reflecting a moderating-but-durable moat; flagged as the single most consequential assumption in this proof |

## One shadow candidate — model definition

A standalone 10-year FCFF DCF, independently coded in
[`scripts/evidence/msft-phase-b/`](../../scripts/evidence/msft-phase-b/) (pure Python
stdlib, no network, no production-code imports):

- **Revenue growth** fades linearly from 16% (year 1 — below the realized FY2025→FY2026
  17.8%, a deliberate haircut for mean reversion) to the 4.0% terminal rate by year 10.
- **Operating margin** fades linearly from the realized FY2026 46.78% toward a 45.0%
  stable margin by year 10 (mild compression judgment call — flagged).
- **Tax rate** held flat at the realized 19% throughout (simplification — see
  Limitations: ignores any OECD Pillar Two or jurisdictional-mix drift).
- **Reinvestment rate** (reinvestment ÷ EBIT·(1−t)) fades linearly from 60% in year 1
  (consistent with FY2026's real, disclosed capex supercycle: implied reinvestment rate
  on FY2026 actuals is ≈61.2%, computed as (capex − D&A) ÷ EBIT·(1−t) = ($115,948M −
  $39,000M) ÷ $125,742M) down to the terminal reinvestment rate implied by the
  stable-growth identity, **reinvestment = g ÷ ROIC = 4.0% ÷ 18% = 22.2%**, by year 10.
  The model reports each year's *implied* sales-to-capital ratio (ΔRevenue ÷
  reinvestment) as a diagnostic rather than driving reinvestment directly off an
  assumed sales-to-capital path, to keep the terminal-year reinvestment rate internally
  consistent with the terminal growth/ROIC identity (no discontinuity at the terminal
  boundary).
- **Discount rate (WACC ≈ 8.64% base case)**: cost of equity via CAPM (Rf + β·ERP =
  4.6% + 1.00×4.2% = 8.8%); after-tax cost of debt = 5.0%×(1−19%) = 4.05%; weights from
  market value of equity (historical price × cover-page share count = $3,710.5B) and
  total debt-equivalent (long-term debt + finance leases + operating leases =
  $128,813M, only ≈3.4% of invested capital).
- **Terminal value**: Gordon-growth, `TV₁₀ = FCFF₁₁ ÷ (WACC − g)`.
- **Equity bridge**: `Equity value = Enterprise value + cash & marketable securities −
  (debt + finance leases + operating leases)`, divided by the cover-page share count.
  `EquityMethodInvestments` ($12,000M) and `EquitySecuritiesWithoutReadilyDeterminableFairValueAmount`
  ($12,400M) are disclosed in the inputs but **not** added separately: in the committed
  capture both are consistently subsets of `LongTermInvestments`, already inside "cash &
  marketable securities" above (e.g. $12.0B/$12.4B of $36.3B at 2026-06-30, and a matching
  $8.9B/$15.4B-of-pattern at 2025-06-30) — adding them again would double-count ≈$24.4B
  of equity.

### Base-case result

| | |
|---|---|
| WACC | 8.64% |
| Sum of PV of explicit-period FCFF (years 1–10) | $858.4B |
| PV of terminal value | $2,373.0B |
| **Terminal value share of enterprise value** | **73.4%** (below the 85% candor threshold) |
| Enterprise value | $3,231.4B |
| + Cash & marketable securities | $113.2B |
| − Debt & lease equivalents | $128.8B |
| Equity value | $3,215.8B |
| ÷ Shares outstanding | 7,425,545,491 |
| **Value per share (base case)** | **$433.08** |

Base case is ≈13.3% below the $499.70 historical captured price. **This is reported
neutrally, as the issue requires — it is not a BUY/HOLD/SELL call**, and no input was
tuned to move this number toward or away from the market price.

Full year-by-year cash-flow trace (revenue, margin, EBIT, reinvestment, FCFF, discount
factor, PV, for every one of the 10 forecast years) is committed at
[`scripts/evidence/msft-phase-b/output/engine_a_shadow_dcf.json`](../../scripts/evidence/msft-phase-b/output/engine_a_shadow_dcf.json).

## Independent oracle

**What was attempted and could not be done:** executing Damodaran's actual
`fcffsimpleginzu.xlsx` against this same input vector. Blocked by the sandboxed
network proxy (see above) — not a credibility judgment about the spreadsheet, a
tooling limitation of this run's environment.

**What the fallback does:** a second, independently written implementation
(`scripts/evidence/msft-phase-b/independent_oracle.py`, "Engine B") of the *same*,
fully disclosed model definition above (`driver_schedule.py` — the one shared,
disclosed assumption path both engines consume) — built without reading or copying
`shadow_dcf.py`'s code, structured differently end to end (closed-form exponentiation
instead of an accumulation loop for discounting; debt-weight-first instead of
equity-weight-first for WACC; a reordered equity bridge), and recording every
intermediate step as an explicit formula-cell ledger (cell name, formula text, computed
value — 57 rows, committed at
[`scripts/evidence/msft-phase-b/output/formula_ledger.csv`](../../scripts/evidence/msft-phase-b/output/formula_ledger.csv)),
in the spirit of "recorded formula cells."

**Result:** Engine A and Engine B agree to floating-point precision —
value per share $433.0752013036617 (A) vs $433.07520130366174 (B), a discrepancy of
1.3×10⁻¹⁴ %, orders of magnitude inside the 0.5% target. Full reconciliation at
[`scripts/evidence/msft-phase-b/output/reconciliation.json`](../../scripts/evidence/msft-phase-b/output/reconciliation.json).

**What this does and does not prove.** It proves the arithmetic — discounting, the
WACC formula, the terminal-value formula, the equity bridge — is internally correct
given the disclosed assumption path; a second, differently-structured implementation
landing on the same answer to 14 decimal places is strong evidence against a formula
bug. **It does not substitute for the issue's actual ask**: an externally-authored,
separately-opinionated model (Damodaran's own, or an equivalent third party) checking
whether *the assumptions themselves* — not just the arithmetic applied to them — are
reasonable. Two engines built by the same author from the same spec, agreeing with each
other, is not independent validation of the growth/margin/beta/ERP/ROIC judgment
calls; it only confirms neither engine mis-keyed a formula. That gap is exactly why
this proof's headline verdict is NOT PROVEN rather than PASS.

## Sensitivity / fragility (one variable at a time, base case held fixed otherwise)

Full detail: [`scripts/evidence/msft-phase-b/output/sensitivity.json`](../../scripts/evidence/msft-phase-b/output/sensitivity.json).

| Variable | −case | Base ($433.08) | +case | Range as % of base |
|---|---|---|---|---|
| Discount rate (WACC, via Rf ∓1pp) | **$561.35** (Rf −1pp) ⚠️ | $433.08 | **$349.55** (Rf +1pp) | −19% / +30% |
| Revenue growth path (Y1 & terminal, ∓2pp) | **$319.51** (−2pp) | $433.08 | **$702.03** (+2pp) ⚠️ | −26% / +62% |
| Operating margin (terminal target, ∓2pp) | **$416.00** (−2pp) | $433.08 | **$450.15** (+2pp) | −4% / +4% |
| Reinvestment, via stable terminal ROIC (∓5pp) | **$389.55** (ROIC −5pp) | $433.08 | **$457.68** (ROIC +5pp) | −10% / +6% |

⚠️ = flagged `TERMINAL_G_GT_RISK_FREE` (see below) — a non-economic combination, not a
clean read of this proof's own stable-growth rule.

**Candor flags checked automatically on every scenario above:** terminal-value share of
enterprise value > 85% (none triggered — base case 73.4%, highest seen across these
one-variable sweeps was 83.5% at revenue growth +2pp); WACC ≤ terminal growth, i.e.
r ≤ g (none triggered — tightest spread, at Rf +1pp, is still 9.61% − 4.00% = 5.61pp);
**terminal growth g > risk-free rate** (this proof's own stable-growth convention, set
in `inputs.json`: "g ≤ risk-free rate"). This third flag **does trigger**, on two of the
eight non-base scenarios above:
- `discountRate` **Rf −1pp**: Rf drops to 3.6% while terminal g stays fixed at the base
  4.0%, so g (4.0%) > Rf (3.6%). The reported **$561.35** figure is a **non-economic
  scenario**, not a clean "lower discount rate raises value" read — it only shows what
  this model's formula does if g and Rf are left inconsistent, not a defensible
  valuation.
- `revenueGrowth` **+2pp**: the terminal fade target (`revenueGrowthFadeTo`) rises to
  6.0% while Rf stays fixed at the base 4.6%, so g (6.0%) > Rf (4.6%). The reported
  **$702.03** figure — the largest upside number in this whole proof — is likewise a
  **non-economic scenario** under this model's own stable-growth rule, not a credible
  "high-growth" case.

Both scenarios are left in the sweep (rather than silently re-run with terminal g held
at its base value) specifically so this flag, and the sweep design that lets terminal g
drift during a one-variable perturbation, are visible rather than hidden. Full detail,
including the per-scenario `terminalGrowth`/`riskFreeRate`/`flags` fields, is in
`sensitivity.json`.

**Reading this candidly:** discarding the two flagged, non-economic scenarios above, the
model is still **most fragile to the discount rate and to the revenue growth path** —
the economically clean ends of those two sweeps are Rf +1pp ($349.55) and revenue growth
−2pp ($319.51), both well below base, while the flagged high-side numbers ($561.35,
$702.03) should not be read as upside case studies at all. Operating margin and the
reinvestment/ROIC assumption move the answer far less in comparison, and neither
produces a flagged scenario. This asymmetry is itself informative: anyone relying on
this kind of model for MSFT should spend their diligence on the growth and
discount-rate assumptions — and on keeping g and Rf jointly consistent under any
perturbation — not on the reinvestment mechanics, which is a limitation candidly
disclosed here precisely because it was found, not smoothed over.

**Implied growth at the observed price (context only, not an input):** holding every
other base-case assumption fixed, the year-1 revenue growth rate that reconciles the
model's value per share to the $499.70 historical price is **≈19.4%**, vs. the 16.0%
assumed in the base case — a 3.4pp gap, not an extreme one. No input was altered to
produce this reconciliation; it is reported strictly as context, per the issue's
instruction, and is not treated as validating or invalidating the base case.

## Unsupported data / limitations (candid)

- **Change in net working capital** is not modeled (no XBRL tag for it survived the
  trimmed capture); reinvestment is capex-and-D&A-only. Growing deferred/unearned
  revenue is a cash *inflow*, not a drag, so omitting it likely **overstates**
  measured reinvestment somewhat, if anything — not understates it. Not fixed here —
  named as missing evidence, not guessed around. Reinvestment rate, growth and ROIC
  are nonetheless Damodaran-consistent in structure.
- **Tax rate held flat at 19%** for all 10 forecast years; ignores any drift from OECD
  Pillar Two minimum-tax implementation or shifts in the US/foreign income mix that
  produced the FY2025→FY2026 18%→19% move itself.
- **Beta, risk-free rate, ERP and pre-tax cost of debt are all WebSearch-sourced
  snippets, not primary filings or a live data feed** — each carries a disclosed range
  wider than a single point estimate should be trusted to within; see the table above.
- **Share count (2026-07-23) and historical price (2026-09-04) are ~6 weeks apart.**
  Share count drift over 6 weeks for MSFT is immaterial (no buyback/issuance event of
  that scale is evidenced in this window) and was not separately adjusted, but the
  mismatch itself is disclosed rather than silently reconciled.
- **Finance leases ($66,594M) are larger than long-term debt ($40,294M)** and are
  included as debt-equivalent per Damodaran convention; this is a real, disclosed
  feature of Microsoft's current AI-capacity buildout financing, not a data anomaly,
  but it is a judgment call (not every practitioner treats finance leases identically)
  that materially affects WACC's small debt weight and the equity bridge.
- **Independent-oracle requirement**, as discussed above, is the proof's primary
  shortfall: NOT a Damodaran-grade cross-check, only an arithmetic-consistency check
  between two same-author implementations.

## What would move this to PASS

1. An execution environment with outbound access to `pages.stern.nyu.edu` (or a
   legitimately obtained, licensed copy of the Ginzu spreadsheet usable offline),
   so the shadow candidate's input vector can be run through Damodaran's own formulas
   and opinions, not just re-derived by the same author twice.
2. Or, failing that, a genuinely separately-authored third-party model (a different
   analyst's or vendor's published MSFT DCF with its own disclosed formulas) to compare
   against, rather than a second same-author implementation of this proof's own model.
3. A primary-filing (not WebSearch-snippet) source for beta, the risk-free rate as of
   the exact valuation date, the equity risk premium, and Microsoft's actual weighted
   average cost of debt from the 10-K's own debt-maturity/rate table.

None of the above is undertaken by this run — per the issue's scope, this proof stops
at an honest NOT PROVEN rather than reaching for any of these on its own initiative.

## Reproducing this proof

No network access and no production code (`lib/`, `app/`) is touched by any of the
following:

```
python3 scripts/evidence/msft-phase-b/run_all.py
```

Regenerates every file under `scripts/evidence/msft-phase-b/output/` from
`scripts/evidence/msft-phase-b/inputs.json` and exits non-zero if Engine A and Engine B
disagree beyond a 0.05% tolerance (they do not — see "Independent oracle" above).

## Explicit non-scope reminder

This proof does not: change `lib/analyzer/modules/scenarioOutputs.ts` or any other
production code; call BUY/HOLD/SELL; claim the Analyzer is "ready for valuation";
promote any WACC/growth/margin/ROIC number here to Methodology policy; or authorize
Phase C or any further phase. The next decision — whether to adopt any methodology or
authorize further phases — is reserved for Calvin, after seeing this evidence.
