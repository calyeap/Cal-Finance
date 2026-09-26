#!/usr/bin/env bash
# CF-FREEZE-CLOSEOUT-01 (F9)
#
# Deterministic, network-free coverage for the coalesced-OWNER-wake
# recovery check. The `cf-owner-single-writer` concurrency group can
# replace a pending, not-yet-run OWNER wake with a newer one for a
# different target (see OWNER.md's "Single-writer serialization"); the
# replaced wake never gets its own liveness guard, so its transition could
# sit unreconciled indefinitely unless a later OWNER run notices it.
#
# OWNER.md's "Coalesced-wake recovery check" (added by this outcome) asks
# OWNER to scan open issues/PRs, during its existing fresh-GitHub read, for
# any whose latest OWNER-requiring terminal/ruling transition has no later
# `OWNER ATTEMPT START:` receipt of its own — i.e.
# terminal_owner_admission_status resolves "admit" for it. This proves that
# exact signal is discoverable: a target whose wake was coalesced away
# (a terminal marker landed, but the concurrency group evicted its fire
# before an "OWNER ATTEMPT START:" receipt was ever posted for it) still
# resolves "admit", the same signal OWNER already relies on for its own
# wake target — nothing new to compute, only a wider scan documented in the
# adapter.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADAPTER="${SCRIPT_DIR}/../ai-routines/OWNER.md"
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
  echo "owner-coalesced-wake.test.sh: 1 check(s) failed"
  exit 1
fi

# --- OWNER.md documents the recovery check as part of its existing read ---

assert_contains "OWNER.md documents the coalesced-wake recovery check" "Coalesced-wake recovery check"
assert_contains "the check is scoped to any OTHER open item, reconciled before the current wake target" \
  "target, reconcile that pending transition first"
assert_contains "the check does not relax the one-routing-mutation-per-run bound" \
  "not relax the one-routing-mutation-per-run bound"

# --- a coalesced middle wake is discoverable via the existing admission
# classifier: a target with a terminal marker and no later admission
# receipt resolves "admit", exactly like an item awaiting its first OWNER
# fire -----------------------------------------------------------------

coalesced_item=$(jq -n '
  [
    {body: "BUILD FIRED: HTTP 200 · session x [BUILD_ATTEMPT_ID: BUILD-1-1]", created_at: "2026-09-26T09:00:00Z"},
    {body: "STOP: MISSING DEPENDENCY — upstream schema not yet migrated", created_at: "2026-09-26T09:10:00Z"}
  ]
')
assert_eq "a coalesced item's own terminal marker with no later OWNER ATTEMPT START resolves admit (discoverable)" \
  "admit" "$(terminal_owner_admission_status "$coalesced_item")"

# Once a later OWNER run reconciles it (posts its own start receipt), the
# same target no longer reads as pending — proving the check is bounded and
# self-clearing, not a persistent duplicate-fire risk.
coalesced_item_reconciled=$(jq -c '. + [{body: "OWNER ATTEMPT START: TERMINAL-5-1\nwake_class: TERMINAL", created_at: "2026-09-26T09:20:00Z"}]' <<<"$coalesced_item")
assert_eq "once reconciled, the same item no longer resolves admit" \
  "skip" "$(terminal_owner_admission_status "$coalesced_item_reconciled")"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "owner-coalesced-wake.test.sh: all checks passed"
  exit 0
else
  echo "owner-coalesced-wake.test.sh: $FAILURES check(s) failed"
  exit 1
fi
