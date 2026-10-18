CORRECT: the new recorded-bundle → M15 path gets MSFT's per-share scale wrong by a factor of 10^6 (or 10^9, depending on unit), and the PR's own test pins that wrong value as "a genuine fair-value range"

Review of PR for issue #433 (CF-ANALYZER-REAL-VALUATION-UNBLOCK-01), head e36642d3f1386766748eb3bd30749245e4c5c47f, HEAVY tier.
Environment: throwaway DB pr434b_test, `npm run migrate` OK, `npx tsc --noEmit` exit 0, new test file 4/4 pass. Full suite: see the last section.

## Findings (material)

### F1. Per-share scale: an MSFT recorded bundle values MSFT at $220,885,392.83 to $445,839,150.50 per share, and the test asserts it
- **Where:** `lib/analyzer/assemble.ts` lines 633-667 (`dynamicScenarioValue`, which divides by `driver.shareCount`). The PR newly routes recorded bundles into it at lines 694-716, via `recordedScenarioValuesComputeFromDrivers` set in `lib/analyzer/acquisition/recordedBundles.ts:341`. The test is `lib/analyzer/acquisition/msftRealValuationUnblock.test.ts` (TEST_INPUT `shareCount: "7430"`, and the "independent recomputation" block).
- **Root cause:** in a real run, base revenue and the EV bridge are in raw USD (MSFT run: baseYearRevenue 331,839,000,000; EV 3,716,234,881,852.7; marketCap 3,722,537,881,852.7). Before this PR, only the AI-proposed path fed `dynamicScenarioValue`, and it converts its share multiple to an absolute raw count (`aiProposedBundle.ts:156-163`). The recorded store has no unit contract for `shareCount`: the form label just says "Share count — required" (`app/components/AnalystBundleForm.tsx:48`). Its one approved row, NVDA's migration 008 seed, uses billions (`"shareCount": "24.1"`). The PR feeds that analyst-typed, unit-less number straight into a raw-USD division. It adds no normalisation, no check against the run's SEC `sharesOutstanding`, and no plausibility guard.
- **Reproduction:** probe `work-b/zzprobe434.test.ts`. It ran in repo-b and was then removed. It does a real offline MSFT run, records a bundle, and calls `computeAnalysisForRun`.
  - With shareCount `7430` (the PR's TEST_INPUT): fairValueRange is a `range`, bear **220885392.83**, base **302565354.31**, bull **445839150.50**. Trust is PARTIAL, not UNUSABLE, so the result is presented as usable.
  - With `7.43` (NVDA seed's billions convention): bear **220,885,392,834.36**, base 302,565,354,307.19, bull 445,839,150,504.51.
  - Only a raw count (`7430000000`) gives sane values: 220.89 / 302.57 / 445.84. The real share price on that run is $499.70.
  - I recomputed this independently in my own Python (`work-b/recompute.py`), not the repo's helpers. M15 formula, 10% rate, 3% terminal growth, r+3pp terminal ROIC, bridge EV−mc = −$6.303B. It matches the engine to the cent at each share scale. So the formula and bridge are right and only the per-share scale is wrong.
  - The PR test passes because its "independent recomputation" is not independent. It calls the same `computeScenarioEnterpriseValue` with the same `netDebtBridge` and the same `shareCount`, so it repeats the error. It then asserts `result.fairValueRange.bear === expectedPerShare(...)`, which is $220,885,392.83/share, and describes that as "a genuine fair-value range from real SEC facts".
- **Same root cause, latent NVDA regression:** NVDA's approved recorded bundle has all drivers authored, so the PR sets the flag true for it. It falls back to the typed $28.08/$102.38/$296.44 only because NVDA's EV bridge is currently INCOMPLETE. Probe `work-b/zzprobe434b.test.ts` fills NVDA's four missing EV inputs and calls `assembleAnalysisResult`. scenarioOutputs then become **$28,817,662,868 / $107,335,145,621 / $274,979,944,806 per share**. With the flag forced false they are $28.08/$102.38/$296.44. So the moment NVDA's bridge completes, its approved figures are silently replaced by values a billion times too large.
- **Smallest fix:** in `dynamicScenarioValue`, when the source is a recorded bundle, make the share count share the bridge's unit before dividing. Either:
  - (a) fail closed (NaN plus a `scenarioValuesMissing` cause) unless `driver.shareCount` is within a sane factor (for example 0.5x to 3x, the AI path's own band) of the run's SEC `enterpriseValue.sharesOutstanding`; or
  - (b) declare and validate one unit for recorded `shareCount` in `recordAnalystBundle`/the form, and convert it.

  Then fix the test. Use a realistic raw share count, and assert an absolute plausibility bound that is not taken from production code (for example 0.1x to 10x of the run's price). Add a case asserting that a mis-scaled share count fails closed.

### F2. No explicit computed-vs-input state; the provenance text describes computed values as analyst-entered
- **Where:** `recordedBundles.ts:266-278` (`disclosureFor`) is unchanged, and `assemble.ts:694-716`. The contract requires this in DO 2: "present an explicit computed-vs-input/missing state".
- **Root cause:** the PR silently switches what the dollar figures are. For MSFT they are recomputed from drivers. For NVDA, or when the recomputation returns NaN, they are the typed values. Nothing in `AnalysisResult` records which one was used: grep finds no source/computed flag outside assemble's locals. The disclosure the report renders still says "The three scenarios, **the values they produce** … were entered by an analyst". Meanwhile the stored row's `scenario_values` (still REQUIRED by `recordAnalystBundle:165`) are discarded.
- **Reproduction:** in the PR's own test, the recorded row stores bear "111.11". The note asserted (`toContain("entered by an analyst on this system")`) is the same one shown for a run whose bear output is 220885392.83. The NaN fallback is likewise invisible: NVDA's live run shows base 102.38 with no indication it is the typed figure and not a computation.
- **Smallest fix:** add one field to the result, for example `scenarioOutputs.valueSource: "computed-from-recorded-drivers" | "recorded-typed" | "dynamic-ai" | "suppressed"`, set at `assemble.ts:699-716`. Make `disclosureFor` (or the note assembly) state that the values are computed when the flag is set.

## DONE WHEN / DO table

| Item | Status | Evidence |
|---|---|---|
| DO 1. Trace MSFT dependence and find the missing input | PARTIAL | Code comments trace the resolver precedence (`analystInputs.ts:225-251`). Not examined: the PR body/receipt (not provided). |
| DO 2. Recorded reviewed bundle beats the committed fixture, explicitly and not auto-approved | MET | `analystInputs.ts:251-255`; test "once a bundle is explicitly recorded…"; delete reverts to the fixture. |
| DO 2. Compute bear/base/bull via the existing M15 path on real SEC base and the approved bridge | NOT MET | The path runs, but per-share output is wrong by 10^6 to 10^9 (F1). The discount rate (POLICY.rateGrid[1]) and terminal (POLICY.terminalGrowth, PROVISIONAL terminalRoicPremium) are not bundle assumptions (see note N1). |
| DO 2. Explicit computed-vs-input/missing state | NOT MET | F2. |
| DO 2. Fixture dollars never treated as valuation | MET | Probe: MSFT with no recorded bundle is still `suppressed`/INCOMPLETE (A4), trust UNUSABLE. |
| DO 3. No invented or silently approved assumptions | MET | No MSFT bundle is seeded; TEST_INPUT is test-only and deleted after each test. |
| DO 4. Tests: fixture suppression on an MSFT run | PARTIAL | The new test checks resolver flags only, not run suppression. That is covered by existing suites and by my probe. |
| DO 4. Tests: recorded bundle computes *correct* fair value from real SEC facts | NOT MET | The test pins the wrong-scale value, and its recomputation repeats production logic (F1). |
| DO 4. Tests: exact-run replay/provenance | NOT MET in this PR's tests | No replay assertion. The pre-existing snapshot mechanism (migration 004) is untouched. |
| DO 4. Tests: missing/AI-only/unsupported refuse a computed valuation | PARTIAL | Not added. The partially-driven typed fallback and the NaN fallback are untested. |
| DO 4. NVDA/OKLO fail-closed gates, no regression | PARTIAL | Only resolver checks (`analystInputsFor` NVDA bear 28.08, OKLO fixture-carried). No gate-level check. The latent NVDA scale regression in F1 is untested. |
| DO 5/6. Receipt / CALVIN REQUIRED | NOT ASSESSED | PR body not provided. |
| No BUY/HOLD/SELL path | MET | The diff touches no verdict code. Probe results carry no verdict. |
| Scope: no policy constants, no frozen docs, no evaluator changes | MET | Diff is limited to 5 files under `lib/analyzer`. No CI, config, frozen-hash or golden changes. |
| DONE WHEN: real MSFT forward valuation computable with full provenance and fail-closed, or one precise approval gate | NOT MET | Computable only with the wrong scale (F1) and without a computed-vs-input state (F2). |

## Notes (not counted)
- **N1.** The recomputed value depends on POLICY.rateGrid[1] (10%), POLICY.terminalGrowth (3%) and POLICY.terminalRoicPremium. policy.ts:18-19 marks terminalRoicPremium PROVISIONAL and says it "must carry the I16 label wherever it drives a figure". None of these come from the recorded bundle, which has no discount or terminal fields. The contract's "auditable … discount/terminal assumptions" is therefore not met by the bundle. This is the pre-existing Ruling-A dynamic path, so I note it here and do not count it as a PR defect. The receipt should say so.
- **N2.** `recordAnalystBundle` upserts (`ON CONFLICT DO UPDATE`), and `computeAnalysisForRun` re-resolves the bundle live. A recorded MSFT bundle therefore changes the recomputation of every earlier MSFT run. Only snapshots (migration 004) give replay. This is pre-existing for NVDA and newly applies to MSFT.
- **N3.** The EV bridge sanity check is consistent: EV − marketCap = −$6.30B, from debt $40.29B, finance leases $66.59B, cash and non-operating investments together about $113.2B. The bridge is held constant across scenarios. This PR does not change the bridge.

## Verification run
- `npx tsc --noEmit`: exit 0.
- `npx vitest run lib/analyzer/acquisition/msftRealValuationUnblock.test.ts`: 4/4 pass.
- Full suite (`npx vitest run`): 2429 passed, 3 failed out of 2432. None of the 3 failures is caused by this PR, and the PR touches none of the files involved:
  - `m9RealCompanyValidationGuards` verdict.ts hash: the Windows checkout has CRLF line endings. The git blob hashes to the expected 4c0fe5f6….
  - `nvdaAnalystDraftValidation`: the draft-reference allowlist compares against backslash paths on Windows.
  - `analyzerSevenTabsOnRealRun`: a 5s timeout under the full-suite load. It passes 10/10 when rerun alone.
- repo-b is left with no tracked or untracked changes (`git status --short` is empty). The probes are kept in work-b.
