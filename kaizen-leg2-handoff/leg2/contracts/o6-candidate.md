OUTCOME-ID: `CF-LEG2-QUICKREAD-LEVERAGE-COPY-01`
TIER: NORMAL

Title: `[AI BUILD] CF-LEG2-QUICKREAD-LEVERAGE-COPY-01 — the Quick Read calls a never-measured capital structure "this levered"`

(DRAFT. Posted only if Calvin releases it as O6, arm B, `lean-sop`.)

## Authority
Calvin's release of this outcome as KAIZEN Leg 2 O6 (arm B). Found by the O2 (#480) blind audit; re-verified on master `a8058b7`. Reproduce first (RED), then fix (GREEN). If it does not reproduce on current master, stop with the evidence; that is a valid outcome.

## OUTCOME
Every leverage statement in the Quick Read is true in every leverage state.

## Evidence
- `app/components/QuickRead.tsx:328` treats `gates.leverage.result === "LEVERAGE UNSUPPORTED IN v1"` as one case. That result covers both a measured net debt at or above 10% of EV and a net debt that was never measured (a REQUIRED §6.5 input missing, `netDebtRatio: null`, as on NVDA's real run).
- In both cases the Quick Read prints "A capital structure this levered can no longer be treated as a straightforward unlevered claim" (`:375`) and "The net debt ratio itself and whether it is likely to change" (`:384`). On an unmeasured run both are false: no ratio exists.
- #480 fixed the discount-rate domain sentence for the same split (`lib/analyzer/discountRate.ts:83` `rateDomainFromLeverage`: WITHIN / OUTSIDE / NOT MEASURED).

## DO
1. RED: on a run whose leverage is unmeasured, the Quick Read (plain and linked forms) states the false lines.
2. Make every statement in that branch follow the measured / not-measured split, reusing the existing mapping:
   - measured at 10% or more: today's lines;
   - not measured: say plainly that net debt could not be measured, so leverage is unknown.
3. Tests for both states, and that a PASS run is unaffected.

## VERIFY
- RED turns GREEN.
- Measured ≥10% keeps today's copy; unmeasured shows the unknown-leverage copy.
- `npx tsc --noEmit` is clean.
- `npm test` is green on the exact head.

## DO NOT
- Do not change the gate result, the leverage computation, rate selection, suppression or any number.
- Do not touch PR #466 or #454.

## DONE WHEN
- One PR is open, labelled `lean-sop`.
- A fresh, independent HEAVY review returns ACCEPT on the exact head, with CI green.
- Calvin merges it.

**Recovery:** revert.

## ESCALATE ONLY IF
The wording needs a methodology decision rather than a factual statement.
