ACCEPT: at ad11789 KO's acquired total debt includes its tagged CommercialPaper (43,808M at 2026-04-03; FY2023–FY2025 history 41,716 / 44,162 / 45,436M). Only KO's values move across all nine captures, the RED test fails on base for the stated reason, tsc is clean, and the suite is green apart from the known Playwright environment failure. No material defect was reproduced.

## Findings (material)

None reproduced.

## What I checked independently

1. **Recomputed from the raw capture** (`scratch/rows.py`, Python reading `ko-companyfacts.json`, not using any repo helper). The rows below are the same in every form; for the history series, the 10-K rows are the ones used (ANNUAL_FORMS).
   - 2026-04-03 (10-Q 0001628280-26-028802): 39,065 + 4,493 + CP 250 = **43,808M** ✓
   - FY2025 (10-K 0001628280-26-010047): 42,119 + 1,822 + 1,495 = **45,436M** ✓
   - FY2024: 42,375 + 648 + 1,139 = **44,162M** ✓
   - FY2023: 35,547 + 1,960 + 4,209 = **41,716M** ✓
   - KO's ShortTermBorrowings rows stop at 2022-12-31, and its lease-inclusive rows start at 2023-12-31. So no instant in the winning series carries both CP and STB, and nothing is double-counted. Sanity check: 250M of CP plus the 82M left unmapped gives 332M of loans and notes payable, a plausible figure for KO's Q1-2026 balance sheet.
2. **Before/after on all nine captures** (`scratch/dump.ts` run on a base tree rebuilt with `git apply -R pr.diff`, and on the head; diffed structurally with `scratch/diff.py`). It covers every TAG_MAP entry's `resolveEntry`, its instant/annual series, `latestAnnualFiscalYear`, `filedAnnualYearsCount`, the full `acquire()` output and the full `buildCompanyInputs()` output. Besides the version string, these changed:
   - KO: the total-debt fact value and source, the crossCheckFact value, its components and its prior period (43,941 → 45,436), the history series, the fixture's EV/leverage `totalDebt` input, and the `roicHistory` invested capital (see nit 1).
   - NUE: the source text and `absentComponents` (CP absent). The value stays 7,099M. NUE's CP rows (2014–2015) fall outside its lease-inclusive series, which starts in 2023, so its history does not move.
   - MSFT, COST, NVDA, LLY, OKLO and the older captures: nothing changed. No cross-check outcome or verificationState changed anywhere.
3. **RED test integrity.** I copied the head test file onto the base code and ran it: 5 failed, 6 passed. The two new tests fail as the PR body states (`43558000000` vs `43808000000`, and `43941000000` vs `45436000000`). The other three failures are the re-pins (version, NUE absent list, KO composition). The expected values come from capture rows via `filed()`, which is independent of the production summing logic.
4. **Evaluator changes.** Only `bridgeInputRecovery.test.ts` changed: the version pin, the KO value and composition, and the NUE absent list. These are exactly what DO 3 authorizes, and the PR body calls them out. No CI, config, golden JSON, frozen hash (`scripts/evidence/config.ts` does not reference these files), threshold or migration was touched. The MSFT/COST byte-identical block and the LLY, NVDA and NUE values are unchanged and pass.
5. **DO NOT respected.** NotesAndLoansPayable and OtherShortTermBorrowings are not mapped. Finance-lease handling, D1–D4, the bridge policy, golden values and migrations are untouched.
6. **Run at head** (DB `leg2c_o6_rev1_test`):
   - `npm run migrate`: applied.
   - `npx tsc --noEmit`: exit 0.
   - `npx vitest run`: 225/226 files and 2707/2708 tests pass. The only failure is `scripts/evidence/selfTest.test.ts` (Playwright `chromium_headless_shell-1243` is missing), which is the known environment-only failure.

## Nits (not counted)

1. **The downstream claim is incomplete.** The PR body and doc §11.4 say "no valuation output moves", but the measurement did not include `buildCompanyInputs`. KO's `roicHistory` invested capital does move: FY2025 65,840 → 67,335M, FY2024 57,051 → 58,190M, FY2023 54,082 → 58,291M (the scratch diff reproduces this). The ROIC floor stays `UNAVAILABLE` before and after, because FY2022 and FY2021 invested capital are null ("FY2022 is missing invested capital"). RONIC's `fiveYearDeltaInvestedCapital` is null both times, and EV and leverage stay suppressed or unsupported. So no rendered verdict changes, and the move is the correct consequence of the methodology. Smallest fix: add one line to §11.2/§11.4 recording the invested-capital move.
2. **Possible double-count, pre-existing.** If a filer tags ShortTermBorrowings as an amount that already includes commercial paper and also tags CommercialPaper at the same instant, the CP + STB pattern counts the paper twice. KO did this in 2019–2022: STB 2,373M against CP 2,146M at 2022-12-31. The pattern was already in candidates 1 and 4, the contract directed this change, and none of the nine captures hits it in the lease-inclusive candidate. Worth noting for a later debt-concept pass.

## DONE WHEN

| Item | Status | Evidence |
|---|---|---|
| DO 1: RED test, KO total debt includes captured CP at 2026-04-03 | MET | `bridgeInputRecovery.test.ts:389-418`; fails on base (43,558M vs 43,808M) and passes at head |
| DO 2: CP added to last candidate; version bumped with review note | MET | `tagMap.ts:270-275` (CP at :273), `:89` (`-10-3`), note at `:76-87`; review in `docs/tag-mapping-version-review.md` §11 |
| DO 3: re-pin KO value and KO/NUE compositions, called out as evaluator change | MET | `bridgeInputRecovery.test.ts:152, 186-189, 225-238`; PR body "Evaluator change" section |
| VERIFY: RED → GREEN for the reported reason | MET | reproduced on base and head |
| VERIFY: MSFT, COST, NVDA, NUE, LLY total-debt unchanged | MET | nine-capture structural diff: no value change outside KO |
| VERIFY: AR2 harness green | MET | `lib/analyzer/golden` passes in the full run |
| VERIFY: `tsc --noEmit` clean | MET | exit 0 |
| VERIFY: `npm test` green on exact head | MET (local) | 2707/2708; the single failure is the known Playwright environment issue |
| DONE WHEN: one PR open, labelled `lean-sop` | NOT VERIFIABLE here | no GitHub access, per the review rules |
| DONE WHEN: fresh independent HEAVY review ACCEPT on exact head, CI green | ACCEPT given here; CI not verifiable here | this review covers ad11789c804571020200842c7c21c57527aeda9d |
| DONE WHEN: Calvin merges | PENDING | owner action |
