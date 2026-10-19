OUTCOME-ID: `CF-LEG2-KO-COMMERCIAL-PAPER-01`
TIER: HEAVY

Title: `[AI BUILD] CF-LEG2-KO-COMMERCIAL-PAPER-01 — KO's acquired total debt leaves out its tagged commercial paper`

(PROPOSED O6, arm B (lean SOP). Posted with the `lean-sop` label, and only if Calvin releases it.)

## Authority
Calvin's release of this outcome as KAIZEN Leg 2 O6 (arm B). It is an AR6 input follow-up, in the bridge-input lineage of #467/#468: found by the O5 blind audit and reproduced on master `c2db01a`. Reproduce first (RED), then fix (GREEN). If it does not reproduce on current master, stop with the evidence; that is a valid outcome.

## OUTCOME
Wherever a filer tags commercial paper, the engine's acquired total debt includes it under every `total-debt` candidate, as the approved basis already states.

## Evidence (reproduced at `c2db01a`)
- **The approved basis:** the `total-debt` entry in `lib/analyzer/acquisition/tagMap.ts` says "commercial paper and other short-term borrowings sit outside it and are added where tagged".
- **The gap:** `CommercialPaper` is a component of candidates 1 (`:240`) and 4 (`:246`), but not of the last candidate (`LongTermDebtAndCapitalLeaseObligations` + `…Current` + `ShortTermBorrowings`).
- **KO today:** KO resolves through the last candidate, giving 43,558M at 2026-04-03. Its pinned capture (`captures/ar6-2026-10-18/ko-companyfacts.json`) tags `CommercialPaper` at 250M on that date (1,495M at 2025-12-31).
- **With the fix:** adding `CommercialPaper` to the last candidate makes KO 43,808M. No other golden company's value moves; NUE's recorded composition gains "CommercialPaper absent".
- **Downstream:** KO's EV stays suppressed (no finance-lease input), so no valuation output moves.

## DO
1. RED: a test that KO's acquired total debt includes its captured commercial paper at 2026-04-03.
2. Add `CommercialPaper` to the last candidate. Bump `TAG_MAPPING_VERSION` (now `calboard-secmap-2026-10-2`) with the review note the file requires.
3. Re-pin the KO value and the KO/NUE composition expectations in `bridgeInputRecovery.test.ts`. Call this out as an evaluator change.

## VERIFY
- RED turns GREEN for the reported reason.
- MSFT, COST, NVDA, NUE and LLY total-debt values are unchanged.
- The AR2 harness is green.
- `npx tsc --noEmit` is clean.
- `npm test` is green on the exact head.

## DO NOT
- Do not map `NotesAndLoansPayable` or `OtherShortTermBorrowings`. KO's remaining 82M (at 2026-04-03) and 56M (FY2025) are a debt-concept decision for Calvin.
- Do not change finance-lease handling, D1–D4, the bridge policy (#467 Option B), golden values or migrations.
- Do not touch PR #466 or #454.

## DONE WHEN
- One PR is open, labelled `lean-sop`.
- A fresh, independent HEAVY review returns ACCEPT on the exact head, with CI green.
- Calvin merges it.

**Recovery:** revert. No data is written.

## ESCALATE ONLY IF
Adding the tag changes any golden company's value other than KO's, or the debt concept needs a methodology decision.
