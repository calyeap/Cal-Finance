CORRECT: two reproduced defects. (1) On a real run, a NOT CONFIRMED current operating margin still feeds the reverse-DCF grid, so DO 2 ("a contradicted fact blocks every output that depends on it") is not met. (2) SCREEN still recomputes each run's verdict at the live price on every view, and that verdict can now differ from the stored report it links to.

Review of PR #463 (CF-AR3-REPRODUCIBLE-RUNS-01, head cea1b49) against issue #451, HEAVY tier.

## Findings

### F1 (material): an unconfirmed current or median margin is not gated in M7, and its NOT CONFIRMED state is overwritten with a clean one

- **Where.** `lib/analyzer/modules/reverseDcf.ts:160-168` (`buildMarginLevelList`). This function is not changed by the PR, but the PR's gating design depends on it.
- **Root cause.**
  - The PR gates by provenance: `figures.ts computedValue` refuses NOT CONFIRMED.
  - The comment in `figures.ts` claims "Every M1–M16 module issues its figures through here with combineProvenance of the inputs it actually used". That claim is false for M7.
  - `buildMarginLevelList` reads `input.currentMargin.value` and `input.medianMargin.value`, then issues both with `CLEAN_PROVENANCE`. The margin's own `verificationState` is dropped.
  - `computeSingleCell` then combines that clean token with base revenue and target EV. A NOT CONFIRMED margin therefore produces solved cells.
  - `current-operating-margin` is a §3.8 named material fact (`spotCheck.ts:29`). It is queued and decided per run, so this case is reachable in production.
- **Reproduction 1: real run through the DB.** Probe `work-b/realPathProbe.test.ts`, output in `work-b/real-path-probe.txt`.
  - Setup: MSFT run. Every queued fact CONFIRMED except `current-operating-margin`, which is decided NOT CONFIRMED ("CONTRADICTED BY SOURCE").
  - The fact correctly reads `state=NOT CONFIRMED`.
  - These cells are still computed:
    - `current@0.08` = 0.16853 (17.6%)
    - `current@0.10` = 0.26650
    - `median@0.08` = 0.19518
    - `median@0.10` = 0.29587
    - `stress@0.08` = 0.26792
  - Each carries provenance `verif=SPOT-CHECK NOT REQUIRED`, so a contradicted input is presented as exempt and clean.
  - The current-margin / 8% cell is the Quick Read "main finding" and "what today's price requires" figure.
- **Reproduction 2: fixture-level perturbation sweep.** Probe `work-b/gatingProbe.test.ts`, output in `work-b/gating-probe.txt`.
  - Method: each SourcedValue input is multiplied by 1.37 and set to NOT CONFIRMED.
  - EV, debt, cash, shares, base revenue and RONIC inputs all gate correctly (0 leaks).
  - `reverseDcf.currentMargin` leaks 7 outputs: grid cells 0–1, plus `priceImplied.nopatGap.current`.
  - `reverseDcf.medianMargin` leaks 7 outputs: grid cells 3–4, plus `nopatGap.medianMargin`.
- **Test gap.** The PR's own `unconfirmedFactGating.test.ts` covers only total debt and base revenue, so it does not catch this.
- **Smallest fix.**
  - In `buildMarginLevelList`, issue current with `input.currentMargin.provenance`.
  - Issue median with `combineProvenance(currentProv, input.medianMargin.provenance)`, because median falls back to current.
  - Stress depends on current, so give it the same treatment.
  - In `assemble.ts`, gate `nopatGap` on its inputs' provenance.
  - Add a cascade test in `unconfirmedFactGating.test.ts` asserting that a NOT CONFIRMED `currentMargin` suppresses every current-margin cell.

### F2 (material): SCREEN still recomputes on view, and its verdict can disagree with the stored report it links to

- **Where.** `app/screen/verdictDisplay.ts:24`, called from `app/screen/page.tsx`.
- **Root cause.**
  - `screenVerdictDisplay` calls `computeAnalysisForRun(runId)`. That calls `loadGateState` with no pinned market, so `fetchMarketSnapshot` fetches a live price and the run is recomputed on every request.
  - Before AR3 the report did the same, so the two agreed.
  - After AR3 the report serves the stored output, valued at the run's pinned price, while SCREEN, which says it surfaces "the report's own state", values the same run at today's price.
  - This contradicts DO 5 ("viewing never recomputes") and the AR0-5 identity: the same run shows two verdicts.
- **Reproduction.** Same probe, test 3.
  - After the first `analysisForReport`, the stored output was set to a different price (300), standing in for "the market moved since the first view".
  - The report then shows `HOLD price=300`.
  - `screenVerdictDisplay` for the same run returns `SELL` ("price $499.7 is 1.6804× of the Base fair value $297.37"). It never read the stored row.
- **Smallest fix.**
  - Derive SCREEN's verdict from the stored output: `currentRunOutput(runId)`, or export and use `storedRunOutput`, which computes once, stores, and makes no model call.
  - Keep the `SpotCheckIncompleteError` branch.
  - Add a test asserting that SCREEN reads the stored row (same marking technique as `runOutputs.test.ts`).

## Independent recomputation (key numbers)

- **M7 grid on `MSFT_FIXTURE`** (own Python, `work-b/m7check.py`).
  - End-of-year timing reproduces the frozen 18.52% / 13.72% at current margin, 8%. This validates the model.
  - Mid-year timing gives 17.65% / 13.13%, matching the re-pinned Quick Read 17.6% / 13.1%.
  - Terminal shares come out at 112%, 117% and 131%, which agrees with the PR's "one cell leaves DEGENERATE" claim (the pattern is now 6 solved, 3 DEGENERATE).
