CORRECT: head e36642d — the new recorded-bundle recompute path (assemble.ts) divides a raw-USD equity value by an analyst-typed share count that has no unit contract, so the PR's own MSFT proof run prints a fair value of $220,885,392.83 / $302,565,354.31 / $445,839,150.50 per share (bear/base/bull) against a $499.70 price, and the test pins those numbers as "correct". Smallest fix: fail closed (INCOMPLETE, named cause) whenever a recorded scenario shareCount is not on the run's own acquired diluted-share scale, and show recomputed values as computed rather than analyst-entered; then re-prove with a correctly scaled MSFT input and a plausibility assertion (details under F1/F2).

REVIEW — PR for issue #433, CF-ANALYZER-REAL-VALUATION-UNBLOCK-01, TIER: HEAVY (kept as the contract sets it)
Reviewed head: e36642d3f1386766748eb3bd30749245e4c5c47f (repo-a; offline replay. No PR body, BUILD report, CI or threads were provided.)

## What the PR does
1. `analystInputsFor` now reads the recorded store (`analyzer_recorded_analyst_bundles`) BEFORE the two committed fixture bundles. A recorded MSFT row therefore overrides the fixture-carried 265/510/650 bundle.
2. `recordedAnalystInputBundle` sets a new flag, `recordedScenarioValuesComputeFromDrivers`, when all nine drivers are authored. In that case `assembleAnalysisResult` throws away the row's typed `scenarioValues` and recomputes bear/base/bull through the existing `dynamicScenarioValue` path: M15 `computeScenarioEnterpriseValue` at `POLICY.rateGrid[1]`, then the EV→equity bridge, then `÷ driver.shareCount`. If the recompute returns NaN (NVDA, whose EV bridge is INCOMPLETE), it falls back to the typed figures.
3. Adds a test, `msftRealValuationUnblock.test.ts`, with a synthetic MSFT bundle.

The direction is right and the scope is bounded: precedence change, reuse of the existing M15 engine, no new policy constants, no BUY/HOLD/SELL path. `verdict.ts` `deriveVerdict` still ends at INCOMPLETE / COMPARATOR_NOT_YET_AVAILABLE. One HEAVY audit item the contract names explicitly fails, though: per-share scale. The PR's own end-to-end evidence is a nonsense valuation.

## Verification run on the exact head
- `npx tsc --noEmit`: exit 0.
- `npx vitest run lib/analyzer/acquisition/msftRealValuationUnblock.test.ts`: 4/4 pass.
- Full suite: 2430 passed, 2 failed. Both failures are Windows-environment artefacts, not caused by this PR (see "Full suite" at the end).
- Probe (temporary copy of the PR test that logs `computeAnalysisForRun` output, since deleted). Output: `work-a/probe1.log`.

## F1 (blocking, CORRECT): per-share scale is wrong on the new recorded-recompute path, and the proof test is self-referential, so it cannot catch it
**Where:** `lib/analyzer/assemble.ts` `dynamicScenarioValue` (`return equityValue.dividedBy(driver.shareCount)`), which this PR now feeds from recorded bundles. Also `lib/analyzer/acquisition/msftRealValuationUnblock.test.ts` (`shareCount: "7430"`, `expectedPerShare(...)`).

**Root cause:**
- On a real acquired run, the numerator is in raw USD. Probe values: base revenue `331839000000`, market cap `3722537881852.7`, EV `3716234881852.7`.
- The divisor is whatever the analyst typed. The recorded entry surface has no unit contract for it:
  - `app/components/AnalystBundleForm.tsx` placeholder: `e.g. 7.4255` (billions).
  - NVDA's approved seed (`migrations/008_nvda_recorded_bundle_seed.sql`): `"shareCount": "24.1"` (billions).
  - This PR's test: `"7430"` (millions).
- Only the AI-proposed path (`aiProposedBundle.ts` `toScenarioDriverInputs`) converts to the raw absolute SEC count that this division needs.
- Before this PR, a recorded bundle's shareCount was never used for division, because the typed dollar values were passed through. The PR makes it load-bearing without reconciling the unit.

