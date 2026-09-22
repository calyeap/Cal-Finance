#!/usr/bin/env bash
# CF-GATE-PUSH-01 (issue #221)
#
# Deterministic, network-free tests for calvin-gate-push.sh's own control
# flow — what `main` does with fetch_comments/send_push/post_comment,
# mirroring the stub-and-source convention owner-liveness-guard.test.sh
# already uses for the same reason: exercising branching that calls
# through command substitution, which the pure lib tests can't reach.
#
# Covers this outcome's DONE WHEN directly:
#   - one OPEN gate -> one push attempt (send_push called exactly once,
#     and only on a genuinely new dedupe key);
#   - duplicate/retry of the same unchanged gate -> no duplicate push
#     (send_push not called again once the marker exists);
#   - push failure -> gate remains OPEN and workflow continues safely
#     (modeled here as: post_comment is never called on a failed send,
#     and the script's own exit code never raises above what the caller
#     is expected to treat as non-blocking);
#   - missing secret/config -> safe explicit no-send state, no workflow
#     failure (exit 0, send_push never called).
#
# Run directly with `bash .github/scripts/calvin-gate-push.test.sh`;
# wired into CI (.github/workflows/ci.yml) alongside the other .test.sh
# scripts.

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
# dummies: fetch_comments/post_comment/send_push are stubbed below, so gh
# and curl are never actually invoked.
export GH_TOKEN=dummy
export TARGET_REPO=x/y
export TARGET_NUMBER=221
export GATE_ID=GATE-1
export PROJECT="Cal Finance"
export ASK="Approve provider X"

# shellcheck source=calvin-gate-push.sh
source "${SCRIPT_DIR}/calvin-gate-push.sh"

# Every `main` call below runs via command substitution ($(main)), which
# bash always runs in a subshell — so main's own `exit` calls only end
# that subshell, and `$?` right after still captures its real exit code.
# That same subshell boundary means a stubbed send_push/post_comment
# can't hand a call count back to the parent script through an ordinary
# variable, so counts are tallied through temp files instead, which
# persist across the subshell.

COUNT_DIR="$(mktemp -d)"
trap 'rm -rf "$COUNT_DIR"' EXIT

reset_counts() {
  : > "$COUNT_DIR/send_push"
  : > "$COUNT_DIR/post_comment"
}
count() {
  wc -l < "$COUNT_DIR/$1" | tr -d ' '
}

# --- new gate, config present, push succeeds: exactly one send_push,
# marker recorded, exit 0 -----------------------------------------------

reset_counts
fetch_comments() { echo '[]'; }
post_comment() { echo 1 >> "$COUNT_DIR/post_comment"; }
send_push() { echo 1 >> "$COUNT_DIR/send_push"; echo "200"; }
CALVIN_PUSH_WEBHOOK_URL="https://example.invalid/push"
CALVIN_PUSH_WEBHOOK_TOKEN=""

output="$(main)"
status=$?
assert_eq "new gate with config present sends exactly one push" "1" "$(count send_push)"
assert_eq "a successful send records the dedupe marker" "1" "$(count post_comment)"
assert_eq "a successful send exits 0" "0" "$status"

# --- same unchanged gate retried: marker already present -> no duplicate
# push --------------------------------------------------------------------

dedupe_key="$(calvin_gate_push_dedupe_key "$GATE_ID" "$ASK")"
marker="$(calvin_gate_push_marker "$dedupe_key")"

reset_counts
fetch_comments() { jq -n --arg marker "$marker" '[{body: $marker}]'; }
post_comment() { echo 1 >> "$COUNT_DIR/post_comment"; }
send_push() { echo 1 >> "$COUNT_DIR/send_push"; echo "200"; }

output="$(main)"
status=$?
assert_eq "a retried unchanged gate sends no duplicate push" "0" "$(count send_push)"
assert_eq "a retried unchanged gate does not post another marker" "0" "$(count post_comment)"
assert_eq "duplicate suppression still exits 0 (not a failure)" "0" "$status"

# --- missing webhook config: safe explicit no-send, no workflow failure --

reset_counts
fetch_comments() { echo '[]'; }
post_comment() { echo 1 >> "$COUNT_DIR/post_comment"; }
send_push() { echo 1 >> "$COUNT_DIR/send_push"; echo "200"; }
CALVIN_PUSH_WEBHOOK_URL=""
CALVIN_PUSH_WEBHOOK_TOKEN=""

output="$(main)"
status=$?
assert_eq "missing webhook config never calls send_push" "0" "$(count send_push)"
assert_eq "missing webhook config posts no marker" "0" "$(count post_comment)"
assert_eq "missing webhook config exits 0, not a failure" "0" "$status"
case "$output" in
  *"CALVIN_PUSH_WEBHOOK_URL is not configured"*"gate stays OPEN"*)
    echo "ok - missing config logs an explicit no-send state naming the gate stays OPEN" ;;
  *)
    echo "not ok - missing config logs an explicit no-send state naming the gate stays OPEN (got: $output)"
    FAILURES=$((FAILURES + 1)) ;;
esac

# --- push failure: gate/marker untouched, script signals failure without
# the caller needing to treat it as a gate-altering error -----------------

reset_counts
fetch_comments() { echo '[]'; }
post_comment() { echo 1 >> "$COUNT_DIR/post_comment"; }
send_push() { echo 1 >> "$COUNT_DIR/send_push"; echo "500"; }
CALVIN_PUSH_WEBHOOK_URL="https://example.invalid/push"
CALVIN_PUSH_WEBHOOK_TOKEN=""

output="$(main)"
status=$?
assert_eq "a failed push attempt still only calls send_push once" "1" "$(count send_push)"
assert_eq "a failed push attempt never records a dedupe marker" "0" "$(count post_comment)"
assert_eq "a failed push attempt exits non-zero (caller logs it, never alters the gate)" "1" "$status"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "calvin-gate-push.test.sh: all checks passed"
  exit 0
else
  echo "calvin-gate-push.test.sh: $FAILURES check(s) failed"
  exit 1
fi
