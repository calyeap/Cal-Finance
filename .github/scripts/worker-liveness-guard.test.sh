#!/usr/bin/env bash
# CF-HANDOFF-FAIL-CLOSED-01 — 28 Sep 2026 reset
# Deterministic, network-free tests for detection-only BUILD/REVIEW liveness.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAILURES=0
LAST_COMMENT=""

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "ok - $desc"
  else
    echo "not ok - $desc (expected [$expected], got [$actual])"
    FAILURES=$((FAILURES + 1))
  fi
}

assert_contains() {
  local desc="$1" haystack="$2" needle="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "ok - $desc"
  else
    echo "not ok - $desc (missing [$needle])"
    FAILURES=$((FAILURES + 1))
  fi
}

assert_not_contains() {
  local desc="$1" haystack="$2" needle="$3"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "ok - $desc"
  else
    echo "not ok - $desc (unexpected [$needle])"
    FAILURES=$((FAILURES + 1))
  fi
}

export GH_TOKEN=dummy
export TARGET_REPO=x/y
export TARGET_NUMBER=1
export WORKER_LIVENESS_LEASE_MINUTES=0

# BUILD
export ACTOR=BUILD
export ATTEMPT_ID=BUILD-2000-1
# shellcheck source=worker-liveness-guard.sh
source "${SCRIPT_DIR}/worker-liveness-guard.sh"

post_comment() { LAST_COMMENT="$1"; }

fetch_comments() {
  jq -n --arg attempt "$ATTEMPT_ID" '[{body: ("DONE: https://github.com/x/y/pull/9 [BUILD_ATTEMPT_ID: " + $attempt + "]"), created_at: "2026-09-26T12:05:00Z"}]'
}
status="$(wait_and_check "$ATTEMPT_ID" "2026-09-26T12:00:00Z")"
assert_eq "BUILD healthy attempt completes" "complete" "$status"

fetch_comments() { echo '[]'; }
status="$(wait_and_check "$ATTEMPT_ID" "2026-09-26T12:00:00Z")"
assert_eq "BUILD stalled attempt becomes missing" "missing" "$status"
LAST_COMMENT=""
post_missing_terminal
assert_contains "BUILD timeout becomes one typed BLOCKED terminal" "$LAST_COMMENT" "BLOCKED: LIVENESS"
assert_contains "BUILD timeout preserves attempt correlation" "$LAST_COMMENT" "[BUILD_ATTEMPT_ID: BUILD-2000-1]"
assert_contains "BUILD timeout explicitly forbids replacement execution" "$LAST_COMMENT" "no replacement BUILD was fired"

# REVIEW
export ACTOR=REVIEW
export ATTEMPT_ID=REVIEW-3000-1
source "${SCRIPT_DIR}/worker-liveness-guard.sh"
post_comment() { LAST_COMMENT="$1"; }
fetch_comments() {
  jq -n --arg attempt "$ATTEMPT_ID" '[{body: ("ACCEPT: head abc123 verified [REVIEW_ATTEMPT_ID: " + $attempt + "]"), created_at: "2026-09-26T12:05:00Z"}]'
}
status="$(wait_and_check "$ATTEMPT_ID" "2026-09-26T12:00:00Z")"
assert_eq "REVIEW healthy attempt completes" "complete" "$status"
fetch_comments() { echo '[]'; }
status="$(wait_and_check "$ATTEMPT_ID" "2026-09-26T12:00:00Z")"
assert_eq "REVIEW stalled attempt becomes missing" "missing" "$status"
LAST_COMMENT=""
post_missing_terminal
assert_contains "REVIEW timeout becomes one typed STOP terminal" "$LAST_COMMENT" "STOP: LIVENESS"
assert_contains "REVIEW timeout preserves attempt correlation" "$LAST_COMMENT" "[REVIEW_ATTEMPT_ID: REVIEW-3000-1]"
assert_contains "REVIEW timeout explicitly forbids replacement review" "$LAST_COMMENT" "no replacement REVIEW was fired"

SCRIPT_TEXT="$(cat "${SCRIPT_DIR}/worker-liveness-guard.sh")"
assert_not_contains "guard has no worker recovery fire function" "$SCRIPT_TEXT" "fire_recovery()"
assert_not_contains "guard does not call FIRE_URL" "$SCRIPT_TEXT" '"$FIRE_URL"'

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "worker-liveness-guard.test.sh: all checks passed"
  exit 0
else
  echo "worker-liveness-guard.test.sh: $FAILURES check(s) failed"
  exit 1
fi
