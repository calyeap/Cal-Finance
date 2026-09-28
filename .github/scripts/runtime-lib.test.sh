#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=runtime-lib.sh
source "${SCRIPT_DIR}/runtime-lib.sh"

fail() { echo "FAIL: $*" >&2; exit 1; }
assert_eq() { [ "$1" = "$2" ] || fail "expected '$2', got '$1' — ${3:-}"; }

# Contract parsing.
BODY=$'OUTCOME-ID: `CF-ONE-01`\nTIER: heavy\n## OUTCOME\nSomething'
assert_eq "$(runtime_outcome_id "$BODY")" "CF-ONE-01" "OUTCOME-ID parsing"
assert_eq "$(runtime_tier "$BODY")" "HEAVY" "tier parsing"
assert_eq "$(runtime_tier $'OUTCOME-ID: X')" "NORMAL" "missing tier defaults safely"
assert_eq "$(runtime_tier $'TIER: turbo')" "INVALID" "invalid tier rejected"

# First-line-only routing keeps quoted/examples from waking machinery.
assert_eq "$(runtime_is_correct $'\n  ## CORRECT: fix one thing\nmore')" true "heading-normalized CORRECT"
assert_eq "$(runtime_is_correct $'Explanation\nCORRECT: quoted later')" false "later CORRECT rejected"
assert_eq "$(runtime_done_pr_number 'DONE: https://github.com/calyeap/Cal-Finance/pull/321')" 321 "DONE PR binding"
assert_eq "$(runtime_done_pr_number $'DONE: evidence below\nhttps://github.com/calyeap/Cal-Finance/pull/999')" "" "later PR link rejected"

# OWNER never wakes itself; child terminal still reaches parent.
assert_eq "$(runtime_is_child_terminal 'BLOCKED: AI — child stopped [BUILD_ATTEMPT_ID: B1]')" true "child block routes parent"
assert_eq "$(runtime_is_child_terminal 'BLOCKED: AI — parent stopped [OWNER_ATTEMPT_ID: O1]')" false "parent block does not recurse"
assert_eq "$(runtime_parent_terminal_kind 'CONTINUE: existing authorised issue #9 [OWNER_ATTEMPT_ID: O1]')" CONTINUE
assert_eq "$(runtime_parent_terminal_kind 'COMPLETE: parent outcome done [OWNER_ATTEMPT_ID: O1]')" COMPLETE

# Slack is deliberately low-noise.
assert_eq "$(runtime_slack_kind 'CALVIN REQUIRED: choose A or B')" calvin_required
assert_eq "$(runtime_slack_kind 'BLOCKED: ACTIONABLE — refresh secret')" actionable_blocked
assert_eq "$(runtime_slack_kind 'BLOCKED: AI — worker timed out')" none
assert_eq "$(runtime_slack_kind 'COMPLETE: meaningful parent outcome')" complete
assert_eq "$(runtime_slack_kind 'CONTINUE: next child')" none

# CF-WORKFLOW-PROOF-SLACK-DEDUPE-01: OWNER restating an already-alerted
# child blocker is a duplicate; a distinct/new OWNER blocker, or any
# non-OWNER terminal, is not.
CHILD_COMMENTS=$(jq -n '[
  {body: "BLOCKED: ACTIONABLE — sandbox denies commit [BUILD_ATTEMPT_ID: B1]", created_at: "2026-09-28T15:10:00Z"},
  {body: "OWNER START: wake=TERMINAL [OWNER_ATTEMPT_ID: O1]", created_at: "2026-09-28T15:11:00Z"}
]')
assert_eq "$(runtime_slack_is_duplicate "$CHILD_COMMENTS" "2026-09-28T15:12:00Z" 'BLOCKED: ACTIONABLE — child BUILD run (B1) reports the same sandbox denial [OWNER_ATTEMPT_ID: O1]')" true "OWNER restating the same alerted child blocker is a duplicate"
assert_eq "$(runtime_slack_is_duplicate "$CHILD_COMMENTS" "2026-09-28T15:12:00Z" 'BLOCKED: ACTIONABLE — separate, unrelated permission is needed for the payments export [OWNER_ATTEMPT_ID: O1]')" false "an OWNER blocker not referencing the alerted attempt is not a duplicate"
assert_eq "$(runtime_slack_is_duplicate "$CHILD_COMMENTS" "2026-09-28T15:12:00Z" 'CALVIN REQUIRED: child BUILD run (B1) needs a scope decision [OWNER_ATTEMPT_ID: O1]')" false "a different Slack kind (calvin_required vs actionable_blocked) is not a duplicate"
assert_eq "$(runtime_slack_is_duplicate "$CHILD_COMMENTS" "2026-09-28T15:10:30Z" 'BLOCKED: ACTIONABLE — sandbox denies commit [BUILD_ATTEMPT_ID: B1]')" false "a non-OWNER (child) terminal is never suppressed as a duplicate"
assert_eq "$(runtime_slack_is_duplicate '[]' "2026-09-28T15:12:00Z" 'BLOCKED: ACTIONABLE — child BUILD run (B1) reports the same sandbox denial [OWNER_ATTEMPT_ID: O1]')" false "no prior Slack-eligible comment means nothing to duplicate"

