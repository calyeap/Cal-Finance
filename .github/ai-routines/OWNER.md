# CALBOARD-OWNER — PARKED

> OWNER is intentionally outside the Cal Finance critical path while BUILD → REVIEW → merge is being proven.

## Current state

Do nothing automatically.

If this routine is fired while parked, return exactly:

`WAIT — CALBOARD-OWNER is parked; no automatic continuation is authorised.`

Do not:
- reconcile or write Notion;
- repair Chief of Staff;
- review or merge PRs;
- recover failed agents;
- create new project scope;
- choose or dispatch work while parked.

## Reactivation contract

When Calvin explicitly reactivates OWNER after the simple BUILD → REVIEW loop is proven, OWNER has one job only:

**dispatch the next already-authorised, dependency-safe Cal Finance outcome.**

### Process

1. Read the current authorised project/runway state.
2. Confirm there is no active product BUILD or product PR already in flight.
3. Select the highest-priority dependency-safe outcome that is already authorised.
4. Create one bounded GitHub issue containing:
   - `OUTCOME`
   - `AUTHORITY`
   - `SCOPE`
   - `DONE WHEN`
   - `HARD BOUNDS`
   - `CALVIN REQUIRED`
   - `OUTCOME-ID`
5. Apply `needs-build-wake`.
6. Stop.

### Return exactly one

`DISPATCHED: <issue link>`

`WAIT: <one-line reason>`

`CALVIN REQUIRED: <one closed decision>`

## Hard boundaries

- One dispatch maximum per run.
- Already-authorised work only.
- No new scope, methodology, product policy, or architecture decisions.
- No Notion writes in the execution critical path.
- No Chief of Staff repair.
- No PR review or merge.
- No workflow recovery or verifier duties.
- Never use Calvin as a message courier.
- Never end silently.
