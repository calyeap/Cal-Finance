CORRECT: head aaf351ed47e73b9d2337d1074b388e2f9e562504 — in one push to the same PR, change only `scripts/evidence/msft-phase-b/` and the proof report. (1) Stop adding back the $24.4B equity-method and measurement-alternative investments: they are already inside `LongTermInvestments` (36,348 = 10-K "Equity and other investments"). (2) Add a g > risk-free flag to the sensitivity checks and report the two cases that trip it (growth +2pp gives terminal g 6.0% > Rf 4.6%; Rf −1pp gives Rf 3.6% < g 4.0%), plus a growth-path sweep that holds terminal g fixed. (3) State the finance-lease reinvestment inconsistency: FY2026 reinvestment is 80.8%, not 61.2%, once the captured $24,608M finance-lease ROU additions are included. Then regenerate the outputs and update the report's figures. The headline NOT PROVEN may stay.

TIER: HEAVY (from the issue #427 contract, kept as set). Reviewed head: aaf351e (the repo-a checkout, one commit).

## What I checked independently, and what held

- **Scope.** The diff touches only `docs/proof/…phase-b-proof-01.md`, `scripts/evidence/msft-phase-b/**` and one line in `.gitignore` (`__pycache__/`). Nothing changes under `lib/`, `app/`, migrations, config, `FROZEN_HASHES` or CI. No BUY/HOLD/SELL call is made, and nothing is promoted to policy. The `.gitignore` line is outside the two artefact paths, but it is harmless (nit).
- **SEC sourcing, periods and units.** I checked every `inputs.json` value against `lib/analyzer/acquisition/captures/msft-companyfacts.json` (FY2026 10-K, accn 0001193125-26-323660, filed 2026-07-29). All of them match exactly, with the right period ends and USD units: revenue 331,839 / 281,724; operating income 155,237; capex 115,948; depreciation 34.3B; amortization 4.7B; cash 20,935; short-term investments 55,908; `LongTermInvestments` 36,348; equity-method 12.0B; measurement-alternative 12.4B; long-term debt 9,227 + 31,067 = 40,294; finance-lease liability 66,594; operating-lease liability 21,925; cover-page shares 7,425,545,491 at 2026-07-23. The price of $499.70 on 2026-09-04 matches `prices.json` and is labelled historical.
- **WebSearch-sourced 10-K text.** I fetched the FY2026 10-K read-only from sec.gov to confirm it. ETR "19% and 18%", net income 133,749, diluted EPS 17.95, cash paid for interest $1.5B and depreciation $34.3B are all exact.
- **Reproducibility.** `run_all.py`, re-run in a copy (work-a/rerun), exits 0, and its five JSON outputs are byte-identical to the committed ones. It needs no network.
- **Independent arithmetic trace.** I wrote my own engine (work-a/check/indep.py), which imports none of the PR's code. From the same inputs it gives WACC 8.6406%, PV of the explicit years $858.40B, PV of the terminal value $2,373.04B, EV $3,231.44B, terminal share 73.4% and value per share $436.36. That matches the report exactly. The terminal value uses FCFF₁₁ = NOPAT₁₀·(1+g)·(1−g/ROIC) over (WACC−g), consistent with the stable-growth identity. Discounting is end-of-year. Terminal spread: WACC − g = 4.64pp in the base case.
- **Oracle.** The report candidly says the fallback "Engine B" is a second implementation by the same author that shares `driver_schedule.py`, so the whole revenue, EBIT and reinvestment path is shared. It does not claim that as independent and grades the oracle requirement NOT PROVEN. That matches the contract's honest-blocker path. I did not need the Ginzu file to reach this verdict. The headline NOT PROVEN is defensible and can stay.

## Findings (mandatory, bounded, inside existing authority)

### F1. The equity bridge double-counts $24.4B of non-operating investments
- **Where:** `shadow_dcf.py` `equity_bridge()`, `independent_oracle.py` cells H1/H2/H3, `inputs.json` (`longTermInvestmentsUsd`, `equityMethodInvestmentsUsd`, `equitySecuritiesNoReadilyDeterminableFvUsd`), and the report's base-case table ("+ Cash & marketable securities $113.2B" and "+ Non-operating investments $24.4B").
- **Root cause:** In XBRL, `LongTermInvestments` (36,348) is the 10-K balance-sheet line "Equity and other investments". The 10-K's Note 4 Investment Components table puts "Equity investments Other 24,567" in that column. The 10-K also says that "Other" includes investments "measured using the equity method" and those without readily determinable fair values. The same note gives the amounts at 2026-06-30 as $12.4B and $12.0B. So the 12.0B + 12.4B are already inside the 36,348 (and inside the $113,191 Note 4 total the report calls "cash & marketable securities"), and the bridge adds them a second time.
- **Evidence:** In the 10-K, Note 4's total row reads "Total $ 113,191 $ 20,935 $ 55,908 $ 36,348". The balance sheet reads "Equity and other investments 36,348 15,405". My trace with the add-back removed gives $433.08/share, not $436.36: −$3.29, or −0.75%. Both engines carry the same error, so their agreement cannot catch it. This is the "non-operating items… equity bridge" check the contract tells REVIEW to make.
- **Smallest fix:** Set the non-operating add-back to 0, or split 36,348 into debt securities and other (11,948) plus non-operating equity (24,400) so nothing is counted twice. Correct the bridge labels, regenerate the outputs and update the report's numbers.

### F2. The sensitivity misses the non-economic combinations it should flag
- **Where:** `sensitivity.py` `run_one()` (flags only terminal share > 85% and WACC ≤ g), `sweep_revenue_growth()` and `sweep_discount_rate()`, plus the report's "Candor flags… none triggered" and "a ±2pp growth swing alone moves value per share from $322.79 to $705.31".
- **Root cause:** The proof sets its own stable-growth rule: terminal g ≤ risk-free rate (`inputs.json` `terminalGrowthRate.source`, and the report's assumptions table). Two of its sensitivity cases break that rule, and no check flags them:
  - The "+2pp revenue growth" case moves terminal g to 6.0%, above Rf 4.6%.
  - The "WACC −1pp via Rf" case sets Rf to 3.6%, below terminal g 4.0%.
  
  The growth sweep also moves perpetual growth along with the growth path. Most of its +62% upside therefore comes from a terminal growth rate the model itself calls inadmissible, not from the forecast path.
- **Evidence (my independent engine):**

  | Case | Value per share |
  |---|---|
  | Growth path ±2pp, terminal g held at 4% | $401.18 / $474.23 |
  | The PR's version of the same sweep | $322.79 / $705.31 |
  | Rf −1pp with g capped at Rf (3.6%) | $524.91 |
  | The PR's Rf −1pp case | $564.64 |

  The contract requires the sweep to "identify … non-economic combinations" and asks REVIEW to judge whether the sensitivity is "candid, not cherry-picked".
- **Smallest fix:**
  - Add a `TERMINAL_G_EXCEEDS_RISK_FREE` flag to `run_one`.
  - Report the two flagged cases as non-economic.
  - Add a growth-path sweep that holds terminal g fixed (terminal g can be its own sweep if wanted).
  - Restate the fragility paragraph to match.
  
  Base inputs do not change.

### F3. The finance-lease reinvestment inconsistency is not disclosed, and the 60% year-1 reinvestment rate is anchored to a figure that leaves it out
- **Where:** In the report's model definition, "implied reinvestment rate on FY2026 actuals is ≈61.2%, computed as (capex − D&A) ÷ EBIT·(1−t)". Related: `inputs.json` `reinvestmentRateY1`, and the Limitations section on finance leases.
- **Root cause:** The proof treats finance leases ($66.6B) as debt in WACC and in the bridge. Its own committed capture has `RightOfUseAssetObtainedInExchangeForFinanceLeaseLiability` FY2026 = 24,608M. The 10-K says finance-lease ROU assets sit in property and equipment, so the subtracted D&A includes their amortization ($5.4B finance-lease ROU amortization). But the capex side includes only cash `PaymentsToAcquirePropertyPlantAndEquipment`. Leaving the debt-financed capacity out of reinvestment while subtracting the matching liability is a lease inconsistency. The contract says to highlight these ("Highlight any… balance-sheet/lease inconsistencies").
- **Evidence:** (115,948 + 24,608 − 39,000) / 125,742 = 80.8%, not 61.2%. With year-1 reinvestment at 80.8% and everything else held, my engine gives $416.03 (−4.7%).
- **Smallest fix:**
  - Disclose the inconsistency in Limitations.
  - Correct the "consistent with FY2026 ≈61.2%" justification to show both figures.
  - Either recalibrate year 1 or add the 80.8% case as a sensitivity row.
  
  This needs no new policy choice; the 60% stays a labelled test-only assumption if kept.

## Notes (non-blocking; can be fixed in the same push)

- **Reproducibility claim is inaccurate.** The report says `run_all.py` "regenerates every file under output/", but no committed script writes `output/formula_ledger.csv`. The CSV does match Engine B's ledger, which I checked. The report also says the ledger has "97 rows"; it has 58.
- **The NWC limitation contradicts itself.** It says the model "understates reinvestment" because of growing unearned revenue, but unearned revenue is a cash source. FY2026 10-K working-capital changes net to about −$4.9B, a use of cash. One sentence fixes this.
- **Operating leases are inconsistent.** The bridge subtracts the $21.9B operating-lease liability, but GAAP operating income has already deducted the full operating lease cost of $6.97B. The upper bound on the effect is about $2.95/share. Worth one line in Limitations.
- **The valuation date is not stated in the report.** It appears only as `inputs.json` `valuationDate` 2026-10-14. The report should also say that year 1 (FY2027, ending 2027-06-30) is discounted a full year from the 2026-06-30 balance-sheet date. The contract asks to "clearly identify the valuation date".
- **The discount-rate sweep moves WACC ±0.97pp** (through Rf, since the debt weight is about 3.4%), not exactly ±1pp. A beta-driven exact +1pp gives $350.46 against $352.83, which is immaterial; a one-line note is enough.
- **Smaller methodology omissions to name:** shares are basic cover-page shares with no RSU dilution, and the OpenAI equity-method stake is at its $12.0B carrying value rather than market value. Both are judgment items to list as limitations, not to resolve.

## Not a Calvin gate

Merging an accepted evidence artefact is within the contract. The only reserved decision is the later methodology ruling. Every item above is mechanical, sits inside `docs/proof/` and `scripts/evidence/`, and needs no new finance policy.

Evidence files: work-a/check/indep.py (independent engine and scenario runs), work-a/rerun/ (re-execution of the PR scripts), work-a/sec/msft-20260630.htm and 10k.txt (FY2026 10-K, fetched read-only from sec.gov). repo-a has no tracked modifications.
