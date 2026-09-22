#!/usr/bin/env bash
# CF-OWNER-FASTPATH-SHADOW-01
#
# Deterministic, network-free unit tests for latency-report-lib.sh.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=latency-report-lib.sh
source "${SCRIPT_DIR}/latency-report-lib.sh"

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

# --- latency_duration_seconds -----------------------------------------------

assert_eq "latency_duration_seconds computes a positive gap in seconds" \
  "90" "$(latency_duration_seconds "2026-09-22T01:00:00Z" "2026-09-22T01:01:30Z")"

assert_eq "latency_duration_seconds is zero for identical timestamps" \
  "0" "$(latency_duration_seconds "2026-09-22T01:00:00Z" "2026-09-22T01:00:00Z")"

# --- latency_owner_span ------------------------------------------------------

comments='[
  {"body":"OWNER ATTEMPT START: MERGE-100-1\nwake_class: MERGE", "created_at":"2026-09-22T01:00:00Z"},
  {"body":"some unrelated chatter", "created_at":"2026-09-22T01:05:00Z"},
  {"body":"DISPATCHED: https://github.com/x/y/issues/9 [OWNER_ATTEMPT_ID: MERGE-100-1]", "created_at":"2026-09-22T01:12:00Z"}
]'
span="$(latency_owner_span "$comments" "MERGE-100-1")"
assert_eq "latency_owner_span finds the attempt's own start" "2026-09-22T01:00:00Z" "$(jq -r '.start' <<<"$span")"
assert_eq "latency_owner_span finds the correlated terminal" "2026-09-22T01:12:00Z" "$(jq -r '.terminal' <<<"$span")"
assert_eq "latency_owner_span computes the duration in seconds" "720" "$(jq -r '.duration_seconds' <<<"$span")"

no_terminal_comments='[{"body":"OWNER ATTEMPT START: MERGE-200-1", "created_at":"2026-09-22T02:00:00Z"}]'
open_span="$(latency_owner_span "$no_terminal_comments" "MERGE-200-1")"
assert_eq "latency_owner_span leaves terminal null for a still-open attempt" "null" "$(jq -r '.terminal' <<<"$open_span")"
assert_eq "latency_owner_span leaves duration_seconds null for a still-open attempt" "null" "$(jq -r '.duration_seconds' <<<"$open_span")"

wrong_attempt_span="$(latency_owner_span "$comments" "MERGE-999-1")"
assert_eq "latency_owner_span never matches a different attempt_id's terminal to this attempt" "null" "$(jq -r '.terminal' <<<"$wrong_attempt_span")"

# --- latency_shadow_span ----------------------------------------------------

shadow="$(latency_shadow_span "2026-09-22T03:00:00Z" "2026-09-22T03:00:02Z")"
assert_eq "latency_shadow_span computes the event -> shadow decision gap" "2" "$(jq -r '.duration_seconds' <<<"$shadow")"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "latency-report-lib.test.sh: all checks passed"
  exit 0
else
  echo "latency-report-lib.test.sh: $FAILURES check(s) failed"
  exit 1
fi
