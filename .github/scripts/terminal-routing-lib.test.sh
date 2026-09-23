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
#
# CF-CORRECT-ROUTER-01 additionally covers the demonstrated PR #218
# failure shape (REVIEW's first line was "## CORRECT") plus the existing
# accepted CORRECT / CORRECT: shapes and the quoted/example-text guard.

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

# --- terminal_is_correct_marker (CF-CORRECT-ROUTER-01) -------------------

assert_eq "bare CORRECT still matches" "true" "$(terminal_is_correct_marker "CORRECT")"
assert_eq "CORRECT: with detail still matches" "true" "$(terminal_is_correct_marker "CORRECT: fix the off-by-one in the parser")"

# Exact PR #218 failure shape: REVIEW's first line was "## CORRECT".
assert_eq "## CORRECT (PR #218 failure shape) matches" "true" "$(terminal_is_correct_marker "## CORRECT")"
assert_eq "## CORRECT: with detail matches" "true" "$(terminal_is_correct_marker "$(printf '## CORRECT: tighten the null check\n\nSee the diff for detail.')")"

# Leading blank lines before a heading-prefixed marker still resolve.
assert_eq "leading blank lines before ## CORRECT still match" "true" "$(terminal_is_correct_marker "$(printf '\n\n  ## CORRECT\nbody\n')")"

# A quoted/example CORRECT later in the comment must not fire when the
# first line itself is not a terminal marker.
not_first_line=$(printf 'ACCEPT: looks good\n\nEarlier drafts said "## CORRECT" but that was superseded.')
assert_eq "quoted ## CORRECT later in the comment does not match" "false" "$(terminal_is_correct_marker "$not_first_line")"

# A near-miss word must not match either shape.
assert_eq "CORRECTED (no colon) does not match" "false" "$(terminal_is_correct_marker "CORRECTED")"
assert_eq "## CORRECTED (no colon) does not match" "false" "$(terminal_is_correct_marker "## CORRECTED")"

# --- terminal_is_calvin_required_marker (CF-CALVIN-ATTENTION-LEAN-01) ----

assert_eq "plain CALVIN REQUIRED: marker matches" "true" "$(terminal_is_calvin_required_marker "CALVIN REQUIRED: approve A or B")"

assert_eq "CALVIN REQUIRED: with [OWNER_ATTEMPT_ID: ...] suffix still matches" "true" \
  "$(terminal_is_calvin_required_marker "CALVIN REQUIRED: approve A or B [OWNER_ATTEMPT_ID: abc123]")"

assert_eq "leading blank lines before CALVIN REQUIRED: still match" "true" \
  "$(terminal_is_calvin_required_marker "$(printf '\n\n  CALVIN REQUIRED: approve A or B\nbody\n')")"

# Heading-prefixed marker (the PR #229 correction shape): must still alert.
assert_eq "## CALVIN REQUIRED: (heading-prefixed) matches" "true" \
  "$(terminal_is_calvin_required_marker "## CALVIN REQUIRED: approve A or B")"

# Routine terminals and a quoted/later mention must not match.
assert_eq "DONE: terminal does not match" "false" "$(terminal_is_calvin_required_marker "DONE: https://github.com/x/y/pull/42")"
assert_eq "WAIT: terminal does not match" "false" "$(terminal_is_calvin_required_marker "WAIT: AI")"
assert_eq "CORRECT: terminal does not match" "false" "$(terminal_is_calvin_required_marker "CORRECT: fix the parser")"

quoted_calvin=$(printf 'DONE: https://github.com/x/y/pull/42\n\nEarlier drafts said "CALVIN REQUIRED:" but that was superseded.')
assert_eq "quoted CALVIN REQUIRED: later in the comment does not match" "false" "$(terminal_is_calvin_required_marker "$quoted_calvin")"

# Leading blank lines before a heading-prefixed CALVIN REQUIRED: marker
# (combining both fixups) still resolve.
assert_eq "leading blank lines before ## CALVIN REQUIRED: still match" "true" \
  "$(terminal_is_calvin_required_marker "$(printf '\n\n  ## CALVIN REQUIRED: approve A or B\nbody\n')")"

