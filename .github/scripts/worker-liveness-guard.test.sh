#!/usr/bin/env bash
# CF-HANDOFF-FAIL-CLOSED-01
#
# Deterministic, network-free tests for worker-liveness-guard.sh's own
# control flow — mirrors owner-liveness-guard.test.sh's boundary (what
# `wait_and_check` returns via command substitution, not what the pure
# lib classifiers return in isolation) for both actors this guard serves.
#
# Sets WORKER_LIVENESS_LEASE_MINUTES=0 and stubs fetch_comments so this
# runs instantly and hits no network.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

export GH_TOKEN=dummy
export TARGET_REPO=x/y
export TARGET_NUMBER=1
export WORKER_LIVENESS_LEASE_MINUTES=0

# --- BUILD actor -----------------------------------------------------------

export ACTOR=BUILD
export ATTEMPT_ID=BUILD-2000-1

# shellcheck source=worker-liveness-guard.sh
source "${SCRIPT_DIR}/worker-liveness-guard.sh"

fetch_comments() {
  jq -n --arg attempt "$ATTEMPT_ID" '
    [{body: ("DONE: https://github.com/x/y/pull/9 [BUILD_ATTEMPT_ID: " + $attempt + "]"), created_at: "2026-09-26T12:05:00Z"}]
  '
}
status="$(wait_and_check "$ATTEMPT_ID" "2026-09-26T12:00:00Z")"
assert_eq "BUILD: wait_and_check returns bare 'complete' for a healthy attempt" "complete" "$status"

fetch_comments() {
  echo '[]'
}
status="$(wait_and_check "$ATTEMPT_ID" "2026-09-26T12:00:00Z")"
assert_eq "BUILD: wait_and_check returns bare 'missing' for a stalled attempt" "missing" "$status"

# --- REVIEW actor: re-source with ACTOR switched, mirroring how each
# workflow job sets its own ACTOR before calling this script fresh --------

export ACTOR=REVIEW
export ATTEMPT_ID=REVIEW-3000-1

# shellcheck source=worker-liveness-guard.sh
source "${SCRIPT_DIR}/worker-liveness-guard.sh"

fetch_comments() {
  jq -n --arg attempt "$ATTEMPT_ID" '
    [{body: ("ACCEPT: head abc123 verified [REVIEW_ATTEMPT_ID: " + $attempt + "]"), created_at: "2026-09-26T12:05:00Z"}]
  '
}
status="$(wait_and_check "$ATTEMPT_ID" "2026-09-26T12:00:00Z")"
assert_eq "REVIEW: wait_and_check returns bare 'complete' for a healthy attempt" "complete" "$status"

fetch_comments() {
  echo '[]'
}
status="$(wait_and_check "$ATTEMPT_ID" "2026-09-26T12:00:00Z")"
assert_eq "REVIEW: wait_and_check returns bare 'missing' for a stalled attempt" "missing" "$status"

# --- actor_fire_secret_name names the exact secret per actor --------------

assert_eq "REVIEW actor names CC_AUTO_FIRE_TOKEN as its secret to refresh" "CC_AUTO_FIRE_TOKEN" "$(actor_fire_secret_name)"
ACTOR=BUILD
assert_eq "BUILD actor names BUILD_FIRE_TOKEN as its secret to refresh" "BUILD_FIRE_TOKEN" "$(actor_fire_secret_name)"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "worker-liveness-guard.test.sh: all checks passed"
  exit 0
else
  echo "worker-liveness-guard.test.sh: $FAILURES check(s) failed"
  exit 1
fi
