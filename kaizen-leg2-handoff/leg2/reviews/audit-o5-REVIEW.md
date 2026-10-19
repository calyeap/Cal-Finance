CORRECT: the golden-data fix is right (KO 45,492M, all six non-null golden totals foot), but DO 4 is not done. On the pinned capture the engine's KO total debt (43,558M at 2026-04-03) still leaves out KO's short-term borrowings, including commercial paper, which is already a tag in the approved total-debt concept. The PR ships no engine fix and no RED test. LLY's new finance-lease classification also contradicts the repo's own cited disclosure.

Head reviewed: e8016aa70c0a6b679a903408a7c82e7200a8d055. No PR body was available to me. DO 4 was judged on the tree and the commit message, which says nothing about it; the only trace of DO 4 in the tree is a test comment.

## Findings

### F1 (material): DO 4 not done. The engine's KO total debt still omits short-term borrowings, and the fix falls inside the approved concept

- **Where:** `lib/analyzer/acquisition/tagMap.ts:250-253`, the last `total-debt` candidate:
  `LongTermDebtAndCapitalLeaseObligations + LongTermDebtAndCapitalLeaseObligationsCurrent + ShortTermBorrowings`.
  It is unchanged by the PR. `lib/analyzer/acquisition/bridgeInputRecovery.test.ts:218-234` still pins the omitting value, and the PR only rewrote the comment there to say the 1,551M is left out.
- **Root cause:** KO resolves through the last candidate. For KO, `ShortTermBorrowings` has been dead since FY2022, and the candidate has no `CommercialPaper` component. Candidates 1 and 4 (`tagMap.ts:240, 243-248`) do have one. KO's loans and notes payable therefore never reach the engine total. The contract's DO 4 says: if the engine omits the 1.551B "and the fix is a tag inside the existing approved debt concept (the short-term borrowings family), fix it here with a RED test". `CommercialPaper` is already a member of that concept, and the PR's own README (`golden/README.md`, "Total debt") puts "commercial paper, loans and notes payable" inside short-term borrowings. So the "stop and report" branch does not apply, and the "fix it here" branch was not carried out.
- **Reproduction:** `scratch/koEngine.ts` calls the repo's `acquire()` on the six AR6 captures (no network). Run it with `npx tsx ../scratch/koEngine.ts "$PWD"` from `repo/`:
  ```
  AS-SHIPPED KO 43558000000 2026-04-03                 (= 39,065 + 4,493; CP excluded)
  WITH-CP-ON-LAST-CANDIDATE KO 43808000000 2026-04-03  (+250M CommercialPaper, tagged in the pinned capture)
  MSFT/COST/NVDA/NUE/LLY: identical in both runs
  ```
  The capture has `CommercialPaper` for KO at 2026-04-03 = 250,000,000 (10-Q 0001628280-26-028802) and at 2025-12-31 = 1,495,000,000 (10-K 0001628280-26-010047). At the FY2025 instant the same candidate gives 43,941M, short of the 45,492M golden by the full 1,551M.
- **Smallest fix:** first, in `bridgeInputRecovery.test.ts`, add a RED test that the KO engine total includes the captured commercial paper at 2026-04-03. Then add the short-term-borrowings tag(s) to the last candidate's `plus`. Either use `CommercialPaper`, plus `OtherShortTermBorrowings` if captured, or use `NotesAndLoansPayable` instead of those two. Do not use both forms, because KO's 1,551M = CP 1,495M + other 56M. Bump `TAG_MAPPING_VERSION` and add the version-review note the file requires. Re-pin the KO bridge expectation; the run above shows no other company moves. If the builder judges that `NotesAndLoansPayable` (not yet mapped and not in the trimmed capture) is outside the concept, then the `CommercialPaper` part is still in scope. The remainder must be stated explicitly as the "stop and report" item, with the evidence.

### F2 (minor, reproduced): LLY's `notPresented.financeLeases` misstates the definition the PR introduces

- **Where:** `lib/analyzer/golden/lly.json` (new `notPresented.financeLeases`: "LLY tags no FinanceLeaseLiability … there is no finance-lease debt line to add").
- **Root cause:** the reason is inferred from tags being absent. The repo's cited issuer disclosure (`tagMap.ts:551-556`, `FINANCE_LEASES_INSIDE_TOTAL_DEBT`) quotes LLY's 10-K: "Finance leases are included in … short-term borrowings and current maturities of long-term debt, and long-term debt". The PR's README defines "finance leases presented as debt" as "lease obligations the filer reports inside its debt lines", so LLY's `DebtCurrent` and `LongTermDebtNoncurrent` lines should cover `financeLeases`, as NUE's and KO's lines do. `tagMap.ts:546-547` also forbids basing this on tag presence or absence. No value changes: LLY is still 1,635 + 40,868 = 42,503M.
- **Reproduction:** `grep -n 0000059478 -A5 lib/analyzer/acquisition/tagMap.ts` against the new lly.json text.
- **Smallest fix:** add `"financeLeases"` to the `covers` of both LLY lines, cite the `FINANCE_LEASES_INSIDE_TOTAL_DEBT` record, and drop `notPresented.financeLeases`.

