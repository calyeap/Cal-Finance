OUTCOME-ID: `CF-LEG2-DECIDED-FACT-GATING-01`
TIER: HEAVY

## Authority
Calvin's GO (18 Oct 2026) for KAIZEN Proof Leg 2. The defect was found by the Leg-1 independent replay and re-verified in code on master (`a2e9ae2`, unchanged since). Reproduce first (RED), then fix (GREEN). If it does not reproduce on current master, stop with the evidence; that is a valid outcome.

## OUTCOME
AR3 DO 2 holds on the real path: "a contradicted fact blocks every output that depends on it" (issue #451).

## Evidence
- `lib/analyzer/acquisition/companyInputs.ts:414` and `:466` build `price` with `provenance: CLEAN_PROVENANCE`, whatever the run's decided `price` fact says.
- On 17 Oct (AR3 head `cea1b49`), two independent reviewers reproduced the defect on a real MSFT run. Deciding `price` NOT CONFIRMED / CONTRADICTED BY SOURCE left the following unchanged:
  - enterprise value;
  - the fair-value range;
  - every reverse-DCF cell;
  - the verdict.
- The same was true of `current-operating-margin`, through `reverseDcf.ts`'s margin-level list. AR4 has since rewritten `reverseDcf.ts`, so the margin half needs re-checking.

## DO
1. RED: write a DB-backed real-run test (offline captures, test DB). It decides each queued fact NOT CONFIRMED in turn: `price`, `current-operating-margin`, and every other queued material fact. Assert that the fact's dependents are suppressed and that no verdict is issued.
2. Carry each decided fact's provenance into every input built from it, using the existing `decideFacts`/`raw()` and `combineProvenance` seams.
3. Show that an all-CONFIRMED run's outputs are byte-identical to today's.

## VERIFY
- RED turns GREEN for the reported reason.
- Outputs that do not depend on the contradicted fact stay computed.
- The all-confirmed run is unchanged.
- The AR2 harness is green.
- `npx tsc --noEmit` is clean.
- `npm test` is green on the exact head.

## DO NOT
- Do not change approved rule values, timing, D1–D4, thresholds or the meaning of a fact state.
- Do not change migrations.
- Do not touch PR #466 or #454.

## DONE WHEN
- One PR is open.
- A fresh, independent HEAVY REVIEW returns ACCEPT on the exact head, with CI green.
- The PR is merged.

**Recovery:** revert. No data is written.

## ESCALATE ONLY IF
Deciding which outputs depend on a fact needs a methodology choice that the contract does not settle.
