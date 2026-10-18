#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

fail() { echo "FAIL: $*" >&2; exit 1; }
require() { grep -Eq "$2" "$1" || fail "$1 missing: $3"; }
forbid() { ! grep -Eq "$2" "$1" || fail "$1 still contains forbidden: $3"; }

ROUTER=.github/workflows/cc-auto-fire.yml
MERGE=.github/workflows/owner-on-merge.yml
SLACK=.github/workflows/calvin-slack-alert.yml
BUILD=.github/ai-routines/BUILD.md
REVIEW=.github/ai-routines/CC.md
OWNER=.github/ai-routines/OWNER.md

# One-outcome admission is repo-wide and explicit, covering the #188 and
# #352/#353/#354 duplicate classes before any worker fire.
require "$ROUTER" 'group: cf-build-admission' 'repo-wide BUILD admission serialization'
require "$ROUTER" 'runtime_admission_decision' 'OUTCOME-ID admission classifier'
require "$ROUTER" 'issues\?state=open' 'repo-wide open artifact inventory'

# CF-FIRE-RETRY-01: the #357 workflow-reset hold (issue #357, closed
# 2026-09-28) is over; its temporary gate must not linger in the router
# or in OWNER's own prose.
forbid "$ROUTER" '#357' 'obsolete reset-hold enforcement removed'
forbid "$OWNER" '#357' 'obsolete reset-hold prose removed'

# Liveness is detect-only: live workflows may watch but never call the old
# automatic recovery guards.
require "$ROUTER" 'terminal-watch\.sh' 'detect-only child/parent liveness'
require "$MERGE" 'terminal-watch\.sh' 'detect-only merge parent liveness'
forbid "$ROUTER" 'worker-liveness-guard\.sh|owner-liveness-guard\.sh' 'automatic worker/OWNER recovery fire'
forbid "$MERGE" 'owner-liveness-guard\.sh' 'automatic OWNER recovery fire'
forbid "$ROUTER" 'RECOVERY_ATTEMPT|recovery-1' 'bounded blind recovery path'
forbid "$MERGE" 'RECOVERY_ATTEMPT|recovery-1' 'bounded blind recovery path'

# Protected evaluator + tiered review are durable worker rules, not copied
# into the router.
require "$BUILD" 'Never weaken, delete, rewrite or bypass an evaluator' 'protected evaluator'
require "$BUILD" '^### LIGHT$' 'LIGHT fast path'
require "$BUILD" '^### NORMAL$' 'NORMAL path'
require "$BUILD" '^### HEAVY$' 'HEAVY path'
require "$REVIEW" '^### LIGHT$' 'tiered review LIGHT'
require "$REVIEW" '^### NORMAL$' 'tiered review NORMAL'
require "$REVIEW" '^### HEAVY$' 'tiered review HEAVY'

# Parent controller is constrained to exactly the approved terminal family.
require "$OWNER" '^### CONTINUE$' 'CONTINUE parent terminal'
require "$OWNER" '^### COMPLETE$' 'COMPLETE parent terminal'
require "$OWNER" '^### BLOCKED$' 'BLOCKED parent terminal'
require "$OWNER" '^### CALVIN REQUIRED$' 'CALVIN REQUIRED parent terminal'
forbid "$OWNER" 'WAIT:|DISPATCHED:' 'legacy parent terminal vocabulary'

# Slack is terminal-driven: genuine ask / actionable block, plus one
# informational completion/stop notification per
# CF-TERMINAL-NOTIFY-RELIABILITY-01 (issue #408), which explicitly
# supersedes CF-SLACK-ACTION-ONLY-01's (issue #377) blanket exclusion of
# COMPLETE for OWNER's own final delegated-task outcome.
require "$SLACK" 'calvin-slack-notify\.sh' 'shared Slack payload/send, reused by direct relay call sites'
forbid "$SLACK" 'WORKFLOW BLOCKED|OWNER LIVENESS EXHAUSTED' 'legacy liveness-specific notification vocabulary'
require "$SLACK" "'COMPLETE:'" 'CF-TERMINAL-NOTIFY-RELIABILITY-01: job-level gate admits COMPLETE for one informational FINISHED notification'