# Admission regression coverage.
assert_eq "$(runtime_admission_decision issue 10 '' '' true)" IN_FLIGHT "#188 same-target duplicate build suppressed"
assert_eq "$(runtime_admission_decision issue 10 '' '12' false)" EXISTING_PR:12 "existing PR suppresses new BUILD"
assert_eq "$(runtime_admission_decision issue 10 '' '12,13' false)" CONFLICT "#352/#353/#354 duplicate PR class fails closed"
assert_eq "$(runtime_admission_decision issue 10 '11' '' false)" CONFLICT "duplicate issues fail closed"
assert_eq "$(runtime_admission_decision pr 12 '10' '' false)" ADMIT "same PR correction allowed"
assert_eq "$(runtime_admission_decision pr 12 '10' '13' false)" CONFLICT "second PR blocks correction fanout"

# Correlated terminal completion: another worker's terminal cannot satisfy this attempt.
COMMENTS=$(cat <<'JSON'
[
  {"body":"BUILD START: OUTCOME-ID=CF-ONE-01 [BUILD_ATTEMPT_ID: B1]","created_at":"2026-09-28T01:00:00Z"},
  {"body":"DONE: https://example/pull/1 [BUILD_ATTEMPT_ID: OTHER]","created_at":"2026-09-28T01:01:00Z"},
  {"body":"DONE: https://example/pull/1 [BUILD_ATTEMPT_ID: B1]","created_at":"2026-09-28T01:02:00Z"}
]
JSON
)
assert_eq "$(runtime_attempt_status "$COMMENTS" BUILD B1 '2026-09-28T01:00:00Z')" complete "exact attempt terminal"
assert_eq "$(runtime_attempt_status "$COMMENTS" BUILD B2 '2026-09-28T01:00:00Z')" missing "wrong attempt cannot complete"
assert_eq "$(runtime_outcome_attempt_open "$COMMENTS" CF-ONE-01)" false "terminal closes outcome attempt"
assert_eq "$(runtime_actor_attempt_open "$COMMENTS" BUILD)" false "closed BUILD attempt admits later bounded work"

OPEN_COMMENTS=$(cat <<'JSON'
[
  {"body":"BUILD START: OUTCOME-ID=CF-TWO-01 [BUILD_ATTEMPT_ID: B2]","created_at":"2026-09-28T02:00:00Z"},
  {"body":"ordinary progress","created_at":"2026-09-28T02:01:00Z"}
]
JSON
)
assert_eq "$(runtime_outcome_attempt_open "$OPEN_COMMENTS" CF-TWO-01)" true "open outcome attempt stays exclusive"
assert_eq "$(runtime_actor_attempt_open "$OPEN_COMMENTS" BUILD)" true "open BUILD attempt suppresses another worker"

REVIEW_OPEN=$(cat <<'JSON'
[
  {"body":"REVIEW START: OUTCOME-ID=CF-TWO-01 [REVIEW_ATTEMPT_ID: R1]","created_at":"2026-09-28T03:00:00Z"}
]
JSON
)
assert_eq "$(runtime_actor_attempt_open "$REVIEW_OPEN" REVIEW)" true "one active REVIEW"

OWNER_DONE=$(cat <<'JSON'
[
  {"body":"OWNER START: wake=MERGE [OWNER_ATTEMPT_ID: O1]","created_at":"2026-09-28T04:00:00Z"},
  {"body":"COMPLETE: parent done [OWNER_ATTEMPT_ID: O1]","created_at":"2026-09-28T04:01:00Z"}
]
JSON
)
assert_eq "$(runtime_actor_attempt_open "$OWNER_DONE" OWNER)" false "OWNER terminal releases parent admission"

echo "runtime-lib: PASS"
