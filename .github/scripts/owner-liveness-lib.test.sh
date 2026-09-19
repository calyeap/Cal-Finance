#!/usr/bin/env bash
# CF-OWNER-LIVENESS-01
#
# Deterministic, network-free unit tests for owner-liveness-lib.sh's
# classification functions. Run directly with
# `bash .github/scripts/owner-liveness-lib.test.sh`; wired into CI
# (.github/workflows/ci.yml) so a change to the liveness contract that
# breaks classification fails the required check immediately, rather than
# only showing up as a live OWNER run stalling 20+ minutes later.
#
# Covers the cases DONE WHEN in issue CF-OWNER-LIVENESS-01 requires: normal
# completion, late-but-healthy evidence, one recovery / duplicate
# suppression, and exhaustion — plus a few adjacent correctness cases for
# the exact terminal contract (wrong attempt id, stale/predating evidence,
# tag and typed line on different comments).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=owner-liveness-lib.sh
source "${SCRIPT_DIR}/owner-liveness-lib.sh"

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

assert_empty() {
  local desc="$1" actual="$2"
  if [ -z "$actual" ]; then
    echo "ok - $desc"
  else
    echo "not ok - $desc (expected empty, got [$actual])"
    FAILURES=$((FAILURES + 1))
  fi
}

assert_nonempty() {
  local desc="$1" actual="$2"
  if [ -n "$actual" ]; then
    echo "ok - $desc"
  else
    echo "not ok - $desc (expected non-empty)"
    FAILURES=$((FAILURES + 1))
  fi
}

# --- fixtures -----------------------------------------------------------

ATTEMPT="MERGE-1000-1"
RECOVERY="MERGE-1000-1-recovery-1"
STARTED_AT="2026-09-19T12:00:00Z"

