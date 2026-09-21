#!/usr/bin/env bash
# CF-OWNER-SINGLE-WRITER-01
#
# Deterministic, network-free structural check on the two workflow files
# that fire CALBOARD-OWNER: owner-on-merge.yml's fire-owner-on-merge job
# (merge wake) and cc-auto-fire.yml's fire-owner-on-terminal job (terminal
# wake). The single-writer guarantee these two jobs give Cal Finance
# Project Home depends entirely on both declaring the exact same
# `concurrency.group` value with `cancel-in-progress: false` — GitHub
# Actions only serializes jobs that share an identical group string. A
# typo, a per-run-id interpolation, or a `cancel-in-progress: true` on
# either job would silently defeat the whole fix (the workflows would
# still run, just without exclusion) with nothing else here to catch it,
# so this test greps both files directly rather than trusting the
# adjacent prose comments.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKFLOWS_DIR="$(cd "${SCRIPT_DIR}/../workflows" && pwd)"

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

# extract_owner_job_block <file> <job_name>
# Prints the lines of one top-level job block (from its "  <job_name>:"
# header up to, but not including, the next line at the same two-space
# indent), which is enough to see that job's own `concurrency:` stanza
# without picking up an unrelated job's.
extract_owner_job_block() {
  local file="$1" job_name="$2"
  awk -v job="  ${job_name}:" '
    $0 == job { found = 1; print; next }
    found && /^  [A-Za-z]/ { exit }
    found { print }
  ' "$file"
}

merge_block="$(extract_owner_job_block "${WORKFLOWS_DIR}/owner-on-merge.yml" "fire-owner-on-merge")"
terminal_block="$(extract_owner_job_block "${WORKFLOWS_DIR}/cc-auto-fire.yml" "fire-owner-on-terminal")"

if [ -z "$merge_block" ]; then
  echo "not ok - found the fire-owner-on-merge job block in owner-on-merge.yml"
  FAILURES=$((FAILURES + 1))
else
  echo "ok - found the fire-owner-on-merge job block in owner-on-merge.yml"
fi

if [ -z "$terminal_block" ]; then
  echo "not ok - found the fire-owner-on-terminal job block in cc-auto-fire.yml"
  FAILURES=$((FAILURES + 1))
else
  echo "ok - found the fire-owner-on-terminal job block in cc-auto-fire.yml"
fi

merge_group="$(printf '%s\n' "$merge_block" | grep -A1 'concurrency:' | grep 'group:' | sed -E 's/^ *group: *//')"
terminal_group="$(printf '%s\n' "$terminal_block" | grep -A1 'concurrency:' | grep 'group:' | sed -E 's/^ *group: *//')"

assert_eq "owner-on-merge.yml's job declares the cf-owner-single-writer group" "cf-owner-single-writer" "$merge_group"
assert_eq "cc-auto-fire.yml's job declares the cf-owner-single-writer group" "cf-owner-single-writer" "$terminal_group"
assert_eq "both OWNER fire jobs share the identical concurrency group string" "$merge_group" "$terminal_group"

merge_cancel="$(printf '%s\n' "$merge_block" | grep 'cancel-in-progress:' | sed -E 's/^ *cancel-in-progress: *//')"
terminal_cancel="$(printf '%s\n' "$terminal_block" | grep 'cancel-in-progress:' | sed -E 's/^ *cancel-in-progress: *//')"

assert_eq "owner-on-merge.yml's job does not cancel an in-progress OWNER write" "false" "$merge_cancel"
assert_eq "cc-auto-fire.yml's job does not cancel an in-progress OWNER write" "false" "$terminal_cancel"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "owner-single-writer-config.test.sh: all checks passed"
  exit 0
else
  echo "owner-single-writer-config.test.sh: $FAILURES check(s) failed"
  exit 1
fi
