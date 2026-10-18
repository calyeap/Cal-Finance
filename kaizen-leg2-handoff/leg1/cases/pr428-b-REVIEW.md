CORRECT: The arithmetic reproduces ($436.36/share), but the equity bridge double-counts $24.4B. Reinvestment leaves out the $24.6B of finance-lease-funded capex while subtracting the lease debt. The sensitivity's main "fragility" claim comes mostly from changing terminal growth, which the report does not say, and two sweeps break the proof's own g <= Rf rule without a flag. The sales-to-capital diagnostic the report describes was never produced.

Reviewed: PR #428 head aaf351ed47e73b9d2337d1074b388e2f9e562504 against issue #427 (HEAVY).

Reviewer evidence (all under work-b\):
- my_dcf.py: my own from-scratch FCFF DCF. It imports nothing from the PR.
- findings.py: quantifies each finding below.
- check_capture.py: dumps the committed XBRL capture.
- dl\msft10k.htm: the primary FY2026 10-K (accn 0001193125-26-323660), fetched read-only from sec.gov, with text extractions dl\t2.txt and dl\msft10k.txt.
- copy\: the PR's run_all.py rerun in a copy. All 6 committed output files regenerate byte-identical, exit 0.

What checks out:
- Every SEC input in inputs.json matches the committed capture `lib/analyzer/acquisition/captures/msft-companyfacts.json`: revenue, operating income, D, A, capex, cash, short-term and long-term investments, equity-method and alternative-measurement investments, long-term debt, finance and operating lease liabilities, and the cover-page share count.
- Net income $133,749M and the 19% effective tax rate match the 10-K text (t2.txt lines 974 and 1535ff).
- My independent model reproduces the base case exactly: WACC 8.6406%, PV explicit $858.40B, PV of terminal value $2,373.04B, EV $3,231.44B, $436.3612/share, terminal share 73.4%.
- No files under lib/ or app/ changed. The NOT PROVEN headline and its oracle limitation are stated honestly.

## Findings

### F1 — The equity bridge counts $24.4B of non-operating investments twice (headline number overstated)

- **Where:** `scripts/evidence/msft-phase-b/shadow_dcf.py:65-79` and `independent_oracle.py:105-114`. Also the report table at `docs/proof/...-proof-01.md:86` and the bridge description at :148.
- **Root cause:** The bridge adds `LongTermInvestments` ($36,348M) and then adds `EquityMethodInvestments` ($12,000M) plus `EquitySecuritiesWithoutReadilyDeterminableFairValueAmount` ($12,400M) a second time. In the 10-K, `LongTermInvestments` is the balance-sheet line "Equity and other investments 36,348". That line is long-term debt investments of $9,108M plus the equity-investments column of $27,240M (9,108 + 27,240 = 36,348). The $27,240M already contains equity investments "Other" of $24,567M. Per the 10-K, that "Other" includes the $12.4B measured at cost and the $12.0B under the equity method (t2.txt:2264-2280 and :2504).
- **Engine B check:** Engine B repeats the same bridge, so the "oracle" agreement could not catch this.
- **Reproduction:** `python -I work-b/findings.py` prints `F1 bridge without double-counted 24.4B: vps 433.08 (delta -3.29, -0.75%)`. The capture also shows the subset relationship in every period, for example 2025-06-30: 6.0 + 2.9 ≤ 15.4.
- **Smallest fix:** Drop `non_operating_assets` from both bridges, or add only the long-term debt investments plus the equity investments. Then regenerate the outputs and the report table.

### F2 — Finance-lease capex is left out of reinvestment while finance-lease debt is subtracted, and the report presents the calibration as consistent

