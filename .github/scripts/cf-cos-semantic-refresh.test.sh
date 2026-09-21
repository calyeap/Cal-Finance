#!/usr/bin/env bash
# CF-OUTCOME-LOOP-LEAN-01
#
# Lightweight structural regression test for
# .github/workflows/cf-cos-semantic-refresh.yml. The workflow itself only
# runs on live GitHub events, so this asserts the committed YAML text
# directly for the three properties issue CF-OUTCOME-LOOP-LEAN-01's item 6
# requires:
#   - no `pull_request` trigger (redundant with OWNER's own
#     `OWNER RECONCILED:`-driven refresh);
#   - no fallback that can route a projection refresh to BUILD_FIRE_URL/
#     BUILD_FIRE_TOKEN when WATCH's own secrets are absent;
#   - the recognised comment markers are meaningful terminal/reconciliation
#     receipts only (BUILD FIRED / REVIEW FIRED / CORRECT dropped).
#
# Run directly with
# `bash .github/scripts/cf-cos-semantic-refresh.test.sh`; wired into CI
# (.github/workflows/ci.yml) alongside the other .test.sh scripts.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKFLOW="${SCRIPT_DIR}/../workflows/cf-cos-semantic-refresh.yml"

FAILURES=0

assert_not_contains() {
  local desc="$1" pattern="$2"
  if grep -qF -- "$pattern" "$WORKFLOW"; then
    echo "not ok - $desc (found [$pattern])"
    FAILURES=$((FAILURES + 1))
  else
    echo "ok - $desc"
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

if [ ! -f "$WORKFLOW" ]; then
  echo "not ok - $WORKFLOW exists"
  echo "cf-cos-semantic-refresh.test.sh: 1 check(s) failed"
  exit 1
fi

# --- no redundant pull_request trigger -----------------------------------

assert_not_contains "no 'pull_request:' trigger block" "  pull_request:"

# --- no fallback that can route a projection refresh to BUILD_FIRE_URL ---

assert_not_contains "no BUILD_FIRE_URL secret reference" "secrets.BUILD_FIRE_URL"
assert_not_contains "no BUILD_FIRE_TOKEN secret reference" "secrets.BUILD_FIRE_TOKEN"
assert_not_contains "no CF_FIRE_URL fallback variable" "CF_FIRE_URL"
assert_not_contains "no CF_FIRE_TOKEN fallback variable" "CF_FIRE_TOKEN"
assert_contains "fails cleanly when WATCH secrets are absent" "not falling back to another routine's fire endpoint"

# --- recognised markers are meaningful terminal/reconciliation receipts
# only: BUILD FIRED / REVIEW FIRED / CORRECT no longer trigger a refresh.
# Matched as case-pattern alternatives (trailing *) rather than bare
# substrings, since the surrounding comment explaining the removal
# legitimately still names them in prose.

assert_not_contains "'BUILD FIRED:' no longer a recognised case pattern" "'BUILD FIRED:'*"
assert_not_contains "'REVIEW FIRED:' no longer a recognised case pattern" "'REVIEW FIRED:'*"
assert_not_contains "'CORRECT' no longer a recognised case pattern" "'CORRECT'|"

# --- the actual terminal/reconciliation markers are still recognised -----

assert_contains "'DONE:' still recognised" "'DONE:'*"
assert_contains "'ACCEPT' still recognised" "'ACCEPT'"
assert_contains "'BLOCKED:' still recognised" "'BLOCKED:'*"
assert_contains "'STOP:' still recognised" "'STOP:'*"
assert_contains "'CALVIN REQUIRED:' still recognised" "'CALVIN REQUIRED:'*"
assert_contains "'OWNER RECONCILED:' ordering note preserved" "'OWNER RECONCILED:'*"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "cf-cos-semantic-refresh.test.sh: all checks passed"
  exit 0
else
  echo "cf-cos-semantic-refresh.test.sh: $FAILURES check(s) failed"
  exit 1
fi
