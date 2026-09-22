#!/usr/bin/env bash
# CF-OWNER-FASTPATH-SHADOW-01
#
# Pure, network-free classification for the deterministic stall sweep
# (issue #212, scope item 5): a cheap, read-mostly safety net that wakes
# OWNER — never BUILD/REVIEW directly, and never a second orchestrator —
# when Cal Finance looks genuinely stalled rather than merely between
# events. stall-sweep-guard.sh is the thin gh/curl wrapper that gathers the
# booleans below from durable GitHub evidence (the execution ledger's
# state, an unresolved OWNER attempt per owner-single-writer-lib.sh, an
# open needs-owner-wake/needs-build-wake gate, a WAIT: PARKED marker, an
# in-flight BUILD FIRED/REVIEW FIRED receipt) and calls stall_sweep_status.

set -uo pipefail

# stall_sweep_latest_owner_terminal_is_parked <comments_json>
# comments_json is a JSON array of {"body":..,"created_at":..} comments,
# fetched repo-wide exactly like owner-single-writer-lib.sh consumes (no
# gh/curl calls here). True (exit 0) only when the most recent comment
# anywhere in that set whose first non-blank line is one of OWNER's five
# typed terminal forms (see OWNER.md's "Terminal rule") is exactly
# "WAIT: PARKED" — i.e. Calvin has explicitly parked the project and this
# sweep must not treat that as a stall.
stall_sweep_latest_owner_terminal_is_parked() {
  local comments_json="$1"
  jq -e '
    def first_nonblank_line:
      (. // "")
      | split("\n")
      | map(select(test("[^\\s]")))
      | (.[0] // "")
      | sub("^\\s+"; "");

    map(select(.body | first_nonblank_line | test("^(DISPATCHED:|WAIT: (AI|EXTERNAL|PARKED)|CALVIN REQUIRED:)")))
    | sort_by(.created_at)
    | ((.[-1].body // "") | first_nonblank_line) as $latest
    | $latest | startswith("WAIT: PARKED")
  ' <<<"$comments_json" >/dev/null
}

# stall_sweep_status <ledger_state> <has_active_attempt> <has_pending_gate>
#                     <has_wait_parked_reason> <has_inflight_dispatch>
#                     <continuation_expected>
# Every boolean argument is the literal string "true" or "false". Echoes
# "stall" only when every one of issue #212's listed conditions holds at
# once:
#   - the project is meant to be active (ledger_state == "active");
#   - no active attempt exists;
#   - no pending Calvin gate exists;
#   - no explicit WAIT/parked reason exists;
#   - no already-dispatched worker/PR is in flight;
#   - continuation should exist but does not.
# Echoes "ok" otherwise — this is a safety net for missed events, not a
# second orchestrator, so it must default to "ok" (never wake OWNER) on
# any ambiguous or only-partially-stalled input.
stall_sweep_status() {
  local ledger_state="$1" has_active_attempt="$2" has_pending_gate="$3" \
    has_wait_parked_reason="$4" has_inflight_dispatch="$5" continuation_expected="$6"

  if [ "$ledger_state" = "active" ] \
    && [ "$has_active_attempt" = "false" ] \
    && [ "$has_pending_gate" = "false" ] \
    && [ "$has_wait_parked_reason" = "false" ] \
    && [ "$has_inflight_dispatch" = "false" ] \
    && [ "$continuation_expected" = "true" ]; then
    echo "stall"
  else
    echo "ok"
  fi
}
