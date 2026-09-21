#!/usr/bin/env bash
# CF-OWNER-SINGLE-WRITER-01 addendum, corrected (issue #197 ADDENDUM)
#
# Deterministic, network-free structural check on cc-auto-fire.yml. The
# first version of the ruling-wake edge ran the classification in its own
# fire-owner-on-calvin-ruling job that only re-applied the needs-owner-wake
# label, on the assumption that the label write would re-enter
# fire-owner-on-terminal's `labeled`-event trigger. It never did: GitHub
# Actions does not start a new workflow run from an event produced by the
# repository's own GITHUB_TOKEN, so that label write was a dead end —
# calvin-ruling-lib.test.sh's 12/12 pure-classifier coverage could not catch
# this, because the classifier itself was correct; only the delivery step
# was broken. This test guards against that exact class of defect
# regressing: an edge whose only production effect is a workflow-authored
# label write depended on as a trigger.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKFLOWS_DIR="$(cd "${SCRIPT_DIR}/../workflows" && pwd)"
CC_AUTO_FIRE="${WORKFLOWS_DIR}/cc-auto-fire.yml"

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

assert_true() {
  local desc="$1" cond="$2"
  if [ "$cond" = "true" ]; then
    echo "ok - $desc"
  else
    echo "not ok - $desc"
    FAILURES=$((FAILURES + 1))
  fi
}

# extract_job_block <file> <job_name>
# Prints one top-level job block (from its "  <job_name>:" header up to,
# but not including, the next line at the same two-space indent). Mirrors
# owner-single-writer-config.test.sh's helper.
extract_job_block() {
  local file="$1" job_name="$2"
  awk -v job="  ${job_name}:" '
    $0 == job { found = 1; print; next }
    found && /^  [A-Za-z]/ { exit }
    found { print }
  ' "$file"
}

# --- the old label-hop job must be gone, not merely supplemented ---------

old_job_count="$(grep -c '^  fire-owner-on-calvin-ruling:' "$CC_AUTO_FIRE" || true)"
assert_eq "the old fire-owner-on-calvin-ruling job no longer exists" "0" "$old_job_count"

# --- the job that actually fires OWNER must itself be reachable from a
# qualifying issue_comment event, not only from the needs-owner-wake label -

terminal_block="$(extract_job_block "$CC_AUTO_FIRE" "fire-owner-on-terminal")"

if [ -z "$terminal_block" ]; then
  echo "not ok - found the fire-owner-on-terminal job block in cc-auto-fire.yml"
  FAILURES=$((FAILURES + 1))
else
  echo "ok - found the fire-owner-on-terminal job block in cc-auto-fire.yml"

  has_issue_comment_admission="false"
  if printf '%s\n' "$terminal_block" | grep -q "github.event_name == 'issue_comment'"; then
    has_issue_comment_admission="true"
  fi
  assert_true "fire-owner-on-terminal's own trigger admits issue_comment (the ruling path terminates in the job that fires OWNER, not behind a label hop)" "$has_issue_comment_admission"

  fires_owner="false"
  if printf '%s\n' "$terminal_block" | grep -q 'OWNER_FIRE_URL'; then
    fires_owner="true"
  fi
  assert_true "the job admitting issue_comment is the same job that fires CALBOARD-OWNER" "$fires_owner"

  still_grouped="false"
  if printf '%s\n' "$terminal_block" | grep -A1 'concurrency:' | grep -q 'group: cf-owner-single-writer'; then
    still_grouped="true"
  fi
  assert_true "the merged job still shares the cf-owner-single-writer concurrency group" "$still_grouped"
fi

# --- no workflow may write needs-owner-wake as its own trigger mechanism -
# BUILD/REVIEW/OWNER apply this label from their own authenticated agent
# sessions (never committed here), which is a legitimate, working trigger
# for the labeled-event path above. What must never exist again is a
# workflow *step*, running as GITHUB_TOKEN, that adds this label and
# expects that write to start a new workflow run — exactly the dead end
# fire-owner-on-calvin-ruling relied on.

label_write_count="$(grep -rn 'labels\[\]=.*needs-owner-wake' "$WORKFLOWS_DIR" | grep -v ':.*#' | wc -l | tr -d ' ')"
assert_eq "no workflow step writes needs-owner-wake as its own (dead-end) trigger mechanism" "0" "$label_write_count"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "calvin-ruling-reachability.test.sh: all checks passed"
  exit 0
else
  echo "calvin-ruling-reachability.test.sh: $FAILURES check(s) failed"
  exit 1
fi
