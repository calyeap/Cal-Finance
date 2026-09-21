#!/usr/bin/env bash
# CF-OWNER-SINGLE-WRITER-01
#
# Deterministic, network-free regression tests modeling the exact failure
# class from issue #197's live evidence (21 Sep 2026): overlapping
# CALBOARD-OWNER attempts fired from owner-on-merge.yml's merge wake and
# cc-auto-fire.yml's terminal wake — on DIFFERENT issues/PRs — raced the
# same Cal Finance Project Home write, and one run explicitly recorded
# three attempts overlapping on the same page.
#
# Per the issue's TEST/PROOF section: OWNER A starts for prior state: a
# new semantic event arrives and OWNER B is requested; A must not be able
# to commit stale Project Home state after B owns the newer reconciliation;
# B/current native truth must still be reconciled (the newer wake cannot
# disappear); exactly one authoritative current-state write wins.
#
# owner_single_writer_holder/status are the admission primitives both
# owner-on-merge.yml and cc-auto-fire.yml's fire-owner-on-terminal job
# consult before firing CALBOARD-OWNER (see owner-single-writer-guard.sh).
# The actual mutual exclusion is enforced by the shared
# `cf-owner-single-writer` concurrency group both jobs declare (see
# owner-single-writer-config.test.sh), which GitHub Actions serializes
# FIFO with automatic coalescing of superseded pending runs; these
# functions are what let that serialization reason correctly about which
# attempt currently holds the write, and are also usable as a live audit
# trail (see the guard script) independent of that platform behaviour.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=owner-single-writer-lib.sh
source "${SCRIPT_DIR}/owner-single-writer-lib.sh"

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

# --- no attempts anywhere: clear -------------------------------------------

status=$(owner_single_writer_status '[]' "2026-09-21T12:00:00Z")
assert_eq "no attempts anywhere classifies clear" "clear" "$status"

# --- OWNER A starts for prior state: still active a minute later, no
# terminal yet -------------------------------------------------------------

