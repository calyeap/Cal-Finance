# Methodology v3 calibration #2 — driver construction (TEST only, #496)

Frozen #495 sheets and 19 Oct captures, plus supplementary SEC facts pulled 20 Oct 2026 (tax, working capital, acquisitions, NUE/LLY operating income — `sec-2026-10-20/`). † = #495's dilution supplement (not engine output). ‡ = operating income constructed from tagged lines (the filer tags none). Recorded moat class; CURRENT = 10/10/+moat credit, OPT1 = runway by moat (wide 10/20/0, narrow 10/15/0, none 10/10/0).

## Reproduction of #495 (no variant)

| Company | CURRENT | OPT1 |
|---|---|---|
| MSFT | MATCH | MATCH |
| COST | MATCH | MATCH |
| NVDA† | MATCH | MATCH |
| NUE† | MATCH | MATCH |
| LLY† | MATCH | MATCH |

## 1. Filed data

| Company | TTM rev growth | Latest-qtr YoY | 3-yr CAGR | 5-yr CAGR | Op margin TTM / 5-yr median / filed range | Eff. tax 3-yr (latest FY) | ROIC latest / 5-yr avg | 3-yr incremental ROIC | Net reinvestment ÷ NOPAT, 3 yrs = capex − D&A + ΔNWC + acquisitions | Model reinvestment ÷ NOPAT yrs 1–5 (g ÷ RONIC) | Drafted reinvestment share ÷ NOPAT |
|---|---|---|---|---|---|---|---|---|---|---|---|
| MSFT | 17.8% | 17.7% (2026-06-30) | 16.1% | 14.6% (to FY2026) | 46.8% / 44.6% / 30.1%–46.8% | 18.5% (FY2024–2026) (19.4% FY2026) | 26.0% (FY2026) / 36.8% | 16.8% (FY2023→2026) | **76.7%** = 49.4% + 2.7% + 24.6% (FY2024–2026; acquisitions: goodwill + finite-lived intangibles acquired (no cash tag after FY2011)) | 66.7% | 38.9% (14.0% of revenue) |
| COST | 10.1% | 11.1% (2026-08-30) | 7.8% | 9.1% (to FY2026) | 3.9% / 3.6% / 3.1%–3.9% | 24.7% (FY2024–2026) (24.7% FY2026) | 41.8% (FY2026) / 39.6% | 48.7% (FY2023→2026) | **18.6%** = 37.6% + -19.0% + 0.0% (FY2024–2026; acquisitions: none tagged) | 22.9% | 38.9% (1.2% of revenue) |
| NVDA† | 83.4% | 105.9% (2026-07-26) | 100.0% | 66.9% (to FY2026) | 65.2% / 54.1% / 15.7%–62.4% | 14.1% (FY2024–2026) (15.1% FY2026) | 66.4% (FY2026) / 47.7% | 79.4% (FY2023→2026) | **25.2%** = 2.1% + 15.0% + 8.1% (FY2024–2026; acquisitions: cash paid for businesses, net of cash acquired) | 45.0% | 4.6% (2.0% of revenue) |
| NUE† | 17.2% | 23.0% (2026-07-04) | -7.8% | 10.0% (to FY2025) | 11.4% / 17.9% / 5.0%–25.4% ‡ | 21.1% (FY2023–2025) (20.6% FY2025) | 8.0% (FY2025) / 24.8% | -119.2% (FY2022→2025) | **65.2%** = 60.3% + -4.1% + 9.0% (FY2023–2025; acquisitions: cash paid for businesses, net of cash acquired) | 36.4% | 60.0% (4.5% of revenue) |
| LLY† | 49.6% | 47.7% (2026-06-30) | 31.7% | 21.6% (to FY2025) | 42.2% / 25.0% / 18.9%–40.4% ‡ | 18.9% (FY2023–2025) (19.8% FY2025) | 20.2% (FY2025) / 14.4% | 24.0% (FY2022→2025) | **93.4%** = 30.7% + 55.4% + 7.4% (FY2023–2025; acquisitions: cash paid for businesses, net of cash acquired) | 93.8% | 37.5% (8.0% of revenue) |

