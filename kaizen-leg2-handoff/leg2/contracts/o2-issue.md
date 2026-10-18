OUTCOME-ID: `CF-LEG2-RATE-DOMAIN-COPY-01`
TIER: NORMAL

## Authority
Calvin's GO (18 Oct 2026) for KAIZEN Proof Leg 2. The defect was found by the Leg-1 independent replay and re-verified present on master (`a2e9ae2`/`f7498c4`). Reproduce first (RED), then fix (GREEN). If it does not reproduce on current master, stop with the evidence; that is a valid outcome.

## OUTCOME
The discount-rate domain statement is true in every leverage state.

## Evidence
- `lib/analyzer/assemble.ts:459` passes `leveragePass: leverage.result === "PASS"`, and `lib/analyzer/discountRate.ts:70` sets `withinValidatedDomain: inputs.leveragePass`.
- So when leverage cannot be measured (`LEVERAGE UNSUPPORTED IN v1`, `netDebtRatio: null`), the result is `false`.
- Two sites then print "Outside its validated domain: net debt is not below 10% of enterprise value.": `app/components/AnalyzerReport.tsx:456` and `lib/analyzer/trustCopy.ts:315`.
- NVDA's real run is one such case: its leverage is unmeasured, yet its filings show net cash. The independent replay reproduced the false sentence in Section E on NVDA's real gated run.

## DO
1. RED test: on a run whose leverage is unmeasured, the report and the trust copy currently state the false sentence.
2. Make the domain state three-way: measured PASS, measured ≥10%, or not measured.
   - Keep today's sentence only when the ratio was measured at 10% or more.
   - Otherwise state plainly that net debt could not be measured, so the rate's validated domain is unknown.
   - Update `types.ts`, both copy sites and any consumers.
3. Add tests for all three states.

## VERIFY
- RED turns GREEN.
- PASS shows no sentence, measured ≥10% shows today's sentence, and unmeasured shows the unknown-domain sentence.
- `npx tsc --noEmit` is clean.
- `npm test` is green on the exact head.

## DO NOT
- Do not change rate selection, D1 values, the leverage computation or any number.
- Do not touch PR #466 or #454.

## DONE WHEN
- One PR is open with CI green on the exact head.
- A fresh independent REVIEW returns ACCEPT.
- The PR is merged.

**Recovery:** revert.

## ESCALATE ONLY IF
The wording needs a methodology decision rather than a factual statement.
