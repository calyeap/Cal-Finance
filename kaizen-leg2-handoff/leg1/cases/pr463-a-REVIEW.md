CORRECT: head cea1b495 — DO 2 gating does not hold on the real production path. On a real MSFT run, deciding either of its two queued facts (`price`, `current-operating-margin`) NOT CONFIRMED / CONTRADICTED BY SOURCE changes no output at all: EV, the fair-value range, every reverse-DCF cell and the SELL verdict all come out identical to the run where everything is confirmed. Smallest fix: carry the price fact's and the current-margin fact's verification state into the inputs computed from them (companyInputs.ts price inputs; reverseDcf.ts buildMarginLevelList), and add a real-run test that decides each queued fact NOT CONFIRMED. Same correction: app/screen/verdictDisplay.ts still recomputes on every view at the live price, so SCREEN can show a different verdict from the stored report (finding 2).

Tier: HEAVY (as set by issue #451). Reviewed exact head cea1b495235630fd267f40e429095ca80a5e2541.

## Verification run (throwaway DB pr463a_test)
- `npm run migrate`: 011 applies cleanly, and a second run is a no-op ("All 11 migration(s) already applied"). The migration is additive: one new table plus nullable `ADD COLUMN IF NOT EXISTS`.
- `npx tsc --noEmit`: exit 0.
- `npx vitest run` (full suite): 2580 passed, 4 failed. All 4 failures come from this environment, not from the PR:
  - The `verdict.ts` hash guard fails because the file is CRLF on this checkout. Stripping CR gives exactly the expected hash `3221c6ac…`, and verdict.ts is not in the diff.
  - The NVDA draft-reference guard fails because Windows paths use backslashes, so its allow-list does not match.
  - Two first-test 5s timeouts (analyzerSurfacesOnRealRun, nonOperatingJudgmentRecordedOnRealRun) happened under full-suite load. Both files pass when run alone (20/20).
- The AR2 REDs for timing, terminal share, unconfirmed facts and run identity are now plain `it`s and pass, with their MECHANISM tests deleted. The rerun proof is in runOutputs.test.ts: re-assembling the stored engine input gives an identical result and verdict. Evaluator changes are labelled in the diff: the zero-growth/Gordon invariants gain the (1+r)^0.5 factor, the frozen golden grid is solved against a rate-scaled target, the QuickRead snapshot moves 13.7/18.5 → 13.1/17.6, and the approved per-share pins are asserted with the timing factor removed. I accept these as correctness consequences of D2, not loosening.

## Finding 1 (blocking): contradicted facts on a real run block nothing (DO 2, DONE WHEN "gating RED GREEN")
- **Where:**
  - `lib/analyzer/acquisition/companyInputs.ts` ~L403 and ~L437: `price: track("price", … { value: price.value, provenance: CLEAN_PROVENANCE })`. The market price is always passed with CLEAN provenance, whatever state the run gave the `price` fact. `fixture.price` and the verdict read it the same way.
  - `lib/analyzer/modules/reverseDcf.ts` `buildMarginLevelList`: it reads `input.currentMargin.value` bare and issues `computedValue(resolved.current, CLEAN_PROVENANCE)` and `computedValue(resolved.median, CLEAN_PROVENANCE)`. The current-margin fact's NOT CONFIRMED token is dropped, so `computedValue`'s new gate never sees it.
- **Root cause:** the gate added in `figures.ts computedValue` only fires when the input provenance actually reaches it. The commit's claim that "every M1–M16 module issues its figures through here with combineProvenance of the inputs it actually used" is false for these two inputs. The PR's own gating tests (`unconfirmedFactGating.test.ts`, knownReds) set NOT CONFIRMED by hand on fixture `totalDebt` / `baseYearRevenue`. On a real acquired run those are SPOT-CHECK NOT REQUIRED and are never queued, so the facts a person or the auto-verifier can actually contradict were never tested.
- **Reproduction:** a temporary probe in the repo, since deleted. It created a real MSFT run, recorded the NON-OPERATING ruling, decided one queued fact `NOT CONFIRMED` / `CONTRADICTED BY SOURCE` and the rest CONFIRMED, then called `computeAnalysisForRun`:
  ```
  baseline (all CONFIRMED):           ev ok, range, base 297.37, rDCF solved 5/9, verdict SELL
  price NOT CONFIRMED:                ev ok, range, base 297.37, rDCF solved 5/9, verdict SELL  (priceFact: NOT CONFIRMED)
  current-operating-margin NOT CONF.: ev ok, range, base 297.37, rDCF solved 5/9, verdict SELL  (marginFact: NOT CONFIRMED)
  ```
  The cell values were identical across all three, e.g. current@8% = 0.1685, carrying "SPOT-CHECK NOT REQUIRED" provenance. `price` is a REQUIRED input of enterprise value (requiredInputs.ts OUTPUT_GROUPS), and the current margin is a REQUIRED input of the reverse DCF ("margin-levels" → current-operating-margin).
- **Smallest fix:**
  - (a) In companyInputs.ts, pass the `price` fact's own provenance into the three price inputs (`byId.get("price")`, the same way `get()` does), or withhold the price as `raw()` now does for a NOT CONFIRMED fact. Then EV, multiples, the reverse-DCF target, the scenario bridge and the verdict fail closed.
  - (b) In reverseDcf.ts `buildMarginLevelList`, issue the current/median margin figures with `combineProvenance(input.currentMargin.provenance, input.medianMargin?.provenance …)` instead of `CLEAN_PROVENANCE`.
  - (c) Add a DB-backed real-run test that decides each queued fact NOT CONFIRMED and asserts that its dependents (per `dependentsOf`) are suppressed and the verdict is not issued.

## Finding 2 (blocking, same correction): SCREEN still recomputes on view and can contradict the stored report (DO 5)
- **Where:** `app/screen/verdictDisplay.ts` → `computeAnalysisForRun(runId)`. This re-acquires the facts and fetches the live price on every SCREEN render. SCREEN's own header says it surfaces "the report's own state honestly".
- **Root cause:** only the report route moved to stored outputs (`currentRunOutput` / `storedRunOutput`). The other view of the same run still recomputes.
- **Reproduction (probe):**
  1. View the report once. `analysisForReport` stored SELL at $499.70.
  2. Change the captured close to $250, which simulates the market moving.
  3. The report re-view still returned the stored SELL at $499.70 (`storedExists: true`).
  4. `screenVerdictDisplay(runId)` in the same state returned `INCOMPLETE — price $250 is 0.8314× of the Base fair value $300.69…`.

  So one run shows two different verdicts, depending on which page is opened.
- **Smallest fix:** have `screenVerdictDisplay` read `currentRunOutput(runId)` and derive the verdict from the stored result. Where no stored output exists yet, keep today's gated path. Add a test like the probe above.

## Notes (non-blocking)
- **Fact snapshot not pinned across outputs of the same run.** When a judgement changes, `storedRunOutput` reuses the run's first market snapshot (`getRunMarketSnapshot`) but re-acquires the facts. The acquisition cache is in-memory with a 15-minute TTL, so after that it fetches fresh EDGAR data. A later output can therefore combine newer facts with the older pinned price: a newer TTM end than the price date gives stub 0, and earlier fact decisions keyed by id get applied to new values. Each stored row is internally consistent and reproducible, which is what the AR0-5 tuple requires. Still, the OUTCOME's "immutable fact … snapshot per run" would be better served by reusing the stored fact snapshot or acquisition the way the market data is reused (the expected file list names `acquisition/provider.ts`, which the PR does not touch). Worth doing in the same correction if it stays small; otherwise record it as an AI DEFAULT receipt.
- **Timing.** The (1+r)^stub roll-forward does not remove cash already received between the base period end and the price date. This is disclosed in valuationTiming.ts and reported as `runIdentity.valuationTiming`. It is acceptable under D2 as written.
- **Code version.** `codeVersion()` shells out to `git`. Outside a git checkout it records "UNKNOWN" unless `CAL_FINANCE_CODE_VERSION` is set, and `.env.example` does not document that variable.
- **Recovery path.** No PR body was available. The migration header states that the change is additive, idempotent and safe to leave applied after a code revert, which matches the contract's recovery text.
