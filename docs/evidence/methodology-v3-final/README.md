# Methodology v3 calibration #3 — final round (TEST only, issue #498)

Evidence only: decides nothing, changes no live behaviour or default. Reads
#495's frozen sheets, the 19 Oct captures and #496's 20 Oct supplementary SEC
facts. No re-drafting, no network, no model call ($0).

| File | What it is |
|---|---|
| `results.md` / `results.json` | A. year-1 funding check; B. Morningstar replication (MSFT); C. growth-plateau Bull. |

The year-by-year engine in `scripts/analyzer/calibration-v3-final.ts` reproduces
the round-2 engine exactly at OPT1 (every company, scenario and check rate;
checked on every run). † = #495's dilution supplement, not engine output.

## Choices made (test-only)

- **A.** NOPAT_0 = filed TTM operating income × (1 − the sheet's tax); RONIC_1 = drafted Base return on new capital; available = last fiscal year's capex − D&A + ΔNWC + acquisitions (#496's definitions). The shortfall is charged per share to Base at all three check rates.
- **B.** Morningstar's 40% investment rate is applied in yrs 1–5 as well as 6–20. Tax, D2 timing, bridge and share count stay ours. B2's stage-2 levels are our OPT1 path's yr 6–20 averages. With S = 0 the terminal treatments are identical (Gordon at return = rate is NOPAT ÷ rate), so "structure" here is the stage-2 shape.
- **C.** The plateau Bull uses S = 0 as specified (the OPT1 Bull carries +1.5pp). The D3 check takes only price and Base, so the Bull cannot move the verdict.

## Reproduce

```
npx tsx scripts/analyzer/calibration-v3-final.ts
```
