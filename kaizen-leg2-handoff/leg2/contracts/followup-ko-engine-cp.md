OUTCOME-ID: `CF-KO-ENGINE-COMMERCIAL-PAPER-01`
TIER: HEAVY

Title: `[AI BUILD] CF-KO-ENGINE-COMMERCIAL-PAPER-01 — KO's acquired total debt leaves out its tagged commercial paper`

(DRAFT follow-up from the Leg 2 O5 blind audit. Posted only if Calvin releases it. Not a Leg 2 sample.)

## OUTCOME
Wherever a filer tags commercial paper, the engine's acquired total debt includes it, under every `total-debt` candidate, as the approved basis already states.

## Evidence (reproduced at PR #486's head `e8016aa`, merged as `c2db01a`)
- `lib/analyzer/acquisition/tagMap.ts` total-debt basis: "commercial paper and other short-term borrowings … are added where tagged". `CommercialPaper` is a component of candidates 1 and 4, but not of the last candidate (`LongTermDebtAndCapitalLeaseObligations` + current + `ShortTermBorrowings`).
- KO resolves through that last candidate: 43,558M at 2026-04-03. Its pinned capture tags `CommercialPaper` 250M at that instant (and 1,495M at 2025-12-31).
- With `CommercialPaper` added to the last candidate, KO becomes 43,808M. No other golden company's value moves; NUE's recorded composition gains "CommercialPaper absent".

## DO
1. RED: a test that KO's acquired total debt includes its captured commercial paper at 2026-04-03.
2. Add `CommercialPaper` to the last candidate. Bump `TAG_MAPPING_VERSION` with the review note the file requires.
3. Re-pin the KO value and the KO/NUE composition expectations in `bridgeInputRecovery.test.ts` as a called-out evaluator change.

## VERIFY
- RED turns GREEN.
- MSFT, COST, NVDA, NUE and LLY values are unchanged.
- The AR2 harness is green, `npx tsc --noEmit` is clean, and `npm test` is green on the exact head.

## DO NOT
- Do not map `NotesAndLoansPayable` or `OtherShortTermBorrowings`. KO's remaining 82M (2026-04-03) / 56M (FY2025) is a debt-concept decision for Calvin.
- Do not change finance-lease handling, D1–D4, or golden values.

## DONE WHEN
One PR; fresh independent HEAVY REVIEW ACCEPT on the exact head with CI green; merged. **Recovery:** revert; no data is written.

## ESCALATE ONLY IF
Adding the tag changes any golden company's value other than KO's.
