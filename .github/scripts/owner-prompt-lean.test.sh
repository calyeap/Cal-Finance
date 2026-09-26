#!/usr/bin/env bash
# CF-FREEZE-CLOSEOUT-01 (F1)
#
# Deterministic, network-free structural check on the three live OWNER
# fire/recovery prompts: owner-on-merge.yml's merge-wake fire,
# cc-auto-fire.yml's fire-owner-on-terminal terminal-wake fire, and
# owner-liveness-guard.sh's one bounded recovery fire. Current
# `.github/ai-routines/OWNER.md` (`WORKFLOW-DELETION-PASS-01`) explicitly
# says OWNER reads native GitHub and never writes to or reads back Cal
# Finance Project Home — but these three prompts previously still told a
# fresh OWNER session to "reconcile the full owned current-state block in
# Cal Finance Project Home from fresh evidence and read it back", actively
# misrouting it toward obsolete behaviour. This asserts all three prompts
# stay thin: follow the current OWNER.md adapter, identify the wake target/
# class, require the exact attempt-id terminal tag, and never restate the
# obsolete Project Home write/readback.
#
# Run directly with `bash .github/scripts/owner-prompt-lean.test.sh`; wired
# into CI (.github/workflows/ci.yml) alongside the other .test.sh scripts.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKFLOWS_DIR="$(cd "${SCRIPT_DIR}/../workflows" && pwd)"
OWNER_ON_MERGE="${WORKFLOWS_DIR}/owner-on-merge.yml"
CC_AUTO_FIRE="${WORKFLOWS_DIR}/cc-auto-fire.yml"
OWNER_LIVENESS_GUARD="${SCRIPT_DIR}/owner-liveness-guard.sh"

FAILURES=0

assert_not_contains() {
  local desc="$1" file="$2" pattern="$3"
  if grep -qF -- "$pattern" "$file"; then
    echo "not ok - $desc (found [$pattern] in $file)"
    FAILURES=$((FAILURES + 1))
  else
    echo "ok - $desc"
  fi
}

assert_contains() {
  local desc="$1" file="$2" pattern="$3"
  if grep -qF -- "$pattern" "$file"; then
    echo "ok - $desc"
  else
    echo "not ok - $desc (missing [$pattern] in $file)"
    FAILURES=$((FAILURES + 1))
  fi
}

for f in "$OWNER_ON_MERGE" "$CC_AUTO_FIRE" "$OWNER_LIVENESS_GUARD"; do
  if [ ! -f "$f" ]; then
    echo "not ok - $f exists"
    echo "owner-prompt-lean.test.sh: 1 check(s) failed"
    exit 1
  fi
done

# --- no live prompt restates the obsolete Project Home write/readback -----

for f in "$OWNER_ON_MERGE" "$CC_AUTO_FIRE" "$OWNER_LIVENESS_GUARD"; do
  assert_not_contains "$(basename "$f")'s prompt does not tell OWNER to reconcile Project Home" \
    "$f" "reconcile the full owned current-state block"
  assert_not_contains "$(basename "$f")'s prompt does not tell OWNER to read Project Home back" \
    "$f" "and read it back"
  assert_not_contains "$(basename "$f")'s prompt does not name Cal Finance Project Home truth" \
    "$f" "Cal Finance Project Home truth"
done

# --- each prompt still follows the current OWNER.md adapter and carries
# the mandatory attempt-id tag requirement -----------------------------

assert_contains "owner-on-merge.yml's prompt still points at the current OWNER.md adapter" \
  "$OWNER_ON_MERGE" ".github/ai-routines/OWNER.md"
assert_contains "owner-on-merge.yml's prompt still requires the OWNER_ATTEMPT_ID tag" \
  "$OWNER_ON_MERGE" "OWNER_ATTEMPT_ID"
assert_contains "owner-on-merge.yml's prompt names its wake class" \
  "$OWNER_ON_MERGE" "wake_class: MERGE"

assert_contains "cc-auto-fire.yml's terminal-wake prompt still points at the current OWNER.md adapter" \
  "$CC_AUTO_FIRE" ".github/ai-routines/OWNER.md"
assert_contains "cc-auto-fire.yml's terminal-wake prompt still requires the OWNER_ATTEMPT_ID tag" \
  "$CC_AUTO_FIRE" "OWNER_ATTEMPT_ID"
assert_contains "cc-auto-fire.yml's terminal-wake prompt names its wake class" \
  "$CC_AUTO_FIRE" "wake_class: TERMINAL"

assert_contains "owner-liveness-guard.sh's recovery prompt still points at the current OWNER.md adapter" \
  "$OWNER_LIVENESS_GUARD" ".github/ai-routines/OWNER.md"
assert_contains "owner-liveness-guard.sh's recovery prompt still requires the OWNER_ATTEMPT_ID tag" \
  "$OWNER_LIVENESS_GUARD" "OWNER_ATTEMPT_ID"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "owner-prompt-lean.test.sh: all checks passed"
  exit 0
else
  echo "owner-prompt-lean.test.sh: $FAILURES check(s) failed"
  exit 1
fi
