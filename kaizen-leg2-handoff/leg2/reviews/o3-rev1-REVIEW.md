ACCEPT: at 1b8d9bb, a price or current operating margin decided NOT CONFIRMED now blocks every output that reads it on the real run. All-confirmed MSFT and OKLO outputs are byte-identical to base. I reproduced RED -> GREEN, and found no material defect.

# HEAVY REVIEW — CF-LEG2-DECIDED-FACT-GATING-01 (issue #481), head 1b8d9bb89fbe909572bade0ab856db011b573a61

## Findings (material)

None reproduced.

### What I verified, and how

1. **Base reconstructed and RED reproduced.**
   - Setup: a copy at `RDIR\base` with the PR's three source hunks reverse-applied, `git apply -R` on `companyInputs.ts`, `assemble.ts` and `steadyStateEvPvgo.ts`. The tests are kept at head.
   - Base `companyInputs.ts:414` and `:466` carry `provenance: CLEAN_PROVENANCE`, which matches the issue's evidence lines.
   - Running `npx vitest run decidedFactGatingOnRealRun unconfirmedFactGating automaticAnalysisOnRealRun` on the test DB gives **9 failed | 39 passed (48)** at base. Each failure matches the PR body's list and reason:
     - "expected false to be true": the price input is still clean.
     - "expected [ …(11) ] to deeply equal []": 11 dependents are not blocked.
     - The verdict is ISSUED.
     - `nopatGap` is `{current: 124.3008…}`.
     - Price location is 0.6366…
   - At head: **48 passed (48)**.
2. **My own real-run probe, written independently of the PR's helpers.** It ran on both base and head, through the production path (`computeRunOutput`) and the stated-D2 path, for MSFT and OKLO, deciding each queued fact NOT CONFIRMED in turn.
   - **Queues.** MSFT is `[price, current-operating-margin]`; OKLO is `[price]`. This matches the PR's claim, and the PR test pins the MSFT queue.
   - **All-confirmed byte identity (DO 3).** I diffed the normalised JSON (UUIDs, codeVersion and wall-clock retrievalTimestamp removed) of the result and fixture on the production path, and the stated result, for both MSFT and OKLO. All six files are **identical** between base and head, including `inputsFingerprint`.
   - **MSFT, price NOT CONFIRMED, at head.** Compared with the all-confirmed run, these change:
     - enterprise value: INCOMPLETE with `NOT_CONFIRMED_INPUT_CAUSE`;
     - the leverage ratio and result (fails closed);
     - EV/EBIT, EV/revenue and FCF yield;
     - steady-state EV, PVGO and PVGO share;
     - `nopatGap`;
     - the reverse DCF (all 3 figures);
     - the fair-value range (suppressed);
     - price location and the rate at which the Base equals the price;
     - trust (UNUSABLE);
     - `baseAtCheckRates`.

     The current-price display binding is INCOMPLETE with `PRICE_NOT_CONFIRMED_CAUSE`, so `slots.ts:205` suppresses the price slot. Nothing else changes. At base, none of these change. The contradicted value 499.7 survives only in `price.value` (the §3.4 sentinel, now suppressed by its binding), the fact row and `runIdentity.priceSnapshot` (a record, not a computation).
   - **OKLO, price NOT CONFIRMED, at head.** Price location, the current price and "success as the price requires" are INCOMPLETE with the new cause. The range is suppressed and trust is UNUSABLE.
   - **MSFT, current-operating-margin NOT CONFIRMED, at head.** The only changed outputs are `priceImplied.nopatGap` (now null), `trust.determinedBy` and the fingerprint and fact snapshot. EV, the range, the reverse DCF and the other figures that do not read the margin stay equal.
3. **Numbers recomputed by hand (Decimal), MSFT all-confirmed.**
   - Current NOPAT: base revenue 331,839,000,000 × current margin 0.46780818408927220731 × (1 − 0.19) = **125,741,970,000**. This equals the engine's `nopatGap.current`.
   - Median-margin NOPAT: 331.839B × 0.415948788729713 × 0.81 = **111,802,704,383.656…**, which equals the engine.
   - The current-operating-margin fact equals operating income / revenue from the fact rows exactly.
   - EV: market cap 3,722,537,881,852.7 + debt 40.294B + finance leases 66.594B − cash 76.843B − non-op 36.348B = **3,716,234,881,852.7**, which equals the engine. Market cap / 499.7 ≈ 7.45B diluted shares, plausible for MSFT.
