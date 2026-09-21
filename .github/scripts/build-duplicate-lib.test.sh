#!/usr/bin/env bash
# CF-OUTCOME-LOOP-LEAN-01
#
# Deterministic, network-free unit tests for build-duplicate-lib.sh. Run
# directly with `bash .github/scripts/build-duplicate-lib.test.sh`; wired
# into CI (.github/workflows/ci.yml) alongside the other .test.sh scripts.
#
# Covers TEST / PROOF REQUIREMENT 3: two near-simultaneous BUILD wake
# attempts for the same active target produce one BUILD fire and one
# DUPLICATE SUPPRESSED, demonstrated here as the underlying classification
# the fire-build job's dedup step relies on.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=build-duplicate-lib.sh
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

assert_contains() {
  local desc="$1" pattern="$2"
  if grep -qF -- "$pattern" "$WORKFLOW"; then
    echo "ok - $desc"
  else
    echo "not ok - $desc (missing [$pattern])"
    FAILURES=$((FAILURES + 1))
  fi
}

# --- no BUILD FIRED receipt at all: nothing to suppress -----------------

no_fire=$(jq -n '[{body: "some unrelated comment", created_at: "2026-09-21T09:00:00Z"}]')
status=$(build_duplicate_status "$no_fire")
assert_eq "no BUILD FIRED receipt classifies clear" "clear" "$status"

# --- issue #188 shape: two label-add events within ~30s, first fire's
# BUILD FIRED has no terminal after it yet -> second must be suppressed ---

in_flight=$(jq -n '
  [{body: "BUILD FIRED: HTTP 200 · session cse_1", created_at: "2026-09-21T09:31:06Z"}]
')
status=$(build_duplicate_status "$in_flight")
assert_eq "an open BUILD FIRED receipt with no terminal after it classifies duplicate" "duplicate" "$status"

# --- a normal completed cycle: BUILD FIRED followed by DONE clears the
# way for a legitimate later re-fire (e.g. from a CORRECT comment) --------

completed_cycle=$(jq -n '
  [
    {body: "BUILD FIRED: HTTP 200 · session cse_1", created_at: "2026-09-21T09:31:06Z"},
    {body: "DONE: https://github.com/calyeap/Cal-Finance/pull/42", created_at: "2026-09-21T09:45:00Z"}
  ]
')
status=$(build_duplicate_status "$completed_cycle")
assert_eq "BUILD FIRED followed by DONE classifies clear" "clear" "$status"

# --- BLOCKED / STOP / CALVIN REQUIRED all count as terminal, same as DONE -

for terminal in "BLOCKED: waiting on external data" "STOP: MISSING OUTCOME-ID — none found" "CALVIN REQUIRED: pick a strategy"; do
  cycle=$(jq -n --arg t "$terminal" '
    [
      {body: "BUILD FIRED: HTTP 200 · session cse_1", created_at: "2026-09-21T09:31:06Z"},
      {body: $t, created_at: "2026-09-21T09:45:00Z"}
    ]
  ')
  status=$(build_duplicate_status "$cycle")
  assert_eq "BUILD FIRED followed by [$terminal] classifies clear" "clear" "$status"
done

# --- a second BUILD FIRED after a completed cycle, with nothing after it
# yet, is itself an open attempt (a fresh correction re-fire in flight) ---

reopened=$(jq -n '
  [
    {body: "BUILD FIRED: HTTP 200 · session cse_1", created_at: "2026-09-21T09:31:06Z"},
    {body: "DONE: https://github.com/calyeap/Cal-Finance/pull/42", created_at: "2026-09-21T09:45:00Z"},
    {body: "REVIEW FIRED: HTTP 200 · session cse_2", created_at: "2026-09-21T09:46:00Z"},
    {body: "CORRECT: rename the helper per review", created_at: "2026-09-21T09:50:00Z"},
    {body: "BUILD FIRED: HTTP 200 · session cse_3", created_at: "2026-09-21T09:50:05Z"}
  ]
')
status=$(build_duplicate_status "$reopened")
assert_eq "the most recent BUILD FIRED (a legitimate correction re-fire) with no terminal after it classifies duplicate against a further stacked fire" "duplicate" "$status"

# --- out-of-order fetch (paginated comments not guaranteed sorted) must
# still classify correctly by created_at, not array position -------------

unsorted=$(jq -n '
  [
    {body: "DONE: https://github.com/calyeap/Cal-Finance/pull/42", created_at: "2026-09-21T09:45:00Z"},
    {body: "BUILD FIRED: HTTP 200 · session cse_1", created_at: "2026-09-21T09:31:06Z"}
  ]
')
status=$(build_duplicate_status "$unsorted")
assert_eq "classification is order-independent (sorts by created_at internally)" "clear" "$status"

# --- structural regression anchor for TEST / PROOF REQUIREMENT 3: the
# classifier above is only deterministic once an earlier "BUILD FIRED:"
# receipt has actually landed, which needs the fire-build job itself
# serialized per target so two near-simultaneous wakes can't both read
# "no open attempt" before either one posts its receipt. -----------------

if [ ! -f "$WORKFLOW" ]; then
  echo "not ok - $WORKFLOW exists"
  FAILURES=$((FAILURES + 1))
else
  assert_contains "fire-build has a per-target concurrency group" \
    'group: fire-build-${{ github.event.issue.number || github.event.pull_request.number }}'
  assert_contains "fire-build concurrency queues rather than cancels a waiting run" \
    "cancel-in-progress: false"
fi

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "build-duplicate-lib.test.sh: all checks passed"
  exit 0
else
  echo "build-duplicate-lib.test.sh: $FAILURES check(s) failed"
  exit 1
fi