- **Real MSFT base scenario** (own Python, `work-b/m15check.py`).
  - Inputs: revenue 331.839B; growth 0.14; margin 0.45; tax 0.19; reinvestment intensity 0.20 fading to terminal; terminal ROIC 0.11; r 10%; stub 66/365.25 = 0.18070.
  - Result: $297.37 per share, ratio 1.6804×, terminal share 0.651133. All match the engine's output exactly.
  - The terminal share is unchanged by the stub, as the PR claims.
  - The verdict stays SELL (above the 1.45× threshold).
- **Timing convention.** Year t's cash flow is discounted from t − 0.5 − stub, and the terminal value from 9.5 − stub. This matches AR0-3 ("mid-year timing, terminal at 9.5 years, valued at the price date"). The base is FISCAL YEAR ending 2026-06-30, which is correct for the capture: the TTM is not more recent than the 10-K.

## Test integrity and evaluator changes

- **AR2 REDs.** The four AR3 REDs in `knownReds.test.ts` are converted to plain `it`, and their MECHANISM tests are deleted, as the file's own doctrine requires.
- **Invariant changes.** The `valuationInvariants` identities gain the (1 + r)^0.5 factor. AR2 explicitly requested this evaluator change.
- **Approved-figure pins** ($214.26 / $283.31 / $402.73). These now go through `endOfYearScenarioPerShare`, which removes exactly the D2 timing factor. This is legitimate, because the factor is common to the whole M15 enterprise value; my recomputation confirms the mid-year values independently.
- **Sensitivity pins.** These are loosened from exact strings to 1e-15 relative tolerance, attributed to decimal.js fractional-power rounding. That is acceptable.
- **Snapshot and count changes.** The QuickRead snapshot re-pin and the suppression-count loosening (4 becomes "0 < n < 9") are justified by the timing change.
- **Reverse-DCF verification.** The golden test in `reverseDcf.test.ts` solves against a target scaled by √(1 + r), which is mathematically equivalent and keeps the frozen reference. The independent-verification test now derives the solved/DEGENERATE split from the independent solve. It remains independent.
- **Untouched evaluators.** No CI, workflow, frozen-hash or threshold file is touched.

## DONE WHEN / DO

| Item | Status | Evidence |
|---|---|---|
| DO 1 Timing: mid-year, terminal at 9.5, price date, TTM base, dated | MET | `valuationTiming.ts`; `reverseDcf.ts`, `scenarioOutputs.ts` use it; Section G "Valued at" row (`AnalyzerReport.tsx` ~1286); recomputed above |
| DO 2 Gating: a contradicted fact blocks every dependent output | **PARTIAL** | EV, base revenue and leverage gated (`figures.ts`, `companyInputs.ts:221`, `assemble.ts:384`); current and median margin leak (F1) |
| DO 3 Snapshot per run (facts, price, sheet, policy, code SHA, AR5 slots), 004 extended additively | MET | `migrations/011_analyzer_run_outputs.sql`; applied, then re-applied twice on the disposable DB without error |
| DO 4 Terminal share computed and reported every time | MET | `assemble.ts` M8 block; Section G row; real MSFT 65.11%, independently matched |
| DO 5 Report reads stored outputs; viewing never recomputes | **PARTIAL** | Report route and `analysisForReport` read the stored output (`runOutputs.test.ts`); SCREEN recomputes (F2) |
| Rerun with same snapshot gives identical outputs | MET | `runOutputs.test.ts` re-assembles the stored engine input to an identical result and verdict |
| AR2 timing / terminal-share / gating / reproducibility REDs GREEN | MET for the named REDs | `knownReds.test.ts:75-149` (the gating RED covers only EV; see F1) |
| `npx tsc --noEmit` | MET | exit 0 |
| `npm test` | MET (environment caveats) | 2580/2584 pass. 4 failures are Windows-environment only: `verdict.ts` hash under CRLF (the LF-normalised hash matches; the file is untouched by the PR); NVDA draft-reference test with backslash paths; `analyzerSurfacesOnRealRun` 5 s timeouts under load (18/18 pass when run alone) |

## Nits (not counted)

- **Fixture-only probe paths.**
  - Run-rate, `peBasis.gaapEps` and `fcf.sbc` still compute from NOT CONFIRMED inputs in the fixture probe.
  - On acquired runs, the run-rate inputs come from companyFacts quarters with clean provenance, so no fact decision reaches them.
- **Stored outputs and later code changes.**
  - Stored outputs are keyed only by the recorded-judgement fingerprint, so code changes after a run's first view (e.g. AR4) never reach that run's report.
  - This is consistent with "dated runs", but worth stating in AR4.
- **What later outputs pin.**
  - A later output of a run (after a new decision) pins only the first output's market data.
  - Facts are re-acquired, so a new filing in between could pair new facts with the old price. With a TTM end after the price date, the stub would fall back to 0.
- **Typed scenario values.** On a fixture with typed scenario dollar values (`MSFT_FIXTURE`), the terminal share comes from the drivers, not from the typed values shown.

## Housekeeping

- Probes ran from an untracked `repo-b/zz_review/`, which has been removed.
- Vitest rewrote one tracked `.snap` file's line endings during the suite; it was restored with `git checkout -- .`. The repo-b tree is clean apart from the pre-existing state.
