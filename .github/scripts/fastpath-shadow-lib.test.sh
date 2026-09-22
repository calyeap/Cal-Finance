#!/usr/bin/env bash
# CF-OWNER-FASTPATH-SHADOW-01
#
# Deterministic, network-free unit tests for fastpath-shadow-lib.sh. Covers
# at least one real/deterministic replay case per allowlisted rule plus
# deliberate cases that must escalate — issue #212's scope item 7 (shadow
# coverage gate): zero disagreement between shadow and the classification
# each rule mirrors is what matters, not raw event count.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=fastpath-shadow-lib.sh
source "${SCRIPT_DIR}/fastpath-shadow-lib.sh"

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

# --- REVIEW_TERMINAL_ROUTE: real/deterministic replay cases -----------------

assert_eq "DONE: EVIDENCE always shadows to WOULD_EXECUTE (matches BUILD.md's evidence-only skip)" \
  "WOULD_EXECUTE:SKIP_REVIEW_DONE_EVIDENCE" \
  "$(fastpath_shadow_classify_review_terminal "DONE: EVIDENCE — verified against current master" false)"

assert_eq "DONE: with a resolvable PR shadows to WOULD_EXECUTE (matches fire-review's normal path)" \
  "WOULD_EXECUTE:FIRE_REVIEW_DONE_PR" \
  "$(fastpath_shadow_classify_review_terminal "DONE: https://github.com/x/y/pull/9" true)"

# --- REVIEW_TERMINAL_ROUTE: deliberate cases that must escalate -------------

assert_eq "DONE: with no resolvable PR escalates (fire-review itself posts REVIEW FIRE SKIPPED here)" \
  "ESCALATE:DONE_WITH_NO_RESOLVABLE_PR" \
  "$(fastpath_shadow_classify_review_terminal "DONE: see summary above" false)"

assert_eq "a non-DONE terminal (e.g. BLOCKED) escalates — this rule only covers DONE routing" \
  "ESCALATE:UNRECOGNIZED_TERMINAL_SHAPE" \
  "$(fastpath_shadow_classify_review_terminal "BLOCKED: missing secret" false)"

assert_eq "an empty/garbage first line escalates" \
  "ESCALATE:UNRECOGNIZED_TERMINAL_SHAPE" \
  "$(fastpath_shadow_classify_review_terminal "" false)"

# --- BUILD_DUPLICATE_ADMIT: real/deterministic replay cases -----------------

assert_eq "an unresolved BUILD FIRED receipt shadows to WOULD_EXECUTE (matches build-duplicate-lib.sh suppression)" \
  "WOULD_EXECUTE:SUPPRESS_DUPLICATE_BUILD" \
  "$(fastpath_shadow_classify_build_duplicate duplicate)"

assert_eq "a clear duplicate check shadows to WOULD_EXECUTE (matches the normal BUILD admit path)" \
  "WOULD_EXECUTE:ADMIT_BUILD_FIRE" \
  "$(fastpath_shadow_classify_build_duplicate clear)"

# --- BUILD_DUPLICATE_ADMIT: deliberate case that must escalate --------------

assert_eq "an unrecognised duplicate_status value escalates rather than guessing" \
  "ESCALATE:UNKNOWN_DUPLICATE_STATUS" \
  "$(fastpath_shadow_classify_build_duplicate "")"

# --- fastpath_shadow_format ---------------------------------------------

assert_eq "fastpath_shadow_format produces one durable, greppable log line" \
  "SHADOW: event=REVIEW_TERMINAL_ROUTE decision=WOULD_EXECUTE:SKIP_REVIEW_DONE_EVIDENCE" \
  "$(fastpath_shadow_format REVIEW_TERMINAL_ROUTE "WOULD_EXECUTE:SKIP_REVIEW_DONE_EVIDENCE")"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "fastpath-shadow-lib.test.sh: all checks passed"
  exit 0
else
  echo "fastpath-shadow-lib.test.sh: $FAILURES check(s) failed"
  exit 1
fi
