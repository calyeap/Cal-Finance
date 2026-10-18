CORRECT: head 3e87d3b — (1) make migration 010's mismatch guard compare the full `scenarios` and `configured_constants` JSONB, not just the snapshot/terminalRoic/bear shares, and add a seed-test case where only one driver differs; (2) restore the seeded MSFT row in the `afterAll` of msftStage2ValuationProof.test.ts and msftRealValuationUnblock.test.ts by re-applying 010's SQL; (3) commit the local `npm run migrate` + readback instruction (with recovery path) that DO item 6 requires.

TIER: HEAVY (from the task contract, issue #442). OUTCOME-ID: CF-MSFT-STAGE2-DURABLE-SEED-01. Reviewed head: 3e87d3bbf8b864cf411a72adf7730e87f82a3746.

## What passes (evidence)

- **Values match the ruling exactly.** Migration 010 writes profile `MATURE_PROFITABLE_STABLE_FCF`. Classification is unchanged from `CANDIDATE_INPUT`, including `positive_volatile` and `asset-heavy`. Growth is 0.08/0.14/0.20, margin 0.4168/0.45/0.4678, reinvestment 0.07/0.20/0.26 and terminalRoic 0.10/0.11/0.125. Shares are 7449545491 in all three scenarios, nopatTaxRate is 0.19 and stressMarginLevel is 0.3006. The snapshot is 214.26/283.31/402.73, and the dummy 0.01 values are not persisted.
- **Anchors carry the required disclosures.** They now state the years 6–10 model-derived fade (≈10.13/9.94/9.09%) as "not independently MSFT-validated economics". They say acquisitions/ΔNWC are "missing, not zero", that bear's reinvestment rises while bull's falls, and that the reversed explicit-period RONIC appears in bear and bull. Each says "No valuation or recommendation is guaranteed". The stale bull claim of a 78.7% terminal share was removed.
- **Production path reproduces the approved figures.** `npm run migrate` on a fresh `pr443a_test` applies 001–010 cleanly. The seed test reproduces $214.26/$283.31/$402.73 to the cent from the pinned capture. `scripts/evidence/msft-stage2-valuation-proof/independent_oracle.py` reports MATCH for all three.
- **The run recomputes from drivers, not the stored snapshot.** I ran my own probe: seed, set `scenario_values` to 1/1/1, then run the real `computeAnalysisForRun`. The result was still `214.26/283.31/402.73`, so DO item 3 is met.
- **No regressions found.** NVDA's migration-008 bundle is unchanged (still 28.08, no terminalRoic). `npx tsc --noEmit` is clean.
- **Full suite: 2449/2451 passed.** The 2 failures are Windows-only artefacts in files this PR does not touch. `m9RealCompanyValidationGuards` fails because it hashes `verdict.ts` with CRLF line endings. `nvdaAnalystDraftValidation` fails on backslash path separators.
- **Scope and verdict.** No UI code, `deriveVerdict`, `docs/frozen/` or schema is touched, and the verdict stays INCOMPLETE.

## Findings

### F1 — The collision guard accepts a different MSFT bundle and reports success (DO item 2; HEAVY silent-error)
- **Where:** `migrations/010_msft_recorded_bundle_seed.sql`, the `DO $$ … $$` block.
- **Root cause:** The guard compares profile, classification, `scenario_values`, the three terminalRoic values and bear `shareCount` only. `scenario_values` is the one field a real run ignores whenever all drivers are authored. The guard never compares the fields a real run does use:
  - growth, margin and reinvestment for each scenario;
  - base and bull `shareCount`;
  - `configured_constants`, including `nopatTaxRate`;
  - the written anchors.
- **Reproduction (my own probe test):**
  1. Seed the row.
  2. Set only `scenarios.base.revenueGrowthOrPath = "0.25"`.
  3. Re-apply 010's SQL: no error.
  4. Run the real `computeAnalysisForRun`: **214.26 / 517.09 / 402.73**.

  `npm run migrate` would therefore record "010 applied successfully" while a different bundle stays in place and produces a different base value. A second probe also passed the guard silently: bull shareCount 1e9, nopatTaxRate 0.30 and a changed bear anchor.
- **Smallest fix:**
  1. Select `scenarios` and `configured_constants` into the DO block.
  2. Add `OR row_scenarios <> '<the same scenarios literal>'::jsonb OR row_constants <> '<the same constants literal>'::jsonb` to the guard.
  3. Add one case to `msftStage2DurableBundleSeed.test.ts` where only a driver differs and the migration must reject it.

### F2 — 15 edited tests depend on cross-file DB state that two other test files delete
- **Where:** Two test files delete the MSFT row and never put it back: `lib/analyzer/acquisition/msftStage2ValuationProof.test.ts` and `lib/analyzer/acquisition/msftRealValuationUnblock.test.ts`. Both run `DELETE … WHERE ticker='MSFT'` in their `afterAll`. The 15 test files this PR edits now assert a range, PARTIAL trust and a recorded bundle, and all of that needs the migration-seeded MSFT row.
- **Root cause:** Only the new seed test restores the row, in its own `afterAll`. Under vitest's default sequencer with no cache, files run largest first. The full suite passes only because the seed test (11,268 B) is 51 bytes larger than `snapshotComparisonOnRealRun.test.ts` (11,217 B), and because the jsdom files ran first in this run.
- **Reproduction:**
  - `npx vitest run msftStage2ValuationProof.test.ts nonOperatingJudgmentRecordedOnRealRun.test.ts snapshotAnalysis.test.ts snapshotComparisonOnRealRun.test.ts updateRealRunObservation.test.ts` → **8 failed** across 4 of the PR's edited files.
  - The shared test DB is then left with no MSFT row (only NVDA and ZZZTEST). A following `npx vitest run acceptanceGateOnRealRun.test.tsx recordedAnalystInputEntryOnRealRun.test.tsx analyzerRoutesOnRealRun.test.tsx` → **5 failed**.
  - The "targeted tests" the contract requires are therefore order- and state-dependent.
- **Smallest fix:** In both files' `afterAll`, after the delete, re-apply `migrations/010_msft_recorded_bundle_seed.sql`, the same way the seed test already does. These are teardown-only edits, not a rewrite of #440's proof. If editing #440's file is considered off-limits, use the fallback instead: a shared `ensureMsftSeed()` helper in `beforeAll` of each dependent file.

### F3 — The local-apply/readback instruction is not committed (DO item 6; VERIFY)
- **Where:** Nowhere in the diff. The migration header explains provenance only.
- **Root cause:** No committed file tells Calvin:
  - to run `npm run migrate` against the `.env.local` `DATABASE_URL`;
  - how to read the row back, for example `SELECT filename FROM schema_migrations WHERE filename='010_msft_recorded_bundle_seed.sql'` and `SELECT scenario_values, scenarios->'base'->>'terminalRoic' FROM analyzer_recorded_analyst_bundles WHERE ticker='MSFT'`;
  - what a guard failure means and how to resolve it;
  - the recovery path for this data write: delete the row, and Analyzer falls back to the committed fixture, as the seed test shows.

  The status `PREPARED/MERGED, LOCAL MIGRATION NOT YET APPLIED` is not recorded either. The PR body was not available to me; under this replay's rules I judge what is committed.
- **Smallest fix:** Add a short "Local apply / readback / recovery" paragraph to the 010 header, or to the proof doc's addendum.

## Notes (non-blocking; for OWNER)
- **Stale file reference:** The migration header names `msftStage2DurableSeedOnRealRun.test.ts`, but the file is `msftStage2DurableBundleSeed.test.ts`. Fix it in the same pass.
- **Test changes called out separately:**
  - `analyzerSevenTabsOnRealRun` timeout raised from 5 s to 15 s.
  - `msftSensitivityCaptureOnRealRun` dropped its assertions that two-way cell [1][2] equals the base case.
  - Several MSFT assertions were rewritten from suppressed/UNUSABLE to range/PARTIAL.

  All are explained in comments and follow from the seed. None weakens what this outcome itself is meant to prove.
- **Sensitivity capture is now stale for MSFT (outside BUILD's authority):** With the seed live, the static capture in `analystInputs.ts` still uses 10/13.7/18.5% growth and 38/41.8/46.8% margin (CALVIN RULING — A). Its rationale says these are "MSFT's own bear/base/bull scenario growth assumptions already authored for this run", which is no longer true. M14's grid also no longer passes through the base case (14%/45%). Changing the capture would change a Calvin-ruled assumption, so it should be a separate follow-up decision, not part of this PR.
- **Visible behaviour change:** Real MSFT runs now show a range and the "Trading at or above the bull case" headline ($499.70 close against a $402.73 bull). This is the intended effect of the existing recorded-wins-over-fixture precedence. No UI code changed and there is no BUY/HOLD/SELL verdict.
- **No durable local record yet:** No claim of a local or production record should be made until a readback is actually done.
