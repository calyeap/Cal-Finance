OUTCOME-ID: `CF-LEG2-KO-GOLDEN-DEBT-01`
TIER: HEAVY

## Authority
Calvin's GO (18 Oct 2026) for KAIZEN Proof Leg 2. The defect was found by the Leg-1 independent replay and re-verified on master (`2d7f38e`; `lib/analyzer/golden/ko.json` is unchanged since `a2e9ae2` and `facts.totalDebt` is still 43,941,000,000). Reproduce first (RED), then fix (GREEN). If it does not reproduce on current master, stop with the evidence; that is a valid outcome.

## OUTCOME
Every golden company's total debt follows one stated definition and matches its presented balance sheet.

## Evidence
KO FY2025 10-K, accession `0001628280-26-010047`, SEC companyfacts, 2025-12-31:
- `NotesAndLoansPayable`: 1,551,000,000. Commercial paper (1,495,000,000) sits inside this line.
- `LongTermDebtAndCapitalLeaseObligationsCurrent`: 1,822,000,000.
- `LongTermDebtAndCapitalLeaseObligations`: 42,119,000,000.
- Presented total: **45,492,000,000.**
- `lib/analyzer/golden/ko.json` `facts.totalDebt` = 43,941,000,000 (`LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities`). It leaves out the short-term loans and notes.
- NUE and LLY include short-term borrowings, so the definitions are inconsistent.

## DO
1. This is an evaluator change: golden data. Call it out in the PR as a separate, consequential change.
2. Correct KO's golden total debt to the presented-balance-sheet total, with its accession number and line labels.
3. Add one golden invariant: for every golden company, total debt equals the sum of its presented debt lines under one written definition (short-term borrowings + current maturities + long-term debt + separately-presented finance leases, as the engine's debt concept defines them).
4. Report whether the engine's own KO total debt on the pinned capture includes the $1.551B.
   - If it does not, and the fix is a tag inside the existing approved debt concept (the short-term borrowings family), fix it here with a RED test.
   - Otherwise stop and report.

## VERIFY
- The new invariant is RED on today's KO golden value and GREEN after the fix.
- Every other golden company passes, or any differences are explained.
- The AR2 harness is green.
- `npx tsc --noEmit` is clean.
- `npm test` is green on the exact head.

## DO NOT
- Do not change other golden values without the same presented-statement evidence.
- Do not change the D1–D4 rules, the bridge policy (#467 Option B) or NVDA's finance-lease state.
- Do not touch PR #466 or #454.

## DONE WHEN
- One PR is open.
- A fresh, independent HEAVY REVIEW returns ACCEPT on the exact head, with CI green.
- The PR is merged.

**Recovery:** revert. It is data in the repo only.

## ESCALATE ONLY IF
The debt definition itself needs a methodology decision.