- **Where:** `docs/proof/...:132-135`, which says the 60% year-1 rate is "consistent with" the FY2026 implied ≈61.2% = (capex − D&A) ÷ EBIT(1−t). The 60% input itself is `inputs.json` `reinvestmentRateY1`.
- **Root cause:**
  - The 10-K says "Finance leases are included in property and equipment" (t2.txt:1933). Finance-lease PP&E at cost is $82,712M (t2.txt:~4005).
  - So the $34.3B depreciation the proof subtracts includes $5,403M of finance-lease right-of-use amortization.
  - But the $24,608M of FY2026 assets obtained under finance leases is never added to capex. That fact is in the committed capture as `RightOfUseAssetObtainedInExchangeForFinanceLeaseLiability` and in the 10-K at t2.txt:3974-3987.
  - Meanwhile the $66,594M finance-lease liability is subtracted as debt.
  - The contract (DO 4) requires the proof to "Highlight any ... balance-sheet/lease inconsistencies". The report instead calls the lease treatment Damodaran-consistent (:262).
- **Reproduction:** `findings.py` prints:
  - `FY2026 implied reinvestment rate incl finance-lease additions 0.8077; cash-capex only 0.6120`
  - `r1=0.808 vps 416.06 (delta -4.65%)`
  - F1 and F2 together: $412.77 (−5.4%).
- **Smallest fix:** Include finance-lease right-of-use additions in the FY2026 net-capex calibration. Either re-derive the year-1 reinvestment rate (about 81%), or keep 60% but disclose that it excludes $24.6B of lease-financed capex and is therefore not "consistent with FY2026". List this under limitations.

### F3 — The sensitivity's main conclusion credits the growth path with a swing that comes mostly from terminal growth, and the non-economic combinations are not flagged

- **Where:**
  - `scripts/evidence/msft-phase-b/sensitivity.py` `sweep_revenue_growth`: it shifts both `revenueGrowthY1` and `revenueGrowthFadeTo`, which is the terminal g.
  - `sweep_discount_rate`: it shifts Rf without checking g against Rf.
  - Report :217-235.
- **Root cause:**
  1. The "+2pp revenue growth" case sets terminal g to 6.0%. That is above the 4.6% risk-free rate, which breaks the proof's own constraint "g ≤ risk-free rate" (inputs.json:42, report :117).
  2. The "Rf −1pp" case gives Rf 3.6% < g 4.0%, which also breaks it.
  3. `run_one` flags only terminal share above 85% and WACC ≤ g, so neither case is flagged. The report then says no flags were triggered.
  4. DO 4 requires identifying "non-economic combinations".
  5. The report's conclusion that the model is "most fragile to ... the revenue growth path — a ±2pp growth swing alone moves value per share from $322.79 to $705.31", and its advice to focus diligence on growth "not ... the reinvestment mechanics", is wrong in attribution. With terminal g held at 4%, the growth path alone moves value only from $401.18 to $474.23 (−8% / +9%). That is about the same size as the ROIC/reinvestment sweep (−10% / +6%). Terminal g alone moves value from $350.69 to $648.09.
- **Reproduction:** `findings.py` prints:
  - `d=+0.02: PR sweep 705.31 | path only 474.23 | terminal g only 648.09 ; gT=0.060 vs rf 4.6%`
  - `d=-0.02: 322.79 | 401.18 | 350.69`
  - `rf-0.01: ... g=4.0% vs rf 3.6% -> g<=rf False`
- **Smallest fix:**
  - Split the growth sweep into a growth-path sweep with terminal g fixed and a separate terminal-g sweep.
  - Add a `G_GT_RISK_FREE` flag to `run_one`, and show it on the +2pp growth and Rf −1pp rows (or hold g ≤ Rf in those rows).
  - Rewrite the "Reading this candidly" paragraph to match.

### F4 — The report describes an output that does not exist (implied sales-to-capital diagnostic)

