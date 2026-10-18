CORRECT: A1 and A2 are correct and independently verified, but there are three reproduced defects. A5's reopen path still calls the AI first and fails when that call refuses. A4 still shows OKLO's fixture $3/$31/$48 and an 85% price location on a real run. A3 wires a present-value numerator.

Reviewed: PR #426 head 15866a5dda3e47a24a10c233b8a7040f48d43598, against task contract #425 (HEAVY).
Environment: tsc --noEmit exits 0. The full vitest run gave 2395 passed and 3 failed. All 3 failures are Windows-environment artefacts that the PR did not cause:
- `m9RealCompanyValidationGuards`: the verdict.ts hash fails because the checkout has CRLF line endings.
- `nvdaAnalystDraftValidation`: the path checks fail on backslash path separators.
- `analyzerSevenTabsOnRealRun`: a 5 s timeout. It fails the same way on a reverse-applied base copy.

Reproduction tests were in work-b/repro/. I ran them from a temporary untracked folder in repo-b and then removed it. repo-b is clean. The base copy is work-b/base (the diff reverse-applied).

## Findings

### F1 — A5: reopening a pinned run still calls the AI first, and the run cannot open if that call returns nothing
- **Where:** `lib/analyzer/gate.ts:354` (`loadGateState` → `isSupportedTicker(run.ticker)`) and `gate.ts:70-71` (`analystInputsFor(ticker)` with no runId).
- **Root cause:** the PR passes `runId` only to the two `buildAcquiredRun` calls (gate.ts:389, 417). `loadGateState` first runs a ticker-only support check, and that check never reads the pin. Once the 15-minute cache has expired, or after a process restart, it goes the old way: it re-acquires the company and calls `aiProposedAnalystInputBundle` again. This is the silent re-proposal on reload that the contract forbids. If that fresh call returns null, `loadGateState` throws `RunNotFoundError`. That happens when the model refuses or fails twice, when no API key is configured, or in offline mode. So the pinned run cannot be reopened at all, even though its exact bundle is in `analyzer_run_ai_proposed_bundles`. This misses A5 ("can be faithfully re-opened … after cache expiry/process restart … do not re-call AI silently on reload") and VERIFY 4 ("no silent re-proposal").
- **Reproduction:** in both tests, NVDA's recorded bundle was removed so NVDA resolves as an AI-proposed ticker, and a bundle was pinned to a new NVDA run.
  - `zzReviewA5Offline.test.ts` printed:
    - `analystInputsFor(NVDA, runId) returns pin: true`
    - `loadGateState(runId) threw: RunNotFoundError: No run e2e26e27-…`
  - `zzReviewA5Online.test.ts` mocked an AI call that refuses after restart. It printed `pin read ok=true, proposal calls after pin read=0, isSupportedTicker=false, proposal calls after support check=1`. That is one fresh proposal call on reopen, and then a refusal.
  - The PR's own `analystInputsPinning.test.ts` calls `analystInputsFor(ticker, runId)` directly, so it never exercises this path.
- **Smallest fix:** in `loadGateState`, make the support check run-aware: `analystInputsFor(run.ticker, runId) !== null`. Better still, resolve the bundle once with runId and reuse it. Add a regression test that opens a pinned run through `loadGateState` or `computeAnalysisForRun` with no AI source available.

### F2 — A4: OKLO's real-run report still shows fixture constants as scenario values and a price location
- **Where:** `lib/analyzer/acquisition/analystInputs.ts` `okloBundle()`, which sets `scenarioValuesAreFixtureCarried: false`. The values render in `app/components/AnalyzerReport.tsx` Section G.
- **Root cause:** the contract names both MSFT and OKLO as fixture-carried. It requires the real-run "fair-value/price-location diagnostic" to show as not computed where the only evidence is fixture constants. The PR deliberately exempts OKLO and gives two reasons. Neither holds:
  1. *"only the 'display only' row is affected."* In fact the real OKLO report also shows "Location of current price within the scenario range **85%**". That figure is computed from OKLO_FIXTURE's 3.10/31/48.
  2. *"it would break the NaN round-trip through snapshot storage."* Not reproducible. I flipped the flag to `true` in a temporary patch and ran all the real-run and snapshot suites (90 tests). The only failure was one existing assertion in `step4SignalObservationOnRealRun.test.ts` that pins the fixture's own `3.10`, which is exactly the kind of re-pin the PR already made for MSFT. No snapshot or round-trip test failed.
- **Reproduction:** `zzReviewMisc.test.tsx` opened a real OKLO run and rendered `AnalyzerReport`. Section G shows `Bear / base / bull values $3 / $31 / $48`, `Scenario-weighted value $27` and `Location of current price within the scenario range 85%`. `result.scenarioOutputs.values` = 3.1/31/48 (OKLO_FIXTURE lines 353ff). The base copy renders the same thing, so the PR leaves it untouched.
- **Smallest fix:** set `scenarioValuesAreFixtureCarried: true` in `okloBundle()` and re-pin the OKLO `3.10` assertion in step4SignalObservationOnRealRun.test.ts. The PR's new NaN branch for `priceLocationWithinRange` (assemble.ts) and Section G's guard then show NOT COMPUTED. Also remove the unsupported justification comment.

