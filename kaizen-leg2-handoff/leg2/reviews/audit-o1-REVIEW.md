ACCEPT: at 239579d a pre-AR4 stored output renders through AnalyzerReport and every DO 3 surface without crashing. The RED->GREEN result is reproduced for the reported TypeError, tsc is clean and npm test passes apart from two known environment-only failures. I reproduced no material defect.

## Findings

None material.

What I checked and reproduced:

1. **RED before, GREEN after, for the reported reason.** I reverse-applied the three production hunks (AnalyzerReport.tsx, briefAcceptance.ts, slots.ts) with `git apply -R --include=...` and ran `app/components/preAr4StoredOutput.test.tsx`.
   - The AnalyzerReport test failed with `TypeError: value.mul is not a function`, which is the contract's error.
   - slots and briefAcceptance each failed with `TypeError: Cannot read properties of undefined (reading 'rate')`, because a pre-AR4 output has no `priceImplied.reverseDcf`.
   - At head all 6 tests pass. The tree was restored afterwards.
2. **The fix is minimal and only reads stored values.**
   - `ladderRate()` (AnalyzerReport.tsx:54) wraps a plain-number rate in a Decimal for display only, at :775.
   - slots.ts:248 skips the reverse-DCF slots when the solve is absent.
   - briefAcceptance.ts:398 reports section 8 as MISSING when the solve is absent, so it fails closed.
   - No valuation output, storage format, AR4 rule, migration or evaluator is touched. The only changes are 3 source files, 1 new test and 1 new fixture.
3. **Independent shape audit (DO 3).**
   - I built a current MSFT result (`assembleAnalysisResult`, both plain and with stated D2 inputs), passed it through `toStorable`, and compared its structure with `msftPreAr4.json`.
   - The pre-AR4-only differences are:
     - ronic `cells[].rate` is a number;
     - `priceImplied.reverseDcf`, `valuationBasis`, `verdictInputs`, `bridgeFlags`, `scenarios.*.returnOnNewInvestment` and `policy.constants.discountRate/moatCredit` are absent;
     - the old shapes of `sensitivity.twoWay*` and tornado remain;
     - `reverseDcfGrid`, `rateGrid`, `growthLicence` and `verdictBlockers` are extra.
   - I traced every consumer of those fields:
     - `twoWay*` is typed `unknown` and never rendered;
     - the tornado row shape is compatible;
     - `bridgeFlags`, `valuationBasis` and `reverseDcf` were already guarded in AnalyzerReport, AnalyzerOverview and QuickRead;
     - deriveVerdict handles a missing `verdictInputs` (INCOMPLETE, "stored before the nine-point verdict check existed; re-run it");
     - snapshotComparison's FIELD_SPECS all exist in the old shape.
   - The ronic ladder rate is the only remaining crash outside slots and briefAcceptance, and the PR fixes it.
4. **No wrong render.**
   - I rendered the fixture through AnalyzerReport (all sections), AnalyzerOverview, QuickRead, OverviewQuickRead and overviewTabText. The output contains no `NaN`, `undefined`, `[object Object]`, `Infinity` or `null` text.
   - The ladder reads `r=8.0%: CLEAN (17.8%)`, `r=10.0%`, `r=12.0%`, which are the stored rates. My own check agrees: `new Decimal(0.08).mul(100).toFixed(1)` gives `8.0`.
   - buildSlotCatalogue returns 41 slots and none of them are reverse-DCF slots.
5. **Fixture realism.**
   - The fixture's structure fits a genuine pre-AR4 `toStorable` output:
     - `runIdentity.codeVersion` is `c963bcd…`;
     - it has the retired `rateGrid` and `reverseDcfGrid`, `growthLicence` and `verdictBlockers`;
     - Decimals are tagged everywhere except the ladder `rate`.
   - This matches the codebase's own "stored before AR4 carries the retired grid" comments. I could not regenerate it at c963bcd because the clone is depth 1, but nothing in it looks hand-typed.
6. **Verification commands.**
   - `npx tsc --noEmit` exits 0.
   - `npm test` result: 220/222 files and 2639/2641 tests pass. The 2 failures are the known environment-only cases:
     - the `verdict.ts` hash under CRLF (`git ls-files --eol` shows `i/lf w/crlf`);
     - the NVDA draft allow-list, which received backslash paths (`lib\\analyzer\\nvdaRealRunObservation.test.ts`, `migrations\\008_…sql`).
   - Neither failure touches a file this PR changed.

## DONE WHEN

| Item | Status | Evidence |
|---|---|---|
| DO 1: a RED test renders the pre-AR4 stored JSON via fromStorable through AnalyzerReport and fails today with the TypeError | MET | preAr4StoredOutput.test.tsx:33-36, 50-55. Reproduced as `value.mul is not a function` with the fix reverted. |
| DO 2: the smallest fix so that shape renders correctly | MET | AnalyzerReport.tsx:50-56 and :775. The rendered text shows `r=8.0%/10.0%/12.0%`. |
| DO 3: check AnalyzerOverview, QuickRead, deriveVerdict, ai/slots.ts and briefAcceptance.ts; fix only crashes or wrong renders | MET | Tests cover every listed surface. slots.ts:246-249 and briefAcceptance.ts:396-403 fix real crashes (reproduced). The other surfaces were already safe: my render scan found no bad text, and the verdict comes back INCOMPLETE. |
| DO 3: list degraded but honest states in the PR | NOT VERIFIABLE | PR body not provided, so this is not counted. The degraded states in code are: section 8 MISSING in brief acceptance, no reverse-DCF slots, no solve shown in Section E, verdict INCOMPLETE. |
| VERIFY: RED turns GREEN for the reported reason | MET | Reproduced (finding 1). |
| VERIFY: the same old-shape fixture passes every DO 3 surface | MET | 6/6 tests pass, plus my own render scan. |
| VERIFY: `npx tsc --noEmit` is clean | MET | Exit 0. |
| VERIFY: `npm test` is green on the exact head | MET (local) | The only 2 failures are the known environment-only cases (CRLF hash, backslash allow-list). |
| DO NOT: no change to valuation outputs, AR4 rules, storage format or migrations; #466/#454 untouched | MET | The diff touches 5 files, none of them in these areas. |
| DONE WHEN: PR open with CI green on the exact head | NOT VERIFIABLE HERE | CI was not provided. The local equivalent is green. |
| DONE WHEN: a fresh independent REVIEW returns ACCEPT | MET | This review. |
| DONE WHEN: merged by the existing workflow | PENDING | This happens after review. |

## Nits (not counted)

- Test 3 ("renders through AnalyzerReportFrame, AnalyzerOverview and QuickRead") asserts only that rendering does not throw. It already passed before the fix, so it is a coverage check rather than a regression test. That is acceptable for DO 3, but one text assertion per surface would make it sturdier.
- `ladderRate`'s parameter type `Decimal | number` widens beyond the declared `RonicLadderCell.rate: Decimal`. A short note in `types.ts` that stored pre-AR4 cells may carry a number would keep the next reader from removing the guard.
- Section E's subtitle "Reverse DCF · one solve at the rate in use" still shows for a pre-AR4 output, which displays no solve. A one-line "stored before AR4; re-run for the solve" note would make that degraded state explicit. This was not introduced by the PR.
