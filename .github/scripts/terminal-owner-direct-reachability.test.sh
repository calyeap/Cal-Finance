#!/usr/bin/env bash
# CF-TERMINAL-HANDOFF-REPAIR-01
#
# Deterministic, network-free structural check on cc-auto-fire.yml's
# fire-owner-on-terminal job. Guards against two ways this edge could ship
# broken even though terminal-routing-lib.test.sh's pure classification is
# fully correct — the exact class of defect calvin-ruling-reachability.test.sh
# already guards for the CALVIN RULING edge (issue #197 ADDENDUM):
#
#   1. The job-level `if:` prefilter is what actually starts this job and
#      claims the cf-owner-single-writer concurrency group, before any
#      step-level classification runs. A bare substring `contains()` match
#      on the comment body would let any comment merely mentioning one of
#      the four direct terminal markers evict a genuinely queued OWNER
#      wake. Admission for these markers must be start-anchored
#      (startsWith), exactly like the existing CALVIN RULING admission.
#   2. The `Resolve target` step must actually call
#      terminal_is_owner_direct_marker and terminal_owner_admission_status
#      — otherwise the job could start on the coarse prefilter above but
#      never apply the precise first-line classification or the admission
#      dedupe, firing OWNER for any comment merely starting with one of
#      these words.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKFLOWS_DIR="$(cd "${SCRIPT_DIR}/../workflows" && pwd)"
CC_AUTO_FIRE="${WORKFLOWS_DIR}/cc-auto-fire.yml"

FAILURES=0

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
# owner-single-writer-config.test.sh's / calvin-ruling-reachability.test.sh's
# helper.
extract_job_block() {
  local file="$1" job_name="$2"
  awk -v job="  ${job_name}:" '
    $0 == job { found = 1; print; next }
    found && /^  [A-Za-z]/ { exit }
    found { print }
  ' "$file"
}

terminal_block="$(extract_job_block "$CC_AUTO_FIRE" "fire-owner-on-terminal")"

if [ -z "$terminal_block" ]; then
  echo "not ok - found the fire-owner-on-terminal job block in cc-auto-fire.yml"
  FAILURES=$((FAILURES + 1))
else
  echo "ok - found the fire-owner-on-terminal job block in cc-auto-fire.yml"

  for marker in "DONE: EVIDENCE" "STOP:" "BLOCKED:" "CALVIN REQUIRED:"; do
    anchored="false"
    if printf '%s\n' "$terminal_block" | grep -qF "startsWith(github.event.comment.body, '${marker}')"; then
      anchored="true"
    fi
    assert_true "job-level admission for '${marker}' is start-anchored (startsWith)" "$anchored"

    not_substring="true"
    if printf '%s\n' "$terminal_block" | grep -qF "contains(github.event.comment.body, '${marker}')"; then
      not_substring="false"
    fi
    assert_true "job-level admission for '${marker}' does not also use a bare substring (contains) match" "$not_substring"
  done

  calls_marker_classifier="false"
  if printf '%s\n' "$terminal_block" | grep -q 'terminal_is_owner_direct_marker'; then
    calls_marker_classifier="true"
  fi
  assert_true "Resolve target calls terminal_is_owner_direct_marker" "$calls_marker_classifier"

  calls_admission_status="false"
  if printf '%s\n' "$terminal_block" | grep -q 'terminal_owner_admission_status'; then
    calls_admission_status="true"
  fi
  assert_true "Resolve target calls terminal_owner_admission_status (the direct-comment + compatibility-label dedupe)" "$calls_admission_status"

  still_grouped="false"
  if printf '%s\n' "$terminal_block" | grep -A1 'concurrency:' | grep -q 'group: cf-owner-single-writer'; then
    still_grouped="true"
  fi
  assert_true "fire-owner-on-terminal still shares the cf-owner-single-writer concurrency group" "$still_grouped"

  sources_terminal_lib="false"
  if printf '%s\n' "$terminal_block" | grep -q 'source .github/scripts/terminal-routing-lib.sh'; then
    sources_terminal_lib="true"
  fi
  assert_true "Resolve target sources terminal-routing-lib.sh" "$sources_terminal_lib"
fi

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "terminal-owner-direct-reachability.test.sh: all checks passed"
  exit 0
else
  echo "terminal-owner-direct-reachability.test.sh: $FAILURES check(s) failed"
  exit 1
fi
