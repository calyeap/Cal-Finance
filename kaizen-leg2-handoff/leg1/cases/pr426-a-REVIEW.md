CORRECT: head 15866a5 — A5 is not met. Reopening a run still goes through `loadGateState`'s `isSupportedTicker(run.ticker)` check, which calls `analystInputsFor(ticker)` without the runId. Smallest fix: make that check aware of the run (pass `runId` through `isSupportedTicker` → `analystInputsFor`, or drop the pre-check and rely on `buildAcquiredRun`'s own `AnalystInputsUnavailableError`). Add a test showing a pinned run reopens with no model call. In the same correction, stop wiring `terminalValuePv` (a present value) as the A3 exit-multiple numerator.

Reviewed: exact head 15866a5dda3e47a24a10c233b8a7040f48d43598 against issue #425 (TIER: HEAVY, preserved). The PR body, BUILD report, CI and threads were not available, so I judged from the diff, the code and my own runs.

## Findings

### F1 (blocking): A5 — a pinned run cannot be reopened without a fresh model call, and fails to open if the model is unavailable
- **Where:** `lib/analyzer/gate.ts:354` (`loadGateState` → `isSupportedTicker(run.ticker)` → `analystInputsFor(ticker)`, with no runId); the pin read is in `lib/analyzer/acquisition/analystInputs.ts:245-248`.
- **Root cause:** the PR passes `runId` only to the two `buildAcquiredRun` calls. The support check runs before them, on every open. Every reopen path goes through it: `[runId]/page.tsx` → `advanceRunAutomatically` → `loadGateState`, plus the facts and profile pages and `computeAnalysisForRun`. That check resolves by ticker alone. Once the 15-minute ticker cache has expired, or after a restart, it skips the pin and goes to the live AI path.
  - If the model is available, every reopen makes a new paid proposal call. That is the "silent re-proposal" VERIFY 4 forbids, even though the inputs themselves stay pinned.
  - If the model is unavailable (offline, no key, refusal, acquisition failure), the check returns false and `loadGateState` throws `RunNotFoundError`. The pinned run cannot be opened at all, which defeats the point of A5.
- **Reproduction:** throwaway DB, offline mode. Test `work-a/zzReviewRepro.test.ts`, copied into `lib/analyzer` for the run and then removed:
  - Removed NVDA's recorded bundle so NVDA becomes an AI-proposed ticker, created an NVDA run and pinned a bundle with `saveAiProposedBundleSnapshot`.
  - `analystInputsFor("NVDA", runId)` returns the pin (`note: "pinned proposal"`).
  - `loadGateState(runId)` then throws `RunNotFoundError: No run 6cfa33e3-…`.
  - The PR's own `analystInputsPinning.test.ts` only calls `analystInputsFor(ticker, runId)` directly, so it never exercises the real reopen path.
- **Smallest fix:** make the gate's support check run-aware: `isSupportedTicker(ticker, runId?)` → `analystInputsFor(ticker, runId)`, with `loadGateState` passing `runId`. Alternatively, remove the pre-check and map `AnalystInputsUnavailableError` to `RunNotFoundError`. Add a regression test: a pinned run on a ticker with no committed or recorded bundle opens through `loadGateState` offline, and the AI resolver is not called.
- **Minor, same area:** under concurrent first opens, the losing `INSERT … ON CONFLICT DO NOTHING` caller returns its own `resolved`, not the stored pin. Re-reading the pin after saving would close this.

### F2 (in the same correction): A3 — the PR wires a present value as the exit-multiple numerator, and a test locks it in
- **Where:** `lib/analyzer/assemble.ts:468-473`; the test is `assemble.test.ts` "computes only from a real terminalValuePv…".
- **Root cause:** `terminalValuePv` is a present value. Its doc comment says "M8 needs a terminal PV", and `computeTerminalDiagnostics` divides it by today's EV to get terminal share. M9 divides by a terminal-year metric (`"FY36 EBIT"`).
  - The frozen methodology defines the implied exit multiple as the terminal value at the exit year divided by that year's metric. See `docs/frozen/calboard-valuation-methodology.md:376-378`, whose worked example has EV/EBIT going from 24.4× today to 10.8–12.5× in FY36.
  - A PV divided by FY36 EBIT understates that multiple by the discount factor (about 2× over 10 years at 8%).
  - The new test (`5000 / 140`) uses the same formula as the code, so it is not the independent worked example the contract asked for.
- **Impact today:** none visible. `terminalValuePv` is null on every fixture and every acquired run, so M9 shows INCOMPLETE everywhere. On the real MSFT run the cause reads `missing REQUIRED input(s): terminalValue, EV/EBIT (operating income)`. The wrong formula is waiting for the first producer of `terminalValuePv`.
- **Smallest fix:** pass `null` as the terminal-value argument and give a precise NOT COMPUTED cause, e.g. "no undiscounted exit-year terminal value is available on the approved path". Delete or rewrite the test that asserts `terminalValuePv / metric`. Do not add any new terminal-value methodology.