# CF-WORKFLOW-RESET-TERMINAL-HANDOFF-REPAIR-02: a workflow-authored
# (GH_TOKEN-authored) terminal comment cannot recursively trigger the
# issue_comment-based OWNER wake or Slack notify those paths would
# otherwise depend on (the #361/#362 defect this outcome repairs). Every
# place a fire/observe step posts one of its own such comments must relay
# it directly in the same job instead of only posting and hoping.
require "$ROUTER" 'terminal-relay\.sh' 'direct in-job OWNER relay for workflow-authored terminals'
require "$ROUTER" 'terminal_relay_owner' 'OWNER relay actually invoked, not just sourced'
require "$ROUTER" 'calvin_slack_send' 'direct in-job Slack relay for workflow-authored terminals'
require "$MERGE" 'calvin-slack-notify\.sh' 'merge-path OWNER fire also relays its own ACTIONABLE failures to Slack'

# The relay must never fire OWNER over OWNER's own transport failure (that
# would loop a fresh OWNER attempt over infra, not a real child
# transition) — only Slack, on both admission entry points that can post
# such a failure.
forbid "$ROUTER" 'terminal_relay_owner.*OWNER transport' 'OWNER-relay self-loop on OWNER'\''s own transport failure'

# CF-FIRE-RETRY-01: every fire transport call goes through one shared,
# bounded-retry primitive instead of duplicated one-shot curl blocks, and
# a BUILD/REVIEW fire step's own transport failure is never relayed into
# OWNER — that double-fire-over-infra is exactly the #387 dead end this
# outcome closes (OWNER is still reachable through Slack and, once BUILD/
# REVIEW exhaust their own retries, a deterministic re-drive label).
require "$ROUTER" 'fire_post' 'shared bounded-retry fire transport primitive'
require "$MERGE" 'fire_post' 'merge-path OWNER fire also uses the shared retry primitive'
forbid "$ROUTER" 'terminal_relay_owner "\$REPO" "\$NUMBER" "\$LINE" fire-build-fire' 'BUILD transport failure no longer relays into OWNER'
forbid "$ROUTER" 'terminal_relay_owner "\$REPO" "\$NUMBER" "\$LINE" fire-review-fire' 'REVIEW transport failure no longer relays into OWNER'

# Terminal destination is now an explicit contract, not implied convention
# (the concrete #361/#362 gap: a BUILD terminal landing somewhere other
# than the exact watched wake target).
require "$BUILD" '\*\*Destination\*\*.*exact wake target' 'BUILD terminal destination is explicit'
require "$REVIEW" '\*\*Destination\*\*.*exact wake target' 'REVIEW terminal destination is explicit'
require "$OWNER" '\*\*Destination\*\*.*exact wake target' 'OWNER terminal destination is explicit'


# CF-REVIEW-BIND-01: PR-body contract fields are BUILD's own responsibility,
# not only inherited from the source issue — REVIEW/runtime binding is
# deterministic only when the PR body itself carries them, and TIER must
# survive correction rather than silently defaulting.
require "$BUILD" 'must itself carry' 'BUILD writes canonical OUTCOME-ID/TIER into every PR body it opens/updates'
require "$BUILD" '^OUTCOME-ID: `<value>`$' 'BUILD PR-body contract names the exact OUTCOME-ID field shape'
require "$BUILD" '^TIER: <LIGHT\|NORMAL\|HEAVY>$' 'BUILD PR-body contract names the exact TIER field shape'
require "$BUILD" 'TIER must stay exactly' 'TIER preserved verbatim across correction, never silently defaulted'

