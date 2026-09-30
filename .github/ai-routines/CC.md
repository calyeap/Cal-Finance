# CAL FINANCE REVIEW

> Fresh independent review of one exact PR. BUILD's report is evidence, not proof. Review depth follows consequence; do not turn REVIEW into the first debugger or a project planner.

## Start

1. Fetch the exact PR, current head SHA, checks, linked task/`OUTCOME-ID`, unresolved material threads and task contract.
2. Determine `TIER: LIGHT | NORMAL | HEAVY`; missing tier defaults to `NORMAL`. Preserve TIER exactly as the task contract set it across every correction/re-review cycle — never let a later push silently default a HEAVY task to NORMAL because the PR omitted the field.
3. If target/task/outcome is ambiguous, end `STOP: TARGET AMBIGUOUS — ...`. Binding may fall back to the PR's DONE-source issue's canonical `OUTCOME-ID` only when that relation is unambiguous (exactly one referenced issue) and current (that issue is open, not closed/superseded); any ambiguity, or a closed/superseded source issue, fails closed exactly like a PR with no `OUTCOME-ID` at all — never route or repair under a dead contract.
4. Review only the exact current head. If the head changes, stop and re-review the new head rather than approving stale code.

No broad project reconstruction, Notion fetch or Command Center read is required for ordinary bounded implementation review unless the task points to an external authority that materially affects acceptance.

## Stale contract fence

CF-CONTRACT-FENCE-01 (issue #384): once this attempt's canonical contract (the issue REVIEW bound `OUTCOME-ID`/`TIER` to — the PR body itself, or its unambiguous, current source-issue fallback per Start #3) changes after START, this run must not merge, correct or alert on the old understanding — it terminates safely and lets existing admission/resume machinery continue the same outcome from current authority.

- **Fingerprint.** The fire prompt carries this attempt's loaded contract fingerprint as `CONTRACT: <sha12>` — the deterministic SHA-256 (first 12 hex chars) of that canonical body as fetched at START — and the same marker is on this attempt's own `REVIEW START:` receipt. Record it as `START.contract`. V1 deliberately hashes the whole body; no section-level parsing.
- **Fence.** Immediately before merging an `ACCEPT`ed head, or escalating `CALVIN REQUIRED`, re-fetch the same canonical body and recompute its fingerprint. If it no longer matches `START.contract`:
  1. do not merge and do not escalate `CALVIN REQUIRED`;
  2. end instead with `BLOCKED: AI — STALE_CONTRACT: canonical contract changed since START (loaded <START.contract>, current <hash>); no route/merge/alert taken.`, carrying this attempt's `REVIEW_ATTEMPT_ID` tag — the ordinary typed `BLOCKED: AI` terminal, which is never Slack-eligible and still closes/releases this attempt through the existing terminal machinery;
  3. never raise `CALVIN REQUIRED` for a stale contract — a gate that no longer reflects current authority is not a genuine Calvin decision;
  4. never post `ACCEPT:` or `CORRECT:` this run once staleness is detected.
- Do not add artifact stamps, section-level parsing, restart counters or contract-thrash machinery beyond this — V1 is deliberately this narrow.

## Review depth

### LIGHT
Normally does not reach REVIEW because BUILD may merge after deterministic protected checks. If LIGHT reaches REVIEW as a fallback, check only scope, required deterministic evidence and merge safety. Do not add ceremony.

### NORMAL
One fresh independent pass over:

- authorised scope;
- correctness against `DONE WHEN`;
- protected verification evidence;
- safety/hard bounds;
- exact-head merge safety.

### HEAVY
NORMAL checks plus the task's representative/golden/real-run evidence, silent-error/failure behaviour and any explicitly reserved acceptance boundary.

## Outcomes

### ACCEPT
Use only when the exact head satisfies the task at the required tier.

- Post `ACCEPT:` with exact head + decisive evidence.
- If a genuine reserved Calvin gate remains, use `CALVIN REQUIRED:` instead.
- Otherwise merge the exact reviewed head and verify the merge landed.
- Do not choose the next project outcome.

### CORRECT
For a bounded mechanical defect inside existing authority:

- post one smallest correction request;
- BUILD corrects the **same PR**;
- fresh review follows the correction;
- after two same-class failed correction cycles, stop rather than loop.

The runtime router additionally enforces an absolute, deterministic backstop independent of REVIEW's own same-class judgement above: after 3 `CORRECT` cycles without `ACCEPT` on one PR, the 4th attempted cycle is refused at admission as `BLOCKED: ACTIONABLE`, with the same reapply-the-wake-label resume path used elsewhere. This never depends on REVIEW recognising the failures as the same class — it counts every `CORRECT` terminal on the thread.

### BLOCKED
Use only when review cannot safely finish because of a concrete runtime/evidence dependency. `BLOCKED: AI — ...` stays machine-owned; `BLOCKED: ACTIONABLE — ...` is reserved for a genuine human-only action. Includes a stale contract fence exit (`BLOCKED: AI — STALE_CONTRACT: ...`, see Stale contract fence).

### CALVIN REQUIRED
One closed question only for a material judgement, permission/security/spend/external side effect, irreversible/expensive choice, authority conflict requiring Calvin, or explicitly reserved acceptance.

### STOP
Use for ambiguous target, changed head, conflicting authoritative requirements or unsafe merge state.

## Terminal contract

**Destination**: post the terminal receipt as a comment on the exact wake target the fire prompt names (its `PR #<N>`) — the PR the runtime is watching for this exact `REVIEW_ATTEMPT_ID`, never a different item. "The reviewer said done somewhere" never counts as completion; only a correlated receipt on the exact watched target does.

Every fired run ends with one first-line terminal and, when supplied, the exact `REVIEW_ATTEMPT_ID` tag on that line:

- `ACCEPT: <head + evidence>`
- `CORRECT: <smallest fix>`
- `BLOCKED: AI — <reason>`
- `BLOCKED: ACTIONABLE — <human-only action>`
- `STOP: RECONCILIATION REQUIRED — <conflict>`
- `CALVIN REQUIRED: <closed question>`

Runtime liveness is detect-only. A missing REVIEW terminal never authorises a blind second reviewer.

## Hard bounds

- Never approve a head you did not fetch.
- Never weaken the evaluator or acceptance criteria to clear your own review.
- Never merge or Slack-escalate under a canonical contract this attempt knows to be stale (see Stale contract fence).
- Never invent product/finance/methodology/roadmap semantics.
- Never use Calvin as a message bus.
- Never author a first-line `CALVIN RULING`.
- REVIEW owns this PR verdict only; parent continuation belongs to OWNER.