### F3 (should fix, or justify accurately): A4 skips OKLO, and the stated reason did not reproduce
- **Where:** `lib/analyzer/acquisition/analystInputs.ts`, `okloBundle()`, which sets `scenarioValuesAreFixtureCarried: false`.
- **Evidence:** on a real OKLO run, Section G still renders the validation fixture's bear/base/bull values of $3.10/$31/$48 and a weighted value of $27.37, with no disclosure. This happens even though the fair-value range is suppressed (LEVERAGE UNSUPPORTED IN v1).
  - The issue names OKLO next to MSFT as fixture-carried.
  - The code comment justifies skipping OKLO by a NaN round-trip break in JSON snapshot storage. I set OKLO's flag to `true` and ran 16 real-run, snapshot and route test files (153 tests). The only failure was `step4SignalObservationOnRealRun.test.ts`, which asserts OKLO's raw bear value equals the fixture's `3.10`. Snapshot comparison and storage tests all passed.
  - Per the issue, either extend A4 to OKLO (and update that assertion), or state the scoping decision accurately.

### F4 (minor): A1 returns "unavailable" without a cause
`ttmFrom` returns a bare `null` when the window is not contiguous or the span is wrong, and the UI just hides the TTM line. The contract asks for "unavailable with cause". Not blocking on its own.

## What was verified (good)
- **A1 TTM is correct.** I checked it against my own oracle that reads the raw XBRL captures (`work-a/oracle.js`), separate from the PR's code:
  - **MSFT:** the FY2026 10-K total is 331,839M. Q1–Q3 are 77,673 + 81,273 + 82,886 = 241,832M, which matches the 9-month YTD. Derived Q4 is 90,007M and TTM is 331,839M. The PR's naive baseline of 311,898M reproduces the bug.
  - **NVDA:** Q3 FY26 57,006 + derived Q4 68,127 (215,938 − 147,811) + Q1 FY27 81,615 + Q2 FY27 96,221 = 302,969M. The YTD cross-check gives 302,970M, a $1M rounding difference in the filed figures.
  - The naive 281,585M sum spanned 15 months; the fixed four quarters are contiguous over 363 days.
  - **OKLO:** TTM stays null.
  - The full pipeline gives `runRate.ttm` = 331839000000 for MSFT.
- **A2 EV multiples are correct.** On the real MSFT run:
  - The EV bridge is 3,722.54B + 40.294 + 66.594 − 76.843 − 36.348 = 3,716.23B.
  - EV/EBIT is 23.94×, and 3,716.23 / 155.237B FY2026 `OperatingIncomeLoss` checks out.
  - EV/Revenue is 11.20×, and 3,716.23 / 331.839 checks out.
  - EV/EBITDA stays INCOMPLETE, so no EBITDA is invented.
- **A4 for MSFT works.** Section G and the price location now show NOT COMPUTED with a cause naming the validation fixture, and $265/$510/$650 is no longer shown as a computed value.
- **A6** is a pointer-only change in `AGENTS.md` and `docs/CURRENT-AUTHORITY.md`.
- **Migration 009** is additive (a new table, `ON DELETE CASCADE`), and recovery is to drop the table. `npm run migrate` applied it cleanly on a fresh DB.
- **`npx tsc --noEmit`:** exit 0.
- **Full suite:** 2395 of 2398 pass. All three failures are this Windows checkout, not the PR:
  - The `verdict.ts` hash guard fails because of CRLF; the LF-normalised sha256 is `4c0fe5f6…`, as expected.
  - The NVDA-draft reference guard fails on `\` path separators.
  - The seven-tabs PASS-matrix test hit the 5s timeout under load; it passes alone with a longer timeout (4.3s).

## Changes to existing tests (consequential, listed separately)
Because of A4, MSFT real-run tests were changed:
- trust `PARTIAL` → `UNUSABLE`;
- fair-value range `range` → `suppressed`;
- verdict reason "growth comparator" → "scenario dollar values".

The assertion that the trust register names "Price is NOT CONFIRMED" was replaced. Rule 1 now fires first, so a contradicted price shows only on the fact row for MSFT. Each change is explained and follows from A4. None appears to hide a different regression. `ci.yml` and `FROZEN_HASHES` are untouched.

## Not in scope, noted only
The run-rate seasonality offsets (`quarterSourced(5/6/9/10)`) index filed quarters only. With Q4 never filed, they compare different fiscal quarters (MSFT `sameQuarterYear1` is Dec-2024 against a current Mar-2026). The PR's comment says these are "unaffected by design". This predates the PR and is outside A1's TTM scope, but the comment is inaccurate.
