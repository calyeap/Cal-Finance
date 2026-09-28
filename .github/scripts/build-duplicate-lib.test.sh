#!/usr/bin/env bash
# CF-OUTCOME-LOOP-LEAN-01
# Deterministic, network-free tests for BUILD admission.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/build-duplicate-lib.sh"
WORKFLOW="${SCRIPT_DIR}/../workflows/cc-auto-fire.yml"
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

assert_contains_file() {
  local desc="$1" pattern="$2"
  if grep -qF -- "$pattern" "$WORKFLOW"; then
    echo "ok - $desc"
  else
    echo "not ok - $desc (missing [$pattern])"
    FAILURES=$((FAILURES + 1))
  fi
}

no_fire=$(jq -n '[{body: "some unrelated comment", created_at: "2026-09-21T09:00:00Z"}]')
assert_eq "no BUILD attempt is clear" "clear" "$(build_duplicate_status "$no_fire")"

in_flight=$(jq -n '[{body: "BUILD FIRED: HTTP 200 · session cse_1", created_at: "2026-09-21T09:31:06Z"}]')
assert_eq "BUILD FIRED without terminal is duplicate" "duplicate" "$(build_duplicate_status "$in_flight")"

completed_cycle=$(jq -n '[
  {body: "BUILD FIRED: HTTP 200 · session cse_1", created_at: "2026-09-21T09:31:06Z"},
  {body: "DONE: https://github.com/calyeap/Cal-Finance/pull/42", created_at: "2026-09-21T09:45:00Z"}
]')
assert_eq "terminal clears target-local admission" "clear" "$(build_duplicate_status "$completed_cycle")"

for terminal in "BLOCKED: waiting" "STOP: MISSING OUTCOME-ID — none" "CALVIN REQUIRED: pick"; do
  cycle=$(jq -n --arg t "$terminal" '[
    {body: "BUILD FIRED: HTTP 200", created_at: "2026-09-21T09:31:06Z"},
    {body: $t, created_at: "2026-09-21T09:45:00Z"}
  ]')
  assert_eq "[$terminal] clears target-local admission" "clear" "$(build_duplicate_status "$cycle")"
done

inline_body=$'## OUTCOME\nfoo\n\nOUTCOME-ID: `CF-ABC-01`'
assert_eq "parses inline OUTCOME-ID" "CF-ABC-01" "$(build_outcome_id_from_body "$inline_body")"
heading_body=$'## OUTCOME-ID\n\n`CF-XYZ-02`'
assert_eq "parses heading OUTCOME-ID" "CF-XYZ-02" "$(build_outcome_id_from_body "$heading_body")"

open_prs=$(jq -n '{items:[{number:353},{number:354}]}')
assert_eq "another open PR for the outcome blocks admission" "duplicate_pr" "$(build_outcome_open_pr_status "$open_prs" "353")"
self_only=$(jq -n '{items:[{number:353}]}')
assert_eq "current PR is ignored during correction re-fire" "clear" "$(build_outcome_open_pr_status "$self_only" "353")"
none=$(jq -n '{items:[]}')
assert_eq "no open PR for outcome is clear" "clear" "$(build_outcome_open_pr_status "$none" "")"

if [ ! -f "$WORKFLOW" ]; then
  echo "not ok - workflow exists"
  FAILURES=$((FAILURES + 1))
else
  assert_contains_file "fire-build still serializes same-target wakes" 'group: fire-build-${{ github.event.issue.number || github.event.pull_request.number }}'
  assert_contains_file "workflow queries open PRs by OUTCOME-ID before firing" 'build_outcome_open_pr_status'
  assert_contains_file "workflow suppresses duplicate outcome PR" 'DUPLICATE OUTCOME SUPPRESSED'
fi

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "build-duplicate-lib.test.sh: all checks passed"
  exit 0
else
  echo "build-duplicate-lib.test.sh: $FAILURES check(s) failed"
  exit 1
fi
