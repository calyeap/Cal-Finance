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

# Slack is an interrupt channel for genuine Calvin action only
# (CF-SLACK-ACTION-ONLY-01, issue #377): COMPLETE stays a valid parent
# terminal (GitHub's durable completion record) but is never Slack-eligible.
assert_eq "$(runtime_slack_kind 'CALVIN REQUIRED: choose A or B')" calvin_required
assert_eq "$(runtime_slack_kind 'BLOCKED: ACTIONABLE — refresh secret')" actionable_blocked
assert_eq "$(runtime_slack_kind 'BLOCKED: AI — worker timed out')" none
assert_eq "$(runtime_slack_kind 'COMPLETE: meaningful parent outcome')" none "COMPLETE is Slack-ineligible"
assert_eq "$(runtime_parent_terminal_kind 'COMPLETE: meaningful parent outcome')" COMPLETE "COMPLETE remains a valid parent terminal"
assert_eq "$(runtime_slack_kind 'CONTINUE: next child')" none

# CF-WORKFLOW-TERMINAL-NORMALIZE-01 (issue #375): a standalone attempt-
# metadata line preceding the real typed terminal must not hide it from
# classification — for BUILD, REVIEW and OWNER terminal families alike —
# while a canonical (terminal-first) comment keeps working unchanged, and
# arbitrary prose followed later by a terminal keyword still never counts.
assert_eq "$(runtime_is_calvin_required 'CALVIN REQUIRED: pick A or B [BUILD_ATTEMPT_ID: BUILD-1-1]')" true "canonical first-line CALVIN REQUIRED still recognised"
assert_eq "$(runtime_slack_kind 'CALVIN REQUIRED: pick A or B [BUILD_ATTEMPT_ID: BUILD-1-1]')" calvin_required "canonical first-line CALVIN REQUIRED still Slack-eligible"
assert_eq "$(runtime_is_calvin_required $'[BUILD_ATTEMPT_ID: BUILD-1-1]\nCALVIN REQUIRED: pick A or B')" true "metadata-first BUILD terminal recognised"
assert_eq "$(runtime_slack_kind $'[BUILD_ATTEMPT_ID: BUILD-1-1]\nCALVIN REQUIRED: pick A or B')" calvin_required "metadata-first BUILD terminal still Slack-eligible"
assert_eq "$(runtime_is_correct $'[REVIEW_ATTEMPT_ID: REVIEW-2-1]\nCORRECT: fix one thing')" true "metadata-first REVIEW terminal recognised"
assert_eq "$(runtime_parent_terminal_kind $'[OWNER_ATTEMPT_ID: OWNER-3-1]\nCOMPLETE: parent outcome done')" COMPLETE "metadata-first OWNER terminal recognised"
assert_eq "$(runtime_slack_kind $'[OWNER_ATTEMPT_ID: OWNER-3-1]\nCOMPLETE: parent outcome done')" none "metadata-first OWNER COMPLETE terminal remains Slack-ineligible"
assert_eq "$(runtime_is_child_terminal $'[OWNER_ATTEMPT_ID: OWNER-3-1]\nCALVIN REQUIRED: needs a call')" false "metadata-first OWNER receipt still excluded from child-terminal routing"
assert_eq "$(runtime_is_calvin_required $'Some narrative update.\n\nCALVIN REQUIRED: quoted later, not a terminal')" false "prose followed later by CALVIN REQUIRED remains ineligible"
assert_eq "$(runtime_slack_kind $'Some narrative update.\n\nCALVIN REQUIRED: quoted later, not a terminal')" none "prose followed later by CALVIN REQUIRED remains Slack-ineligible"
assert_eq "$(runtime_is_calvin_required $'[BUILD_ATTEMPT_ID: BUILD-1-1] not standalone\nCALVIN REQUIRED: pick A or B')" false "a metadata line with trailing text is not tolerated as metadata-only"

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

# Metadata-first terminals correlate the same way canonical ones do — the
# real failure #375 fixes: the tag lives on the standalone metadata line,
# not the typed-terminal line, but attempt correlation still finds it, and
# a mismatched attempt ID is still never silently accepted.
META_FIRST_COMMENTS=$(cat <<'JSON'
[
  {"body":"BUILD START: OUTCOME-ID=CF-META-01 [BUILD_ATTEMPT_ID: B3]","created_at":"2026-09-28T05:00:00Z"},
  {"body":"[BUILD_ATTEMPT_ID: B3]\nCALVIN REQUIRED: pick A or B","created_at":"2026-09-28T05:01:00Z"}
]
JSON
)
assert_eq "$(runtime_attempt_status "$META_FIRST_COMMENTS" BUILD B3 '2026-09-28T05:00:00Z')" complete "metadata-first terminal still correlates the matching attempt"
assert_eq "$(runtime_attempt_status "$META_FIRST_COMMENTS" BUILD B4 '2026-09-28T05:00:00Z')" missing "metadata-first terminal with a mismatched attempt ID stays uncorrelated"
assert_eq "$(runtime_outcome_attempt_open "$META_FIRST_COMMENTS" CF-META-01)" false "metadata-first CALVIN REQUIRED still closes the outcome attempt"

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


# CF-REVIEW-OUTCOME-RESOLVE-01 (issue #381): REVIEW's target resolution
# reads state/body through the same shared primitives BUILD's already does,
# fetched from the same issues-endpoint shape — a representative PR-shaped
# object (open, carries a `pull_request` key, body backtick-wraps its
# OUTCOME-ID first line exactly like a real PR description) must resolve
# its OUTCOME-ID through this seam, generically — not by naming any one
# outcome or PR number.
PR_TARGET=$(jq -n --arg body $'OUTCOME-ID: `CF-EXAMPLE-OUTCOME-01`\n\nCloses #1. TIER: NORMAL.\n\n## What this does\n' '
  {state: "open", body: $body, pull_request: {url: "https://example/pulls/1"}}
')
runtime_pr_is_open "$PR_TARGET" || fail "representative open PR target should report open"
assert_eq "$(runtime_outcome_id "$(runtime_target_body "$PR_TARGET")")" "CF-EXAMPLE-OUTCOME-01" "shared body extraction resolves a backtick-wrapped OUTCOME-ID from a PR-shaped target"

CLOSED_PR_TARGET=$(jq -n '{state: "closed", body: "OUTCOME-ID: `X`", pull_request: {url: "https://example/pulls/1"}}')
runtime_pr_is_open "$CLOSED_PR_TARGET" && fail "closed PR target must not be treated as open"

ISSUE_TARGET=$(jq -n '{state: "open", body: "OUTCOME-ID: `X`"}')
runtime_pr_is_open "$ISSUE_TARGET" && fail "a plain issue (no pull_request key) must never be admitted as REVIEW's PR target"

MISSING_BODY_TARGET=$(jq -n '{state: "open", pull_request: {url: "https://example/pulls/1"}}')
assert_eq "$(runtime_outcome_id "$(runtime_target_body "$MISSING_BODY_TARGET")")" "" "a target with no body still fails closed rather than erroring"

echo "runtime-lib: PASS"
