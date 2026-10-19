ACCEPT: at head ad11789, KO's acquired total debt includes its tagged commercial paper (43,808M at 2026-04-03), and nothing else moves. I recomputed this from the raw captures and confirmed it with a full before/after run on all nine captures. Every DO and VERIFY item I can check here is met, and I found no material defect.

# HEAVY review: CF-LEG2-KO-COMMERCIAL-PAPER-01 (issue #487) at ad11789c804571020200842c7c21c57527aeda9d

## Findings (material)

None.

## What I checked, and how

**1. Recomputed from the raw captures.** I wrote my own Python reader (`scratch/raw.py`, `scratch/ko_all.py`). It does not use the PR's helpers. It reads `lib/analyzer/acquisition/captures/ar6-2026-10-18/ko-companyfacts.json` directly:
- **KO at 2026-04-03:** LongTermDebtAndCapitalLeaseObligations 39,065 + …Current 4,493 + CommercialPaper 250 = **43,808M**. This matches the head.
- **KO 10-K instants, before → after:**
  - FY2023: 35,547 + 1,960 = 37,507, plus CommercialPaper 4,209 = **41,716M**.
  - FY2024: 42,375 + 648 = 43,023, plus 1,139 = **44,162M**.
  - FY2025: 42,119 + 1,822 = 43,941, plus 1,495 = **45,436M**.
  - All three match doc §11.2.
- **Gap to the AR2 golden total:** FY2025 golden `ko.json` is 45,492M. The difference, 45,492 − 45,436 = 56M, is KO's other short-term borrowings, which stay unmapped as DO NOT requires.
- **82M figure:** the contract's 82M at 2026-04-03 cannot be checked from the trimmed capture, because NotesAndLoansPayable is not in it. It can only be checked against SEC, and I made no SEC request.
- **No double count in KO's case:** golden `ko.json` presents "Notes and Loans Payable" as a separate line from the two lease-inclusive debt lines. So commercial paper is not already inside LongTermDebtAndCapitalLeaseObligations or its current portion.
- **NUE:** its CommercialPaper rows end at 2015-12-31 (151.4M at 2014-12-31, 0 at 2015-12-31). It is therefore absent at 2026-07-04, and NUE's value is unchanged at 6,389 + 581 + 129 = 7,099M.

**2. Full before/after run.** Script: `scratch/dump.ts` plus `scratch/cmp.py`.
- **Method:** I rebuilt the base by running `git apply -R pr.diff`, then restored the tree, which is clean. On all nine captures (the six AR6 ones plus msft, nvda and oklo) I compared:
  - `resolveEntry` and the annual series for every `TAG_MAP` entry;
  - `latestAnnualFiscalYear` and `filedAnnualYearsCount`;
  - the full `acquire()` output, including cross-checks;
  - `buildCompanyInputs()` and `assembleAnalysisResult()`.
- **MSFT, COST, NVDA, LLY, MSFT-old, NVDA-old, OKLO:** no difference apart from the version string and the fingerprints derived from it.
- **NUE:** only the fact's `source` text and `absentComponents` (+CommercialPaper) change.
- **KO, values:** total-debt 43,558 → 43,808M. History 37,507/43,023/43,941 → 41,716/44,162/45,436M. Cross-check prior period 43,941 → 45,436M, with 3 components and an unchanged outcome.
- **KO, downstream:** `fixture.enterpriseValue.totalDebt`, `fixture.leverage.totalDebt`, and `roicHistory` invested capital FY2023–25 (+4,209/+1,139/+1,495M).
- **KO, assembled result:** only the total-debt fact value and source change. EV is still suppressed ("missing REQUIRED input(s): financeLeaseLiabilities"). Leverage is still "LEVERAGE UNSUPPORTED IN v1". The ROIC floor is still UNAVAILABLE ("FY2022 is missing invested capital"). So no valuation output moves, as the contract says.

**3. RED → GREEN.** With only `tagMap.ts` reverted to base and the head tests kept, `bridgeInputRecovery.test.ts` has 5 failing tests and 6 passing:
- the new KO test fails with `expected { value: 43558000000 } to deeply equal { value: 43808000000 }`;
- the FY2025 history test fails with `expected 43941000000 to be 45436000000`;
- the three re-pins fail: version, KO composition and NUE composition.

These are the reported reasons. At head the file passes 11/11.

