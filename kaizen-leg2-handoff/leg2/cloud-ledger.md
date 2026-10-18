# Leg 2 cloud continuation ledger (O4 onward)

Operator: Claude Code cloud session `session_01J5uiG2ZcmLTBevbgQXsq6W` (Opus 5.5), branch
`claude/optimistic-turing-fkla3u` built on `kaizen/leg2-handoff` @ `ea22edb` (that branch is untouched).
Authority: Calvin's GO Leg 2 (18 Oct 2026) + his cloud instruction "Resume O4–O6 under the existing approved
experiment plan" (18 Oct, ~15:35Z). Evidence only; never merge this branch.

## Verification before resuming (15:36–15:39Z)
- `origin/master` = `a8058b7` (merge of #482). O1 #478 → db83c04, O2 #480 → e5d8933, O3 #482 → a8058b7: all merged.
- Actions: 0 runs in_progress, 0 queued. Last run: owner-on-merge for #482 at 15:22:33Z, skipped (lean-sop guard).
- Receipts: last arm-A chain (#477/#478) is closed by COMPLETE (14:09:08Z); #482 has no comments.
- `lean-sop` issues: #479, #481, both closed. Open PRs: only #466 (held; untouched).
- Sessions: the local Leg-1/Leg-2 operator session is idle ("safe to transfer to Cloud"); no other active session.
- O4 defect present on master: `gate.ts:375` `isSupportedTicker(run.ticker)`; `:69-70` `analystInputsFor(ticker)` (no runId);
  `gate.ts` and `golden/ko.json` unchanged since `a2e9ae2`.

## Cloud capabilities (measured, not assumed)
- GitHub: MCP as `calyeap` (read + write); `gh` CLI unusable (GH_TOKEN invalid); REST GETs via curl work.
- Node v22.22.0, npm 10.9.4; `npm ci` 12 s.
- PostgreSQL 16 in-container (started with `pg_ctlcluster 16 main start`; password set for TCP auth).
- sec.gov: HTTP 403 (blocked), as the handoff predicted.
- Baseline on `a8058b7`: `npx tsc --noEmit` clean; `npm run migrate` OK; `npm test` 2678 passed / 1 failed (195 s).
  The one failure is environment-only: `scripts/evidence/selfTest.test.ts` needs Playwright
  `chromium_headless_shell-1243`; the container ships -1194 (same failure O1's cloud BUILD reported).
- KO capture (`captures/ar6-2026-10-18/ko-companyfacts.json`) holds CommercialPaper 1,495M,
  LongTermDebtAndCapitalLeaseObligationsCurrent 1,822M and LongTermDebtAndCapitalLeaseObligations 42,119M at 2025-12-31,
  but not NotesAndLoansPayable (1,551M): in the cloud that line is verifiable only from the contract's quotation.

## O4 CF-LEG2-PINNED-REOPEN-01 (arm A)
- 15:39Z issue #483 posted (contracts.md §O4 verbatim in the o3-issue format; master line updated to a8058b7).
- 15:39:54Z `needs-build-wake` applied (dispatch). Routing run 39141499602 created 15:39:56Z.
- 15:40:06Z BUILD START (session cse_017v2MQtRQSCzsHiBm7RcZMp, BUILD-39141499602-1, CONTRACT e95d555e8dbf).

## O6 status
- No released roadmap outcome: AR6 held (Calvin NO on #466; RULING B on #467); AR7 #455 "needs AR6 (#454) merged";
  #455–#458 are off-limits. O6 needs Calvin's release (genuine decision).
- Candidate surfaced by the O2 audit and re-verified on a8058b7: `app/components/QuickRead.tsx:375`/`:383` say
  "A capital structure this levered…" / "The net debt ratio itself…" in the `LEVERAGE UNSUPPORTED IN v1` branch,
  which also covers never-measured leverage (NVDA).

## New cloud measurement: arm-A routine usage is visible
`get_session` (claude-code-remote) on a routine's `cse_…` id (as `session_…`) returns its usage once idle.
This closes the handoff confound "arm-A routine token usage is not visible" for O1 retroactively, and for O4/O5.
`ctx` = final context tokens (`context_usage.used_tokens`), the same kind of figure as arm B's per-agent totals.

| Outcome | Routine | Session | ctx tokens | output tokens | cost USD |
|---|---|---|---|---|---|
| O1 | BUILD | session_017d7Phu2QU8otR8RLKsP9oF | 121,308 | 20,348 | 2.0005 |
| O1 | REVIEW | session_011y8nzcoPQkveJfojhtRpND | 94,343 | 8,354 | 1.1704 |
| O1 | OWNER | session_017M91J9tFqwG7vY2XbhJpCd | 72,386 | 2,286 | 0.5057 |
| O1 | total | 3 sessions | 288,037 | 30,988 | 3.6766 |

Routine sessions run in the same cloud environment as this operator (`env_01QhyqYXtNW7xqtB6L5bA5Jo`), Opus 5.5,
permission mode auto (`routine:auto-mode-forced`).

## O4 receipts (continued)
- 15:48:33Z PR #484 opened (head `ad9da6b`, 2 files, +125/−1; branch claude/optimistic-sagan-dw3g4k).
- 15:48:46Z BUILD DONE → #484. BUILD session usage: ctx 94,917, output 13,449, $1.2421.

## Why arm A has zero Calvin touches (structural, verified)
- `.github/ai-routines/CC.md:56` — REVIEW itself merges: "Otherwise merge the exact reviewed head and verify the merge landed."
- O1: REVIEW ACCEPT 14:08:06Z → #478 merged 14:08:12Z → OWNER START 14:08:23Z. The merge is REVIEW's, under auto mode
  (routine sessions carry `routine:auto-mode-forced`).
- Arm B's merge moved to Calvin only because the local operator's `gh pr merge` was blocked by auto mode
  ("Merge Without Review"); the handoff forbids the operator merging, so O6 keeps Calvin's manual merge.
- Arm A also pings Calvin once per outcome: OWNER's `COMPLETE:` sends an informational Slack FINISHED (OWNER.md).
  Not a touch (no action), but an attention event.
- 15:48:57Z REVIEW START (session cse_014WoBQm8wYKsThoA41jGBfV, REVIEW-39142163149-1).
- 15:52:37Z CI "typecheck and tests" success on exact head `ad9da6b` (run 39142146684).
- 15:54:38Z REVIEW `ACCEPT:` head ad9da6b, HEAVY, CI green on exact head. REVIEW usage: ctx 82,322, output 7,125, $0.8253.
- 15:54:41Z #484 merged by the REVIEW routine (as calyeap) → master `2d7f38e`. Elapsed dispatch→merge 14.8 min.
- 15:54:53Z OWNER START wake=MERGE (session cse_0113EWV4skscRudvwAtPzQuY).
- ~15:55Z blind audit launched: fresh Opus agent, high effort, workspace built by mkreview-cloud.sh at ad9da6b
  (contract + diff + RUBRIC; no PR body, no arm label; DB leg2c_audit_o4). O5 waits for this audit (stop rule).
- 15:55:40Z OWNER `COMPLETE:` (OWNER usage: ctx 72,173, output 2,561, $0.5096). 15:55:42Z Slack "Notify Calvin" run
  success (informational FINISHED). Issue #483 closed (completed). No runs active.
- O4 control-plane comments: 6 (#483: BUILD START, DONE; #484: REVIEW START, ACCEPT, OWNER START, COMPLETE).
- O4 routine totals: 3 sessions, ctx 249,412, output 23,135, **$2.5770**.
- O5 defect re-verified on master `2d7f38e`: KO golden totalDebt 43,941,000,000
  (LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities); NUE = LTD + current + ShortTermBorrowings;
  LLY = DebtLongtermAndShorttermCombinedAmount.
- 16:01Z O4 blind audit returned `ACCEPT` (no material finding). Agent: 111,925 tokens, 24 tool uses, 6.5 min.
  Operator reproduction of its core claim: base gate.ts → new test 1 failed (RunNotFoundError at gate.ts:378) | 1 passed;
  head → 2 passed. Audit nits (not counted): stale comment aiProposedBundle.ts:193-196; offline not.toHaveBeenCalled trivially true.
  Harness lesson: `vitest.setup.ts` refuses a DB whose name does not end in `_test`; the auditor created
  `leg2c_audit_o4_test`. Later workspaces use `*_test` names.
- Scorecard row 4 appended. Issue body archived as contracts/o4-issue.md; audit as reviews/audit-o4-REVIEW.md.

## O5 CF-LEG2-KO-GOLDEN-DEBT-01 (arm A)
- Pre-dispatch: 0 runs in_progress/queued; O4 chain closed by COMPLETE; O4 audit back (no stop rule fired).
- 16:02Z issue #485 posted (contracts.md §O5 verbatim in the o3-issue format; master line 2d7f38e).
- 16:02:33Z `needs-build-wake` applied (dispatch).