**Reproduction (exact head, PR's own TEST_INPUT, MSFT acquired run, profile confirmed):**
```
fairValueRange.kind = "range"
bear = 220885392.83435665363   base = 302565354.30718557218   bull = 445839150.50450500124
priceLocationWithinRange = -0.98191244023690457549   (price 499.7)
trust.status = "PARTIAL"   enterpriseValue.suppressed = false
```
The test asserts exactly these numbers, because it recomputes them with the same formula and the same unscaled `7430`. It proves the plumbing echoes itself, not that the fair value is correct. The contract asks for proof that a recorded bundle "computes correct fair value from real SEC facts", without "misleading numbers".

Same computation at other share counts (linear):
| shareCount | base value per share |
|---|---|
| `7.4255`, the form's own example | ≈ $302,748,714,901 |
| `7430000000`, raw | ≈ $302.57 |

So an analyst who follows the product's own form would get a ~$3×10^11/share MSFT valuation. It would render as a computed range with trust PARTIAL, not suppressed.

**Latent second instance:** NVDA's seeded `24.1` is masked today only because its EV bridge is INCOMPLETE and the trial falls back to typed values. The day those three tag-mapping gaps close, NVDA flips silently from the approved $28.08/$102.38/$296.44 to equity-in-USD ÷ 24.1, which is about a billion times too large.

**Smallest fix:**
- (a) In `dynamicScenarioValue`, or before the recorded-recompute trial, fail closed when a scenario's `shareCount` is not on the run's own acquired diluted-share scale. That scale is `shares-outstanding` + treasury dilution, already available to the EV bridge and `aiProposedBundle`. Reuse `scenarioProposal`'s existing 0.5×–3× band rather than a new constant, and set `scenarioValuesMissing` with a named cause so the range reports INCOMPLETE and does not print a value. Do not auto-rescale, which would be inventing an input.
- (b) Make the entry form's share-count label and placeholder state the unit the engine needs (absolute shares).
- (c) Change the test so it records a correctly scaled MSFT input and asserts a plausibility bound independent of the formula. For example, base value within an order of magnitude of the run's own price, or recompute equity using the acquired `shares-outstanding` fact rather than the bundle's own `shareCount`.
- (d) Add one test showing that a billions-scaled entry (the form's example, or NVDA's `24.1` convention on a complete bridge) refuses instead of computing.

## F2 (blocking, part of the same CORRECT): output misstates provenance; there is no explicit computed-vs-input state
**Where:** `recordedBundles.ts` `disclosureFor` (unchanged), and `assemble.ts` (no result field records which path produced `scenarioOutputs.values`).

**Root cause:** When `recordedScenarioValuesComputeFromDrivers` is true, the analyst's typed `scenarioValues` are discarded and replaced by computed ones. But:
- The run's disclosure still says "The three scenarios, **the values they produce** … were entered by an analyst on this system". The PR test asserts this note (`toContain("entered by an analyst on this system")`) on the same run that recomputes.
- Nothing in `AnalysisResult` tells a reader, or a later snapshot, whether bear/base/bull are the analyst's typed figures or M15-computed. On NVDA the silent NaN fallback gives typed figures, and the two cases look identical.

The contract (DO item 2) requires "an explicit computed-vs-input/missing state" and source/assumption separation, which HEAVY review must audit.

**Smallest fix:**
- Carry one explicit marker through to the result: e.g. `scenarioValuesSource: "computed-from-recorded-drivers" | "recorded-typed" | "ai-proposed-computed" | null`, or reuse an existing provenance slot.
- When the recompute path is taken, append to the bundle note that the dollar values were computed by M15 from the recorded drivers, with the typed figures not used.
- Assert both in the MSFT test, and assert the typed-fallback marker for the NVDA case.

## Non-blocking notes (no extra correction cycle needed)
- **N1. Entry path is unreachable for MSFT.** `app/analyzer/inputs/[ticker]/page.tsx` still shows "MSFT already has a committed bundle … This screen edits only recorded bundles" and does not load or show a recorded MSFT row, which would now govern. Recording is therefore only possible by SQL or migration. That is acceptable for an approval-gated seed like NVDA's 008, but the page text is now inaccurate and hides the governing bundle from review. Worth a one-line follow-up, or folding into F2.
- **N2. Replay.** DO item 4 asks for "exact-run replay verified"; no test here covers it. The existing snapshot store (migration 004) is the replay mechanism; a re-computation from live inputs is not, because a later upsert of the recorded row changes the result. With F2 in place, a snapshot round-trip assertion on the MSFT recompute run would close this cheaply.
- **N3. Discount rate and terminal growth.** The recompute uses `POLICY.rateGrid[1]` (0.10) and `POLICY.terminalGrowth` (existing M15/RULING A semantics), not analyst-recorded discount or terminal assumptions; the recorded schema has no such fields. This is not new policy introduced by this PR, but the shipping receipt should state it explicitly so the "first remaining Calvin decision" is accurate.
- **N4. The bridge looks right.** EV = mcap + debt 40.294B + finance leases 66.594B − cash/marketable debt 76.843B − non-op equity investments 36.348B. Net bridge −6.303B, held constant across scenarios. No double count is visible from this PR; the bridge itself is unchanged and pre-existing.
- **N5. Regressions hold.** NVDA still resolves its 008 bundle and keeps its typed figures. OKLO still resolves its committed bundle. The MSFT committed bundle stays fixture-suppressed when nothing is recorded. Precedence reverts when the row is deleted.

## Full suite
`npx vitest run` on the exact head, against the throwaway DB: 2430 passed, 2 failed (205 files). Neither failure comes from this PR; both come from running on a Windows checkout:
- `m9RealCompanyValidationGuards.test.ts`: the sha256 of `lib/analyzer/verdict.ts` differs only because of CRLF line endings. The LF-normalised hash is `4c0fe5f6…1b73a`, exactly the expected value, and the PR does not touch verdict.ts.
- `nvdaAnalystDraftValidation.test.ts`: the allowlist is compared against backslash paths (`lib\analyzer\nvdaRealRunObservation.test.ts`, `migrations\008_…`). Those are allowlisted files the PR does not touch.

CI on Linux should be green for both; CI results were not available for this exact head, so this is not verified.

A temporary probe test file was created under repo-a and then deleted. repo-a has no tracked or untracked modifications from this review.
