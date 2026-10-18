OUTCOME-ID: `CF-LEG2-PREFLIGHT-01`
TIER: NORMAL

## Authority
Calvin's GO (18 Oct 2026) for KAIZEN Proof Leg 2, step A: **one pre-flight runtime PR through the existing BUILD → REVIEW → OWNER workflow**, before any Leg 2 outcome runs. This issue is that authorised, directly dispatched BUILD wake.

Read-only evidence on master `a2e9ae2`:
- **No commenter check anywhere.** Every routing job acts on comment *text* and labels:
  - `cc-auto-fire.yml` `fire-build`, `fire-review` and `fire-owner-on-terminal` gate only on text or labels;
  - `calvin-ruling-lib.sh` `calvin_ruling_should_wake` checks only whether the commenter is a bot;
  - `calvin-slack-alert.yml` does the same.

  Outsiders are blocked today only by a repo interaction limit that **expires 18 Apr 2027**.
- **`owner-on-merge.yml` fires OWNER on every merged PR, with no filter.**
- **#474 regression.** `runtime_blocker_owner` classes any `BLOCKED: ACTIONABLE` line containing "egress" as `ai`, so genuine human gates lose the `<!channel>` ping. On the shipped classifier, every line below returns `ai` and `stopped`:
  1. `BLOCKED: ACTIONABLE — refresh BUILD_FIRE_TOKEN (401); egress is not the cause. [OWNER_ATTEMPT_ID: OWNER-1-1]`
  2. `BLOCKED: ACTIONABLE — security: rotate the leaked egress-proxy credential before any worker runs. [OWNER_ATTEMPT_ID: OWNER-1-1]`
  3. `BLOCKED: ACTIONABLE — Calvin must decide the spend/consent policy for paid data egress (Morningstar). [OWNER_ATTEMPT_ID: OWNER-1-1]`
  4. ``BLOCKED: ACTIONABLE — OWNER transport did not recover after 4 attempts (503); reapply the `needs-owner-wake` label to #12 to re-drive. Egress proxy may be degraded. [OWNER_ATTEMPT_ID: OWNER-1-1]``
  5. `BLOCKED: ACTIONABLE — refresh OWNER_FIRE_TOKEN; the egress allow-list itself is fine. [OWNER_ATTEMPT_ID: OWNER-1-1]`

## OUTCOME
Three deterministic runtime guards, and nothing else.

## DO
1. **Isolate the lean arm by label.**
   - In `cc-auto-fire.yml` (every fire job), `owner-on-merge.yml` and `calvin-slack-alert.yml`, skip any target issue or PR that carries the label `lean-sop` (`github.event.issue.labels.*.name` / `github.event.pull_request.labels.*.name`).
   - The check is label-based only: no comment-text parsing.
2. **Allow-list the commenter or sender.**
   - Every `issue_comment`- or `labeled`-triggered job in `cc-auto-fire.yml` and `calvin-slack-alert.yml` acts only when the actor is `calyeap`: `github.event.comment.user.login` for comment events, `github.event.sender.login` for label events.
   - Before relying on this, confirm against the current relay and handoff paths (`terminal-relay.sh`, `owner-continue.sh`, OWNER's label re-drives) that no legitimate wake is authored by another identity. If one is, name it and keep it working.
3. **Fix the #474 regression in `runtime_blocker_owner`.**
   - A strong human marker wins over "egress": `refresh <SECRET_NAME>`, ``reapply the `<label>` label``, `credential`, `security`, `payment`, `consent`.
   - Without a strong marker, the line stays `ai` in three cases, all unchanged from today:
     - it asks to allow, enable, grant or open egress or network access;
     - it cites `CONNECT 403`;
     - it asks a human to supply, provide, paste or copy source text.
   - `permission` and `policy` alone do not override, so the Nucor class keeps today's result.
   - When unsure, page; never silence.

## VERIFY
- **`runtime-lib.test.sh`:**
  - the five lines above classify as `human` / `actionable_blocked`;
  - every existing Nucor and #473 regression stays `ai`.
- **`runtime-wiring.test.sh` / `calvin-slack-alert-workflow.test.sh`:**
  - each guarded job carries both conditions;
  - a `lean-sop` item fires nothing;
  - a non-`calyeap` commenter or sender fires nothing.
- **CI:** all nine runtime test scripts green, `npx tsc --noEmit` clean, and `npm test` green on the exact head.

## DO NOT
- Do not change `BUILD.md`, `CC.md` or `OWNER.md`.
- Do not change finance code, `ci.yml`, tiers, gates, `FROZEN_HASHES`, Slack formatting or dedupe, wake-label semantics, or any other workflow behaviour.
- Do not touch PR #466, #454 or the AR7/AR8 gates.
- Add no new workflow, label, secret, agent, queue or dashboard.

## DONE WHEN
- One PR carries the three guards with their tests.
- CI is green on the exact head.
- A fresh independent REVIEW returns ACCEPT.
- The existing workflow merges it.

**Recovery:** revert the PR. The change is runtime-only and writes no data.

## ESCALATE ONLY IF
A guard cannot be expressed without breaking an existing legitimate wake path. In that case, name the exact path.