**4. Test integrity.**
- The new tests (`bridgeInputRecovery.test.ts:389-418`) take their inputs from the capture rows and also hard-pin 43,808M and 45,436M. They also check that the CommercialPaper contributing row is dated the same instant (2026-04-03).
- The re-pins (`:152` version, `:188` NUE `absent: ["CommercialPaper"]`, `:226`/`:239` KO tags and value) are exactly the evaluator changes DO 3 authorises. Doc §11.5 calls them out.
- Nothing was deleted, skipped or loosened. The MSFT/COST byte-identical block and the LLY, NVDA and NUE values are untouched and pass.
- No CI config, golden JSON, frozen hash or threshold file is touched. The diff covers 3 files: `tagMap.ts`, the test file and `docs/tag-mapping-version-review.md`.

**5. Suite.**
- `npm run migrate` succeeded.
- `npx tsc --noEmit` exits 0.
- `npx vitest run`: 225 of 226 files and 2707 of 2708 tests pass. The single failure is `scripts/evidence/selfTest.test.ts`, which fails with "Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1243". That is the known environment-only failure.
- The AR2 golden harness (`lib/analyzer/golden/*.test.ts`) is green.

## DONE WHEN / DO / VERIFY table

| Item | Status | Evidence |
|---|---|---|
| DO 1: RED test that KO's total debt includes its captured CP at 2026-04-03 | MET | `bridgeInputRecovery.test.ts:390-404`. It is RED on base (43,558M vs 43,808M) and GREEN on head. |
| DO 2: add `CommercialPaper` to the last candidate | MET | `tagMap.ts:270-275` (`…AndCapitalLeaseObligations + …Current + CommercialPaper + ShortTermBorrowings`) |
| DO 2: bump `TAG_MAPPING_VERSION`, with the review note | MET | `tagMap.ts:76-89` (`-10-3`, header note), `tagMap.ts:253-259`, `docs/tag-mapping-version-review.md` §11 |
| DO 3: re-pin KO value and KO/NUE composition, called out as an evaluator change | MET | `bridgeInputRecovery.test.ts:152,186-189,225-239`; doc §11.5 |
| OUTCOME: CP included under every `total-debt` candidate where tagged | MET | Candidates 1, 4 and 5 add CP. Candidate 2 (`DebtCurrent`) and candidate 3 (`DebtLongtermAndShorttermCombinedAmount`) already include it by definition (`tagMap.ts:225-229`). |
| VERIFY: RED → GREEN for the reported reason | MET | See check 3 |
| VERIFY: MSFT, COST, NVDA, NUE, LLY total-debt unchanged | MET | See check 2. NUE is unchanged in value; only its absence record is new. |
| VERIFY: AR2 harness green | MET | `lib/analyzer/golden/*` pass |
| VERIFY: `npx tsc --noEmit` clean | MET | exit 0 |
| VERIFY: `npm test` green on exact head | MET (local) | 2707/2708 pass; the one failure is env-only (Playwright build). I could not see CI. |
| DO NOT: NotesAndLoansPayable / OtherShortTermBorrowings unmapped | MET | Neither appears in `TAG_MAP` |
| DO NOT: no finance-lease, D1–D4, bridge-policy, golden or migration change | MET | The diff touches only the 3 files above |
| ESCALATE: does any golden company's value other than KO's move? | Not triggered | See check 2 |
| DONE WHEN: one PR is open | Not verifiable here | No GitHub access by rule |
| DONE WHEN: independent HEAVY review ACCEPT on exact head, with CI green | This review: ACCEPT | CI status is not visible to me |
| DONE WHEN: PR merged | Pending | Happens after review |

## Nits (not counted)

1. **Doc §11.2 leaves out a downstream input change.** KO's `roicHistory` invested-capital inputs also move: FY2023 54,082 → 58,291M, FY2024 57,051 → 58,190M, FY2025 65,840 → 67,335M. No assembled output moves, because the ROIC floor stays UNAVAILABLE on FY2022. A one-line mention would make the blast-radius statement complete.
2. **Possible double count, not reachable today.** Candidates 1, 4 and now 5 add `CommercialPaper` and `ShortTermBorrowings` side by side. Some filers tag `ShortTermBorrowings` as a total that includes their CP. KO itself did so through 2022: at 2021-12-31, STB was 3,307M and CP was 2,462M. If a filer tags both at the same instant, the CP would be counted twice. No captured company reaches that combination under the new candidate today. KO has no STB after 2022, and NUE has no CP after 2015. This belongs with the reserved NotesAndLoansPayable / short-term-debt concept decision, not with this PR.
