#!/usr/bin/env bash
# CF-FREEZE-CLOSEOUT-01 (F10)
#
# Deterministic, network-free structural check that BUILD.md, CC.md, and
# OWNER.md all carry the explicit hard boundary against an AI worker
# impersonating a Calvin ruling. `CALVIN RULING` routing
# (calvin-ruling-lib.sh) is text-based and every AI worker posts under the
# same GitHub user identity, so nothing else in this repo stops a worker
# from opening a comment with `CALVIN RULING` and having it read as an
# authenticated Calvin decision. This does not add new identity
# infrastructure — it only makes the boundary explicit in the three
# adapters a worker actually reads.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROUTINES_DIR="$(cd "${SCRIPT_DIR}/../ai-routines" && pwd)"

FAILURES=0

assert_contains() {
  local desc="$1" file="$2" pattern="$3"
  if grep -qF -- "$pattern" "$file"; then
    echo "ok - $desc"
  else
    echo "not ok - $desc (missing [$pattern] in $file)"
    FAILURES=$((FAILURES + 1))
  fi
}

for adapter in BUILD.md CC.md OWNER.md; do
  f="${ROUTINES_DIR}/${adapter}"
  if [ ! -f "$f" ]; then
    echo "not ok - $f exists"
    FAILURES=$((FAILURES + 1))
    continue
  fi
  assert_contains "$adapter's hard boundaries prohibit an AI worker opening a comment with CALVIN RULING" \
    "$f" "must never begin any GitHub comment with \`CALVIN RULING\`"
  assert_contains "$adapter's hard boundaries prohibit presenting an AI/default decision as a Calvin ruling" \
    "$f" "present an AI/default decision as a Calvin ruling"
  assert_contains "$adapter reserves CALVIN RULING for an authenticated Calvin-facing interaction" \
    "$f" "reserved for a decision promoted from an authenticated Calvin-facing"
done

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "calvin-ruling-impersonation-guard.test.sh: all checks passed"
  exit 0
else
  echo "calvin-ruling-impersonation-guard.test.sh: $FAILURES check(s) failed"
  exit 1
fi