# REVIEW may bind to the DONE-source issue's OUTCOME-ID only when that
# relation is unambiguous and current; ambiguity or a closed/superseded
# source issue fails closed rather than guessing — and the router actually
# implements that fallback and its dead-contract guard.
require "$REVIEW" 'unambiguous .*and current' 'source-issue OUTCOME-ID fallback is explicitly bounded, not a blind lookup'
require "$ROUTER" 'runtime_closing_issue_number' 'source-issue fallback resolution wired into REVIEW admission'
require "$ROUTER" 'DEAD CONTRACT' 'closed/superseded contract guard stops routing/repair under a dead contract'

# The dead-contract guard must cover the PR-scoped repair/review paths too,
# not only an issue-kind BUILD wake — a bare 'DEAD CONTRACT' string match
# would pass even if only the issue-kind path checked it.
require "$ROUTER" 'PR-scoped dead-contract guard \(KIND=pr\)' 'fire-build dead-contract guard also covers KIND=pr (CORRECT-triggered repair), not only KIND=issue wakes'
require "$ROUTER" 'PR-scoped dead-contract guard covers a PR that carries its own OUTCOME-ID' 'fire-review dead-contract guard also covers a PR carrying its own OUTCOME-ID, not only the source-issue fallback'

# CF-REVIEW-BIND-01: the already-approved bounded-repair intent (3 CORRECT
# cycles without ACCEPT) is enforced at BUILD admission, not left to
# REVIEW's own prose discipline alone.
require "$ROUTER" 'runtime_correct_cycles_exhausted' 'runtime enforces the approved 3-CORRECT-cycle repair bound'
require "$REVIEW" '3 .CORRECT. cycles without .ACCEPT' 'REVIEW documents the deterministic runtime repair-cycle backstop'

# An unreproduced ordinary failure is never manufactured into Calvin work.
require "$BUILD" 'cannot be reproduced' 'unreproduced bounded diagnosis completes without manufacturing CALVIN REQUIRED'

# CF-CONTRACT-FENCE-01 (issue #384): a worker must not route, merge or
# alert once the canonical contract it loaded at START no longer matches
# the current one — documented in each actor's own contract, and the
# CONTRACT fingerprint is actually threaded through the router that fires
# BUILD/REVIEW/OWNER, not only described in prose.
require "$BUILD" 'Stale contract fence' 'BUILD documents the stale-contract fence'
require "$REVIEW" 'Stale contract fence' 'REVIEW documents the stale-contract fence'
require "$OWNER" 'Stale contract fence' 'OWNER documents the stale-contract fence'
require "$BUILD" 'STALE_CONTRACT' 'BUILD names the typed stale-contract exit'
require "$REVIEW" 'STALE_CONTRACT' 'REVIEW names the typed stale-contract exit'
require "$OWNER" 'STALE_CONTRACT' 'OWNER names the typed stale-contract exit'
require "$ROUTER" 'runtime_contract_hash' 'router computes the contract fingerprint for BUILD/REVIEW/OWNER fires'
require "$MERGE" 'runtime_contract_hash' 'merge-path OWNER fire also stamps a contract fingerprint'
require "$ROUTER" '\[CONTRACT: \$\{CONTRACT\}\]' 'START receipts carry the CONTRACT fingerprint marker'

# CF-CONTRACT-FENCE-01 (CORRECT on #397): a PR body never changes when
# Calvin edits the issue contract mid-run, so a PR-scoped fire must bind
# CONTRACT_BODY to the PR's unambiguous, currently-open source issue body
# (not only describe that in prose) whenever one exists, not only when the
# PR lacks its own OUTCOME-ID.
require "$ROUTER" 'CONTRACT_BODY="\$\(jq -r .*<<< "\$SRC"\)"' 'fire-review binds CONTRACT_BODY to the source issue body, not only the PR body'
require "$ROUTER" 'CONTRACT_BODY="\$\(jq -r .*<<< "\$TARGET"\)"' 'fire-owner-on-terminal starts CONTRACT_BODY from the fetched wake-target body'
require "$MERGE" 'CONTRACT_BODY="\$\(jq -r .*<<< "\$TARGET"\)"' 'merge-path OWNER fire starts CONTRACT_BODY from the fetched PR body'
require "$ROUTER" 'has\("pull_request"\)' 'fire-owner-on-terminal distinguishes a PR wake target before preferring its source issue body'

