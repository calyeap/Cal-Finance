ACCEPT: the rate-domain statement is now three-way (WITHIN / OUTSIDE / NOT MEASURED). I reproduced RED to GREEN, checked NVDA's real gated run before and after, and found no change to any number. No material defect found.

Reviewed head: 2ae096d3294753a8ca2fa6fe6cbf56cc16f5adb9 (contract #479, CF-LEG2-RATE-DOMAIN-COPY-01).

## Findings

There are no material findings. These are the checks I ran myself, with the evidence for each.

1. **The mapping is correct across every leverage state.** `lib/analyzer/gates.ts:151-196` `evaluateLeverage` returns `netDebtRatio: null` only when a required input is missing. Whenever the ratio is not null, `result` is exactly `ratio < POLICY.leverageThreshold ? PASS : UNSUPPORTED`. So `rateDomainFromLeverage` (`lib/analyzer/discountRate.ts:83-86`) can map null to NOT MEASURED and non-null non-PASS to OUTSIDE. OUTSIDE ("net debt is not below 10%") is printed only when a ratio at or above 10% was actually measured. No state is missing and none overlaps.
2. **RED to GREEN, reproduced on my own base build.** I built the base by reverse-applying `pr.diff` to a copy, keeping the new test. `npx vitest run app/components/rateDomainCopy.test.tsx` gives **4 failed | 9 passed (13)** on base. The 4 failures are the PR's 4 named RED tests, each with the stated assertion (for example `expected 'Valued at 9.0% …' not to match /net debt is not below 10%/`). On head it gives **13 passed**.
3. **NVDA's real gated run, with my own probe.** The probe runs `createRun`, clears the spot-check queue, records the profile, then runs `computeAnalysisForRun`, on the migrated test DB. It was not committed and has been removed.
   - The leverage inputs are: totalDebt 33,366,000,000; financeLeaseLiabilities null; cash 22,443,000,000; enterpriseValue null. That gives `LEVERAGE UNSUPPORTED IN v1` with `netDebtRatio` null.
   - Base: `withinValidatedDomain=false`. Both the trust line and Section E say "… Outside its validated domain: net debt is not below 10% of enterprise value." This is the defect.
   - Head: `validatedDomain="NOT MEASURED"`. Both the trust line and Section E say "… Net debt could not be measured, so whether this rate is within its validated domain (net debt below 10% of enterprise value) is unknown."
   - The rate is 0.11 (cyclical, SIC 3674) on both base and head. No number moved.
4. **No number changes (DO NOT).** The only engine change is that the domain field is now derived from the leverage result. Rate selection, `checkRates`, D1 rows and `evaluateLeverage` are byte-unchanged in the diff. `verdict.ts` is not touched.
5. **Pre-fix stored results.** `rateDomainOf` (`discountRate.ts:96-103`) works out the domain from the same run's `gates.leverage`, the source the old boolean was set from. Every render site passes it (`AnalyzerReport.tsx:1159`, `AnalyzerReportFrame.tsx:122`). The stored-boolean tests cover all three states through `toStorable`/`fromStorable`. With no leverage result at all, the fallback states nothing rather than guess, which is conservative. No other consumer of `withinValidatedDomain` or `leveragePass` remains (grep across app/lib/scripts). `snapshotComparison.ts` does not compare `valuationBasis`.
6. **Test integrity.**
   - Every changed existing test (`ar4Engine.test.ts`, `trustCopy.test.ts`) changes shape only. The former `leveragePass:false` case now uses a measured 25% ratio and asserts `"OUTSIDE"`, which is the same intent made stricter. Its check-point assertions are unchanged.
   - No test was deleted, skipped or loosened. There are no CI, config, frozen-hash or golden-file changes.
   - The new tests would fail on wrong mappings: the `it.each` over three states covers the mapping, the exact-string NOT MEASURED test covers the wording, and the stored-boolean tests cover the legacy path.
7. **Suite and typecheck at head.**
   - `npx tsc --noEmit` is clean.
   - Targeted run (rateDomainCopy, trustCopy, ar4Engine, preAr4StoredOutput, nvdaRealRunObservation, acceptanceGateOnRealRun): 6 files, 90 passed.
   - Full `npx vitest run`: 2656 of 2658 passed. The 2 failures are the known Windows environment-only ones:
     - `m9RealCompanyValidationGuards`: the CRLF hash of verdict.ts.
     - `nvdaAnalystDraftValidation`: the backslash paths `lib\\analyzer\\nvdaRealRunObservation.test.ts` and `migrations\\008_…`.
   - CI is reported green on the exact head.
8. **Escalation.** None is needed. The new sentence is a factual statement of what is known, and the contract does not reserve the wording as a methodology call.

## DONE WHEN / DO / VERIFY

| Item | Status | Evidence |
|---|---|---|
| DO 1: RED test on an unmeasured-leverage run (report and trust copy) | MET | `app/components/rateDomainCopy.test.tsx` "RED —" block. On my base build it is 4 failed / 9 passed. |
| DO 2: three-way domain state | MET | `lib/analyzer/types.ts` `RateDomain`, `DiscountRateInUse.validatedDomain`; `discountRate.ts:74,83-103` |
| DO 2: today's sentence only when measured at or above 10% | MET | `trustCopy.ts:315-320` OUTSIDE sentence. `ar4Engine.test.ts` it.each. The NVDA probe shows it no longer appears on an unmeasured run. |
| DO 2: otherwise state that net debt could not be measured, so the domain is unknown | MET | `trustCopy.ts:318-319`; the exact-string test in `trustCopy.test.ts` |
| DO 2: update types.ts, both copy sites and consumers | MET | `types.ts`, `trustCopy.ts:327-338`, `AnalyzerReport.tsx:458-470,1159`, `AnalyzerReportFrame.tsx:122`, `assemble.ts:459`. Grep shows no remaining consumers. |
| DO 3: tests for all three states | MET | `rateDomainCopy.test.tsx` (fresh and stored, trust copy and report), `ar4Engine.test.ts` it.each |
| VERIFY: RED turns GREEN | MET | base 4 failed / 9 passed; head 13 / 13 |
| VERIFY: PASS shows none, measured ≥10% shows today's, unmeasured shows unknown | MET | tests above; NVDA real-run probe before and after |
| VERIFY: `npx tsc --noEmit` clean | MET | my run at head, exit 0 |
| VERIFY: `npm test` green on the exact head | MET | CI reported green. Locally only the 2 known Windows environment-only failures. |
| DO NOT: change rate selection, D1, leverage computation or any number | MET | diff inspection; NVDA rate 0.11 on base and head; the test asserts the rate is identical across states |
| DO NOT: touch PR #466 / #454 | MET | the diff is limited to the 9 files listed, none of them AR6 |
| DONE WHEN: one PR open with CI green on the exact head | MET | as reported (supplement) |
| DONE WHEN: fresh independent REVIEW returns ACCEPT | MET | this review |
| DONE WHEN: PR merged | PENDING | done after this review; not a builder defect |

## Nits (not counted)
- `rateDomainCopy.test.tsx`, test "not measured shows the unknown-domain sentence only — trust copy, report and hero": the title promises a positive check and a hero check, but the test only asserts that the OUTSIDE sentence is absent. The positive check is covered by the RED block and the stored-result block, so this is title overreach only.
- The hero assertions on the two non-PASS states pass trivially, because the hero shows no rate there. The test comment says so openly.
- Reviewer housekeeping:
  - `RDIR\base` is my reverse-applied base copy. Its `node_modules` is a junction to `repo\node_modules`, so delete the junction with `rmdir`, not a recursive delete.
  - A full vitest run rewrites `QuickReadEvidenceUnchanged.test.tsx.snap` line endings on this Windows checkout. I restored it, and the repo is clean.