‡ NUE: pre-tax income + interest expense − interest income − equity-method earnings. LLY: pre-tax income − non-operating income (expense) — the construction reproduces MSFT's and NVDA's tagged operating income exactly in FY2023–26. LLY invested capital adds long-term debt back: its mapped total-debt series is us-gaap:DebtCurrent alone; LLY capex is us-gaap:PaymentsToAcquireOtherPropertyPlantAndEquipment (its mapped capex tags stop before FY2022). ΔNWC is the cash-flow statement's working-capital lines.

**What drives FCF in the engine:** the return on new capital. Reinvestment_t = NOPAT_t × g_(t+1) ÷ RONIC_t (`lib/analyzer/modules/scenarioOutputs.ts:76`). The drafted reinvestment share (`reinvestmentCapitalIntensity`) is never read by the valuation — only displayed (`assemble.ts:951`) and used for the profile's capital-intensity classification (`aiProposedBundle.ts:160`).

## 2–3. Variants (recorded moat class)

Grid = verdict zones at rate −0.5pp / rate / +0.5pp, each Low·Med·High (B/H/S). ΔBase vs the drafted sheet under the same design.

| Company | Variant | Base RONIC yrs 1–5 | Design | Bear / Base / Bull | Price÷Base | TV share | D3 grid | Close calls | ΔBase vs drafted |
|---|---|---|---|---|---|---|---|---|---|
| MSFT | Drafted | 18.0% | CURRENT | $189 / **$328** / $456 | 1.63× | 70% | SSS / SSS / SSS | 0 | — |
| MSFT | Drafted | 18.0% | OPT1 | $189 / **$316** / $448 | 1.69× | 37% | SSS / SSS / SSS | 0 | — |
| MSFT | M1 margin TTM→drafted | 18.0% | CURRENT | $191 / **$329** / $456 | 1.62× | 70% | SSS / SSS / SSS | 0 | +0.1% |
| MSFT | M1 margin TTM→drafted | 18.0% | OPT1 | $191 / **$317** / $447 | 1.69× | 37% | SSS / SSS / SSS | 0 | +0.1% |
| MSFT | G1 growth TTM→drafted | 18.0% | CURRENT | $215 / **$362** / $471 | 1.47× | 72% | SSH / SSS / SSS | 1 | +10.3% |
| MSFT | G1 growth TTM→drafted | 18.0% | OPT1 | $215 / **$348** / $462 | 1.53× | 38% | SSH / SSS / SSS | 1 | +10.2% |
| MSFT | T1 effective tax (3-yr) | 18.0% | CURRENT | $195 / **$338** / $470 | 1.58× | 70% | SSH / SSS / SSS | 1 | +3.1% |
| MSFT | T1 effective tax (3-yr) | 18.0% | OPT1 | $195 / **$326** / $462 | 1.64× | 37% | SSS / SSS / SSS | 0 | +3.1% |
| MSFT | R1 RONIC = latest ROIC | 26.0% | CURRENT | $189 / **$354** / $456 | 1.51× | 65% | SSH / SSS / SSS | 1 | +7.7% |
| MSFT | R1 RONIC = latest ROIC | 26.0% | OPT1 | $189 / **$349** / $448 | 1.53× | 33% | SSH / SSS / SSS | 1 | +10.4% |
| MSFT | R2 RONIC = 3-yr incremental | 16.8% | CURRENT | $189 / **$323** / $456 | 1.65× | 72% | SSS / SSS / SSS | 0 | -1.7% |
| MSFT | R2 RONIC = 3-yr incremental | 16.8% | OPT1 | $189 / **$309** / $448 | 1.73× | 38% | SSS / SSS / SSS | 0 | -2.3% |
| MSFT | R3 RONIC = implied by actual reinvestment | 15.6% | CURRENT | $189 / **$316** / $456 | 1.69× | 73% | SSS / SSS / SSS | 0 | -3.7% |
| MSFT | R3 RONIC = implied by actual reinvestment | 15.6% | OPT1 | $189 / **$301** / $448 | 1.77× | 39% | SSS / SSS / SSS | 0 | -4.9% |
| MSFT | M1+G1+T1 | 18.0% | CURRENT | $221 / **$374** / $485 | 1.43× | 72% | SSH / SSH / SSS | 1 | +13.8% |
| MSFT | M1+G1+T1 | 18.0% | OPT1 | $221 / **$360** / $476 | 1.48× | 38% | SSH / SSS / SSS | 1 | +13.7% |
| COST | Drafted | 35.0% | CURRENT | $269 / **$419** / $559 | 2.37× | 58% | SSS / SSS / SSS | 0 | — |
| COST | Drafted | 35.0% | OPT1 | $269 / **$419** / $565 | 2.38× | 29% | SSS / SSS / SSS | 0 | — |
| COST | M1 margin TTM→drafted | 35.0% | CURRENT | $274 / **$419** / $554 | 2.38× | 58% | SSS / SSS / SSS | 0 | -0.1% |
| COST | M1 margin TTM→drafted | 35.0% | OPT1 | $274 / **$418** / $560 | 2.38× | 30% | SSS / SSS / SSS | 0 | -0.1% |
| COST | G1 growth TTM→drafted | 35.0% | CURRENT | $289 / **$436** / $550 | 2.28× | 59% | SSS / SSS / SSS | 0 | +4.0% |
| COST | G1 growth TTM→drafted | 35.0% | OPT1 | $289 / **$436** / $556 | 2.29× | 30% | SSS / SSS / SSS | 0 | +4.0% |
| COST | T1 effective tax (3-yr) | 35.0% | CURRENT | $258 / **$401** / $534 | 2.48× | 58% | SSS / SSS / SSS | 0 | -4.4% |
| COST | T1 effective tax (3-yr) | 35.0% | OPT1 | $258 / **$401** / $540 | 2.49× | 29% | SSS / SSS / SSS | 0 | -4.4% |
| COST | R1 RONIC = latest ROIC | 41.8% | CURRENT | $269 / **$425** / $559 | 2.34× | 58% | SSS / SSS / SSS | 0 | +1.4% |
| COST | R1 RONIC = latest ROIC | 41.8% | OPT1 | $269 / **$427** / $565 | 2.33× | 29% | SSS / SSS / SSS | 0 | +2.0% |
| COST | R2 RONIC = 3-yr incremental | 48.7% | CURRENT | $269 / **$429** / $559 | 2.32× | 57% | SSS / SSS / SSS | 0 | +2.4% |
| COST | R2 RONIC = 3-yr incremental | 48.7% | OPT1 | $269 / **$433** / $565 | 2.30× | 28% | SSS / SSS / SSS | 0 | +3.4% |
| COST | R3 RONIC = implied by actual reinvestment | 43.0% | CURRENT | $269 / **$426** / $559 | 2.34× | 57% | SSS / SSS / SSS | 0 | +1.6% |
| COST | R3 RONIC = implied by actual reinvestment | 43.0% | OPT1 | $269 / **$428** / $565 | 2.32× | 29% | SSS / SSS / SSS | 0 | +2.2% |
| COST | M1+G1+T1 | 35.0% | CURRENT | $280 / **$416** / $521 | 2.39× | 59% | SSS / SSS / SSS | 0 | -0.7% |
| COST | M1+G1+T1 | 35.0% | OPT1 | $280 / **$416** / $526 | 2.39× | 30% | SSS / SSS / SSS | 0 | -0.7% |
| NVDA† | Drafted | 40.0% | CURRENT | $31 / **$118** / $264 | 1.83× | 60% | SSS / SSS / SSS | 0 | — |
| NVDA† | Drafted | 40.0% | OPT1 | $31 / **$121** / $274 | 1.79× | 26% | SSS / SSS / SSS | 0 | — |
| NVDA† | M1 margin TTM→drafted | 40.0% | CURRENT | $37 / **$120** / $264 | 1.81× | 59% | SSS / SSS / SSS | 0 | +1.4% |
| NVDA† | M1 margin TTM→drafted | 40.0% | OPT1 | $37 / **$123** / $275 | 1.77× | 25% | SSS / SSS / SSS | 0 | +1.4% |
| NVDA† | G1 growth TTM→drafted | 40.0% | CURRENT | $79 / **$343** / $624 | 0.63× | 67% | BBB / BBB / BBB | 0 | +189.5% |
| NVDA† | G1 growth TTM→drafted | 40.0% | OPT1 | $79 / **$352** / $650 | 0.62× | 29% | BBB / BBB / BBB | 0 | +190.2% |
| NVDA† | T1 effective tax (3-yr) | 40.0% | CURRENT | $34 / **$129** / $287 | 1.68× | 60% | SSS / SSS / SSS | 0 | +8.9% |
| NVDA† | T1 effective tax (3-yr) | 40.0% | OPT1 | $34 / **$132** / $299 | 1.64× | 26% | SSS / SSS / SSS | 0 | +8.9% |
| NVDA† | R1 RONIC = latest ROIC | 66.4% | CURRENT | $31 / **$127** / $264 | 1.71× | 56% | SSS / SSS / SSS | 0 | +7.4% |
| NVDA† | R1 RONIC = latest ROIC | 66.4% | OPT1 | $31 / **$132** / $274 | 1.65× | 23% | SSS / SSS / SSS | 0 | +8.8% |
| NVDA† | R2 RONIC = 3-yr incremental | 79.4% | CURRENT | $31 / **$129** / $264 | 1.68× | 55% | SSS / SSS / SSS | 0 | +9.3% |
| NVDA† | R2 RONIC = 3-yr incremental | 79.4% | OPT1 | $31 / **$135** / $274 | 1.61× | 23% | SSS / SSS / SSS | 0 | +11.1% |
| NVDA† | R3 RONIC = implied by actual reinvestment | 71.3% | CURRENT | $31 / **$128** / $264 | 1.69× | 55% | SSS / SSS / SSS | 0 | +8.2% |
| NVDA† | R3 RONIC = implied by actual reinvestment | 71.3% | OPT1 | $31 / **$133** / $274 | 1.63× | 23% | SSS / SSS / SSS | 0 | +9.8% |
| NVDA† | M1+G1+T1 | 40.0% | CURRENT | $53 / **$372** / $679 | 0.58× | 67% | BBB / BBB / BBB | 0 | +214.2% |
| NVDA† | M1+G1+T1 | 40.0% | OPT1 | $53 / **$382** / $707 | 0.57× | 29% | BBB / BBB / BBB | 0 | +214.9% |
| NUE† | Drafted | 11.0% | CURRENT | $49 / **$98** / $182 | 2.66× | 50% | SSS / SSS / SSS | 0 | — |
| NUE† | Drafted | 11.0% | OPT1 | $49 / **$98** / $182 | 2.66× | 50% | SSS / SSS / SSS | 0 | — |
| NUE† | M1 margin TTM→drafted | 11.0% | CURRENT | $66 / **$102** / $179 | 2.56× | 49% | SSS / SSS / SSS | 0 | +3.8% |
| NUE† | M1 margin TTM→drafted | 11.0% | OPT1 | $66 / **$102** / $179 | 2.56× | 49% | SSS / SSS / SSS | 0 | +3.8% |
| NUE† | G1 growth TTM→drafted | 11.0% | CURRENT | $55 / **$114** / $206 | 2.29× | 60% | SSS / SSS / SSS | 0 | +15.9% |
| NUE† | G1 growth TTM→drafted | 11.0% | OPT1 | $55 / **$114** / $206 | 2.29× | 60% | SSS / SSS / SSS | 0 | +15.9% |
| NUE† | T1 effective tax (3-yr) | 11.0% | CURRENT | $49 / **$98** / $182 | 2.66× | 50% | SSS / SSS / SSS | 0 | -0.1% |
| NUE† | T1 effective tax (3-yr) | 11.0% | OPT1 | $49 / **$98** / $182 | 2.66× | 50% | SSS / SSS / SSS | 0 | -0.1% |
| NUE† | R1 RONIC = latest ROIC | 8.0% | CURRENT | $49 / **$89** / $182 | 2.92× | 54% | SSS / SSS / SSS | 0 | -9.1% |
| NUE† | R1 RONIC = latest ROIC | 8.0% | OPT1 | $49 / **$89** / $182 | 2.92× | 54% | SSS / SSS / SSS | 0 | -9.1% |
| NUE† | R2 RONIC = 3-yr incremental | — | — | NOT COMPUTED: not positive (-119.2%) | | | | | |
| NUE† | R3 RONIC = implied by actual reinvestment | 6.1% | CURRENT | $49 / **$80** / $182 | 3.27× | 59% | SSS / SSS / SSS | 0 | -18.8% |
| NUE† | R3 RONIC = implied by actual reinvestment | 6.1% | OPT1 | $49 / **$80** / $182 | 3.27× | 59% | SSS / SSS / SSS | 0 | -18.8% |
| NUE† | M1+G1+T1 | 11.0% | CURRENT | $56 / **$114** / $205 | 2.29× | 60% | SSS / SSS / SSS | 0 | +16.0% |
| NUE† | M1+G1+T1 | 11.0% | OPT1 | $56 / **$114** / $205 | 2.29× | 60% | SSS / SSS / SSS | 0 | +16.0% |
| LLY† | Drafted | 16.0% | CURRENT | $133 / **$315** / $629 | 3.94× | 78% | SSS / SSS / SSS | 0 | — |
| LLY† | Drafted | 16.0% | OPT1 | $133 / **$311** / $632 | 3.98× | 57% | SSS / SSS / SSS | 0 | — |
| LLY† | M1 margin TTM→drafted | 16.0% | CURRENT | $152 / **$317** / $629 | 3.91× | 78% | SSS / SSS / SSS | 0 | +0.6% |
| LLY† | M1 margin TTM→drafted | 16.0% | OPT1 | $152 / **$313** / $632 | 3.96× | 56% | SSS / SSS / SSS | 0 | +0.6% |
| LLY† | G1 growth TTM→drafted | 16.0% | CURRENT | $234 / **$565** / $1022 | 2.20× | 91% | SSS / SSS / SSS | 0 | +79.3% |
| LLY† | G1 growth TTM→drafted | 16.0% | OPT1 | $234 / **$557** / $1028 | 2.22× | 66% | SSS / SSS / SSS | 0 | +79.1% |
| LLY† | T1 effective tax (3-yr) | 16.0% | CURRENT | $138 / **$325** / $647 | 3.82× | 78% | SSS / SSS / SSS | 0 | +3.1% |
| LLY† | T1 effective tax (3-yr) | 16.0% | OPT1 | $138 / **$321** / $650 | 3.87× | 57% | SSS / SSS / SSS | 0 | +3.1% |
| LLY† | R1 RONIC = latest ROIC | 20.2% | CURRENT | $133 / **$344** / $629 | 3.61× | 72% | SSS / SSS / SSS | 0 | +9.2% |
| LLY† | R1 RONIC = latest ROIC | 20.2% | OPT1 | $133 / **$344** / $632 | 3.60× | 52% | SSS / SSS / SSS | 0 | +10.6% |
| LLY† | R2 RONIC = 3-yr incremental | 24.0% | CURRENT | $133 / **$361** / $629 | 3.43× | 69% | SSS / SSS / SSS | 0 | +14.7% |
| LLY† | R2 RONIC = 3-yr incremental | 24.0% | OPT1 | $133 / **$364** / $632 | 3.41× | 49% | SSS / SSS / SSS | 0 | +17.0% |
| LLY† | R3 RONIC = implied by actual reinvestment | 16.1% | CURRENT | $133 / **$316** / $629 | 3.93× | 78% | SSS / SSS / SSS | 0 | +0.2% |
| LLY† | R3 RONIC = implied by actual reinvestment | 16.1% | OPT1 | $133 / **$312** / $632 | 3.98× | 57% | SSS / SSS / SSS | 0 | +0.2% |
| LLY† | M1+G1+T1 | 16.0% | CURRENT | $151 / **$537** / $1032 | 2.31× | 98% | SSS / SSS / SSS | 0 | +70.5% |
| LLY† | M1+G1+T1 | 16.0% | OPT1 | $151 / **$530** / $1038 | 2.34× | 71% | SSS / SSS / SSS | 0 | +70.2% |