- **Where:** `docs/proof/...:136-140` says "The model reports each year's *implied* sales-to-capital ratio (ΔRevenue ÷ reinvestment) as a diagnostic".
- **Reproduction:** `grep -ril "salesToCapital\|sales_to_capital\|sales-to-capital" scripts/evidence/msft-phase-b/` returns nothing. No code or output file computes it.
- **Why it matters:** DO 2 asks that reinvestment be tied to sales-to-capital or supportable economics. My model computes the ratio at about 0.61 in years 1-3, falling to 0.475 by year 10 (`python -I work-b/my_dcf.py`). Reporting it would show readers that the path assumes $1 of reinvestment produces only about $0.5-0.6 of revenue.
- **Smallest fix:** Emit ΔRevenue ÷ reinvestment per year in `driver_schedule`/Engine A output and in the report, or delete the claim.

### F5 — The stated valuation date does not match the discounting convention

- **Where:** `inputs.json:5` states `valuationDate: 2026-10-14`. The report header (:69) says "as of FY2026 (FYE 2026-06-30)". Both engines discount the FY2027 cash flow a full year, and the bridge uses the 2026-06-30 balance sheet.
- **Root cause:** The model actually values the company as of 2026-06-30, but it is labeled 2026-10-14 and compared with a 2026-09-04 price. The contract asks the review to check discount conventions and asks the proof to "Clearly identify the valuation date".
- **Reproduction:** `findings.py` prints `stub (valuation 2026-10-14, Y1 end 2027-06-30): vps 446.96 (2.43%)`. The convention alone moves value by 2.4%, more than F1.
- **Smallest fix:** State the effective valuation date as 2026-06-30 and note the mismatch with the price date. Alternatively, apply an explicit stub-period roll-forward.

## DONE WHEN / DO table

| Item | Status | Evidence |
|---|---|---|
| DO 1: as-of evidence set, provenance, units, historical price labelled, no fixture values | PARTIAL | Inputs match the capture and the 10-K (check_capture.py). Price is labelled historical. The valuation date is inconsistent (F5). The bridge double-counts investments (F1). |
| DO 2: fully specified 10-year FCFF DCF with drivers, sources, formulas, annual trace | PARTIAL | Engine A and the annual trace exist and reproduce exactly. The reinvestment calibration misstates FY2026 economics (F2). The sales-to-capital diagnostic is claimed but absent (F4). |
| DO 3: independent oracle or honest blocker | MET (as honest NOT PROVEN) | Ginzu was not run, and the report says so. Engine B shares `driver_schedule` and the same bridge, so it is an arithmetic re-coding only, which the report admits. It also repeats F1. |
| DO 4: sensitivity (WACC ±1pp, growth, margin, reinvestment), terminal share, r ≤ g, lease inconsistencies, non-economic combinations, implied growth as context | PARTIAL | All four sweeps exist and reproduce. The growth attribution is wrong and non-economic combinations are unflagged (F3). The lease inconsistency is not highlighted (F2). Implied growth of 19.27% reproduces. |
| DO 5: one docs/proof report plus small scripts/evidence, PASS / NOT PROVEN | MET | 1 report plus 6 small Python and JSON files. Outputs regenerate byte-identical with no network. |
| DO NOT: no lib/, app/ or policy changes | MET | The diff touches only docs/proof, scripts/evidence/msft-phase-b and .gitignore. |
| DONE WHEN: verified inputs, oracle and sensitivity inspectable, limitations candid | NOT MET until F1-F5 are fixed | The limitations omit the double count, the lease-capex gap and the g > Rf combinations. |

## Nits (not counted)

- The `.gitignore` `__pycache__/` addition was not authorised; it is harmless.
- Operating leases are subtracted as debt but EBIT is not adjusted for them: the $6,968M operating lease cost stays in EBIT. Under Ginzu convention this costs roughly $1-3/share. Worth disclosing alongside F2.
- D + A of $39.0B exceeds the cash-flow statement's "Depreciation, amortization, and other" of $38,534M. This is immaterial.
- `run_all.py` `_scrub()` is a no-op, and its docstring describes behaviour it does not have.
- The PR body, CI results and the builder's report were not provided, so their compliance is not assessed here.
