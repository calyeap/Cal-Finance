CORRECT: The seeded figures are right and I recomputed them independently, but there are two reproduced material defects: (1) the PR re-pins 13 test files so they need a durable MSFT row, and two existing files delete that row, which makes the suite depend on test-file order; (2) migration 010's collision check silently accepts a different MSFT bundle whose drivers differ. A third, smaller gap: the local-apply/readback instruction (DO 6) is not in any committed file.

Reviewed: PR #443 at 3e87d3b (issue #442, CF-MSFT-STAGE2-DURABLE-SEED-01, HEAVY). Evidence files are in work-b/ (full1.log, order1.log, collision.log, oracle.py, m14.py, collision.cjs).

## Findings

### F1 (material): the suite now passes only in some test-file orders. The re-pinned tests need a durable MSFT row that two existing test files delete
- **Where:** 13 re-pinned files. These are automaticAnalysisOnRealRun, nonOperatingJudgmentRecordedOnRealRun (lib and app), acceptanceGateOnRealRun, analyzerRoutesOnRealRun, recordedAnalystInputEntryOnRealRun, snapshotAnalysis, snapshotComparisonOnRealRun, updateRealRunObservation, growthLicenceOnRealRun, leverageOnRealRun, msftSensitivityCaptureOnRealRun, step4ForecastDispersionReadingOnRealRun and reverseDcfOnRealRun. They now assert PARTIAL/range/214.26, which holds only while `analyzer_recorded_analyst_bundles` has the migration-010 MSFT row.
- **Root cause:**
  - `lib/analyzer/acquisition/msftRealValuationUnblock.test.ts:84,100-105` and `msftStage2ValuationProof.test.ts:140,154-159` run `DELETE ... WHERE ticker='MSFT'` in afterEach/afterAll and never restore the row.
  - The new `msftStage2DurableBundleSeed.test.ts` header (lines 15-27) acknowledges this, but only that file re-seeds the row (afterAll, lines 58-64).
  - Any re-pinned file that runs after one of the deleting files and before the seed file sees no MSFT row. MSFT then falls back to MSFT_FIXTURE, A4 suppresses the range, and the test fails.
  - The full CI run passes only because of where vitest's default sequencer happens to put the files. On a fresh run it orders files largest-first. Measured with LF line endings, the seed file is 11,268 bytes and snapshotComparisonOnRealRun.test.ts is 11,217 bytes, a 51-byte margin. Re-runs with a cache order by failed-first, then duration.
- **Reproduction:** one targeted vitest invocation on the test DB (work-b/order1.log):
  ```
  npx vitest run lib/analyzer/acquisition/msftStage2ValuationProof.test.ts \
    lib/analyzer/nonOperatingJudgmentRecordedOnRealRun.test.ts lib/analyzer/automaticAnalysisOnRealRun.test.ts
  -> Test Files 1 failed | 2 passed; Tests 3 failed
     nonOperatingJudgmentRecordedOnRealRun: expected 'UNUSABLE' to be 'PARTIAL';
     expected 'suppressed' to be 'range'; reason contains 'scenario dollar values'
  ```
  The MSFT row was present before this run (rows before: MSFT, NVDA, ...). For comparison, the full suite in size order passed every PR-touched file. Its only two failures were Windows-only artefacts in untouched files (see the verification notes).
- **Smallest fix:** in the afterAll of msftRealValuationUnblock.test.ts and msftStage2ValuationProof.test.ts, re-apply `migrations/010_msft_recorded_bundle_seed.sql` after the final delete, the same way the new seed test does. This leaves the table as migration 010 defines it, whatever the file order. A shared helper for this is fine.

### F2 (material, DO item 2): the collision/mismatch check skips the drivers the Analyzer actually computes from
- **Where:** `migrations/010_msft_recorded_bundle_seed.sql`, the DO block at lines 112-160.
- **Root cause:**
  - The check compares only these fields: profile, classification_inputs, scenario_values, the three terminalRoic values and the bear shareCount.
  - It never compares the fields the real Analyzer computes from: revenueGrowthOrPath, operatingMargin, reinvestmentCapitalIntensity, the base/bull shareCount, writtenAnchor, or configured_constants such as nopatTaxRate.
  - The migration's own header says real runs recompute from those drivers (`recordedScenarioValuesComputeFromDrivers`), not from the stored snapshot. So `ON CONFLICT DO NOTHING` can keep a different MSFT bundle and still report "applied successfully". The contract forbids exactly that: "verification must surface a mismatch instead of calling it done".
- **Reproduction:** `node work-b/collision.cjs <repo-b>` (output in work-b/collision.log). Starting from the canonical row, it changes bear growth to 0.02, base margin to 0.30, bull margin to 0.60, base shareCount to 7,000,000,000 and nopatTaxRate to 0.35, then applies migration 010 in a transaction:
  ```
  RESULT: migration 010 applied WITHOUT error against a different MSFT bundle
  row left in place: { g: '0.02', m: '0.30', t: '0.35' }
  ```
  The new test only covers a row that differs in every checked field (`msftStage2DurableBundleSeed.test.ts:70-81`), so it cannot detect this gap.
- **Smallest fix:** in the DO block, also require `scenarios = '<same literal>'::jsonb` and `configured_constants = '<same literal>'::jsonb`, using whole-value jsonb equality. Add one test case that mutates a single driver, for example the base operatingMargin, and expects the raise.

