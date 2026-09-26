#!/usr/bin/env bash
# CF-FREEZE-CLOSEOUT-01 (F5)
#
# Deterministic, network-free structural check on cc-auto-fire.yml's
# fire-build and fire-review jobs. Issue #352 observed BUILD's original
# 20-minute terminal-only liveness lease cross before a real product BUILD
# actually completed: the one bounded recovery fired while the original
# BUILD attempt was still running, and that original BUILD then also
# completed — two live BUILD sessions for one outcome. The smallest fix
# raises BUILD's own lease (via WORKER_LIVENESS_LEASE_MINUTES on its "Run
# BUILD liveness guard" step) to a window that covers real observed
# product-build duration, with a matching job timeout, while REVIEW and
# OWNER stay unchanged. This test greps the workflow file directly rather
# than trusting comments, and asserts fire-review/fire-owner-on-terminal
# were not touched.

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
# Mirrors owner-single-writer-config.test.sh's / calvin-ruling-reachability
# .test.sh's helper: prints one top-level job block from its "  <job>:"
# header up to (not including) the next line at the same two-space indent.
extract_job_block() {
  local file="$1" job_name="$2"
  awk -v job="  ${job_name}:" '
    $0 == job { found = 1; print; next }
    found && /^  [A-Za-z]/ { exit }
    found { print }
  ' "$file"
}

build_block="$(extract_job_block "$CC_AUTO_FIRE" "fire-build")"
review_block="$(extract_job_block "$CC_AUTO_FIRE" "fire-review")"

if [ -z "$build_block" ]; then
  echo "not ok - found the fire-build job block in cc-auto-fire.yml"
  FAILURES=$((FAILURES + 1))
else
  echo "ok - found the fire-build job block in cc-auto-fire.yml"
fi

if [ -z "$review_block" ]; then
  echo "not ok - found the fire-review job block in cc-auto-fire.yml"
  FAILURES=$((FAILURES + 1))
else
  echo "ok - found the fire-review job block in cc-auto-fire.yml"
fi

# --- BUILD: raised lease + matching job timeout ---------------------------

build_lease="false"
if printf '%s\n' "$build_block" | grep -qE 'WORKER_LIVENESS_LEASE_MINUTES:\s*"40"'; then
  build_lease="true"
fi
assert_true "fire-build's liveness guard step sets WORKER_LIVENESS_LEASE_MINUTES to 40" "$build_lease"

build_timeout="$(printf '%s\n' "$build_block" | grep -m1 'timeout-minutes:' | sed -E 's/^[[:space:]]*timeout-minutes:[[:space:]]*//')"
assert_eq "fire-build's job timeout covers two bounded 40-minute windows plus overhead" "90" "$build_timeout"

# --- REVIEW: lease/timeout semantics stay unchanged ------------------------

review_lease_override="false"
if printf '%s\n' "$review_block" | grep -q 'WORKER_LIVENESS_LEASE_MINUTES'; then
  review_lease_override="true"
fi
assert_eq "fire-review's liveness guard step does not override WORKER_LIVENESS_LEASE_MINUTES (keeps the 20-minute default)" "false" "$review_lease_override"

review_timeout="$(printf '%s\n' "$review_block" | grep -m1 'timeout-minutes:' | sed -E 's/^[[:space:]]*timeout-minutes:[[:space:]]*//')"
assert_eq "fire-review's job timeout is unchanged" "50" "$review_timeout"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "build-lease-config.test.sh: all checks passed"
  exit 0
else
  echo "build-lease-config.test.sh: $FAILURES check(s) failed"
  exit 1
fi
