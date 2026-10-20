# AR8 corrections — re-run evidence (CF-AR8-CORRECTIONS-01, #504)

Calvin chose "1 — Not yet: fix first" on #458, and ruled on #504 that KO's D7 bound may use the balance-sheet identity.
This is the free re-run on this branch: no model calls, the isolated cloud database `calboard_ar8`, and live SEC data with prices at the 19 Oct close.

## What changed

| # | Fix | Effect on the eight |
|---|---|---|
| F1 | Bridge cash includes the marketable-securities line a filer tags as `MarketableSecuritiesCurrent` / `DebtSecuritiesCurrent` instead of `ShortTermInvestments` (tag map `-10-6`) | NVDA cash $22,443M → $56,586M; what-if Base $132.14 → $133.53. No other company moves (§14 review). |
| F3 | D7's total liabilities = total liabilities and equity − total equity where a filer tags no `Liabilities` (Calvin, #504) | KO's bound forms: $68,483M − $43,808M = $24,675M, about $5.74/share. **At that conservative bound KO's net debt is 12.5% of EV, above the 10% gate, so KO is still "can't bound value"** — now for a stated reason (debt load), not missing inputs. |
| F4 | The bottom line names what enterprise value is waiting for | COST, NVDA, NUE, KO, LLY, OKLO now read "its enterprise value needs a decision on which of its investments are non-operating". The old line was "the balance-sheet inputs needed to measure its debt load are not all available". |
| Drafter | A fresh draft's diluted shares ignore a stale dilution tag | LLY drafts no longer add FY2011's 6.86m shares. |
| #502 regression | The stale-tag test compares period **ends** | #502 compared "start to end" strings, so MSFT and COST used the D8 fallback instead of their filed tag. Values were identical (diluted − basic equals the tag for both), but the input and label were wrong. Fixed. |

## Re-run (normal path, no §4.4 answers except MSFT's #188)

| Co. | Real app now | With "none" for §4.4 (WHAT-IF, not Calvin's answer) |
|---|---|---|
| MSFT | Valued: $184 / $334 / $449; 1.47–1.73×; draft SELL | — (Calvin's #188 answer is used) |
| COST | Needs §4.4 (named) | $252 / $394 / $535; draft SELL |
| NVDA | Needs §4.4 (named) | $36 / $134 / $298; draft SELL |
| NUE | Needs §4.4 (named) | $49 / $102 / $182; draft SELL |
| LLY | Needs §4.4 (named) | $138 / $373 / $637; draft SELL |
| KO | Needs §4.4 (named) | Values $14 / $23 / $33, but "can't bound value": net debt 12.5% ≥ 10% at the D7 bound |
| OKLO | Needs §4.4 (named); Overview still says "cannot be concluded from filed history" | Can't conclude ✔ |
| JPM | Refused, bank ✔ | — |

The deterministic report for each is ready in 2–4 s. AI prose was not re-run; the AR8 paid runs in `../runs/` stand for it.

## Files

- `runs/`: per-ticker acceptance, overview, report and console files.
- `what-if-none.json`
- RED output for the new tests is in the PR body.
- Tag-map review: `docs/tag-mapping-version-review.md` §14.