# CF-CONTRACT-FENCE-01 (CORRECT #2 on #397): merging a Closes/Fixes/Resolves
# PR closes its source issue, so OWNER's post-merge fence must bind the same
# body whether that issue is open or closed — requiring it to stay open (as
# REVIEW correctly does, since REVIEW runs before merge) would make every
# ordinary merge read as a false STALE_CONTRACT even though nobody edited
# the contract. Only OWNER.md's fence carries this open-or-closed rule.
forbid "$OWNER" 'currently-open' "OWNER's fence does not require the source issue to stay open"

# CF-CONTRACT-FENCE-01 (CORRECT #2 on #397): a transient failure fetching
# the source issue must emit an empty CONTRACT, not silently fall back to
# hashing the PR/target body — that fallback would make the fingerprint
# depend on the fetch's luck rather than on the canonical body, and could
# itself manufacture a spurious mismatch on a later successful fetch.
require "$ROUTER" 'CONTRACT_FETCH_FAILED' 'fire-review and fire-owner-on-terminal emit an empty CONTRACT on a failed source-issue fetch, not the PR-body fallback'
require "$MERGE" 'CONTRACT_FETCH_FAILED' 'merge-path OWNER fire emits an empty CONTRACT on a failed source-issue fetch, not the PR-body fallback'

# CF-TIMEOUT-ACTIONABLE-01 (issue #401): a lease expiry is a monitoring
# incident — one typed BLOCKED: ACTIONABLE sent straight to Slack from
# terminal-watch.sh — never an OWNER reconciliation hop, and never a
# silent BLOCKED: AI. BUILD's lease is 90 minutes (its job timeout leaves
# room for it); other leases are unchanged.
forbid "$ROUTER" 'observe-(build|review)-timeout' 'timeout-only OWNER relay hops removed'
forbid "$ROUTER" 'terminal-watch-blocked-line' 'observe jobs no longer read a timeout line back to relay it'
require "$ROUTER" "TERMINAL_LEASE_MINUTES: '90'" 'BUILD terminal lease is 90 minutes'
[ "$(grep -c "TERMINAL_LEASE_MINUTES: '90'" "$ROUTER")" = 1 ] || fail "$ROUTER: only the BUILD lease is 90 minutes"
[ "$(grep -c "TERMINAL_LEASE_MINUTES: '25'" "$ROUTER")" = 2 ] || fail "$ROUTER: REVIEW/OWNER leases unchanged at 25 minutes"
awk '/^  observe-build:/{f=1} f&&/timeout-minutes:/{print $2; exit}' "$ROUTER" | grep -Eq '^(9[5-9]|[1-9][0-9]{2})$' \
  || fail "$ROUTER: observe-build job timeout must exceed the 90-minute lease"
