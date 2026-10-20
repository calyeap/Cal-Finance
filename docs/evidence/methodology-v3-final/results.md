# Methodology v3 calibration #3 — final round (TEST only, #498)

Frozen #495/#496 sheets, 19 Oct captures and 20 Oct supplementary SEC facts. † = #495's dilution supplement (not engine output). Runway OPT1 at the recorded moat class unless stated.

## Reproduction of round 2 (OPT1, drafted, all scenarios and check rates)

| Company | Result |
|---|---|
| MSFT | MATCH |
| COST | MATCH |
| NVDA† | MATCH |
| NUE† | MATCH |
| LLY† | MATCH |

## A. Year-1 funding check (OPT1)

Required yr-0 investment = NOPAT_0 × g_1 ÷ RONIC_1, with NOPAT_0 = filed TTM operating income × (1 − the sheet's tax) and RONIC_1 = the drafted Base return on new capital. Available = the last fiscal year's filed net reinvestment (capex − D&A + ΔNWC + acquisitions). The shortfall is charged per share at the valuation date to Base (and to Base at each check rate).

| Co. | Growth rule | g_1 | NOPAT_0 | Required | Available (FY) | Shortfall | Shortfall ÷ unfunded Base | Unfunded Base | **Funded Base** | Δ vs unfunded | Price÷Base | D3 grid (−½ / rate / +½) | Routing | Close calls |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| MSFT | Drafted constant | 12.0% | $122.6bn | $81.8bn | $87.5bn (FY2026) | $0.0bn ($0.00/sh) | 0.0% | $316 | **$316** | +0.0% | 1.69× | SSS / SSS / SSS | SELL | 0 |
| MSFT | G1 ramp | 17.8% | $122.6bn | $121.2bn | $87.5bn (FY2026) | $33.7bn ($4.62/sh) | 1.3% | $348 | **$344** | -1.3% | 1.55× | SSH / SSS / SSS | CLOSE CALL HOLD/SELL | 1 |
| COST | Drafted constant | 8.0% | $9.2bn | $2.1bn | $1.4bn (FY2026) | $0.7bn ($1.51/sh) | 0.4% | $419 | **$417** | -0.4% | 2.38× | SSS / SSS / SSS | SELL | 0 |
| COST | G1 ramp | 10.1% | $9.2bn | $2.7bn | $1.4bn (FY2026) | $1.2bn ($2.78/sh) | 0.6% | $436 | **$433** | -0.6% | 2.30× | SSS / SSS / SSS | SELL | 0 |
| NVDA† | Drafted constant | 18.0% | $156.1bn | $70.2bn | $33.7bn (FY2026) | $36.6bn ($1.49/sh) | 1.2% | $121 | **$120** | -1.2% | 1.81× | SSS / SSS / SSS | SELL | 0 |
| NVDA† | G1 ramp | 83.4% | $156.1bn | $325.3bn | $33.7bn (FY2026) | $291.7bn ($11.86/sh) | 3.4% | $352 | **$340** | -3.4% | 0.64× | BBB / BBB / BBB | BUY | 0 |
| NUE† | Drafted constant | 4.0% | $3.3bn | $1.2bn | $2.8bn (FY2025) | $0.0bn ($0.00/sh) | 0.0% | $98 | **$98** | +0.0% | 2.66× | SSS / SSS / SSS | SELL | 0 |
| NUE† | G1 ramp | 17.2% | $3.3bn | $5.1bn | $2.8bn (FY2025) | $2.3bn ($9.96/sh) | 8.8% | $114 | **$104** | -8.8% | 2.51× | SSS / SSS / SSS | SELL | 0 |
| LLY† | Drafted constant | 15.0% | $26.6bn | $24.9bn | $14.6bn (FY2025) | $10.3bn ($10.85/sh) | 3.5% | $311 | **$300** | -3.5% | 4.13× | SSS / SSS / SSS | SELL | 0 |
| LLY† | G1 ramp | 49.6% | $26.6bn | $82.3bn | $14.6bn (FY2025) | $67.7bn ($71.24/sh) | 12.8% | $557 | **$486** | -12.8% | 2.55× | SSS / SSS / SSS | SELL | 0 |

Available reinvestment components (last fiscal year, capex − D&A / ΔNWC / acquisitions): MSFT FY2026 $81.6bn / $4.9bn / $0.9bn; COST FY2026 $3.8bn / $-2.3bn / $0.0bn; NVDA† FY2026 $3.2bn / $15.9bn / $14.5bn; NUE† FY2025 $2.2bn / $0.6bn / $0.0bn; LLY† FY2025 $5.8bn / $8.1bn / $0.7bn.

## B. Morningstar replication — MSFT (humility check, not a target)

Morningstar inputs: 13.8% growth yrs 1–5; operating margin from TTM 46.8% linearly to 47.6% by yr 5, then held; 8.9% growth yrs 6–20 at a 40% investment rate (return on new capital 22.3%); yrs 1–5 also at 40% (return 34.5%); perpetuity from yr 20 at return = rate. Held at our values throughout: tax 21.0%, D2 timing (mid-year, price-date stub), bridge and Base share count. Our stage-2 levels for B2 are our OPT1 path's yr 6–20 averages: growth 4.2%, return on new capital 13.5%.

| Run | Base | Price÷Base | TV share |
|---|---|---|---|
| B1 — Morningstar structure + Morningstar inputs @ 8.5% | **$576** | 0.93× | 52% |
| B1@9 — Morningstar structure + Morningstar inputs @ 9.0% | **$524** | 1.02× | 49% |
| B2 — Morningstar structure + our drafted inputs @ 9.0% | **$304** | 1.76× | 39% |
| B3 — Our structure (OPT1) + Morningstar inputs @ 9.0% | **$419** | 1.27× | 33% |
| OURS — Our structure (OPT1) + our drafted inputs @ 9.0% (reference) | **$316** | 1.69× | 37% |

Split of B1 − ours ($576 − $316 = $260), one order:

| Step | $/share | Share of gap |
|---|---|---|
| Inputs (our structure): B3 − ours | +$103 | 40% |
| Structure (Morningstar inputs): B1@9 − B3 | +$105 | 40% |
| Rate: B1 − B1@9 | +$52 | 20% |

The other order:

| Step | $/share | Share of gap |
|---|---|---|
| Structure (our inputs): B2 − ours | $-13 | -5% |
| Inputs (Morningstar structure): B1@9 − B2 | +$221 | 85% |
| Rate: B1 − B1@9 | +$52 | 20% |

Order-independent (average of the two orders): inputs $162 (62%), structure $46 (18%), rate $52 (20%). Inputs and structure interact: Morningstar's structure is worth +$105 with its own inputs but −$13 with ours.

## C. Growth plateau as Bull — wide-moat companies

Bull = drafted Bull drivers; growth yrs 1–5 as drafted, yrs 6–15 at min(drafted yr-5 Bull rate, 9%), linear to 3% by yr 20; return on new capital fades from the drafted Bull value to the rate by yr 20 (R = 20, S = 0); terminal value from yr 19.5. The OPT1 Bull carries S = +1.5pp (D2's bull uplift); the plateau Bull carries S = 0 as specified.

| Co. | Bull g yrs 1–5 → plateau | CURRENT Bull | OPT1 Bull | **Plateau Bull** | vs OPT1 Bull | Base (unchanged) | Verdict (OPT1) |
|---|---|---|---|---|---|---|---|
| MSFT | 16.0% → 9.0% | $456 | $448 | **$487** | +8.8% | $316 | SELL (Bull is not a D3 input) |
| COST | 11.0% → 9.0% | $559 | $565 | **$678** | +20.1% | $419 | SELL (Bull is not a D3 input) |
| NVDA† | 30.0% → 9.0% | $264 | $274 | **$266** | -3.2% | $121 | SELL (Bull is not a D3 input) |

