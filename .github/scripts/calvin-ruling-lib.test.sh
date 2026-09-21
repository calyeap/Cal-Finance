#!/usr/bin/env bash
# CF-OWNER-SINGLE-WRITER-01 addendum (issue #197 ADDENDUM, 11:09:44Z)
#
# Deterministic, network-free regression tests modeling the addendum's
# required proof: `CALVIN REQUIRED` -> human ruling -> exactly one OWNER
# reconciliation, with no manual label/courier action, plus the guardrails
# the addendum explicitly requires: do not trigger OWNER for arbitrary
# comments, and duplicate/overlapping admission must still be suppressed.
#
# calvin_ruling_should_wake is the single decision cc-auto-fire.yml's
# fire-owner-on-terminal job consults (in its `Resolve target` step) before
# admitting a qualifying issue_comment ruling straight into the same fire,
# single-writer serialization, and duplicate suppression every other
# terminal wake already gets via the cf-owner-single-writer concurrency
# group CF-OWNER-SINGLE-WRITER-01 built (see owner-single-writer-lib.test.sh
# / owner-single-writer-config.test.sh). This file covers the pure
# classification only; calvin-ruling-reachability.test.sh separately
# guards that the classification is actually wired to something that fires
# OWNER, rather than to a workflow-authored label write depended on as a
# trigger (the defect this edge originally shipped with).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=calvin-ruling-lib.sh
source "${SCRIPT_DIR}/calvin-ruling-lib.sh"

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

# --- a live open gate: OWNER's own restated CALVIN REQUIRED: is the most
# recent state-changing terminal marker, nothing has been admitted since --

open_gate=$(jq -n '
  [
    {body: "REVIEW FIRED: HTTP 200 · session x", created_at: "2026-09-21T10:58:00Z"},
    {body: "CALVIN REQUIRED: approve option A or option B [OWNER_ATTEMPT_ID: TERMINAL-50-1]", created_at: "2026-09-21T11:00:30Z"}
  ]
')

status=$(calvin_ruling_gate_status "$open_gate")
assert_eq "OWNER's restated CALVIN REQUIRED with nothing after it reads open" "open" "$status"

decision=$(calvin_ruling_should_wake "$open_gate" "CALVIN RULING — APPROVE OPTION B" "false")
assert_eq "a genuine ruling on a live open gate wakes" "wake" "$decision"

decision=$(calvin_ruling_should_wake "$open_gate" "CALVIN RULING: approve option B" "false")
assert_eq "the colon-separated ruling form also wakes" "wake" "$decision"

# --- bot comment: never wakes, even with the exact ruling text -----------

decision=$(calvin_ruling_should_wake "$open_gate" "CALVIN RULING — APPROVE OPTION B" "true")
assert_eq "a bot-authored comment never wakes" "skip" "$decision"

# --- arbitrary comment: ordinary chatter never wakes ----------------------

decision=$(calvin_ruling_should_wake "$open_gate" "Sounds good, thanks for the writeup." "false")
assert_eq "an arbitrary non-ruling comment never wakes" "skip" "$decision"

decision=$(calvin_ruling_should_wake "$open_gate" "quoting: CALVIN RULING — APPROVE OPTION B was mentioned earlier" "false")
assert_eq "a ruling marker that is not the comment's own first line never wakes" "skip" "$decision"

# --- item with no open gate: never wakes, whatever the comment says ------

no_gate=$(jq -n '
  [{body: "DONE: https://github.com/x/y/pull/9", created_at: "2026-09-21T09:00:00Z"}]
')
status=$(calvin_ruling_gate_status "$no_gate")
assert_eq "a DONE: terminal with no CALVIN REQUIRED reads closed" "closed" "$status"
decision=$(calvin_ruling_should_wake "$no_gate" "CALVIN RULING — APPROVE OPTION B" "false")
assert_eq "a ruling on an item with no open gate never wakes" "skip" "$decision"

empty_gate=$(jq -n '[]')
status=$(calvin_ruling_gate_status "$empty_gate")
assert_eq "no terminal markers at all reads closed" "closed" "$status"

# --- gate already resolved by a later terminal marker (e.g. a fresh BUILD
# cycle landed a DONE: after the old CALVIN REQUIRED): closed -------------

superseded=$(jq -n '
  [
    {body: "CALVIN REQUIRED: approve option A or option B [OWNER_ATTEMPT_ID: TERMINAL-50-1]", created_at: "2026-09-21T11:00:30Z"},
    {body: "DONE: https://github.com/x/y/pull/12", created_at: "2026-09-21T11:30:00Z"}
  ]
')
status=$(calvin_ruling_gate_status "$superseded")
assert_eq "a later DONE: superseding the old CALVIN REQUIRED reads closed" "closed" "$status"

# --- second ruling while an OWNER attempt already admitted the first one:
# still exactly one admission — the gate closes once OWNER ATTEMPT START
# lands after the CALVIN REQUIRED, even before that attempt resolves -----

already_admitted=$(jq -c '. + [{body: "OWNER ATTEMPT START: TERMINAL-51-1\nwake_class: TERMINAL", created_at: "2026-09-21T11:05:00Z"}]' <<<"$open_gate")
status=$(calvin_ruling_gate_status "$already_admitted")
assert_eq "an OWNER ATTEMPT START after the CALVIN REQUIRED reads closed" "closed" "$status"
decision=$(calvin_ruling_should_wake "$already_admitted" "CALVIN RULING — APPROVE OPTION B" "false")
assert_eq "a second ruling once an OWNER attempt is already admitted does not wake again" "skip" "$decision"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "calvin-ruling-lib.test.sh: all checks passed"
  exit 0
else
  echo "calvin-ruling-lib.test.sh: $FAILURES check(s) failed"
  exit 1
fi
