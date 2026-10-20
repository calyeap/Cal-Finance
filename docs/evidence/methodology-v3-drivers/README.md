# Methodology v3 calibration #2 — driver construction (TEST only, issue #496)

Evidence only: decides nothing, changes no live behaviour or default. The
script reads #495's frozen sheets (`../methodology-v3-calibration`, MSFT from
`../ar7-prototype`) and the committed 19 Oct captures. No re-drafting, no SEC
call in round 1, one free SEC pull in round 2, no model call ($0).

| File | What it is |
|---|---|
| `results.md` / `results.json` | Filed data, every variant × CURRENT/OPT1, implied single drivers, convertible check. |

The engine is #495's parameterised D2 with a year-by-year margin and growth
path for years 1–5 and a tax override; with no variant it reproduces #495's
CURRENT and OPT1 results exactly (checked on every run). † = #495's dilution
supplement, not engine output.

## Gap fill — one free SEC pull (Calvin, 20 Oct 2026)

The frozen captures lack tax, working-capital and acquisition tags, and NUE and
LLY tag no operating income. One companyfacts pull per company (data.sec.gov,
20 Oct 2026 06:32 UTC) filled them. `scripts/analyzer/calibration-v3-sec-extract.py`
extracts the facts verbatim into `sec-2026-10-20/<ticker>-supplementary-facts.json`
(source URL, accession per value). Frozen sheets, prices and captures are unchanged.

| Gap | Filled with |
|---|---|
| 3-yr effective tax (T1) | Σ income tax ÷ Σ pre-tax income, latest three fiscal years |
| ΔNWC | the cash-flow statement's working-capital lines (`IncreaseDecreaseIn*`; asset increases use cash, liability increases provide it; deferred and other income-tax movements excluded). The balance-sheet method was not usable: NVDA tags no FY2026 marketable securities. |
| Acquisitions | cash paid for businesses, net of cash acquired; MSFT tags none after FY2011, so goodwill + finite-lived intangibles acquired stands in (FY2024 Activision ≈ $74.5bn); COST tags none. LLY's acquired IPR&D is excluded: it is expensed through operating income. |
| NUE operating income | pre-tax income + interest expense − interest income − equity-method earnings |
| LLY operating income | pre-tax income − non-operating income (expense); this construction reproduces MSFT's and NVDA's tagged operating income exactly, FY2023–26 |
| LLY invested capital | engine definition + long-term debt (its mapped total-debt series is `DebtCurrent` alone) |
| LLY capex | `PaymentsToAcquireOtherPropertyPlantAndEquipment` (its mapped capex tags stop before FY2022) |

## Reproduce

```
# raw companyfacts into an empty directory, then:
python3 -I scripts/analyzer/calibration-v3-sec-extract.py <raw-dir> docs/evidence/methodology-v3-drivers/sec-2026-10-20 <fetchedAt>
npx tsx scripts/analyzer/calibration-v3-drivers.ts
```