a_started=$(jq -n '
  [{body: "OWNER ATTEMPT START: MERGE-100-1\nwake_class: MERGE", created_at: "2026-09-21T12:00:00Z", issue_number: 195}]
')
status=$(owner_single_writer_status "$a_started" "2026-09-21T12:01:00Z")
assert_eq "OWNER A alone, checked before any terminal, classifies active" "active" "$status"
holder=$(owner_single_writer_holder "$a_started" "2026-09-21T12:01:00Z")
assert_eq "holder is A while A is the only attempt" "MERGE-100-1" "$(jq -r '.id' <<<"$holder")"

# --- new semantic event arrives, OWNER B is requested on a DIFFERENT
# issue while A is still active: admission must still read active (B's own
# guard must see contention before B ever posts its own START) -------------

status=$(owner_single_writer_status "$a_started" "2026-09-21T12:02:00Z")
assert_eq "checking admission for B's would-be fire while A is unresolved still classifies active" "active" "$status"

# --- A resolves with its typed terminal receipt: now clear -----------------

a_resolved=$(jq -n '
  [
    {body: "OWNER ATTEMPT START: MERGE-100-1\nwake_class: MERGE", created_at: "2026-09-21T12:00:00Z", issue_number: 195},
    {body: "DISPATCHED: https://github.com/x/y/issues/9 [OWNER_ATTEMPT_ID: MERGE-100-1]", created_at: "2026-09-21T12:03:00Z", issue_number: 195}
  ]
')
status=$(owner_single_writer_status "$a_resolved" "2026-09-21T12:04:00Z")
assert_eq "A's own terminal receipt clears A's hold" "clear" "$status"

# --- B now fires (posts its own START) after A cleared, on a different
# issue: B becomes the sole holder, and current native truth is still
# reconciled exactly once — the newer wake was not lost -------------------

b_started=$(jq -c '. + [{body: "OWNER ATTEMPT START: TERMINAL-101-1\nwake_class: TERMINAL", created_at: "2026-09-21T12:05:00Z", issue_number: 197}]' <<<"$a_resolved")
status=$(owner_single_writer_status "$b_started" "2026-09-21T12:06:00Z")
assert_eq "B alone active after A resolved classifies active" "active" "$status"
holder=$(owner_single_writer_holder "$b_started" "2026-09-21T12:06:00Z")
assert_eq "holder is B, not stale A, once B has started" "TERMINAL-101-1" "$(jq -r '.id' <<<"$holder")"

# --- exactly one authoritative write wins: a terminal receipt tagged for a
# DIFFERENT attempt id on the same issue must not resolve the real holder --

wrong_tag=$(jq -n '
  [
    {body: "OWNER ATTEMPT START: MERGE-100-1", created_at: "2026-09-21T12:00:00Z", issue_number: 195},
    {body: "DISPATCHED: https://x/y [OWNER_ATTEMPT_ID: some-other-attempt]", created_at: "2026-09-21T12:03:00Z", issue_number: 195}
  ]
')
status=$(owner_single_writer_status "$wrong_tag" "2026-09-21T12:05:00Z")
assert_eq "a terminal receipt tagged for a different attempt id leaves the real holder active" "active" "$status"

# --- the literal observed failure: three attempts overlapping (issue
# #197's evidence) — the mechanism must surface exactly one holder, never
# silently treat all three as fine simultaneously ---------------------------

three_overlapping=$(jq -n '
  [
    {body: "OWNER ATTEMPT START: MERGE-1-1", created_at: "2026-09-21T12:00:00Z", issue_number: 195},
    {body: "OWNER ATTEMPT START: TERMINAL-2-1", created_at: "2026-09-21T12:01:00Z", issue_number: 196},
    {body: "OWNER ATTEMPT START: MERGE-3-1", created_at: "2026-09-21T12:02:00Z", issue_number: 197}
  ]
')
status=$(owner_single_writer_status "$three_overlapping" "2026-09-21T12:03:00Z")
assert_eq "three overlapping starts classify active" "active" "$status"
holder=$(owner_single_writer_holder "$three_overlapping" "2026-09-21T12:03:00Z")
assert_eq "holder resolves to exactly the most recently started attempt" "MERGE-3-1" "$(jq -r '.id' <<<"$holder")"

# --- bounded liveness safety valve: an orphaned START far older than the
# max age auto-expires rather than deadlocking admission forever ----------

orphan=$(jq -n '
  [{body: "OWNER ATTEMPT START: MERGE-1-1", created_at: "2026-09-21T10:00:00Z", issue_number: 195}]
')
status=$(owner_single_writer_status "$orphan" "2026-09-21T12:00:00Z" 50)
assert_eq "an orphaned START older than max_age_minutes auto-clears (bounded, per OWNER liveness lease)" "clear" "$status"
status=$(owner_single_writer_status "$orphan" "2026-09-21T10:30:00Z" 50)
assert_eq "the same START is still active well within max_age_minutes" "active" "$status"

# --- OWNER LIVENESS EXHAUSTED also releases the holder, so a stalled
# attempt whose recovery also stalled does not block admission forever ----

exhausted=$(jq -n '
  [
    {body: "OWNER ATTEMPT START: MERGE-1-1", created_at: "2026-09-21T12:00:00Z", issue_number: 195},
    {body: "OWNER LIVENESS EXHAUSTED — RECONCILIATION REQUIRED\n\ndetails", created_at: "2026-09-21T12:45:00Z", issue_number: 195}
  ]
')
status=$(owner_single_writer_status "$exhausted" "2026-09-21T12:46:00Z")
assert_eq "an exhaustion receipt clears the holder without a normal terminal result" "clear" "$status"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "owner-single-writer-lib.test.sh: all checks passed"
  exit 0
else
  echo "owner-single-writer-lib.test.sh: $FAILURES check(s) failed"
  exit 1
fi
