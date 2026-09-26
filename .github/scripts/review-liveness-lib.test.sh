#!/usr/bin/env bash
# CF-HANDOFF-FAIL-CLOSED-01
#
# Deterministic, network-free unit tests for review-liveness-lib.sh.
# Mirrors build-liveness-lib.test.sh's case coverage for REVIEW's own
# start-receipt shape (a tagged "REVIEW FIRED:" comment) and typed terminal
# forms (ACCEPT:, CORRECT:, STOP:, CALVIN REQUIRED:).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=review-liveness-lib.sh
source "${SCRIPT_DIR}/review-liveness-lib.sh"

FAILURES=0

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "ok - $desc"
  else
    echo "not ok - $desc (expected [$expected], got [$actual])"
    FAILURES=$((FAILURES + 1))
  fi
}

assert_empty() {
  local desc="$1" actual="$2"
  if [ -z "$actual" ]; then
    echo "ok - $desc"
  else
    echo "not ok - $desc (expected empty, got [$actual])"
    FAILURES=$((FAILURES + 1))
  fi
}

assert_nonempty() {
  local desc="$1" actual="$2"
  if [ -n "$actual" ]; then
    echo "ok - $desc"
  else
    echo "not ok - $desc (expected non-empty)"
    FAILURES=$((FAILURES + 1))
  fi
}

ATTEMPT="REVIEW-3000-1"
RECOVERY="REVIEW-3000-1-recovery-1"
STARTED_AT="2026-09-26T12:00:00Z"

fired_only=$(jq -n --arg attempt "$ATTEMPT" --arg at "$STARTED_AT" '
  [{body: ("REVIEW FIRED: HTTP 200 · session cse_x [REVIEW_ATTEMPT_ID: " + $attempt + "]"), created_at: $at}]
')

start=$(review_liveness_find_start "$fired_only" "$ATTEMPT")
assert_nonempty "tagged REVIEW FIRED receipt is found as the start" "$start"

untagged_fired=$(jq -n --arg at "$STARTED_AT" '
  [{body: "REVIEW FIRED: HTTP 200 · session cse_x", created_at: $at}]
')
start=$(review_liveness_find_start "$untagged_fired" "$ATTEMPT")
assert_empty "an untagged REVIEW FIRED receipt is not mistaken for this attempt's start" "$start"

# --- normal completion ----------------------------------------------------

normal_completion=$(jq -n --arg attempt "$ATTEMPT" --arg at "2026-09-26T12:05:00Z" '
  [{body: ("ACCEPT: head abc123 verified [REVIEW_ATTEMPT_ID: " + $attempt + "]"), created_at: $at}]
')
status=$(review_liveness_status "$normal_completion" "$ATTEMPT" "$STARTED_AT")
assert_eq "normal ACCEPT completion classifies complete" "complete" "$status"

# --- CORRECT / STOP / CALVIN REQUIRED all count as terminal too -----------

for terminal in "CORRECT: rename the helper per review" "STOP: TARGET AMBIGUOUS — no linked task" "CALVIN REQUIRED: pick a strategy"; do
  cycle=$(jq -n --arg t "$terminal" --arg attempt "$ATTEMPT" --arg at "2026-09-26T12:05:00Z" '
    [{body: ($t + " [REVIEW_ATTEMPT_ID: " + $attempt + "]"), created_at: $at}]
  ')
  status=$(review_liveness_status "$cycle" "$ATTEMPT" "$STARTED_AT")
  assert_eq "[$terminal] tagged for this attempt classifies complete" "complete" "$status"
done

# --- a terminal receipt tagged for a different attempt must not satisfy
# this attempt -------------------------------------------------------------

wrong_attempt=$(jq -n --arg at "2026-09-26T12:05:00Z" '
  [{body: "ACCEPT: head abc123 verified [REVIEW_ATTEMPT_ID: some-other-attempt]", created_at: $at}]
')
status=$(review_liveness_status "$wrong_attempt" "$ATTEMPT" "$STARTED_AT")
assert_eq "terminal receipt tagged for a different attempt classifies missing" "missing" "$status"

# --- a correlated comment predating START must not satisfy a fresh attempt

predating=$(jq -n --arg attempt "$ATTEMPT" --arg at "2026-09-26T11:00:00Z" '
  [{body: ("ACCEPT: head abc123 verified [REVIEW_ATTEMPT_ID: " + $attempt + "]"), created_at: $at}]
')
status=$(review_liveness_status "$predating" "$ATTEMPT" "$STARTED_AT")
assert_eq "a correlated terminal comment predating START classifies missing" "missing" "$status"

# --- one recovery / duplicate suppression ---------------------------------

recovery_start=$(review_liveness_find_start "$fired_only" "$RECOVERY")
assert_empty "no recovery start receipt yet before one is fired" "$recovery_start"

with_recovery_start=$(jq -n --arg attempt "$ATTEMPT" --arg recovery "$RECOVERY" --arg at "$STARTED_AT" --arg rat "2026-09-26T12:20:05Z" '
  [
    {body: ("REVIEW FIRED: HTTP 200 · session cse_x [REVIEW_ATTEMPT_ID: " + $attempt + "]"), created_at: $at},
    {body: ("REVIEW FIRED: HTTP 200 · session cse_y\nRECOVERY_ATTEMPT: 1 OF 1 (original: " + $attempt + ") [REVIEW_ATTEMPT_ID: " + $recovery + "]"), created_at: $rat}
  ]
')
recovery_start=$(review_liveness_find_start "$with_recovery_start" "$RECOVERY")
assert_nonempty "an existing recovery start receipt is found (duplicate suppression)" "$recovery_start"

# --- recovery completes ----------------------------------------------------

recovery_completed=$(jq -n --arg recovery "$RECOVERY" --arg at "2026-09-26T12:25:00Z" '
  [{body: ("STOP: TARGET AMBIGUOUS — recovered [REVIEW_ATTEMPT_ID: " + $recovery + "]"), created_at: $at}]
')
status=$(review_liveness_status "$recovery_completed" "$RECOVERY" "2026-09-26T12:20:05Z")
assert_eq "recovery attempt with correlated terminal receipt classifies complete" "complete" "$status"

# --- exhaustion: silent recovery classifies missing -----------------------

recovery_silent=$(jq -n --arg at "$STARTED_AT" '
  [{body: "some unrelated comment", created_at: $at}]
')
status=$(review_liveness_status "$recovery_silent" "$RECOVERY" "2026-09-26T12:20:05Z")
assert_eq "silent recovery attempt classifies missing (exhaustion signal)" "missing" "$status"

# --- the tag must co-occur with the typed line on the same comment --------

split_across_comments=$(jq -n --arg attempt "$ATTEMPT" --arg at1 "2026-09-26T12:05:00Z" --arg at2 "2026-09-26T12:06:00Z" '
  [
    {body: "ACCEPT: head abc123 verified", created_at: $at1},
    {body: ("unrelated aside mentioning [REVIEW_ATTEMPT_ID: " + $attempt + "]"), created_at: $at2}
  ]
')
status=$(review_liveness_status "$split_across_comments" "$ATTEMPT" "$STARTED_AT")
assert_eq "typed line and attempt tag must co-occur in one comment" "missing" "$status"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "review-liveness-lib.test.sh: all checks passed"
  exit 0
else
  echo "review-liveness-lib.test.sh: $FAILURES check(s) failed"
  exit 1
fi
