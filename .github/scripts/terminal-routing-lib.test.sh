#!/usr/bin/env bash
# CF-OUTCOME-LOOP-LEAN-01
#
# Deterministic, network-free unit tests for terminal-routing-lib.sh. Run
# directly with `bash .github/scripts/terminal-routing-lib.test.sh`; wired
# into CI (.github/workflows/ci.yml) alongside the other .test.sh scripts.
#
# Covers the two defects the issue's TEST / PROOF REQUIREMENTS name:
#   1. `DONE: EVIDENCE` is recognised distinctly from a PR-bearing DONE.
#   4. A quoted/example /pull/N later in the comment cannot redirect
#      REVIEW — only the first line's own reference counts.
#   5. The existing normal DONE: <PR link> route stays green.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=terminal-routing-lib.sh
source "${SCRIPT_DIR}/terminal-routing-lib.sh"

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

assert_empty() {
  local desc="$1" actual="$2"
  if [ -z "$actual" ]; then
    echo "ok - $desc"
  else
    echo "not ok - $desc (expected empty, got [$actual])"
    FAILURES=$((FAILURES + 1))
  fi
}

# --- terminal_first_line ------------------------------------------------

first_line=$(terminal_first_line "$(printf '\n\n  DONE: https://github.com/x/y/pull/42\nsecond line\n')")
assert_eq "terminal_first_line drops leading blanks and trims whitespace" "DONE: https://github.com/x/y/pull/42" "$first_line"

# --- normal DONE: <PR link> route stays green (proof requirement 5) -----

pr=$(terminal_pr_number_from_first_line "DONE: https://github.com/calyeap/Cal-Finance/pull/42")
assert_eq "normal DONE with PR link on the first line resolves that PR number" "42" "$pr"

# --- DONE: EVIDENCE never carries a PR link (proof requirement 1) -------

evidence_first_line=$(terminal_first_line "DONE: EVIDENCE — confirmed via audit, no code change required")
case "$evidence_first_line" in
  "DONE: EVIDENCE"*) ok=true ;;
  *) ok=false ;;
esac
assert_eq "DONE: EVIDENCE is recognisable on the first line" "true" "$ok"

pr=$(terminal_pr_number_from_first_line "DONE: EVIDENCE — confirmed via audit, no code change required")
assert_empty "DONE: EVIDENCE's first line carries no PR number to scrape" "$pr"

# --- a quoted/example /pull/N later in the comment must not redirect
# REVIEW (proof requirement 4) --------------------------------------------

quoted_later=$(printf 'DONE: https://github.com/calyeap/Cal-Finance/pull/42\n\nEarlier drafts referenced https://github.com/calyeap/Cal-Finance/pull/1 as an example; ignore it.')
pr=$(terminal_pr_number_from_first_line "$quoted_later")
assert_eq "PR number binds to the first line even when a different /pull/N appears later in prose" "42" "$pr"

quoted_before_link=$(printf 'DONE: see https://github.com/calyeap/Cal-Finance/pull/99 (superseding the earlier https://github.com/calyeap/Cal-Finance/pull/1 draft mentioned below)\n\nhttps://github.com/calyeap/Cal-Finance/pull/1')
pr=$(terminal_pr_number_from_first_line "$quoted_before_link")
assert_eq "PR number binds to the first /pull/N on the first line itself, not a later duplicate" "99" "$pr"

# --- DONE with no PR link anywhere on the first line resolves empty -----

no_link=$(terminal_pr_number_from_first_line "DONE: implementation ready, see the PR opened separately")
assert_empty "DONE with no /pull/N on the first line resolves no PR number" "$no_link"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "terminal-routing-lib.test.sh: all checks passed"
  exit 0
else
  echo "terminal-routing-lib.test.sh: $FAILURES check(s) failed"
  exit 1
fi
