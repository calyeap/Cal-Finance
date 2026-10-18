# Cloud-first SOP: one outcome through the existing workflow

**Status:** proposed by KAIZEN Leg 2 (see `RESULT.md`). Demonstrated on O4 and O5 from a Claude Code cloud session: about 14 min from dispatch to merge, 0 Calvin touches, 6 receipts, $2.6–4.2 per outcome. It changes no workflow file; it only moves the operator from Calvin's machine to the cloud.

```
Calvin: release an outcome ──► cloud session: contract issue + needs-build-wake
   ──► BUILD routine → PR ──► REVIEW routine → ACCEPT + CI green on exact head → REVIEW merges
   ──► OWNER routine → COMPLETE (+ one informational Slack FINISHED)
```

## Who does what

| Calvin | Cloud session (Claude Code, Default environment, repo calyeap/Cal-Finance) |
|---|---|
| Releases the outcome (the contract is his authority) | Drafts the contract, re-verifies its evidence on current master, posts it, dispatches it, reports the result |
| Answers a `CALVIN REQUIRED:` gate (rare) | Never answers one for him |
| Runs production `npm run migrate` locally, after a `pg_dump`, when a merged PR adds a migration | Never touches Calvin's databases |

## Steps (cloud session)

1. **Quiet check.** No Actions run is `in_progress` or `queued`, and the last START receipt has its terminal. Otherwise wait: one outcome at a time.
2. **Contract.** Open an issue whose first lines are `OUTCOME-ID:` and `TIER:`, followed by OUTCOME, Evidence, DO, VERIFY, DO NOT, DONE WHEN (with Recovery) and ESCALATE ONLY IF. Post only what Calvin released.
3. **Dispatch.** Apply `needs-build-wake`. The GitHub MCP acts as `calyeap`, so the routing allow-list admits it. BUILD START follows within 9–12 s.
4. **Hands off.** Watch the receipts (BUILD START → DONE → REVIEW START → ACCEPT/CORRECT → OWNER START → COMPLETE). Do not comment, label or merge.
5. **Report.** PR, merge SHA, elapsed time and cost. Cost is the sum of `get_session` usage over the three routine sessions named in the receipts.
6. **Recommended for HEAVY finance or golden-data outcomes:** one blind audit after the merge, by a fresh Opus subagent. It takes about 7 min and 110–130k tokens.
   - **Why:** it is the only check that caught Leg 2's one escaped defect (O5, a contract miss that REVIEW accepted). Leg 1 found the same class (#463).
   - **Inputs:** exact head, diff and contract only; no PR body.
   - **Database:** name it `*_test`, because `vitest.setup.ts` refuses any other name.
   - **SEC:** unset `SEC_USER_AGENT`; make no sec.gov request.
   - **Builder:** `mkreview-cloud.sh`.
   - **Before acting:** reproduce a finding yourself. A reproduced material finding becomes a follow-up contract for Calvin's release; never a direct fix.

## Never

- Merge yourself, or apply a wake label to anything not meant to run.
- Start a comment line with `CORRECT`, `DONE:`, `BLOCKED:`, `STOP:`, `CALVIN RULING` or `CALVIN REQUIRED:`. The session acts as `calyeap`, and routing trusts `calyeap`-authored comments.
- Put an email address in any request. The environment's `SEC_USER_AGENT` belongs to the repo's SEC client and routines, not to the operator.
- Touch PR #466, #454 or the AR7/AR8 gates (#455–#458) without Calvin's release.

## Cloud environment facts (measured 18 Oct 2026)

- The `gh` CLI is not authenticated; use the GitHub MCP for writes and `curl` to api.github.com for reads.
- PostgreSQL 16 is installed but stopped. It is needed only for audits: `pg_ctlcluster 16 main start`, then set a password for TCP.
- `scripts/evidence/selfTest.test.ts` fails in this container only, because Playwright's `chromium_headless_shell-1243` is missing (it ships 1194). This is environment-only; CI is the binding check.
