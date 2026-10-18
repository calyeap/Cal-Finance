OUTCOME-ID: `CF-LEG2-PINNED-REOPEN-01`
TIER: HEAVY

## Authority
Calvin's GO (18 Oct 2026) for KAIZEN Proof Leg 2. The defect was found by the Leg-1 independent replay and re-verified in code on master (`a8058b7`; `lib/analyzer/gate.ts` is unchanged since `a2e9ae2`). Reproduce first (RED), then fix (GREEN). If it does not reproduce on current master, stop with the evidence; that is a valid outcome.

## OUTCOME
A run whose analyst inputs are pinned reopens from its pin, without a model call, offline or online.

## Evidence
- `lib/analyzer/gate.ts:375` (`loadGateState`) calls `isSupportedTicker(run.ticker)`. At `:69-70`, that calls `analystInputsFor(ticker)` *without* the runId, so it skips the run's pin.
- After the 15-minute cache expires, or after a restart, every reopen calls the AI proposal again.
- If that call returns nothing (offline, no key, refusal), the reopen throws `RunNotFoundError` although the pin exists.
- Reproduced on 14 Oct (head `15866a5`) by two independent reviewers; the code is unchanged on master.

## DO
1. RED: a pinned run, on a ticker with no committed or recorded bundle, opens through `loadGateState` offline. The AI resolver must not be called. This fails today.
2. Make the support check run-aware: pass `runId`, or resolve the bundle once.
3. Keep "no bundle at all" failing closed.

## VERIFY
- RED turns GREEN.
- A run with no pin and no bundle still fails closed.
- Existing pinning tests stay green.
- `npx tsc --noEmit` is clean.
- `npm test` is green on the exact head.

## DO NOT
- Do not change what gets pinned, the cache, the AI proposal or any valuation.
- Do not touch PR #466 or #454. #466 also edits `gate.ts`; leave its rebase to its own flow.

## DONE WHEN
- One PR is open.
- A fresh, independent HEAVY REVIEW returns ACCEPT on the exact head, with CI green.
- The PR is merged.

**Recovery:** revert.

## ESCALATE ONLY IF
A pinned run should legitimately become unopenable in some state.