# Every live observe step (3 in the router, 1 on the merge path) carries the
# Slack webhook its actionable timeout is sent through.
for wf in "$ROUTER" "$MERGE"; do
  watches=$(grep -c 'run: bash .github/scripts/terminal-watch.sh' "$wf")
  with_slack=$(awk '
    /^      - name:/ { slack=0 }
    /SLACK_WEBHOOK_URL: \$\{\{ secrets.CALVIN_SLACK_WEBHOOK_URL \}\}/ { slack=1 }
    /run: bash .github\/scripts\/terminal-watch.sh/ { if (slack) n++ }
    END { print n+0 }' "$wf")
  [ "$watches" -gt 0 ] && [ "$watches" = "$with_slack" ] || fail "$wf: every terminal-watch step must carry SLACK_WEBHOOK_URL ($with_slack/$watches)"
done
[ "$(grep -c 'run: bash .github/scripts/terminal-watch.sh' "$ROUTER")" = 3 ] || fail "$ROUTER: expected 3 live observe jobs"
# A non-retryable fire-transport failure leaves a human re-drive as the only
# recovery, so it is actionable rather than a silent BLOCKED: AI.
forbid "$ROUTER" 'BLOCKED: AI — (BUILD|REVIEW|OWNER) transport failed' 'silent non-retryable transport dead end'
forbid "$MERGE" 'BLOCKED: AI — OWNER transport failed' 'silent non-retryable merge-path transport dead end'
forbid .github/scripts/terminal-relay.sh 'BLOCKED: AI — OWNER relay transport failed' 'silent non-retryable OWNER-relay transport dead end'
require "$ROUTER" 'BUILD transport failed \(\$\{CODE\}, not retryable\).*needs-build-wake' 'non-retryable BUILD transport names its re-drive label'
require "$ROUTER" 'REVIEW transport failed \(\$\{CODE\}, not retryable\).*needs-cc-rereview' 'non-retryable REVIEW transport names its re-drive label'
require "$ROUTER" 'OWNER transport failed \(\$\{CODE\}, not retryable\).*needs-owner-wake' 'non-retryable OWNER transport names its re-drive label'
require "$MERGE" 'OWNER transport failed \(\$\{CODE\}, not retryable\).*needs-owner-wake' 'non-retryable merge-path OWNER transport names its re-drive label'

# CF-CONTINUE-SCRIPT-01 (issue #402): CONTINUE's mechanical handoff is code
# (owner-continue.sh, behaviorally tested in owner-continue.test.sh); OWNER
# keeps only the semantic readiness judgment and may not hand-author success.
require "$OWNER" 'owner-continue\.sh' 'OWNER CONTINUE calls the deterministic helper'
require "$OWNER" 'Never hand-author a .CONTINUE:' 'OWNER prohibits a hand-authored CONTINUE'
forbid "$OWNER" 'Read back before claiming success' 'the retired prose apply/read-back protocol'

# CF-LEG2-PREFLIGHT-01 (issue #475): each fire job's live `if:` carries both
# guards — a `lean-sop` item fires nothing, and only a `calyeap` comment or
# label sender fires anything. Evaluated behaviourally on the real
# expressions (workflow-if-eval.js), not only by text match.
EVAL=.github/scripts/workflow-if-eval.js
fires() { node "$EVAL" "$1" "$2" "$3"; }
expect_fire() { [ "$(fires "$1" "$2" "$3")" = "$4" ] || fail "$1 $2 should be $4 for: $5"; }
for job in fire-build fire-review fire-owner-on-terminal; do
  block="$(awk -v j="  ${job}:" '$0==j{f=1;next} f&&/^    runs-on:/{exit} f' "$ROUTER")"
  grep -q "github.event.comment.user.login == 'calyeap'" <<< "$block" || fail "$job missing commenter allow-list"
  grep -q "github.event.sender.login == 'calyeap'" <<< "$block" || fail "$job missing label-sender allow-list"
  grep -q "!contains(github.event.issue.labels.\*.name, 'lean-sop')" <<< "$block" || fail "$job missing issue lean-sop guard"
  grep -q "!contains(github.event.pull_request.labels.\*.name, 'lean-sop')" <<< "$block" || fail "$job missing PR lean-sop guard"
done
grep -q "!contains(github.event.pull_request.labels.\*.name, 'lean-sop')" "$MERGE" || fail "$MERGE missing lean-sop guard"

label_issue() { jq -nc --arg n "$1" --arg s "$2" --arg l "${3:-}" '{event_name:"issues",event:{label:{name:$n},sender:{login:$s},issue:{number:1,labels:([$n,$l]|map(select(.!=""))|map({name:.}))}}}'; }
label_pr() { jq -nc --arg n "$1" --arg s "$2" --arg l "${3:-}" '{event_name:"pull_request",event:{label:{name:$n},sender:{login:$s},pull_request:{number:2,labels:([$n,$l]|map(select(.!=""))|map({name:.}))}}}'; }
comment() { jq -nc --arg b "$1" --arg u "$2" --arg l "${3:-}" --arg s "${4:-$2}" \
  '{event_name:"issue_comment",event:{comment:{body:$b,user:{login:$u}},sender:{login:$s},issue:{number:3,labels:([$l]|map(select(.!=""))|map({name:.}))}}}'; }

for case in \
  "fire-build|$(label_issue needs-build-wake calyeap)|true|calyeap BUILD wake label" \
  "fire-build|$(label_pr needs-build-wake calyeap)|true|calyeap BUILD wake label on a PR" \
  "fire-build|$(label_issue needs-build-wake calyeap lean-sop)|false|lean-sop issue" \
  "fire-build|$(label_pr needs-build-wake calyeap lean-sop)|false|lean-sop PR" \
  "fire-build|$(label_issue needs-build-wake mallory)|false|non-calyeap label sender" \
  "fire-build|$(comment 'CORRECT: fix it [REVIEW_ATTEMPT_ID: R1]' calyeap)|true|calyeap CORRECT" \
  "fire-build|$(comment 'CORRECT: fix it' mallory)|false|non-calyeap CORRECT" \
  "fire-build|$(comment 'CORRECT: fix it' mallory '' calyeap)|false|comment author, not sender, decides a comment wake" \
  "fire-build|$(comment 'CORRECT: fix it' calyeap lean-sop)|false|CORRECT on a lean-sop item" \
  "fire-review|$(label_pr needs-cc-rereview calyeap)|true|calyeap REVIEW wake label" \
  "fire-review|$(label_pr needs-cc-rereview mallory)|false|non-calyeap REVIEW label" \
  "fire-review|$(label_pr needs-cc-rereview calyeap lean-sop)|false|REVIEW label on a lean-sop PR" \
  "fire-review|$(comment 'DONE: https://github.com/o/r/pull/2' calyeap)|true|calyeap DONE" \
  "fire-review|$(comment 'DONE: https://github.com/o/r/pull/2' mallory)|false|non-calyeap DONE" \
  "fire-review|$(comment 'DONE: https://github.com/o/r/pull/2' calyeap lean-sop)|false|DONE on a lean-sop item" \
  "fire-owner-on-terminal|$(label_issue needs-owner-wake calyeap)|true|calyeap OWNER re-drive label" \
  "fire-owner-on-terminal|$(label_issue needs-owner-wake mallory)|false|non-calyeap OWNER label" \
  "fire-owner-on-terminal|$(label_issue needs-owner-wake calyeap lean-sop)|false|OWNER label on a lean-sop item" \
  "fire-owner-on-terminal|$(comment 'BLOCKED: AI — x [BUILD_ATTEMPT_ID: B1]' calyeap)|true|calyeap child terminal" \
  "fire-owner-on-terminal|$(comment 'CALVIN RULING: A' calyeap)|true|Calvin ruling" \
  "fire-owner-on-terminal|$(comment 'CALVIN RULING: A' mallory)|false|non-calyeap ruling" \
  "fire-owner-on-terminal|$(comment 'BLOCKED: AI — x [BUILD_ATTEMPT_ID: B1]' calyeap lean-sop)|false|terminal on a lean-sop item" \
  "fire-owner-on-terminal|$(comment 'just chatting' calyeap)|false|non-terminal calyeap comment (unchanged)" \
  "fire-build|$(label_issue needs-owner-wake calyeap)|false|other wake label (unchanged)"; do
  IFS='|' read -r job ctx want desc <<< "$case"
  expect_fire "$ROUTER" "$job" "$ctx" "$want" "$desc"
done

merged() { jq -nc --argjson m "$1" --arg l "${2:-}" '{event_name:"pull_request",event:{action:"closed",sender:{login:"calyeap"},pull_request:{number:4,merged:$m,labels:([$l]|map(select(.!=""))|map({name:.}))}}}'; }
expect_fire "$MERGE" fire-owner-on-merge "$(merged true)" true "merged PR"
expect_fire "$MERGE" fire-owner-on-merge "$(merged true lean-sop)" false "merged lean-sop PR"
expect_fire "$MERGE" fire-owner-on-merge "$(merged false)" false "closed unmerged PR (unchanged)"

echo "runtime-wiring: PASS"
