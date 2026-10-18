ACCEPT: CF-LEG2-RATE-DOMAIN-COPY-01 at 2ae096d makes the rate-domain sentence three-way (PASS: none; measured >=10%: today's sentence; not measured: an unknown-domain sentence). RED reproduces on base, GREEN on head, NVDA's real gated run now prints the unknown-domain sentence, no number moves, tsc is clean, and the full suite is green apart from the two known Windows-only failures.

## Findings (material)

None.

### What I checked (evidence)

1. **RED on base, GREEN on head.** I reverse-applied the six non-test files of `pr.diff` and kept the PR's tests, then ran `rateDomainCopy.test.tsx` and `trustCopy.test.ts`. 7 tests fail, for the stated reason. For example, the trust line on an unmeasured run was `"Valued at 9.0% — … (rate dated 2026-10-17). Outside its validated domain: net debt is not below 10% of enterprise value."`. The report's Section E text showed the same false sentence for the MSFT fixture with `totalDebt: null`. On head, 66/66 pass across `rateDomainCopy.test.tsx`, `trustCopy.test.ts` and `ar4Engine.test.ts`. I restored the tree with `git checkout -- .`.
2. **Real data: NVDA's real gated run.** I used a temporary untracked probe, since deleted, that follows the same path as `nvdaRealRunObservation.test.ts`: createRun -> confirm spot-checks -> profile decision -> `computeAnalysisForRun`. Results:
   - Leverage is `LEVERAGE UNSUPPORTED IN v1` with `netDebtRatio: null`, and `validatedDomain` is `"NOT MEASURED"`.
   - The trust line and the rendered Section E both end in "Net debt could not be measured, so whether this rate is within its validated domain (net debt below 10% of enterprise value) is unknown."
   - The phrase "net debt is not below 10%" does not appear anywhere in the report.
   - The rate is still 11.0% (SIC 3674, cyclical band).
3. **Three-way mapping checked against the leverage source, independently.** In `lib/analyzer/gates.ts:151-196` (`evaluateLeverage`):
   - It returns `netDebtRatio: null` only when a REQUIRED input is missing, and then `result` is always `LEVERAGE UNSUPPORTED IN v1`.
   - Otherwise `result` is PASS exactly when the ratio is below `POLICY.leverageThreshold`.
   - So `rateDomainFromLeverage` (`discountRate.ts:83-86`) covers every reachable state: null -> NOT MEASURED, PASS -> WITHIN, measured non-PASS -> OUTSIDE.
   - There is no PASS-with-null state that could be mislabelled.
4. **No number changes (DO NOT).** In `selectDiscountRate`, only the domain field changed (`discountRate.ts:74`). Band, rate, check rates and row selection are untouched, and `evaluateLeverage` is not in the diff. Test `ar4Engine.test.ts:281-289` pins the rate at 0.09 in all three states, and the NVDA probe shows 11.0%.
5. **Consumers.** A repo-wide grep for `withinValidatedDomain|validatedDomain|leveragePass|rateInUseLine` finds only the PR's files. The domain sentence has exactly two producers:
   - `rateDomainSentence`/`rateInUseLine` in `trustCopy.ts:315-339`;
   - the Section E view at `AnalyzerReport.tsx:458-470`, plus the hero via `AnalyzerReportFrame.tsx:122`.

   Neither the AI slots (`ai/slots.ts:220-222`) nor the docs read the boolean.
6. **Stored results.** A result stored between AR4 and this fix carries only `withinValidatedDomain`. `rateDomainOf` (`discountRate.ts:96-103`) resolves it from the same run's `gates.leverage`, the value the boolean was originally derived from. The test `rateDomainCopy.test.tsx:153-186` exercises this through `toStorable`/`fromStorable`, and it would fail on a boolean-only implementation for the unmeasured case.
7. **Evaluator changes.** No CI, test config, frozen-hash or golden file is touched. The one existing assertion that changed (`ar4Engine.test.ts:276`) moves from `withinValidatedDomain === false` to `validatedDomain === "OUTSIDE"` for a measured-above input. That change follows from the type change the contract asks for and does not loosen the test.
8. **Wording.** The new sentence is a statement of fact (net debt was not measured, so the domain is unknown) and makes no methodology choice, so the contract's ESCALATE condition does not apply.

## DONE WHEN / DO / VERIFY

| Item | Status | Evidence |
|---|---|---|
| DO 1: RED test on an unmeasured run (report + trust copy) | MET | `app/components/rateDomainCopy.test.tsx:104-117`; fails on base (7 failures, reproduced), passes on head |
| DO 2: three-way domain state | MET | `lib/analyzer/types.ts:603-612` (`RateDomain`), `types.ts:625-631`; `discountRate.ts:74,83-103` |
| DO 2a: today's sentence only when measured >=10% | MET | `trustCopy.ts:315-320` (`OUTSIDE`); test `rateDomainCopy.test.tsx:126-132` |
| DO 2b: otherwise say net debt could not be measured, so domain unknown | MET | `trustCopy.ts:318-319`; exact-string test `trustCopy.test.ts:128-136`; NVDA real-run probe |
| DO 2c: update types.ts, both copy sites, consumers | MET | `types.ts`, `trustCopy.ts:327-339`, `AnalyzerReport.tsx:458-470,1159`, `AnalyzerReportFrame.tsx:122`, `assemble.ts:459` |
| DO 3: tests for all three states | MET | `rateDomainCopy.test.tsx:83-151`, `ar4Engine.test.ts:281-289`, `trustCopy.test.ts:123-136` |
| VERIFY: RED turns GREEN | MET | reproduced (base 7 fail -> head 66/66 pass) |
| VERIFY: PASS none / >=10% today's / unmeasured unknown | MET | tests above plus the NVDA real run |
| VERIFY: `npx tsc --noEmit` clean | MET | exit 0 on head |
| VERIFY: `npm test` green on head | MET (env caveat) | 2656 passed, 2 failed out of 2658. The 2 failures are the known Windows-only ones: the CRLF hash of verdict.ts (`m9RealCompanyValidationGuards`; the PR does not touch verdict.ts) and backslash paths in the draft-reference allow-list (`nvdaAnalystDraftValidation`; received `lib\\analyzer\\…`, `migrations\\008_…`) |
| DO NOT: change rate selection / D1 values / leverage computation / any number | MET | only the domain field changed; rate pinned across the three states; `gates.ts` not in the diff |
| DO NOT: touch PR #466 / #454 | MET | the diff touches only the 9 listed files |
| DONE WHEN: one PR open, CI green on exact head | NOT VERIFIABLE HERE | CI not provided (local suite green as above) |
| DONE WHEN: fresh independent REVIEW returns ACCEPT | MET | this review |
| DONE WHEN: PR merged | PENDING | comes after review |

## Nits (not counted)

- `rateDomainCopy.test.tsx:126` and `:134`: two test titles end "— trust copy, report and hero", but neither test asserts on `frameText`. The hero is covered separately at `:143-146`. The titles could drop "and hero".
- `rateDomainCopy.test.tsx:134-138`: the "unknown-domain sentence only" test asserts only that the measured sentence is absent, not that the unknown sentence is present. The RED block at `:104-117` already covers presence.
- Out of scope, noting for a follow-up: on an unmeasured run, the Quick read also says "What worries Calboard: A capital structure this levered can no longer be treated as a straightforward unlevered claim". That is the same false claim of leverage for a company whose net debt was never measured (seen in the MSFT `totalDebt: null` render and applicable to NVDA). It is not the discount-rate domain statement, so it is outside this contract.
- `rateInUseLine`'s `leverage` parameter is optional. A future caller that omits it on a pre-fix stored result gets no sentence (fail-quiet), which is safe but easy to miss.
