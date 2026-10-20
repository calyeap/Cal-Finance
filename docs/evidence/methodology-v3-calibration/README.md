# Methodology v3 calibration — TEST only (issue #495)

Evidence for a possible Methodology v3 D2. **Decides nothing and changes no
live behaviour or default:** the two scripts below are evidence tooling; the
app imports neither, and the engine's constants are read, never edited.

| File | What it is |
|---|---|
| `results.md` / `results.json` | Every company × design × moat class; implied runway; ROIC history; MSFT input dump. |
| `<ticker>-run.json` | The frozen inputs: one median-of-three DRAFT sheet per company (COST, NVDA, NUE, KO, LLY), valued unadopted through the production engine. MSFT's is `../ar7-prototype/msft-run.json` (#494). |
| `<ticker>-run-supplement.json` | **TEST-ONLY SUPPLEMENT, not engine output** (NVDA, NUE, LLY; KO still fails): the frozen sheet re-valued with treasury-method dilution stated as diluted − basic weighted-average shares from the same capture. The engine itself leaves these NOT VALUED (named gate, `docs/ev-input-gaps-reconciliation.md` §1). Marked † everywhere. |
| `spend.json` | Tokens and cost of the one paid drafting run: 15 calls, 57,180 in + 71,667 out, **$2.08** of the $5 cap. |

## Frozen inputs

- **SEC facts:** the committed 19 Oct captures (`lib/analyzer/acquisition/captures/ar6-2026-10-19`), read through the production CAPTURE path. No SEC endpoint was called: the drafts' research is filed XBRL history only (no earnings-release text, no 10-K Item 1 — the MSFT run, drafted live on 20 Oct, also had two earnings releases).
- **Drafts:** the production drafting path (`draftAssumptionSheet`, `claude-opus-5`, three price-blind drafts, per-driver median), drafted once and frozen. The scripts refuse to redraft a frozen company.
- **Price:** the 19 Oct 2026 close (Yahoo), the same date as MSFT's; the script refuses any other date.
- **Non-operating investments:** the recorded §4.4 answer where one exists (MSFT only), else "none" — as `draft-spread.ts` does.

## Parameterised D2 (test harness)

G = year growth reaches terminal growth (3%); R = year return on new capital
reaches rate + S; S = terminal spread. Both fade linearly from year-5 values;
explicit period to max(G, R); terminal value discounted from max(G, R) − 0.5.
Mid-year flows, price-date stub, TTM base, reinvestment_t = NOPAT_t ×
g_(t+1) ÷ RONIC_t — as the engine. **With G = R = 10 the harness reproduces
the engine exactly** (Bear, Base, Bull, Base at rate ± 0.5pp and terminal share
for every valued company; see "Engine reproduction" in `results.md`).

AI DEFAULTS (test-only, reversible): Bear takes the design's "none" row with
S = 0 (D2's "bear +0"); Bull takes the class's row with S + 1.5pp (D2's "bull
= base + 1.5pp"); margins beyond year 10 hold the sheet's margin; each
company is checked at its own D1 rate ± 0.5pp (11% for NUE and NVDA, which
are cyclical by SIC); for R ≤ 5 the target applies from year R.

## Reproduce

```
ANTHROPIC_API_KEY=… DATABASE_URL=… npx tsx scripts/analyzer/calibration-v3-freeze.ts --preflight   # free count_tokens
ANTHROPIC_API_KEY=… DATABASE_URL=… npx tsx scripts/analyzer/calibration-v3-freeze.ts               # paid, capped; skips frozen companies
DATABASE_URL=… npx tsx scripts/analyzer/calibration-v3-supplement.ts                                # free: † supplement runs
npx tsx scripts/analyzer/calibration-v3.ts                                                          # free, deterministic
```

## Caveats on the inputs

- **NUE and LLY tag no operating income** in the capture, so their drafted margins rest on an operating-cash-flow proxy (cited in each anchor) and their ROIC history is n/a. NUE's base return on new capital equals its 11% rate, so its value does not move with runway.
- **NVDA's bridge carries the D7 finance-lease upper bound** ($57.9bn, "not disclosed — valued at its upper bound").
- **KO** stays NOT VALUED even in the supplement: no finance-lease liability and no same-date upper bound (D7: the bridge stays INCOMPLETE).
- **MSFT FY2017 ROIC (12.9%)** is a series-edge artefact: that year's cash series excludes short-term investments (invested capital $177.9bn vs $29.5bn in FY2018). It does not change any count.
