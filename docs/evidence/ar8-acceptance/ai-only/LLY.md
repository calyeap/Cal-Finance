# LLY (Eli Lilly) — AI-only DCF baseline

Prepared 2026-10-20. Sources: SEC XBRL companyfacts (CIK 0000059478) and the Yahoo chart endpoint. No other repo or source was used.
**Price:** $1,240.34, the close on 2026-10-19.

## Key filed facts (FY ended 2025-12-31, 10-K filed 2026-02-12)
| Item | Value | XBRL tag |
|---|---|---|
| Revenue | $65,179M | us-gaap:Revenues |
| Operating income (derived*) | $26,302M | IncomeLossFromContinuingOperationsBeforeIncomeTaxes... (25,731) − NonoperatingIncomeExpense (−571) |
| Net income | $20,640M | us-gaap:NetIncomeLoss |
| Capex | $7,841M | us-gaap:PaymentsToAcquireOtherPropertyPlantAndEquipment |
| D&A | $1,997M | us-gaap:DepreciationDepletionAndAmortization |
| Diluted shares (wtd) | 899.3M | us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding |

*LLY does not tag `OperatingIncomeLoss`. EBIT is pre-tax income less other income/expense. It is after acquired IPR&D charges ($2,910M in FY25), which I treat as a recurring cost of doing business.

**TTM to 2026-06-30** (FY25 − H1'25 + H1'26): revenue $79.7B; EBIT $33.6B (42%); capex $9.9B (12.4%); D&A ~$2.1B. H1'26 revenue was up 51% y/y, and Q2'26 alone was $23.0B.

**Net debt at 2026-06-30:** DebtCurrent $7,050M + LongTermDebtNoncurrent $47,858M + operating leases $1,362M (FY25, the latest tagged) − cash $8,950M = **$47,320M**. LongTermInvestments ($3.9B, mostly strategic equity stakes) is excluded. Including it would add about $4 per share.
**Shares:** 893.7M, the diluted weighted average for Q2 2026.

## Method
FCFF = EBIT×(1−19%) + D&A − capex − ΔNWC. The method uses mid-year discounting, a 10-year explicit period starting from TTM, **r = 9.0%** and **g = 3.0%**. The terminal value is discounted at t = 9.5, which matches the mid-year convention.

Common assumptions across all three cases:
- Tax is 19%, close to the FY25 effective rate of 19.8%.
- ΔNWC is 8% of incremental revenue. FY25 receivables, inventory and payables net to about 7% of the revenue increase.
- D&A rises from 2.7% to 4.0% of revenue as new plants come online.
- Capex falls from 11% to 5% of revenue as the manufacturing build-out ends. In the terminal year, capex is 1.15× D&A.

## Scenarios (revenue growth Y1..Y10 / EBIT margin)
- **Bear: $339/sh.** Growth runs 15, 7, 4, 2, 1, 0, −1, 0, 1, 2%. Margin falls from 40% to 30%. This case assumes GLP-1 price erosion from Medicare/MFN deals and competition from Novo, orals and compounders. It also assumes tirzepatide exclusivity erodes toward the mid-2030s.
- **Base: $687/sh.** Growth runs 24, 16, 11, 8, 6, 5, 4, 3.5, 3, 3%. Margin holds at 43–44% and fades to 38% by Y10. This case extrapolates the current incretin ramp, which annualises to about $92B, plus an orforglipron launch. It then fades for pricing and loss of exclusivity.
- **Bull: $990/sh.** Growth runs 30, 22, 15, 11, 9, 7, 6, 5, 4, 3%. Margin peaks at 48%. This case assumes obesity volume expands across new indications and the pipeline offsets the cliff.

Base EV is $661B, of which the terminal value is 60%.

## Verdict
- price ÷ Base = 1,240.34 / 686.9 = **1.81**.
- **Uncertainty: High.** About 60% of value sits in the terminal, revenue is concentrated in one drug class, and Bear-to-Bull spans roughly ±50%.
- The SELL threshold at High uncertainty is ≥ 1.45, so the verdict is **SELL**. At this price, even the Bull case is below market.
- Humility note: the market is pricing in more growth or a longer exclusivity than my Bull case, or a discount rate below 9%. A fixed 9% rate on a stock with a $1.1T market cap is the single biggest reason for the gap.

**Biggest risks to this view:**
1. GLP-1 demand and duration outrun even the Bull case, through outcomes data and new indications. In that case the call is wrong.
2. US pricing policy (MFN, Medicare negotiation) and competition compress margins. In that case the call is right, and possibly more so.
