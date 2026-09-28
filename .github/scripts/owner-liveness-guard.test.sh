#!/usr/bin/env bash
# CF-OWNER-LIVENESS-01 — 28 Sep 2026 reset
# Deterministic, network-free tests for detection-only OWNER liveness.

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
export ATTEMPT_ID=MERGE-1000-1
export WAKE_CLASS=MERGE
export OWNER_LIVENESS_LEASE_MINUTES=0

# shellcheck source=owner-liveness-guard.sh
source "${SCRIPT_DIR}/owner-liveness-guard.sh"
post_comment() { LAST_COMMENT="$1"; }

fetch_comments() {
  jq -n --arg attempt "$ATTEMPT_ID" '[{body: ("DISPATCHED: https://github.com/x/y/issues/9 [OWNER_ATTEMPT_ID: " + $attempt + "]"), created_at: "2026-09-19T12:05:00Z"}]'
}
status="$(wait_and_check "$ATTEMPT_ID" "2026-09-19T12:00:00Z")"
assert_eq "healthy OWNER attempt completes" "complete" "$status"

fetch_comments() { echo '[]'; }
status="$(wait_and_check "$ATTEMPT_ID" "2026-09-19T12:00:00Z")"
assert_eq "stalled OWNER attempt becomes missing" "missing" "$status"
LAST_COMMENT=""
post_blocked
assert_contains "OWNER timeout emits actionable workflow block" "$LAST_COMMENT" "WORKFLOW BLOCKED — LIVENESS"
assert_contains "OWNER timeout preserves exact attempt" "$LAST_COMMENT" "attempt: MERGE-1000-1"
assert_contains "OWNER timeout states no automatic recovery" "$LAST_COMMENT" "No automatic OWNER recovery was fired"

SCRIPT_TEXT="$(cat "${SCRIPT_DIR}/owner-liveness-guard.sh")"
assert_not_contains "guard has no OWNER recovery fire function" "$SCRIPT_TEXT" "fire_owner_recovery()"
assert_not_contains "guard does not call OWNER_FIRE_URL" "$SCRIPT_TEXT" '"$OWNER_FIRE_URL"'

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "owner-liveness-guard.test.sh: all checks passed"
  exit 0
else
  echo "owner-liveness-guard.test.sh: $FAILURES check(s) failed"
  exit 1
fi