### F3 (DO item 6 / DONE WHEN, not met in committed files): no local-apply or readback instruction
- **Where:** migration header and repo docs. `grep -r "010_msft|DURABLE-SEED"` finds only the migration and test files. There is no `npm run migrate` step and no SELECT readback for Calvin's local DB, and no `PREPARED/MERGED, LOCAL MIGRATION NOT YET APPLIED` status. The PR body is not available to me, so I judged only the committed files, as instructed.
- **Smallest fix:** add about five lines to the migration header or the proof doc covering:
  - `npm run migrate` against the local `.env.local` DATABASE_URL;
  - `SELECT ticker, scenario_values, scenarios->'base'->>'terminalRoic' FROM analyzer_recorded_analyst_bundles WHERE ticker='MSFT';` and `SELECT * FROM schema_migrations WHERE filename='010_msft_recorded_bundle_seed.sql';`;
  - the explicit not-yet-applied status.

## Independent recomputation (headline numbers are correct)
- **Raw inputs come from the committed capture** (`lib/analyzer/acquisition/captures/msft-companyfacts.json`):
  - FY2026 revenue (RevenueFromContractWithCustomerExcludingAssessedTax, 2025-07-01 to 2026-06-30, accn 0001193125-26-323660) is 331,839,000,000.
  - Cover-page shares are 7,425,545,491. Adding 24,000,000 of treasury-method dilution gives 7,449,545,491, which matches the seed.
- **My own Decimal DCF** (work-b/oracle.py, no repo code) uses rate 10%, terminal growth 3%, tax 0.19, the growth fade over years 6-10, the reinvestment fade toward margin×(1−t)×g/ROIC, and the EV bridge (EV 3,716,234,881,852.70 minus market cap 499.70×7,449,545,491 = −6.303B):

| Scenario | Fade target | Terminal-value share | Per share |
|---|---|---|---|
| Bear | 10.13% | 52.5% | $214.2616 |
| Base | 9.94% | 65.1% | $283.3138 |
| Bull | 9.09% | 71.6% | $402.7311 |

  These match the approved 214.26 / 283.31 / 402.73 and the approved fade targets.
- **Re-pinned M14 values:** work-b/m14.py independently reproduces the growth row, the margin row and two-way cell [1][1] in msftSensitivityCaptureOnRealRun.test.ts to every digit, for example 2068964793072.3221 and 1884622910600.1285.
- **RONIC shift:** the move from 17.4977% to 17.7164% (0.1750 to 0.1772) equals ×0.81/0.80, which is the tax change from 0.20 to 0.19. It is consistent.

## DONE WHEN / DO table
| Item | Status | Evidence |
|---|---|---|
| DO1: reconstruct exactly (classification, positive_volatile, growth/margin/reinvestment, terminalRoic 0.10/0.11/0.125, shares 7,449,545,491, constants) | MET | migration lines 66-120 match CANDIDATE_INPUT (msftStage2ValuationProof.test.ts:58-136) and proof doc §3/§9; round-trip asserted in the seed test at lines 83-149 |
| DO2: one additive, idempotent, forward-only 010 migration into the existing table, with collision detection | PARTIAL | additive and idempotent: yes (ON CONFLICT DO NOTHING; the re-apply test passes). Mismatch detection is incomplete (F2) |
| DO3: no dummy 0.01 values persisted; approved snapshot stored; dynamic recompute proven | MET | scenario_values are 214.26/283.31/402.73; the seed test (lines 151-185) recomputes them through computeAnalysisForRun with `recordedScenarioValuesComputeFromDrivers` true |
| DO4: anchors disclose the model-derived fade, ΔNWC missing not zero, not MSFT-validated, bear rises / bull falls, reversed RONIC, no guarantee | MET | anchors in migration lines 72-96; figures (38.58%/29.15%/25.5%) agree with proof doc §4; stale "78.7% >75% caution" text removed |
| DO5: test-DB-only regression: readback via recordedAnalystInputBundle/analystInputsFor, production-path 214.26/283.31/402.73, NVDA/legacy unaffected | MET, but see F1 | msftStage2DurableBundleSeed.test.ts. The re-pinned suite depends on file order (F1) |
| DO6: document local `npm run migrate` and readback; no claim the local DB is updated | NOT MET in committed files | F3. No false local-DB claim found |
| DONE WHEN: one small PR; typecheck, tests, migrations green | PARTIAL | `tsc --noEmit` exit 0; `npm run migrate` applied 001-010 cleanly; full suite: 2449 passed, 2 failed (Windows-only, unrelated), but green only in a lucky file order (F1) |
| DO NOT: no #440/frozen/deriveVerdict/UI code/schema changes | MET | the diff touches only test files and the new migration. The hero now shows a range because of the data, which is the intended effect of the seed |

## Evaluator / test-integrity notes
- **Re-pins:** every re-pinned expectation follows from the MSFT bundle now being recorded (range instead of suppressed, PARTIAL instead of UNUSABLE, the M8 reason, tax 0.19). I recomputed the numeric ones above. The removed `cells[1][2] == growthRow.values[1]` identity is justified: the base drivers (0.14 growth / 0.45 margin) no longer lie on the fixed grid points.
- **Timeout:** analyzerSevenTabsOnRealRun has its timeout raised from 5s to 15s, with a stated reason (range computation now runs on every render). This is mildly loosening but justified.
- **Full-suite failures:** both are Windows artefacts in files the PR does not touch.
  - m9RealCompanyValidationGuards hashes verdict.ts. The committed blob hashes to the expected 4c0fe5f6..., so the mismatch comes from the CRLF checkout.
  - nvdaAnalystDraftValidation fails on backslash path separators.

## Nits (not counted)
- The migration header cites `msftStage2DurableSeedOnRealRun.test.ts`, which does not exist. The real file is `lib/analyzer/acquisition/msftStage2DurableBundleSeed.test.ts`.
- The comment in growthLicenceOnRealRun.test.ts still says "(no DB)", but the run now depends on the DB's recorded MSFT row.