## 4. Implied single driver (Base = price; other drivers as drafted; recorded moat class)

Bands are the drafting rules (`scenarioProposal.ts` rule 4): growth within the filed single-year range ± 10pp; margin within the filed range −10pp / +5pp; return on new capital up to 1.5× the best filed ROIC. Where a filed range is missing, the drafter's hard bounds (`BANDS`) apply and the band is named.

| Company | Price | Design | Growth yrs 1–5 | Flat margin | Return on new capital yrs 1–5 |
|---|---|---|---|---|---|
| MSFT | $533.52 | CURRENT | 24.1% | no solution within the drafting band [20.1%, 51.8%] — Base at most $373 | no solution within the drafting band [0.1%, 141.1%] — Base at most $405 |
| MSFT | $533.52 | OPT1 | 25.2% | no solution within the drafting band [20.1%, 51.8%] — Base at most $360 | no solution within the drafting band [0.1%, 141.1%] — Base at most $419 |
| COST | $995.53 | CURRENT | 27.4% | no solution within the drafting band [-6.9%, 8.9%] — Base at most $912 | no solution within the drafting band [0.1%, 62.7%] — Base at most $435 |
| COST | $995.53 | OPT1 | 27.3% | no solution within the drafting band [-6.9%, 8.9%] — Base at most $912 | no solution within the drafting band [0.1%, 62.7%] — Base at most $442 |
| NVDA† | $217.09 | CURRENT | 31.4% | no solution within the drafting band [5.7%, 67.4%] — Base at most $146 | no solution within the drafting band [0.1%, 121.9%] — Base at most $134 |
| NVDA† | $217.09 | OPT1 | 30.6% | no solution within the drafting band [5.7%, 67.4%] — Base at most $149 | no solution within the drafting band [0.1%, 121.9%] — Base at most $140 |
| NUE† | $260.73 | CURRENT | no solution within the drafting band [-26.4%, 91.2%] — Base at most $201 | 22.1% | no solution within the drafting band [0.1%, 63.5%] — Base at most $121 |
| NUE† | $260.73 | OPT1 | no solution within the drafting band [-26.4%, 91.2%] — Base at most $201 | 22.1% | no solution within the drafting band [0.1%, 63.5%] — Base at most $121 |
| LLY† | $1240.34 | CURRENT | 47.9% | no solution within the drafting band [8.9%, 45.4%] — Base at most $562 | no solution within the drafting band [0.1%, 30.4%] — Base at most $382 |
| LLY† | $1240.34 | OPT1 | 47.9% | no solution within the drafting band [8.9%, 45.4%] — Base at most $556 | no solution within the drafting band [0.1%, 30.4%] — Base at most $388 |

## 5. Dilution fallback check — convertibles in the 19 Oct captures

Both convertible tags (`ConvertibleDebt`, `ConvertibleNotesPayable`) are in the tag mapping (`tagMap.ts` "convertible-debt"), so the capture keeps every row of either over its twelve calendar years.

| Company | Convertible rows in the capture | Latest | Diluted − basic weighted-average shares (latest 10-K) |
|---|---|---|---|
| NVDA | 17 rows; last non-zero $15m at 2018-01-28 | ConvertibleDebt $0m at 2019-01-27 (10-K 0001045810-19-000023) | 155.0m (0.64% of basic, FY ending 2026-01-25) |
| NUE | none, in any period | — | 0.3m (0.13% of basic, FY ending 2025-12-31) |
| LLY | none, in any period | — | 2.0m (0.22% of basic, FY ending 2025-12-31) |