4. **Scope and DO NOT.**
   - Only 3 source files and 3 test files are touched. There are no migrations, and `verdict.ts`, `FROZEN_HASHES`, CI, thresholds and rule values are unchanged.
   - `priceDate` and the valuation timing are unchanged (asserted at fixture level, and the probe's all-confirmed identity holds).
5. **Evaluator change** (`automaticAnalysisOnRealRun.test.ts:465-477`).
   - The old assertion (trust PARTIAL, with the range rendered on a cross-check-failed price) encoded the very defect the contract fixes.
   - The new assertion is stricter: EV is INCOMPLETE with the named cause and trust is UNUSABLE.
   - Rule-2 coverage on a real run moved to the margin case (`decidedFactGatingOnRealRun.test.ts:424-428`).
   - The change is justified by the contract outcome, and it is not a loosening.
6. **Test integrity.**
   - The new real-run test fails at base for the stated reasons, and its dependent checks read outputs, not production logic.
   - Its "independent" sets are compared with the all-confirmed run.
   - The queue pin fails the suite if the queue grows.
7. **Checks at head** (test DB `leg2_o3_rev1_test`):
   - `npm run migrate`: OK.
   - `npx tsc --noEmit`: exit 0.
   - Full `npx vitest run`: **2 failed | 2677 passed (2679)**, 222/224 files. The two failures are the known environment-only ones: the `m9RealCompanyValidationGuards` verdict.ts CRLF hash, and the `nvdaAnalystDraftValidation` backslash-path allow-list.
   - The AR2 harness is green: ar4Engine 34, goldenFacts 58, valuationInvariants 16, knownReds 12, tagDrift 5.

## DONE WHEN / DO / VERIFY

| Item | Status | Evidence |
|---|---|---|
| DO 1: DB-backed real-run RED, each queued fact decided NOT CONFIRMED in turn; dependents suppressed; no verdict | MET | `lib/analyzer/decidedFactGatingOnRealRun.test.ts:355-441`. It covers both MSFT queued facts (queue pinned at :372-375). It fails 4 tests at base and passes at head. OKLO's only queued fact (price) I checked by probe: range suppressed, verdict-blocking trust UNUSABLE. |
| DO 2: carry decided provenance into every input built from it, via existing seams | MET | `companyInputs.ts:390-391` uses `tokensOf(byId.get("price"))`. It is used at `:429` and `:481`, and in market cap at `:511-515` through `combineProvenance`. The bare reads are withheld at `assemble.ts:725-727`, `:1160`, `:1298-1304`, and the NOPAT gap at `steadyStateEvPvgo.ts:455-461`. |
| DO 3: all-confirmed outputs byte-identical | MET | My probe gives 6/6 normalised files identical, base vs head (MSFT and OKLO; production path and stated). |
| VERIFY: RED -> GREEN for the reported reason | MET | Base 9 failed / 39 passed; head 48/48. The failure messages match the defect. |
| VERIFY: non-dependents stay computed | MET | The probe's field-level diff lists only dependents (item 2 above). The test checks this at `:413-415`. |
| VERIFY: AR2 harness green | MET | `lib/analyzer/golden/*`: 5 files, 125 tests passing. |
| VERIFY: `tsc --noEmit` clean | MET | Exit 0. |
| VERIFY: `npm test` green on the exact head | MET (local) | 2677 passed. The only 2 failures are the documented Windows environment ones. CI was not reported to me. |
| DONE WHEN: one PR open | MET (given) | The PR body is supplied. |
| DONE WHEN: fresh HEAVY REVIEW ACCEPT with CI green | ACCEPT here; CI not observed | This review. |
| DONE WHEN: PR merged | PENDING | Post-review. |
| DO NOT: rules, timing, D1–D4, thresholds, migrations, #466/#454 | MET | No such files appear in the diff. Timing is unchanged. |

## Nits (not counted)

1. **Margin-half authority is cited loosely.** The PR body says the margin dependents were "read against §4.2's map (requiredInputs.ts)". But §4.2 (spec line 389; `requiredInputs.ts:117,158`) still lists "margin levels", aliased to `current-operating-margin`, as REQUIRED for the reverse DCF. The authority that removes that dependency is AR0-2 (§14.9, spec line 1700: one solve, with "margin move to sensitivity"). The stale §4.2 row and map entry predate this PR, and `evaluateCompleteness` is used only by `scripts/analyzer/acquire-run.ts`. The PR body should cite AR0-2; the map itself could be reconciled in a later docs or spec pass.
2. **Trigger A still reads the contradicted number.** On the margin-NOT-CONFIRMED run, Trigger A, and with it the "MARGIN AT HISTORICAL HIGH" qualifying flag, still fires on `current margin 0.4678081840892722`. That is numerically the contradicted fact's value, read from the companyFacts margin series rather than from the fact. Per §4.2, triggers A/B depend on "operating-margin-history", a separate input, so this is not a dependent under the contract. If Calvin wants a contradicted current margin to also void the series' current year, that is a separate methodology question. The same applies to MSFT's hand-typed 46.8% sensitivity anchor (`analystInputs.ts:115-124`, CALVIN RULING A, typed and not read from the fact).
3. **Some blocked checks lack an all-confirmed baseline.** The precondition test (`decidedFactGatingOnRealRun.test.ts:377-390`) does not assert that EV/EBIT, EV/revenue, PVGO and price location are computed in the all-confirmed run. My diff shows they are, so the "blocked" checks are not vacuous; the test would still be stronger with those asserts.
4. **Margin-case verdict.** For the margin case, "no verdict" holds only because the close-call answer is bound to the all-confirmed fingerprint. The PR body discloses this honestly; `verdict.ts` does not read the margin.
5. **Fallback scenario values on the stated path.** With price NOT CONFIRMED, `scenarioOutputs.values` falls back to the recorded typed figures (214.26 / 283.31 / 402.73) while the range is suppressed and the verdict is INCOMPLETE. This is the pre-existing "EV bridge INCOMPLETE" fallback, the same as on a priceless run. It is not presented as a range.
6. **Pending price provenance.** An undecided price now carries SPOT-CHECK PENDING instead of CLEAN. This is more honest, and `computeRunOutput` refuses an incomplete queue anyway.
7. **Environment: snapshot line endings.** On this Windows checkout the full run rewrote `app/components/__snapshots__/QuickReadEvidenceUnchanged.test.tsx.snap` from CRLF to LF, a whitespace-only change. I restored it with `git checkout`, and the repo tree is clean.