own_start_only=$(jq -n --arg attempt "$ATTEMPT" --arg at "$STARTED_AT" '
  [{body: ("OWNER ATTEMPT START: " + $attempt + "\nwake_class: MERGE\nsession: cse_x"), created_at: $at}]
')

# --- normal completion ---------------------------------------------------

normal_completion=$(jq -n --arg attempt "$ATTEMPT" --arg at "2026-09-19T12:05:00Z" '
  [{body: ("DISPATCHED: https://github.com/x/y/issues/9 [OWNER_ATTEMPT_ID: " + $attempt + "]"), created_at: $at}]
')
status=$(owner_liveness_status "$normal_completion" "$ATTEMPT" "$STARTED_AT")
assert_eq "normal completion classifies complete" "complete" "$status"

# --- late but healthy evidence: arrives near the end of the window,
# still after START --------------------------------------------------------

late_but_healthy=$(jq -n --arg attempt "$ATTEMPT" --arg at "2026-09-19T12:19:59Z" '
  [{body: ("WAIT: AI — recovering the next Stock Analyzer dispatch [OWNER_ATTEMPT_ID: " + $attempt + "]"), created_at: $at}]
')
status=$(owner_liveness_status "$late_but_healthy" "$ATTEMPT" "$STARTED_AT")
assert_eq "late but healthy evidence still classifies complete" "complete" "$status"

# --- OWNER RECONCILED is a reconciliation receipt, never a terminal
# substitute, even carrying the attempt tag --------------------------------

reconciled_only=$(jq -n --arg attempt "$ATTEMPT" --arg at "2026-09-19T12:05:00Z" '
  [{body: ("OWNER RECONCILED: Project Home refreshed [OWNER_ATTEMPT_ID: " + $attempt + "]"), created_at: $at}]
')
status=$(owner_liveness_status "$reconciled_only" "$ATTEMPT" "$STARTED_AT")
assert_eq "OWNER RECONCILED alone classifies missing" "missing" "$status"

# --- a terminal comment tagged for a different attempt must not satisfy
# this attempt --------------------------------------------------------------

wrong_attempt=$(jq -n --arg at "2026-09-19T12:05:00Z" '
  [{body: "DISPATCHED: https://github.com/x/y/issues/9 [OWNER_ATTEMPT_ID: some-other-attempt]", created_at: $at}]
')
status=$(owner_liveness_status "$wrong_attempt" "$ATTEMPT" "$STARTED_AT")
assert_eq "terminal receipt tagged for a different attempt classifies missing" "missing" "$status"

# --- a correlated comment predating START (e.g. a stale earlier attempt on
# the same issue) must not satisfy a fresh attempt ---------------------------

predating=$(jq -n --arg attempt "$ATTEMPT" --arg at "2026-09-19T11:00:00Z" '
  [{body: ("DISPATCHED: https://github.com/x/y/issues/9 [OWNER_ATTEMPT_ID: " + $attempt + "]"), created_at: $at}]
')
status=$(owner_liveness_status "$predating" "$ATTEMPT" "$STARTED_AT")
assert_eq "a correlated terminal comment predating START classifies missing" "missing" "$status"

# --- before any recovery is fired, find_start for the recovery attempt id
# must come back empty (the guard's signal to recover) -----------------------

recovery_start=$(owner_liveness_find_start "$own_start_only" "$RECOVERY")
assert_empty "no recovery start receipt yet before one is fired" "$recovery_start"

# --- one recovery / duplicate suppression: once a recovery START receipt
# exists, find_start must return it so the guard skips firing a second
# recovery --------------------------------------------------------------------

with_recovery_start=$(jq -n --arg attempt "$ATTEMPT" --arg recovery "$RECOVERY" --arg at "$STARTED_AT" --arg rat "2026-09-19T12:20:05Z" '
  [
    {body: ("OWNER ATTEMPT START: " + $attempt + "\nwake_class: MERGE"), created_at: $at},
    {body: ("OWNER ATTEMPT START: " + $recovery + "\nwake_class: MERGE\nRECOVERY_ATTEMPT: 1 OF 1 (original: " + $attempt + ")"), created_at: $rat}
  ]
')
recovery_start=$(owner_liveness_find_start "$with_recovery_start" "$RECOVERY")
assert_nonempty "an existing recovery start receipt is found (duplicate suppression)" "$recovery_start"

# --- recovery completes: terminal receipt tagged with the recovery attempt
# id after the recovery START time classifies complete -----------------------

recovery_completed=$(jq -n --arg recovery "$RECOVERY" --arg at "2026-09-19T12:25:00Z" '
  [{body: ("WAIT: EXTERNAL — awaiting Stock Analyzer SEC filing refresh [OWNER_ATTEMPT_ID: " + $recovery + "]"), created_at: $at}]
')
status=$(owner_liveness_status "$recovery_completed" "$RECOVERY" "2026-09-19T12:20:05Z")
assert_eq "recovery attempt with correlated terminal receipt classifies complete" "complete" "$status"

# --- exhaustion: recovery attempt with no correlated terminal receipt
# classifies missing, which is the guard's signal to post the exhaustion
# receipt -----------------------------------------------------------------

recovery_silent=$(jq -n --arg at "$STARTED_AT" '
  [{body: "OWNER RECONCILED: nothing else happened", created_at: $at}]
')
status=$(owner_liveness_status "$recovery_silent" "$RECOVERY" "2026-09-19T12:20:05Z")
assert_eq "silent recovery attempt classifies missing (exhaustion signal)" "missing" "$status"

# --- CALVIN REQUIRED and WAIT: PARKED are also valid typed terminal forms --

calvin_required=$(jq -n --arg attempt "$ATTEMPT" --arg at "2026-09-19T12:05:00Z" '
  [{body: ("CALVIN REQUIRED: authorise the next Stock Analyzer scope [OWNER_ATTEMPT_ID: " + $attempt + "]"), created_at: $at}]
')
status=$(owner_liveness_status "$calvin_required" "$ATTEMPT" "$STARTED_AT")
assert_eq "CALVIN REQUIRED classifies complete" "complete" "$status"

parked=$(jq -n --arg attempt "$ATTEMPT" --arg at "2026-09-19T12:05:00Z" '
  [{body: ("WAIT: PARKED — by Calvin until M9 sign-off [OWNER_ATTEMPT_ID: " + $attempt + "]"), created_at: $at}]
')
status=$(owner_liveness_status "$parked" "$ATTEMPT" "$STARTED_AT")
assert_eq "WAIT: PARKED classifies complete" "complete" "$status"

# --- the tag must be on the same comment as the typed first line, not
# merely present somewhere else in the thread --------------------------------

split_across_comments=$(jq -n --arg attempt "$ATTEMPT" --arg at1 "2026-09-19T12:05:00Z" --arg at2 "2026-09-19T12:06:00Z" '
  [
    {body: "DISPATCHED: https://github.com/x/y/issues/9", created_at: $at1},
    {body: ("unrelated aside mentioning [OWNER_ATTEMPT_ID: " + $attempt + "]"), created_at: $at2}
  ]
')
status=$(owner_liveness_status "$split_across_comments" "$ATTEMPT" "$STARTED_AT")
assert_eq "typed line and attempt tag must co-occur in one comment" "missing" "$status"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "owner-liveness-lib.test.sh: all checks passed"
  exit 0
else
  echo "owner-liveness-lib.test.sh: $FAILURES check(s) failed"
  exit 1
fi
