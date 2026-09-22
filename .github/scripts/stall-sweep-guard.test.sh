#!/usr/bin/env bash
# CF-OWNER-FASTPATH-SHADOW-01
#
# Deterministic, network-free control-flow tests for stall-sweep-guard.sh:
# stubs every gh/curl-backed helper (fetch_ledger_comments,
# fetch_repo_comments_since, open_label_count, open_pr_count,
# fire_owner_stall_recovery) so main()'s evidence-gathering and its final
# branch into stall_sweep_status can be exercised without gh/curl —
# mirroring owner-liveness-guard.test.sh's approach for a sibling guard.

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

assert_contains() {
  local desc="$1" haystack="$2" needle="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "ok - $desc"
  else
    echo "not ok - $desc (expected to find [$needle] in [$haystack])"
    FAILURES=$((FAILURES + 1))
  fi
}

export GH_TOKEN=dummy
export OWNER_FIRE_URL=https://example.invalid/fire
export OWNER_FIRE_TOKEN=dummy
export TARGET_REPO=x/y
export LEDGER_ISSUE_NUMBER=213

# shellcheck source=stall-sweep-guard.sh
source "${SCRIPT_DIR}/stall-sweep-guard.sh"

FIRE_CALLS="$(mktemp)"
trap 'rm -f "$FIRE_CALLS"' EXIT

fire_owner_stall_recovery() {
  printf 'attempt_id=%s target_number=%s\n' "$1" "$2" >>"$FIRE_CALLS"
  return 0
}

LEDGER_JSON=""
fetch_ledger_comments() {
  if [ -z "$LEDGER_JSON" ]; then
    echo '[]'
    return
  fi
  jq -nc --arg body "$(ledger_comment_body "$LEDGER_JSON")" \
    '[{body:$body, created_at:"2026-09-22T02:00:00Z"}]'
}

REPO_COMMENTS='[]'
fetch_repo_comments_since() {
  printf '%s' "$REPO_COMMENTS"
}

GATE_COUNT=0
DISPATCH_COUNT=0
PR_COUNT=0
open_label_count() {
  case "$1" in
    needs-owner-wake) echo "$GATE_COUNT" ;;
    needs-build-wake) echo "$DISPATCH_COUNT" ;;
    *) echo 0 ;;
  esac
}
open_pr_count() {
  echo "$PR_COUNT"
}

# --- no ledger state at all: nothing to sweep, never fires ------------------

LEDGER_JSON=""
: >"$FIRE_CALLS"
main
assert_eq "no ledger state yet -> no fire" "" "$(cat "$FIRE_CALLS")"

# --- an in-flight PR suppresses the fire ------------------------------------

LEDGER_JSON="$(ledger_initial cal-finance "2026-09-22T01:00:00Z")"
LEDGER_JSON="$(jq -c '.state="active" | .active_outcome_id="212"' <<<"$LEDGER_JSON")"
REPO_COMMENTS='[]'
GATE_COUNT=0
DISPATCH_COUNT=0
PR_COUNT=1
: >"$FIRE_CALLS"
main
assert_eq "active outcome, an open PR exists (in-flight dispatch) -> no fire" "" "$(cat "$FIRE_CALLS")"

# --- the genuine stall: active outcome, nothing running, no gate, no park, --
# --- no PR in flight -> fires OWNER on the ledger's active_outcome_id ------

PR_COUNT=0
: >"$FIRE_CALLS"
main
fire_call="$(cat "$FIRE_CALLS")"
assert_contains "a genuine stall fires OWNER on the ledger's active_outcome_id" "$fire_call" "target_number=212"
assert_contains "the stall fire's attempt_id carries the STALL- prefix" "$fire_call" "attempt_id=STALL-"

# --- an open needs-owner-wake gate suppresses the fire ----------------------

GATE_COUNT=1
: >"$FIRE_CALLS"
main
assert_eq "a pending needs-owner-wake gate -> no fire" "" "$(cat "$FIRE_CALLS")"
GATE_COUNT=0

# --- a WAIT: PARKED terminal suppresses the fire ----------------------------

REPO_COMMENTS='[{"body":"WAIT: PARKED — by Calvin, until Q4 review [OWNER_ATTEMPT_ID: MERGE-1-1]", "created_at":"2026-09-22T01:30:00Z"}]'
: >"$FIRE_CALLS"
main
assert_eq "a WAIT: PARKED terminal -> no fire" "" "$(cat "$FIRE_CALLS")"
REPO_COMMENTS='[]'

# --- a non-numeric active_outcome_id is skipped rather than guessed a target

LEDGER_JSON="$(jq -c '.active_outcome_id="CF-SOME-OUTCOME"' <<<"$LEDGER_JSON")"
: >"$FIRE_CALLS"
main
assert_eq "a non-numeric active_outcome_id is never fired at (nothing safe to wake)" "" "$(cat "$FIRE_CALLS")"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "stall-sweep-guard.test.sh: all checks passed"
  exit 0
else
  echo "stall-sweep-guard.test.sh: $FAILURES check(s) failed"
  exit 1
fi
