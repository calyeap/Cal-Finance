# NVDA — AI-only FCFF DCF baseline

- Price: **$217.09** (Yahoo close 2026-10-19)
- Discount rate: **11%** (semiconductors = cyclical); terminal growth 3.0%; mid-year discounting; 10-yr explicit; TV discounted at end of year 10 (Gordon on year-11 FCFF, reinvestment = g/RONIC).
- Valuation date ≈ 2026-10-20. Year 0 = TTM (FY26 + H1 FY27 − H1 FY26: revenue $302.9B, op income $197.6B (65.2%)).

## Six key filed facts (latest FY, $M; shares M)

| Item | Value | FY end | XBRL tag |
|---|---|---|---|
| Revenue | 215,938 | 2026-01-25 (FY2026) | `Revenues` |
| Operating income | 130,387 | 2026-01-25 | `OperatingIncomeLoss` |
| Net income | 120,067 | 2026-01-25 | `NetIncomeLoss` |
| Capex | 6,042 | 2026-01-25 | `PaymentsToAcquireProductiveAssets` |
| D&A | 2,843 | 2026-01-25 | `DepreciationDepletionAndAmortization` |
| Diluted shares | 24,514 | 2026-01-25 | `WeightedAverageNumberOfDilutedSharesOutstanding` |

Balance sheet (10-Q 2026-07-26): LongTermDebt 33,366 + OperatingLeaseLiability 5,494 = debt 38,860; CashAndCashEquivalentsAtCarryingValue 22,443 + DebtSecuritiesCurrent (marketable) 34,143 = 56,586. Equity stakes (EquitySecuritiesFvNi 42,783; non-marketable 47,898) excluded from net debt (~$3.7/share if added).
Net debt = **$-17,726M**; diluted shares used = **24,285 M** (Q2 FY27 diluted weighted avg).

## Drivers

| | Bear | Base | Bull |
|---|---|---|---|
| growth | +15% NTM, −10%, −5% (AI capex digestion), then 3–5% | +45% NTM (Q2 FY27 run-rate $385B), +15%, +8%, +5%, fade to 3% | +60%, +28%, +18%, +12%, +8%, fade to 3% |
| margin | 60% → 50% → 40% floor | 64% → 50% linear | 66% → 58% |
| tax | 17% → 21% | 16% → 18% | 16% → 17% |
| reinv | sales-to-capital 3.0; terminal RONIC 15% | sales-to-capital 4.0; terminal RONIC 20% | sales-to-capital 5.0; terminal RONIC 30% |

**Why:** Revenue went 27.0B (FY23) → 60.9B → 130.5B → 215.9B; H1 FY27 was $177.8B (Q2 $96.2B, +18% q/q), so NTM ≈ 1.45× TTM is roughly flat-to-modest sequential growth. Op margin was 54%/62%/60% FY24–26 and 66% in H1 FY27; a decade-long fade toward ~50% assumes competition (custom ASICs, AMD) and customer bargaining power. Effective tax 15.1% FY26, 16.5% H1 FY27. Reinvestment: FY26 FCFF after SBC ≈ $90B vs NOPAT ≈ $111B ⇒ ~$20B reinvestment on +$85B revenue ⇒ sales-to-capital ≈ 4.2.

## Results

| Scenario | EV $B | PV(TV) share | Equity $B | $/share |
|---|---|---|---|---|
| Bear | 1,202 | 37% | 1,220 | **50.23** |
| Base | 2,777 | 41% | 2,795 | **115.09** |
| Bull | 4,734 | 47% | 4,752 | **195.67** |

Base projection ($B):

| Yr | Revenue | Op margin | EBIT | NOPAT | Reinvest | FCFF |
|---|---|---|---|---|---|---|
| 1 | 439.3 | 64.0% | 281.1 | 236.2 | 34.1 | 202.1 |
| 2 | 505.2 | 62.4% | 315.4 | 264.3 | 16.5 | 247.8 |
| 3 | 545.6 | 60.9% | 332.2 | 277.6 | 10.1 | 267.5 |
| 4 | 572.9 | 59.3% | 339.9 | 283.2 | 6.8 | 276.4 |
| 5 | 599.6 | 57.8% | 346.4 | 287.9 | 6.7 | 281.2 |
| 6 | 625.6 | 56.2% | 351.7 | 291.5 | 6.5 | 285.0 |
| 7 | 650.6 | 54.7% | 355.7 | 294.0 | 6.3 | 287.8 |
| 8 | 674.5 | 53.1% | 358.2 | 295.3 | 6.0 | 289.4 |
| 9 | 696.9 | 51.6% | 359.3 | 295.4 | 5.6 | 289.8 |
| 10 | 717.8 | 50.0% | 358.9 | 294.3 | 5.2 | 289.1 |

## Verdict

- price ÷ Base = 217.09 / 115.09 = **1.89**
- Uncertainty: **High** — revenue tripled in two years on a single capex cycle; Bear→Bull spans ~4×.
- Thresholds (High): BUY ≤ 0.70, SELL ≥ 1.45 → **SELL**

## Biggest risks

1. AI data-center capex digestion: hyperscaler spending pause turns +45% into a revenue decline (Bear = $50/sh).
2. Margin/share erosion from custom silicon, AMD and China export controls; 60%+ operating margin is historically unprecedented for hardware.

## Notes / limitations

Base needs ~$290B of FCFF in year 10 and still gives $115/sh; market price implies roughly the Bull path (ratio to Bull 1.11). The fixed 11% rate is a major driver: at ~9% the Base would be materially higher. SBC treated as a real expense (inside operating income).
