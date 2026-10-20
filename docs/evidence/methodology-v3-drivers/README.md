# Methodology v3 calibration #2 — driver construction (TEST only, issue #496)

Evidence only: decides nothing, changes no live behaviour or default. The
script reads #495's frozen sheets (`../methodology-v3-calibration`, MSFT from
`../ar7-prototype`) and the committed 19 Oct captures. No re-drafting, no SEC
call, no model call ($0).

| File | What it is |
|---|---|
| `results.md` / `results.json` | Filed data, every variant × CURRENT/OPT1, implied single drivers, convertible check. |

The engine is #495's parameterised D2 with a year-by-year margin and growth
path for years 1–5 and a tax override; with no variant it reproduces #495's
CURRENT and OPT1 results exactly (checked on every run). † = #495's dilution
supplement, not engine output.

## Inputs not in the frozen data

- **Effective tax, 3-yr average:** the captures carry no tax or pre-tax income tags. T1 uses the latest fiscal year's effective rate from the committed, independently reviewed golden facts (`lib/analyzer/golden/*.json`).
- **Net reinvestment:** ΔNWC and acquisitions are not in the captures, so "actual" is capex − D&A only. R3 rests on that partial figure.
- **NUE, LLY:** no operating income is tagged, so TTM margin, ROIC and NOPAT-based figures (M1, R1–R3) are not computable.

## Reproduce

```
npx tsx scripts/analyzer/calibration-v3-drivers.ts
```