# --- CF-SLACK-ALERT-RELIABILITY-01 ----------------------------------------
#
# Root cause A: terminal_first_line used to be `sed | head -n1 | sed`.
# Under `set -o pipefail`, GitHub Actions' default `run:` shell already
# wraps steps in `bash -e {0}`, so a long body could make head -n1 close
# the pipe early, SIGPIPE the upstream sed, and abort the whole step even
# though the first line was valid. Prove the fixed pipeline-free
# implementation survives the exact effective flags GitHub Actions uses
# (-e -u -o pipefail) on a long multi-line body.
long_body=$(printf 'CALVIN REQUIRED: approve the long rollout plan\n%s\n' "$(printf 'x%.0s' $(seq 1 20000))")
long_first_line_output=$(bash -c '
  set -euo pipefail
  source "'"${SCRIPT_DIR}"'/terminal-routing-lib.sh"
  terminal_first_line "$1"
' _ "$long_body")
long_first_line_status=$?
assert_eq "terminal_first_line survives a long multi-line body under -euo pipefail" "0" "$long_first_line_status"
assert_eq "terminal_first_line still extracts the correct first line from a long body" \
  "CALVIN REQUIRED: approve the long rollout plan" "$long_first_line_output"

long_marker_ok=$(bash -c '
  set -euo pipefail
  source "'"${SCRIPT_DIR}"'/terminal-routing-lib.sh"
  terminal_is_calvin_required_marker "$1"
' _ "$long_body")
assert_eq "long multi-line CALVIN REQUIRED: body still classifies as a marker" "true" "$long_marker_ok"

# Root cause B: the Slack ask-normalisation path used `| xargs` to trim
# whitespace, and xargs parses its input for shell-like quoting, so an
# apostrophe (or other quote-like punctuation) in an ordinary ask could
# fail with an unmatched-quote error. terminal_trim_whitespace must treat
# all of that as opaque text.
assert_eq "terminal_trim_whitespace leaves an apostrophe untouched" \
  "approve Calvin's decision" "$(terminal_trim_whitespace "  approve Calvin's decision  ")"
assert_eq "terminal_trim_whitespace leaves double quotes untouched" \
  'approve the "fast" rollout' "$(terminal_trim_whitespace '  approve the "fast" rollout  ')"
assert_eq "terminal_trim_whitespace leaves backticks untouched" \
  'run `npm test` first' "$(terminal_trim_whitespace '  run `npm test` first  ')"
assert_eq "terminal_trim_whitespace leaves brackets untouched" \
  'approve A or B [see thread]' "$(terminal_trim_whitespace '  approve A or B [see thread]  ')"
assert_eq "terminal_trim_whitespace collapses to empty on an all-whitespace string" \
  "" "$(terminal_trim_whitespace "   ")"

# End-to-end shape of calvin-slack-alert.yml's ask derivation: strip the
# CALVIN REQUIRED: marker prefix, strip a trailing [OWNER_ATTEMPT_ID: ...]
# suffix, then trim — exercised here exactly as the workflow step does it,
# so the apostrophe/quote/backtick/bracket cases are proven against the
# real derivation order, not just the trim helper in isolation.
derive_ask() {
  local body="$1" first_line normalized ask
  first_line="$(terminal_first_line "$body")"
  normalized="$(terminal_strip_markdown_heading "$first_line")"
  ask=${normalized#CALVIN REQUIRED:}
  ask=$(printf '%s' "$ask" | sed -E 's/[[:space:]]*\[OWNER_ATTEMPT_ID:[^]]+\][[:space:]]*$//')
  terminal_trim_whitespace "$ask"
}

assert_eq "derived ask keeps an apostrophe intact" \
  "approve Calvin's decision" \
  "$(derive_ask "CALVIN REQUIRED: approve Calvin's decision")"
assert_eq "derived ask keeps quotes/backticks/brackets intact and strips the attempt-id suffix" \
  'run `npm test` and confirm the "fast" path [details]' \
  "$(derive_ask 'CALVIN REQUIRED: run `npm test` and confirm the "fast" path [details] [OWNER_ATTEMPT_ID: abc123]')"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "terminal-routing-lib.test.sh: all checks passed"
  exit 0
else
  echo "terminal-routing-lib.test.sh: $FAILURES check(s) failed"
  exit 1
fi
