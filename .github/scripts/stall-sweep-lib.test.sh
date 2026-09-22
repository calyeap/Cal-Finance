#!/usr/bin/env bash
# CF-OWNER-FASTPATH-SHADOW-01
#
# Deterministic, network-free unit tests for stall-sweep-lib.sh. Exercises
# the exact stall case from issue #212's scope item 5, plus a truth-table
# of near-miss cases that must all stay "ok" — a safety net that fires on
# an ambiguous input is worse than one that occasionally waits an extra
# sweep cycle.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=stall-sweep-lib.sh
source "${SCRIPT_DIR}/stall-sweep-lib.sh"

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

# --- the one genuine stall case ---------------------------------------------

assert_eq "active, nothing running, no gate, no park, no dispatch, continuation expected -> stall" \
  "stall" "$(stall_sweep_status active false false false false true)"

# --- every single near-miss must stay "ok" ----------------------------------

assert_eq "project not meant to be active -> ok" \
  "ok" "$(stall_sweep_status idle false false false false true)"

assert_eq "an active attempt already exists -> ok" \
  "ok" "$(stall_sweep_status active true false false false true)"

assert_eq "a pending Calvin gate exists -> ok" \
  "ok" "$(stall_sweep_status active false true false false true)"

assert_eq "an explicit WAIT/parked reason exists -> ok" \
  "ok" "$(stall_sweep_status active false false true false true)"

assert_eq "an already-dispatched worker/PR is in flight -> ok" \
  "ok" "$(stall_sweep_status active false false false true true)"

assert_eq "continuation is not actually expected -> ok" \
  "ok" "$(stall_sweep_status active false false false false false)"

# --- the fully healthy default and the fully-everything-wrong case ---------

assert_eq "nothing active and nothing expected -> ok" \
  "ok" "$(stall_sweep_status idle true true true true false)"

# --- stall_sweep_latest_owner_terminal_is_parked ----------------------------

parked_comments='[
  {"body":"WAIT: AI — recovering", "created_at":"2026-09-22T01:00:00Z"},
  {"body":"WAIT: PARKED — by Calvin, until Q4 review", "created_at":"2026-09-22T02:00:00Z"}
]'
if stall_sweep_latest_owner_terminal_is_parked "$parked_comments"; then
  echo "ok - latest OWNER terminal WAIT: PARKED is recognised"
else
  echo "not ok - latest OWNER terminal WAIT: PARKED is recognised"
  FAILURES=$((FAILURES + 1))
fi

not_parked_comments='[
  {"body":"WAIT: PARKED — by Calvin, until Q4 review", "created_at":"2026-09-22T01:00:00Z"},
  {"body":"WAIT: AI — recovering", "created_at":"2026-09-22T02:00:00Z"}
]'
if stall_sweep_latest_owner_terminal_is_parked "$not_parked_comments"; then
  echo "not ok - an older WAIT: PARKED superseded by a newer terminal is not parked"
  FAILURES=$((FAILURES + 1))
else
  echo "ok - an older WAIT: PARKED superseded by a newer terminal is not parked"
fi

if stall_sweep_latest_owner_terminal_is_parked '[]'; then
  echo "not ok - no OWNER terminal at all is not parked"
  FAILURES=$((FAILURES + 1))
else
  echo "ok - no OWNER terminal at all is not parked"
fi

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "stall-sweep-lib.test.sh: all checks passed"
  exit 0
else
  echo "stall-sweep-lib.test.sh: $FAILURES check(s) failed"
  exit 1
fi
