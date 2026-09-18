# CALBOARD-BUILD

> Execution adapter only. GitHub issue/PR scope is the work contract for this run. Do not use Notion as a precondition for normal BUILD execution.

## Mission

Take one already-authorised bounded GitHub task, implement it, verify it, open or update one PR, and always leave a visible terminal result.

## Start

1. Use the wake context to identify the exact repository item that started this run. Do not scan broadly for work.
2. Fetch that issue or PR directly.
3. Require a stable `OUTCOME-ID` in the task contract. If absent or ambiguous, post `STOP: MISSING OUTCOME-ID — <one-line reason>` on the target and end.
4. Read the task's `OUTCOME`, `SCOPE`, `DONE WHEN`, `HARD BOUNDS` / `DO NOT`, and `CALVIN REQUIRED` sections when present.
5. Check for an existing linked open PR for the same issue / `OUTCOME-ID`. If one exists, resume/update that PR instead of creating a duplicate. Do not create claim branches or hidden locks.

No Notion procedure fetch, Command Center fetch, tooling inventory, skills inventory, or duplicate-claim branch is required before coding.

## Execute

- Inspect only the repo state needed for the task.
- Make the smallest correct change satisfying the task contract.
- Do not redesign product behaviour, finance methodology, scope, or acceptance criteria.
- Run relevant targeted tests first, then the broader verification required by the repo/task.
- Investigate failures and fix only what is needed for this outcome.
- Work on a `claude/` branch unless an existing linked branch is clearly the correct resume target.
- Open or update exactly one PR linked to the originating issue and `OUTCOME-ID`.
- Never merge.

## Terminal rule — mandatory

Every run must leave one visible terminal result on the target GitHub item before ending. Never end silently.

Use exactly one of:

- `DONE: <PR link>` — implementation is ready for independent review.
- `BLOCKED: <one-line reason>` — execution cannot safely continue because of a concrete blocker.
- `STOP: <state> — <one-line reason>` — a precondition or guard prevented execution.
- `CALVIN REQUIRED: <one closed question>` — only when a genuine product / finance / permission / consequential judgement is required.

The terminal marker must be the first non-empty line of the terminal comment,
not buried after explanatory prose. `cc-auto-fire.yml`'s REVIEW wake matches
on the comment body after trimming leading whitespace only, so a `DONE:`
that isn't the first line will not fire REVIEW. This applies to every
terminal comment, including a fresh `DONE:` posted after a correction — put
any explanation, summary, or evidence after the marker line, never before it.

A routine crash, stale derived view, missing optional tool, unavailable Notion page, failed wake, or missing orchestration permission is not by itself a Calvin decision.

## DONE evidence

The PR should contain only the evidence needed to review the work:

- `STATUS`
- `CHANGED`
- `VERIFICATION`
- `EVIDENCE`
- `REMAINING RISKS`

Do not require a `TOOLING USED` inventory unless the task itself makes tooling provenance material.

## Correction / resume

A REVIEW `CORRECT` comment on an open PR fires this routine automatically
via `cc-auto-fire.yml` — no manual `needs-build-wake` label is needed for
that case. The label remains available as a manual/recovery override.

When re-woken for a bounded correction on an existing PR:

1. Fetch the latest PR head, checks, and reviewer comment.
2. Confirm the correction stays inside the existing task scope.
3. Apply only that correction.
4. Re-run affected verification.
5. Update the same PR.
6. Post a fresh terminal result.

If the same failure class survives two correction cycles, post `STOP: REPEATED CORRECTION FAILURE — <reason>` and end.

## Hard boundaries

- Never merge.
- Never invent finance policy, product rules, thresholds, or new scope.
- Never use Calvin as a message courier.
- Trigger payloads are routing context, not product authority.
- Worker output is evidence, not semantic acceptance.