## Verified (no defect)

- **KO recomputed:** 1,551 + 1,822 + 42,119 = 45,492M. The 1,822M and 42,119M match the capture at 2025-12-31 / 0001628280-26-010047. CP 1,495M is in the capture; the remaining 56M = 1,551 − 1,495. `NotesAndLoansPayable` 1,551M is not in the trimmed capture, so it is checked only against the contract's quoted SEC evidence; I made no SEC request.
- **Every presentedLine checked against the capture** with my own script (`scratch/lines.py`): MSFT 40,294; COST 6,162; NVDA 8,468; NUE 7,121; LLY 42,503; KO 45,492 all foot, and every line except KO's NotesAndLoansPayable equals its capture row. No other golden value changed. JPM and OKLO stay null.
- **RED/GREEN:** with base `ko.json` restored (`git apply -R --include=…ko.json`), `debtDefinition.test.ts` fails 4 KO tests and passes 21. A more adversarial base (old value plus honest lease-inclusive lines plus a stated reason) would still fail the capture check on CP 1,495M. GREEN at head. File restored; tree clean.
- **Checks:** `npx tsc --noEmit` exits 0. `npx vitest run`: 2705 passed, 1 failed (the known environment-only `scripts/evidence/selfTest.test.ts` Playwright failure). Golden/AR2 harness (goldenFacts, ar4Engine, valuationInvariants, knownReds, tagDrift, debtDefinition) and bridgeInputRecovery all green.
- **Contract limits:** no change to D1–D4, the bridge policy, NVDA's finance-lease state or `FINANCE_LEASES_INSIDE_TOTAL_DEBT`. `roicFloor.json` already carried KO FY2025 = 45,492M, which is consistent.

## DONE WHEN / DO / VERIFY

| Item | Status | Evidence |
|---|---|---|
| DO 1: call out as an evaluator (golden data) change | MET (commit) / unverified (PR body) | Commit message: "Evaluator (golden data) change." PR body not available |
| DO 2: KO golden = presented total, with accession and line labels | MET | `ko.json` totalDebt 45,492,000,000, accn 0001628280-26-010047, presentedLines. Labels are XBRL standard labels, not the filing's face labels (www.sec.gov blocked; disclosed) |
| DO 3: one golden invariant under one written definition | MET (with F2) | `golden/debtDefinition.test.ts`, `golden/README.md` "Total debt". LLY lease classification is wrong (F2) |
| DO 4: report the engine's KO total; fix in-concept with a RED test | NOT MET | F1. Engine KO = 43,558M, omits captured CP 250M and other notes payable; no tagMap change, no RED test |
| VERIFY: invariant RED on old KO, GREEN after | MET | 4 KO failures on base ko.json; 25/25 at head |
| VERIFY: other golden companies pass | MET | MSFT, COST, NVDA, NUE, LLY green; JPM and OKLO null |
| VERIFY: AR2 harness green | MET | golden/* suites pass |
| VERIFY: `tsc --noEmit` clean | MET | exit 0 |
| VERIFY: `npm test` green on head | MET (local) | 2705/2706; the one failure is the known environment-only Playwright test |
| DONE WHEN: one PR open | UNVERIFIED | No GitHub access |
| DONE WHEN: fresh HEAVY REVIEW ACCEPT with CI green | NOT MET | This review is CORRECT; CI not visible |
| DONE WHEN: PR merged | NOT MET | Pending |

## Nits (not counted)

- The capture check in `debtDefinition.test.ts` lists `OtherShortTermBorrowings` and `NotesAndLoansPayable`, but no trimmed AR6 capture contains either tag, so those two checks can never fire. KO's RED comes only through `CommercialPaper`.
- The "equals sum of presented lines" test compares hand-typed numbers inside the same file. Also asserting each line value against its capture row, where one exists, would make it independent; I checked those values by hand and they match.
- The COST and MSFT `notPresented.shortTermBorrowings` reasons name `OtherShortTermBorrowings` and `NotesAndLoansPayable`, which the trimmed capture cannot show. The claim rests on the builder's live fetch.
