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
- 16:02:32Z `needs-build-wake` applied (dispatch). This is GitHub's labeled-event time; the container clock read 16:02:33Z.

## Correction: what "sec.gov is blocked" means in this cloud environment (16:13Z)
- `data.sec.gov`: the proxy allows CONNECT; SEC itself answers HTTP 403 to a User-Agent without a contact email
  (the experiment's rule forbids an email in any request).
- `www.sec.gov`: the proxy denies CONNECT (policy; recorded in the proxy's relay failures).
- `SEC_USER_AGENT` is set at the environment level (value not read). Routines run in the same environment and use the
  repo's SEC client with it: O5's BUILD fetched live companyfacts. The operator and the blind auditors never use it;
  audits from O5 on run with it unset and are told to make no sec.gov request. (O4's auditor ran one online-mode scratch
  test with acquisition forced to the committed capture; it reports no SEC request, and none was intended.)

## O5 receipts
- 16:02:42Z BUILD START (session cse_01NhoYUtLtkmzuXbiVKLk3YB, BUILD-39143197572-1, CONTRACT 0bae350642b0).
- 16:11:57Z PR #486 opened (head `e8016aa`, 9 files, +212/−11). 16:12:05Z BUILD DONE → #486.
  BUILD's DO 4 report: the engine's KO total debt on the pinned capture omits the loans and notes payable
  (43,558M at 2026-04-03); not fixed here, because the approved short-term-borrowings family recovers only CommercialPaper
  and the other elements are outside the family and absent from the capture. Golden KO 43,941M → 45,492M (evaluator change, called out).
- BUILD usage: ctx 141,514, output 33,846, $2.5014 (worker_epoch 2: the routine's worker restarted once).
- 16:12:16Z REVIEW START (session cse_017cWwsGqNmXrFkNfNLysBXb, REVIEW-39143924043-1).
- Audit workspace pre-built at e8016aa (DB leg2c_audit_o5_test).
- 16:16:16Z CI "typecheck and tests" success on exact head e8016aa.
- 16:16:44Z REVIEW `ACCEPT:` e8016aa, HEAVY, CI green. REVIEW usage: ctx 96,538, output 10,508, $1.2056.
- 16:16:48Z #486 merged by the REVIEW routine → master `c2db01a`. Elapsed dispatch→merge 14.3 min.
- 16:16:58Z OWNER START wake=MERGE (cse_0169hWqKT1RhZveZqzVwg4u7). 16:17:42Z OWNER `COMPLETE:` (no CONTINUE, no new work;
  engine KO debt gap "recorded, not routed"). OWNER usage: ctx 73,780, output 2,452, $0.5095. Issue #485 closed (completed).
- O5 control-plane comments: 6. O5 routine totals: 3 sessions, ctx 311,832, output 46,806, **$4.2165**.
- ~16:17Z O5 blind audit launched (fresh Opus, high effort; SEC_USER_AGENT unset; no sec.gov requests; DB leg2c_audit_o5_test).

## O6 decision analysis (16:18Z)
The pre-registered rule is already decided without O6:
- A elapsed {O1 11.4, O4 14.8, O5 14.3} → median 14.3; 1.5× = 21.45.
- B elapsed {O2 29.2, O3 38.5, O6 x}: the median of three is ≥ 29.2 for any x, so condition 4 fails whatever O6 does.
- Calvin touches: A 0 per outcome; B ≥ 2/3 even if O6 had none (it would have one: Calvin merges arm B). Condition 3 fails.
- So O6 can add evidence about running the lean SOP from the cloud, but cannot change the Leg 2 result.

## O5 blind audit and adjudication (16:25–16:40Z)
- Audit: fresh Opus, high effort, 129,571 tokens, 24 tool uses, 7.7 min. Verdict `CORRECT`.
- **F1 (claimed material):** DO 4 not done. The engine's KO total debt omits CommercialPaper, an in-concept tag.
  Operator reproduction at e8016aa, with the repo's own `resolveEntry` on the six AR6 captures (scratch probe, deleted):

  | Company | as shipped | + CommercialPaper on candidate 5 |
  |---|---|---|
  | KO | 43,558M @ 2026-04-03 | **43,808M** (+250M CP) |
  | NUE | 7,099M | 7,099M (composition records CP absent) |
  | MSFT / COST / NVDA / LLY | 40,294 / 6,162 / 33,366 / 54,908M | unchanged |

  - `tagMap.ts` total-debt basis: "commercial paper and other short-term borrowings … are added where tagged". CP is
    already in candidates 1 and 4 but missing from candidate 5, which KO resolves through.
  - With CP on candidate 5, `bridgeInputRecovery.test.ts` fails at the KO **and NUE** composition assertions (:220, :181).
    So the auditor's "NUE identical" is true for values, not for the recorded composition.
  - Arm-A REVIEW's ACCEPT justified stop-and-report only for `OtherShortTermBorrowings`/`NotesAndLoansPayable`
    (out of family, not captured). It never addressed CommercialPaper (in family, captured).
  - **Ruling: count F1 as 1 escaped material defect for arm A, contested and low impact.**
    - Why it counts: it is reproduced; it misses DO 4's in-family branch for CP; the in-arm review's recorded
      reasoning does not dispose of it.
    - Why it is contested: the BUILD's literal reading ("the full fix is not one in-family tag") is defensible, and the
      PR body disclosed it.
    - Impact: KO's EV is already suppressed (no finance-lease input), so no valuation output moves. The acquired
      fact is understated by 250M (0.6%).
    - Cost if wrong: arm A's escaped count drops from 1 to 0. The verdict is unchanged (B still fails 3 and 4).
  - **Stop rule ("a finance defect merged"): not fired.** The merge introduced no wrong value, and the engine gap
    predates Leg 2. No experiment outcome remains to run on top of it. Reported to Calvin with a ready follow-up
    contract. On 19 Oct that draft became the proposed O6 (`contracts/o6-proposed.md`).
- **F2 (minor):** reproduced. `lly.json` `notPresented.financeLeases` says there is no finance-lease debt line, while
  `tagMap.ts:551-556` cites LLY's 10-K: finance leases are inside its debt lines. No value changes. Not counted (nit).
- Auditor's nits not counted: two capture-check tags can never fire; the line-sum test uses hand-typed values.

## 18 Oct close-out and 19 Oct reconciliation
- 18 Oct 16:31Z: a five-outcome write-up (`RESULT.md`) and a Cloud-first SOP were drafted on
  `claude/optimistic-turing-fkla3u`. On 19 Oct Calvin directed that the final verdict wait for O6, so those drafts
  are superseded by `PROVISIONAL-O1-O5.md` and are not part of this branch.
- Operator session (cloud, Opus 5.5, max effort) through 16:30Z 18 Oct: $15.40. This covers verification, both
  dispatches, watching, two blind audits, the reproductions and the write-up. It is measurement overhead, not either
  arm's per-outcome cost.
- 19 Oct 00:42Z re-verification: master still `c2db01a`; 0 Actions runs in progress or queued; no routine session working.
  The only new activity is an informational evidence note on #470 (no worker).
- O4/O5 reconciled against GitHub's own events (labeled, closed, PR merged_at, CI check runs, receipts). O5's dispatch is
  16:02:32Z (labeled event); everything else matches this ledger.
- Rows 4–5, both blind audits, both issue bodies, this ledger and the cloud audit harness were recorded on
  `kaizen/leg2-handoff`, per Calvin's 19 Oct instruction.
- Never merge `kaizen/leg2-handoff` or `claude/optimistic-turing-fkla3u`: both are evidence only.
- O6 (19 Oct): no AR milestone is eligible without a Calvin decision. AR6 is held (NO on #466; RULING B on #467);
  AR7 #455 needs AR6 merged; AR8 follows AR7. The one eligible AR6 input follow-up is `CF-LEG2-KO-COMMERCIAL-PAPER-01`
  (`contracts/o6-proposed.md`; reproduced at `c2db01a`; no overlap with PR #466's files). It is proposed to Calvin as O6;
  status CALVIN REQUIRED (release). Not posted, and no label applied.

## O6 CF-LEG2-KO-COMMERCIAL-PAPER-01 (arm B, lean SOP, run from the cloud)
- Authority: Calvin, 19 Oct 2026: "Release O6. Proceed with CF-LEG2-KO-COMMERCIAL-PAPER-01 under the already-approved
  Leg 2 lean SOP and the exact proposed contract."
- 03:02Z pre-dispatch: 0 runs active or queued; master `c2db01a`; open PRs: #466 only; no `lean-sop` items open;
  no GitHub activity since 00:45Z. Postgres restarted (the container had restarted).
- 03:03:07Z issue #487 created with `lean-sop` (labeled event 03:03:08Z). The routing run at 03:03:09Z was skipped,
  so the pre-flight guard holds. The body is `contracts/o6-proposed.md` verbatim, minus its title and "PROPOSED" lines
  (archived as `contracts/o6-issue.md`).
- Worker workspace: fresh clone of origin/master at `c2db01a` on `lean/cf-leg2-ko-commercial-paper-01`, `npm ci`
  OK, DB `leg2c_o6_worker_test`; contract fetched from the issue.
- **03:04:07Z dispatch:** one worker launched (fresh Opus agent, high effort, matching the local arm-B session's effort
  and the Leg 1 harness). Brief = briefs.md WORKER, adapted for the cloud:
  - no `gh`: push with git; PR and `lean-sop` label via the GitHub MCP (as calyeap);
  - `_test` DB;
  - Playwright environment-only failure noted;
  - no sec.gov requests, with `SEC_USER_AGENT` unset;
  - posts no comments;
  - never merges.
- 03:12:32Z PR #488 opened by the worker (head `ad11789`, base `c2db01a`, 1 commit, 3 files, +173/−8:
  `tagMap.ts`, `bridgeInputRecovery.test.ts`, `docs/tag-mapping-version-review.md`). Labelled `lean-sop` at
  03:12:35Z. The routing run on the label was skipped; CI started 03:12:34Z. No comments on #487 or #488.
  Worker usage: 151,940 tokens, 41 tool uses, 8.6 min.
  - Worker's claims (evidence, not proof):
    - `CommercialPaper` added to the last candidate; `TAG_MAPPING_VERSION` → `calboard-secmap-2026-10-3`.
    - New RED tests: 43,558M → 43,808M at 2026-04-03; FY2025 43,941M → 45,436M.
    - Only KO's values move; NUE records CP absent.
    - Full suite 2707 passed / 1 failed (Playwright, environment-only).
- ~03:14Z review cycle 1: fresh HEAVY reviewer (Opus, high effort) on exact head `ad11789`. Inputs: repo, diff, contract,
  PR body as evidence, RUBRIC = heavy-slim; DB `leg2c_o6_rev1_test`; no GitHub access.
