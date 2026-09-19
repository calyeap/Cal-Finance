#!/usr/bin/env bash
# CF-OWNER-LIVENESS-01
#
# Deterministic, network-free tests for owner-liveness-guard.sh's own
# control flow — specifically the boundary owner-liveness-lib.test.sh
# cannot reach: what `main` actually branches on after calling
# wait_and_check via command substitution, not what owner_liveness_status
# returns in isolation.
#
# This exists because wait_and_check's informational progress line was
# once written to stdout inside a function whose stdout command
# substitution captures for the "complete"/"missing" verdict, so the
# verdict was silently prefixed with that line and every comparison
# against the bare string "complete" failed — misclassifying every
# healthy attempt as stalled. owner_liveness_status itself was never
# wrong, so the existing lib unit tests stayed green throughout.
#
# Sets OWNER_LIVENESS_LEASE_MINUTES=0 and stubs fetch_comments so this
# runs instantly and hits no network, consistent with
# owner-liveness-lib.test.sh.

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

# Required env for the script's own `: "${VAR:?}"` guards. Values are
# dummies: fetch_comments/post_comment/curl are stubbed or unreached below.
export GH_TOKEN=dummy
export TARGET_REPO=x/y
export TARGET_NUMBER=1
export ATTEMPT_ID=MERGE-1000-1
export WAKE_CLASS=MERGE
export OWNER_LIVENESS_LEASE_MINUTES=0

# shellcheck source=owner-liveness-guard.sh
source "${SCRIPT_DIR}/owner-liveness-guard.sh"

# --- healthy attempt: wait_and_check must return the bare string
# "complete", not the progress line + "complete" -----------------------------

fetch_comments() {
  jq -n --arg attempt "$ATTEMPT_ID" '
    [{body: ("DISPATCHED: https://github.com/x/y/issues/9 [OWNER_ATTEMPT_ID: " + $attempt + "]"), created_at: "2026-09-19T12:05:00Z"}]
  '
}
status="$(wait_and_check "$ATTEMPT_ID" "2026-09-19T12:00:00Z")"
assert_eq "wait_and_check returns bare 'complete' for a healthy attempt (not prefixed with the progress line)" "complete" "$status"

# --- stalled attempt: wait_and_check must return the bare string "missing" --

fetch_comments() {
  echo '[]'
}
status="$(wait_and_check "$ATTEMPT_ID" "2026-09-19T12:00:00Z")"
assert_eq "wait_and_check returns bare 'missing' for a stalled attempt" "missing" "$status"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "owner-liveness-guard.test.sh: all checks passed"
  exit 0
else
  echo "owner-liveness-guard.test.sh: $FAILURES check(s) failed"
  exit 1
fi