### F3 — A3: the numerator wired in is a present value, so the multiple comes out on the wrong basis
- **Where:** `lib/analyzer/assemble.ts:468-473` passes `fixture.terminalValuePv` to `computeImpliedExitMultiple`. The new `assemble.test.ts` A3 test pins `terminalValuePv ÷ metric` as the correct value.
- **Root cause:** `terminalValuePv` is the *present value* of the terminal value. It is the input to terminal share (`computeTerminalDiagnostics(terminalValuePv, EV)`). An implied exit multiple divides the *undiscounted terminal value at the exit year* by that year's metric (FY36 EBIT). The repo's own worked example, `docs/analyst-drafts/nvda-step7-draft.md` (base case), gives "terminal value at year 10 … $3,472.1B" and "PV = … $1,338.7B". Its implied exit multiple is $3,472.1B ÷ $426.7B = **8.14×**. The PR's wiring returns PV ÷ EBIT₁₀ = **3.14×**, understated by the discount factor (1.10)^10. The contract required "the genuinely corresponding terminal valuation … compatible metric basis … verified against an independent worked example". The PR asserts PV is that figure, and its "independent" test only repeats the code's own division.
- **Today's display:** `terminalValuePv` is null on every real run and on both fixtures, so the result shows INCOMPLETE ("missing REQUIRED input(s): terminalValue, …"). What reaches the screen is honest today, but the code and its pinning test encode a wrong formula that will ship a wrong number as soon as a terminal PV is supplied.
- **Reproduction:** `zzReviewMisc.test.tsx` A3 case: `assembleAnalysisResult({...MSFT_FIXTURE, terminalValuePv: 1338.7, impliedExitMultipleMetric: 426.7})` returns 3.14. The documented value is 8.14.
- **Smallest fix:** pass `null` with a precise not-computed reason, e.g. "undiscounted terminal value at the exit year is not supplied by any approved path". Or add a separate undiscounted terminal-value field if one exists in the approved path. Replace the A3 test's expected value with a worked example built on the undiscounted terminal value.

## DONE WHEN / DO table

| Item | Status | Evidence |
|---|---|---|
| A1 TTM exact 12-month periods | MET | `history.ts:600-652` derives Q4 only from three contiguous quarters starting at the fiscal-year start. `companyInputs.ts:757-796` `ttmFrom` adds contiguity and a 350–380-day span guard. My Python oracle on the raw captures: MSFT FY2026 10-K total (2025-07-01→2026-06-30) = 331,839,000,000, and the real run's `runRate.ttm` = 331839000000 (base: 311898000000). NVDA Q3 FY26 57,006 + derived Q4 (215,938−147,811 = 68,127) + Q1 FY27 81,615 + Q2 FY27 96,221 = 302,969M, which matches the PR (the YTD route gives 302,970M; the 1M gap is filer rounding). OKLO stays null. TTM feeds only the run-rate display (`AnalyzerReport.tsx:788`, `slots.ts:357`), so no other base computation changed. |
| A2 EV multiples wiring | MET | `assemble.ts:373`. Real MSFT run: EV 3,716,234,881,852.7. EV/EBIT 23.9391 = EV ÷ FY2026 OperatingIncomeLoss 155,237,000,000, recomputed independently. EV/Revenue 11.1989 = EV ÷ 331,839,000,000. EV/EBITDA is still INCOMPLETE (ebitda null). On base both were suppressed. Provenance tokens match the EV bridge (PRIMARY / DETERMINISTIC / SPOT-CHECK NOT REQUIRED). |
| A3 implied exit-multiple numerator | PARTIAL | The current-EV numerator is removed and the screen shows INCOMPLETE, but the replacement is on the wrong basis (F3). |
| A4 real-run fixture values not shown as computed | PARTIAL | MSFT: Section G now shows NOT COMPUTED and the page contains none of $265/$510/$650/$475 (base: all four present). OKLO: fixture values and the 85% price location still render (F2). |
| A5 run-scoped reproducible AI bundle | NOT MET | The pin table, the write-once save and the resolver precedence are fine (migration 009, `aiProposedBundleSnapshot.ts`), but reopen still re-calls the AI and fails closed when that call returns null (F1). |
| A6 Methodology pointer | MET | One-line URL pointers only (AGENTS.md, docs/CURRENT-AUTHORITY.md). |
| Independent oracle / tests | PARTIAL | The A1 oracle is genuinely independent of the derivation function, but it shares the `quarterlySeries` and `annualSeries` readers. The A3 test is not independent (F3). The A5 tests skip the `loadGateState` path (F1). |
| tsc / targeted regression | MET (local) | `tsc --noEmit` exits 0. The full suite has 3 environment-only failures, all present on base too or caused by CRLF and Windows path separators. Exact-head CI was not available to me. |

## Test integrity / evaluator notes
- About 12 real-run tests were re-pinned from PARTIAL/range to UNUSABLE/suppressed. This is the direct consequence of A4 through the existing trust rule 1 and verdict precedence, so it is contract-justified, not a loosening.
- Some real-run coverage was lost:
  - The "Price is NOT CONFIRMED" trust-detail assertion (automaticAnalysisOnRealRun).
  - MSFT's profile-confirmation change case in snapshotComparisonOnRealRun, which now asserts `changed: []`.
  - Both are honestly explained, but no replacement real-run coverage was added.
- `snapshotComparison.ts` now treats NaN as equal to NaN. This is a small production change that a fully suppressed MSFT range needs. It is reasonable but out of the contract's literal scope.

## Nits (not counted)
- `ttmFrom` and `quarterlySeriesWithDerivedQ4` do not check that the annual and quarterly series resolved to the same XBRL tag. They agree for MSFT and NVDA, but a cross-tag Q4 is possible for other filers.
- `saveAiProposedBundleSnapshot` uses ON CONFLICT DO NOTHING but `analystInputsFor` returns its own `resolved` rather than re-reading the pin. Under a concurrent first open, the losing caller computes on a bundle other than the pinned one.
