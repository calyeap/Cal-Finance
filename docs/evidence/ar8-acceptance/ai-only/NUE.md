# NUE — AI-only FCFF DCF baseline

- Price: **$260.73** (Yahoo close 2026-10-19)
- Discount rate: **11%** (steel = cyclical); terminal growth 3.0%; mid-year discounting; 10-yr explicit; TV discounted at end of year 10 (Gordon on year-11 FCFF, reinvestment = g/RONIC).
- Valuation date ≈ 2026-10-20. Year 0 = TTM (FY25 + H1 26 − H1 25: revenue $36.1B, EBIT ≈ $4.17B (11.5%)).

## Six key filed facts (latest FY, $M; shares M)

| Item | Value | FY end | XBRL tag |
|---|---|---|---|
| Revenue | 32,494 | 2025-12-31 | `RevenueFromContractWithCustomerExcludingAssessedTax` |
| Operating income (derived: no OperatingIncomeLoss tag) | 2,627 = pretax 2,568 + net interest 59 | 2025-12-31 | `IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest + InterestRevenueExpenseNet` |
| Net income (to Nucor) | 1,744 | 2025-12-31 | `NetIncomeLoss` |
| Capex | 3,422 | 2025-12-31 | `PaymentsToAcquirePropertyPlantAndEquipment` |
| D&A | 1,480 = 1,226 + 254 | 2025-12-31 | `Depreciation + AmortizationOfIntangibleAssets` |
| Diluted shares | 231.0 | 2025-12-31 | `WeightedAverageNumberOfDilutedSharesOutstanding` |

Balance sheet (10-Q 2026-07-04): LongTermDebtAndCapitalLeaseObligations 6,389 + ...Current 581 + ShortTermBorrowings 129 + OperatingLeaseLiability 128 (FY25) = 7,227; Cash 2,478 + ShortTermInvestments 214 = 2,692.
Net debt = **$4,535M**; diluted shares used = **228.5 M** (Q2 2026 diluted weighted avg).

## Drivers

| | Bear | Base | Bull |
|---|---|---|---|
| growth | −8%, −5% (price down-cycle), then +2–3% | +4% NTM, 0%, then 3% | +8%, +5%, then 4% fading to 3% |
| margin | 9% → 7% trough → 9% mid | 13% → 12% → 11.5% mid-cycle | 15% → 14% (tariff-protected spreads) |
| tax | 23% → 24% | 23% | 22% |
| reinv | S/C 1.0 + $3.0B excess project capex Y1–3; RONIC 9% | S/C 1.2 + $1.5B excess project capex Y1–2; RONIC 12% | S/C 1.4 + $0.5B Y1; RONIC 15% |

**Why:** Revenue 20.1B (2020) → 36.5 → 41.5 → 34.7 → 30.7 → 32.5B (2025); EBIT margin ~25% at the 2021–22 peak, ~18% 2023, ~9.6% 2024, 8.1% 2025, 13.8% H1 2026 — a mid-cycle of ~11–12% is the Base. Capex 3.4B vs D&A 1.5B reflects a project build-out (new mills) that should roll off, modeled as explicit excess capex. Tax ≈ 21–23% of pretax historically.

## Results

| Scenario | EV $B | PV(TV) share | Equity $B | $/share |
|---|---|---|---|---|
| Bear | 20 | 42% | 15 | **65.53** |
| Base | 30 | 47% | 26 | **112.76** |
| Bull | 44 | 49% | 39 | **172.57** |

Base projection ($B):

| Yr | Revenue | Op margin | EBIT | NOPAT | Reinvest | FCFF |
|---|---|---|---|---|---|---|
| 1 | 37.5 | 13.0% | 4.9 | 3.8 | 2.2 | 1.6 |
| 2 | 37.5 | 12.0% | 4.5 | 3.5 | 0.5 | 3.0 |
| 3 | 38.7 | 11.5% | 4.4 | 3.4 | 0.9 | 2.5 |
| 4 | 39.8 | 11.5% | 4.6 | 3.5 | 1.0 | 2.6 |
| 5 | 41.0 | 11.5% | 4.7 | 3.6 | 1.0 | 2.6 |
| 6 | 42.3 | 11.5% | 4.9 | 3.7 | 1.0 | 2.7 |
| 7 | 43.5 | 11.5% | 5.0 | 3.9 | 1.1 | 2.8 |
| 8 | 44.8 | 11.5% | 5.2 | 4.0 | 1.1 | 2.9 |
| 9 | 46.2 | 11.5% | 5.3 | 4.1 | 1.1 | 3.0 |
| 10 | 47.6 | 11.5% | 5.5 | 4.2 | 1.2 | 3.1 |

## Verdict

- price ÷ Base = 260.73 / 112.76 = **2.31**
- Uncertainty: **High** — deeply cyclical: EBIT margin ranged 8%–25% in five years and pricing depends on tariff policy.
- Thresholds (High): BUY ≤ 0.70, SELL ≥ 1.45 → **SELL**

## Biggest risks

1. Steel price/spread down-cycle — e.g., Section 232 tariff relief or import surge, plus new domestic EAF capacity — pushes margins back to 7–9%.
2. Heavy growth capex ($3.4B vs $1.5B D&A) earns below the 11% hurdle.

## Notes / limitations

Per the fixed method, noncontrolling interest (book $1,157M; ~11% of pretax) is NOT deducted; deducting it at book would lower Base by ~$5/sh. At 11%/3% a business earning ~12% on new capital is worth ~9–10× NOPAT, which is the main reason the model sits far below the market's ~17× P/E.
