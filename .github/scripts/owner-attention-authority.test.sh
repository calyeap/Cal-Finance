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
assert_contains "NEEDS CALVIN derivation present (matches docs/CURRENT-AUTHORITY.md)" "most recent unanswered"
assert_contains "hard bound against writing status/NEXT/attention to Project Home" "Do not write current status, \`NEXT\`, or attention to Cal"

# --- F4 (CF-FREEZE-CLOSEOUT-01): NEEDS CALVIN reconstructs only from an
# unanswered CALVIN REQUIRED:, while STOP/BLOCKED/DONE: EVIDENCE remain
# OWNER-owned control transitions that still reach OWNER -------------------

assert_contains "CALVIN is scoped to an unanswered CALVIN REQUIRED: (not STOP/BLOCKED/DONE: EVIDENCE by themselves)" \
  "most recent unanswered \`CALVIN REQUIRED:\` terminal comment, or an open"
assert_contains "STOP/BLOCKED/DONE: EVIDENCE are explicitly not NEEDS CALVIN by themselves" \
  "itself \`NEEDS CALVIN\`"
assert_contains "STOP/BLOCKED/DONE: EVIDENCE still route directly to OWNER" \
  "route directly to OWNER per"
assert_contains "AI attention owner covers an unresolved STOP/BLOCKED/DONE: EVIDENCE this run has not yet escalated" \
  "this run has not yet converted into a fresh"

# --- F2 (CF-FREEZE-CLOSEOUT-01): stale lane-specific OWNER permissions are
# gone; the general gate-compression / DRAFT BEFORE ASK rules remain -------

assert_not_contains "stale Analyzer finish-line standing authorisation section is gone" \
  "Analyzer finish-line standing authorisation"
assert_not_contains "completed CF-HANDOFF-FAIL-CLOSED-01 canary pause section is gone" \
  "CF-HANDOFF-FAIL-CLOSED-01 canary"
assert_not_contains "stale product-continuation pause language is gone" \
  "do not dispatch any new"
assert_contains "general gate-compression / DRAFT BEFORE ASK rules are preserved" \
  "Gate-compression / DRAFT BEFORE ASK"
assert_contains "the escalate-only-material-exception rule is preserved" \
  "Escalate only a material exception."

# --- F6 (CF-FREEZE-CLOSEOUT-01): a Calvin ruling that redirects/supersedes
# an ordinary outcome can close its wake target with a successor/defer
# pointer instead of leaving resolved residue open indefinitely ------------

assert_contains "routine issue closure allows a redirecting CALVIN RULING to close with a successor/defer pointer" \
  "on the wake target itself redirects or"
assert_contains "closure by ruling covers superseding its ordinary outcome" \
  "supersedes its ordinary outcome"
assert_contains "closure by ruling still names the successor/defer pointer, never a bulk sweep" \
  "never bulk-close"

# --- F9 (CF-FREEZE-CLOSEOUT-01): coalesced OWNER wake recovery check ------

assert_contains "the coalesced-wake recovery check is documented as part of the existing read step" \
  "Coalesced-wake recovery check"

# --- F10 (CF-FREEZE-CLOSEOUT-01): workers must never impersonate a Calvin
# ruling ---------------------------------------------------------------

assert_contains "OWNER.md prohibits an AI worker from opening a comment with CALVIN RULING" \
  "must never begin any GitHub comment with \`CALVIN RULING\`"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "owner-attention-authority.test.sh: all checks passed"
  exit 0
else
  echo "owner-attention-authority.test.sh: $FAILURES check(s) failed"
  exit 1
fi
