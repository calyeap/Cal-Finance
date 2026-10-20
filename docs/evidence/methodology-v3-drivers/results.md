# Methodology v3 calibration #2 — driver construction (TEST only, #496)

Frozen #495 sheets and 19 Oct captures; † = #495's dilution supplement (not engine output). Recorded moat class; CURRENT = 10/10/+moat credit, OPT1 = runway by moat (wide 10/20/0, narrow 10/15/0, none 10/10/0).

## Reproduction of #495 (no variant)

| Company | CURRENT | OPT1 |
|---|---|---|
| MSFT | MATCH | MATCH |
| COST | MATCH | MATCH |
| NVDA† | MATCH | MATCH |
| NUE† | MATCH | MATCH |
| LLY† | MATCH | MATCH |

## 1. Filed data

| Company | TTM rev growth | Latest-qtr YoY | 3-yr CAGR | 5-yr CAGR | Op margin TTM / 5-yr median / filed range | Eff. tax (latest FY) | ROIC latest / 5-yr avg | 3-yr incremental ROIC | Net reinvestment ÷ NOPAT, 3 yrs (capex − D&A only) | Model reinvestment ÷ NOPAT yrs 1–5 (g ÷ RONIC) | Drafted reinvestment share ÷ NOPAT |
|---|---|---|---|---|---|---|---|---|---|---|---|
| MSFT | 17.8% | 17.7% (2026-06-30) | 16.1% | 14.6% (to FY2026) | 46.8% / 44.6% / 30.1%–46.8% | 19.4% (FY2026; 3-yr not in frozen data) | 26.0% (FY2026) / 36.8% | 16.8% (FY2023→2026) | 49.4% (FY2024–2026) | 66.7% | 38.9% (14.0% of revenue) |
| COST | 10.1% | 11.1% (2026-08-30) | 7.8% | 9.1% (to FY2026) | 3.9% / 3.6% / 3.1%–3.9% | 24.7% (FY2026; 3-yr not in frozen data) | 41.8% (FY2026) / 39.6% | 48.7% (FY2023→2026) | 37.6% (FY2024–2026) | 22.9% | 38.9% (1.2% of revenue) |
| NVDA† | 83.4% | 105.9% (2026-07-26) | 100.0% | 66.9% (to FY2026) | 65.2% / 54.1% / 15.7%–62.4% | 15.1% (FY2026; 3-yr not in frozen data) | 66.4% (FY2026) / 47.7% | 79.4% (FY2023→2026) | 2.1% (FY2024–2026) | 45.0% | 4.6% (2.0% of revenue) |
| NUE† | 17.2% | 23.0% (2026-07-04) | -7.8% | 10.0% (to FY2025) | n/a / n/a / n/a (operating income not tagged) | 20.6% (FY2025; 3-yr not in frozen data) | n/a / n/a | n/a | n/a | 36.4% | 60.0% (4.5% of revenue) |
| LLY† | 49.6% | 47.7% (2026-06-30) | 31.7% | 21.6% (to FY2025) | n/a / n/a / n/a (operating income not tagged) | 19.8% (FY2025; 3-yr not in frozen data) | n/a / n/a | n/a | n/a | 93.8% | 37.5% (8.0% of revenue) |

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
| MSFT | T1 effective tax (latest FY) | 18.0% | CURRENT | $193 / **$335** / $465 | 1.59× | 70% | SSS / SSS / SSS | 0 | +2.0% |
| MSFT | T1 effective tax (latest FY) | 18.0% | OPT1 | $193 / **$323** / $457 | 1.65× | 37% | SSS / SSS / SSS | 0 | +2.0% |
| MSFT | R1 RONIC = latest ROIC | 26.0% | CURRENT | $189 / **$354** / $456 | 1.51× | 65% | SSH / SSS / SSS | 1 | +7.7% |
| MSFT | R1 RONIC = latest ROIC | 26.0% | OPT1 | $189 / **$349** / $448 | 1.53× | 33% | SSH / SSS / SSS | 1 | +10.4% |
| MSFT | R2 RONIC = 3-yr incremental | 16.8% | CURRENT | $189 / **$323** / $456 | 1.65× | 72% | SSS / SSS / SSS | 0 | -1.7% |
| MSFT | R2 RONIC = 3-yr incremental | 16.8% | OPT1 | $189 / **$309** / $448 | 1.73× | 38% | SSS / SSS / SSS | 0 | -2.3% |
| MSFT | R3 RONIC = implied by actual reinvestment | 24.3% | CURRENT | $189 / **$349** / $456 | 1.53× | 66% | SSH / SSS / SSS | 1 | +6.5% |
| MSFT | R3 RONIC = implied by actual reinvestment | 24.3% | OPT1 | $189 / **$344** / $448 | 1.55× | 34% | SSH / SSS / SSS | 1 | +8.7% |
| MSFT | M1+G1+T1 | 18.0% | CURRENT | $218 / **$370** / $480 | 1.44× | 72% | SSH / SSH / SSS | 1 | +12.6% |
| MSFT | M1+G1+T1 | 18.0% | OPT1 | $218 / **$356** / $471 | 1.50× | 38% | SSH / SSS / SSS | 1 | +12.5% |
| COST | Drafted | 35.0% | CURRENT | $269 / **$419** / $559 | 2.37× | 58% | SSS / SSS / SSS | 0 | — |
| COST | Drafted | 35.0% | OPT1 | $269 / **$419** / $565 | 2.38× | 29% | SSS / SSS / SSS | 0 | — |
| COST | M1 margin TTM→drafted | 35.0% | CURRENT | $274 / **$419** / $554 | 2.38× | 58% | SSS / SSS / SSS | 0 | -0.1% |
| COST | M1 margin TTM→drafted | 35.0% | OPT1 | $274 / **$418** / $560 | 2.38× | 30% | SSS / SSS / SSS | 0 | -0.1% |
| COST | G1 growth TTM→drafted | 35.0% | CURRENT | $289 / **$436** / $550 | 2.28× | 59% | SSS / SSS / SSS | 0 | +4.0% |
| COST | G1 growth TTM→drafted | 35.0% | OPT1 | $289 / **$436** / $556 | 2.29× | 30% | SSS / SSS / SSS | 0 | +4.0% |
| COST | T1 effective tax (latest FY) | 35.0% | CURRENT | $258 / **$401** / $535 | 2.48× | 58% | SSS / SSS / SSS | 0 | -4.3% |
| COST | T1 effective tax (latest FY) | 35.0% | OPT1 | $258 / **$401** / $540 | 2.48× | 29% | SSS / SSS / SSS | 0 | -4.3% |
| COST | R1 RONIC = latest ROIC | 41.8% | CURRENT | $269 / **$425** / $559 | 2.34× | 58% | SSS / SSS / SSS | 0 | +1.4% |
| COST | R1 RONIC = latest ROIC | 41.8% | OPT1 | $269 / **$427** / $565 | 2.33× | 29% | SSS / SSS / SSS | 0 | +2.0% |
| COST | R2 RONIC = 3-yr incremental | 48.7% | CURRENT | $269 / **$429** / $559 | 2.32× | 57% | SSS / SSS / SSS | 0 | +2.4% |
| COST | R2 RONIC = 3-yr incremental | 48.7% | OPT1 | $269 / **$433** / $565 | 2.30× | 28% | SSS / SSS / SSS | 0 | +3.4% |
| COST | R3 RONIC = implied by actual reinvestment | 21.3% | CURRENT | $269 / **$398** / $559 | 2.50× | 62% | SSS / SSS / SSS | 0 | -5.2% |
| COST | R3 RONIC = implied by actual reinvestment | 21.3% | OPT1 | $269 / **$389** / $565 | 2.56× | 32% | SSS / SSS / SSS | 0 | -7.2% |
| COST | M1+G1+T1 | 35.0% | CURRENT | $280 / **$416** / $521 | 2.39× | 59% | SSS / SSS / SSS | 0 | -0.6% |
| COST | M1+G1+T1 | 35.0% | OPT1 | $280 / **$416** / $526 | 2.39× | 30% | SSS / SSS / SSS | 0 | -0.7% |
| NVDA† | Drafted | 40.0% | CURRENT | $31 / **$118** / $264 | 1.83× | 60% | SSS / SSS / SSS | 0 | — |
| NVDA† | Drafted | 40.0% | OPT1 | $31 / **$121** / $274 | 1.79× | 26% | SSS / SSS / SSS | 0 | — |
| NVDA† | M1 margin TTM→drafted | 40.0% | CURRENT | $37 / **$120** / $264 | 1.81× | 59% | SSS / SSS / SSS | 0 | +1.4% |
| NVDA† | M1 margin TTM→drafted | 40.0% | OPT1 | $37 / **$123** / $275 | 1.77× | 25% | SSS / SSS / SSS | 0 | +1.4% |
| NVDA† | G1 growth TTM→drafted | 40.0% | CURRENT | $79 / **$343** / $624 | 0.63× | 67% | BBB / BBB / BBB | 0 | +189.5% |
| NVDA† | G1 growth TTM→drafted | 40.0% | OPT1 | $79 / **$352** / $650 | 0.62× | 29% | BBB / BBB / BBB | 0 | +190.2% |
| NVDA† | T1 effective tax (latest FY) | 40.0% | CURRENT | $34 / **$127** / $284 | 1.70× | 60% | SSS / SSS / SSS | 0 | +7.6% |
| NVDA† | T1 effective tax (latest FY) | 40.0% | OPT1 | $34 / **$130** / $295 | 1.66× | 26% | SSS / SSS / SSS | 0 | +7.6% |
| NVDA† | R1 RONIC = latest ROIC | 66.4% | CURRENT | $31 / **$127** / $264 | 1.71× | 56% | SSS / SSS / SSS | 0 | +7.4% |
| NVDA† | R1 RONIC = latest ROIC | 66.4% | OPT1 | $31 / **$132** / $274 | 1.65× | 23% | SSS / SSS / SSS | 0 | +8.8% |
| NVDA† | R2 RONIC = 3-yr incremental | 79.4% | CURRENT | $31 / **$129** / $264 | 1.68× | 55% | SSS / SSS / SSS | 0 | +9.3% |
| NVDA† | R2 RONIC = 3-yr incremental | 79.4% | OPT1 | $31 / **$135** / $274 | 1.61× | 23% | SSS / SSS / SSS | 0 | +11.1% |
| NVDA† | R3 RONIC = implied by actual reinvestment | 842.5% | CURRENT | $31 / **$141** / $264 | 1.54× | 50% | SSS / SSS / SSS | 0 | +18.8% |
| NVDA† | R3 RONIC = implied by actual reinvestment | 842.5% | OPT1 | $31 / **$149** / $274 | 1.46× | 21% | SSH / SSS / SSS | 1 | +22.7% |
| NVDA† | M1+G1+T1 | 40.0% | CURRENT | $53 / **$368** / $671 | 0.59× | 67% | BBB / BBB / BBB | 0 | +210.4% |
| NVDA† | M1+G1+T1 | 40.0% | OPT1 | $53 / **$377** / $699 | 0.58× | 29% | BBB / BBB / BBB | 0 | +211.2% |
| NUE† | Drafted | 11.0% | CURRENT | $49 / **$98** / $182 | 2.66× | 50% | SSS / SSS / SSS | 0 | — |
| NUE† | Drafted | 11.0% | OPT1 | $49 / **$98** / $182 | 2.66× | 50% | SSS / SSS / SSS | 0 | — |
| NUE† | M1 margin TTM→drafted | — | — | NOT COMPUTED: TTM operating margin not computable (operating income not tagged) | | | | | |
| NUE† | G1 growth TTM→drafted | 11.0% | CURRENT | $55 / **$114** / $206 | 2.29× | 60% | SSS / SSS / SSS | 0 | +15.9% |
| NUE† | G1 growth TTM→drafted | 11.0% | OPT1 | $55 / **$114** / $206 | 2.29× | 60% | SSS / SSS / SSS | 0 | +15.9% |
| NUE† | T1 effective tax (latest FY) | 11.0% | CURRENT | $49 / **$99** / $183 | 2.64× | 50% | SSS / SSS / SSS | 0 | +0.6% |
| NUE† | T1 effective tax (latest FY) | 11.0% | OPT1 | $49 / **$99** / $183 | 2.64× | 50% | SSS / SSS / SSS | 0 | +0.6% |
| NUE† | R1 RONIC = latest ROIC | — | — | NOT COMPUTED: ROIC not computable (operating income not tagged) | | | | | |
| NUE† | R2 RONIC = 3-yr incremental | — | — | NOT COMPUTED: incremental ROIC not computable | | | | | |
| NUE† | R3 RONIC = implied by actual reinvestment | — | — | NOT COMPUTED: actual reinvestment not computable (no NOPAT) | | | | | |
| NUE† | M1+G1+T1 | — | — | NOT COMPUTED: TTM operating margin not computable (operating income not tagged) | | | | | |
| LLY† | Drafted | 16.0% | CURRENT | $133 / **$315** / $629 | 3.94× | 78% | SSS / SSS / SSS | 0 | — |
| LLY† | Drafted | 16.0% | OPT1 | $133 / **$311** / $632 | 3.98× | 57% | SSS / SSS / SSS | 0 | — |
| LLY† | M1 margin TTM→drafted | — | — | NOT COMPUTED: TTM operating margin not computable (operating income not tagged) | | | | | |
| LLY† | G1 growth TTM→drafted | 16.0% | CURRENT | $234 / **$565** / $1022 | 2.20× | 91% | SSS / SSS / SSS | 0 | +79.3% |
| LLY† | G1 growth TTM→drafted | 16.0% | OPT1 | $234 / **$557** / $1028 | 2.22× | 66% | SSS / SSS / SSS | 0 | +79.1% |
| LLY† | T1 effective tax (latest FY) | 16.0% | CURRENT | $136 / **$321** / $639 | 3.87× | 78% | SSS / SSS / SSS | 0 | +1.8% |
| LLY† | T1 effective tax (latest FY) | 16.0% | OPT1 | $136 / **$317** / $643 | 3.92× | 57% | SSS / SSS / SSS | 0 | +1.8% |
| LLY† | R1 RONIC = latest ROIC | — | — | NOT COMPUTED: ROIC not computable (operating income not tagged) | | | | | |
| LLY† | R2 RONIC = 3-yr incremental | — | — | NOT COMPUTED: incremental ROIC not computable | | | | | |
| LLY† | R3 RONIC = implied by actual reinvestment | — | — | NOT COMPUTED: actual reinvestment not computable (no NOPAT) | | | | | |
| LLY† | M1+G1+T1 | — | — | NOT COMPUTED: TTM operating margin not computable (operating income not tagged) | | | | | |

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
| NUE† | $260.73 | CURRENT | no solution within the drafting band [-26.4%, 91.2%] — Base at most $201 | 22.1% (within the hard bounds, no filed margin range) | no solution within the hard bounds, no filed ROIC [0.1%, 200.0%] — Base at most $125 |
| NUE† | $260.73 | OPT1 | no solution within the drafting band [-26.4%, 91.2%] — Base at most $201 | 22.1% (within the hard bounds, no filed margin range) | no solution within the hard bounds, no filed ROIC [0.1%, 200.0%] — Base at most $125 |
| LLY† | $1240.34 | CURRENT | 47.9% | no solution within the hard bounds, no filed margin range [-100.0%, 90.0%] — Base at most $1163 | no solution within the hard bounds, no filed ROIC [0.1%, 200.0%] — Base at most $453 |
| LLY† | $1240.34 | OPT1 | 47.9% | no solution within the hard bounds, no filed margin range [-100.0%, 90.0%] — Base at most $1150 | no solution within the hard bounds, no filed ROIC [0.1%, 200.0%] — Base at most $471 |

## 5. Dilution fallback check — convertibles in the 19 Oct captures

Both convertible tags (`ConvertibleDebt`, `ConvertibleNotesPayable`) are in the tag mapping (`tagMap.ts` "convertible-debt"), so the capture keeps every row of either over its twelve calendar years.

| Company | Convertible rows in the capture | Latest | Diluted − basic weighted-average shares (latest 10-K) |
|---|---|---|---|
| NVDA | 17 rows; last non-zero $15m at 2018-01-28 | ConvertibleDebt $0m at 2019-01-27 (10-K 0001045810-19-000023) | 155.0m (0.64% of basic, FY ending 2026-01-25) |
| NUE | none, in any period | — | 0.3m (0.13% of basic, FY ending 2025-12-31) |
| LLY | none, in any period | — | 2.0m (0.22% of basic, FY ending 2025-12-31) |

