#!/usr/bin/env bash
# CF-STATUS-PLUMBING-CLEANUP-01
#
# Lightweight structural regression test for
# .github/ai-routines/OWNER.md. OWNER.md is an execution adapter read by a
# worker, not code that runs in CI, so this asserts the committed Markdown
# text directly for the property issue #235 requires: OWNER must derive
# current status/attention (CALVIN/AI/EXTERNAL/PARKED) from native GitHub
# state, never from Cal Finance Project Home's `NEXT MOVE` line, which
# issue #231/#232's Phase 2 cutover superseded for this fact type.
#
# Run directly with
# `bash .github/scripts/owner-attention-authority.test.sh`; wired into CI
# (.github/workflows/ci.yml) alongside the other .test.sh scripts.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADAPTER="${SCRIPT_DIR}/../ai-routines/OWNER.md"

FAILURES=0

assert_not_contains() {
  local desc="$1" pattern="$2"
  if grep -qF -- "$pattern" "$ADAPTER"; then
    echo "not ok - $desc (found [$pattern])"
    FAILURES=$((FAILURES + 1))
  else
    echo "ok - $desc"
  fi
}

assert_contains() {
  local desc="$1" pattern="$2"
  if grep -qF -- "$pattern" "$ADAPTER"; then
    echo "ok - $desc"
  else
    echo "not ok - $desc (missing [$pattern])"
    FAILURES=$((FAILURES + 1))
  fi
}

if [ ! -f "$ADAPTER" ]; then
  echo "not ok - $ADAPTER exists"
  echo "owner-attention-authority.test.sh: 1 check(s) failed"
  exit 1
fi

# --- Project Home NEXT MOVE no longer claimed as attention authority -----

assert_not_contains "Project Home NEXT MOVE no longer claimed as sole attention authority" "It is the sole attention authority"
assert_not_contains "terminal rule no longer requires writing Project Home NEXT MOVE=AI" "Project Home \`NEXT MOVE\` must be \`AI\`"
assert_not_contains "terminal rule no longer requires writing Project Home NEXT MOVE=CALVIN" "Project Home \`NEXT MOVE\` must be \`CALVIN\`"

# --- native GitHub is named as the attention authority -------------------

assert_contains "native GitHub named as the attention authority" "Native GitHub state is the sole"
assert_contains "NEEDS CALVIN derivation present (matches docs/CURRENT-AUTHORITY.md)" "the most recent unanswered"
assert_contains "hard bound against writing status/NEXT/attention to Project Home" "Do not write current status, \`NEXT\`, or attention to Cal"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "owner-attention-authority.test.sh: all checks passed"
  exit 0
else
  echo "owner-attention-authority.test.sh: $FAILURES check(s) failed"
  exit 1
fi
