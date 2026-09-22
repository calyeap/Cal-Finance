#!/usr/bin/env bash
# CF-OWNER-FASTPATH-SHADOW-01
#
# Pure, network-free latency measurement for issue #212's scope item 8.
# No new storage: every timestamp this needs already exists as durable
# workflow evidence — OWNER's own "OWNER ATTEMPT START:"/typed-terminal
# comments (the same contract owner-liveness-lib.sh already parses) and
# this outcome's own ledger/shadow-decision timestamps. This file only
# computes durations from timestamps the caller already fetched; it makes
# no gh/curl calls itself.

set -uo pipefail

# latency_duration_seconds <iso_a> <iso_b>
# Prints b - a in whole seconds (may be negative if misordered — the
# caller decides whether that's meaningful).
latency_duration_seconds() {
  local iso_a="$1" iso_b="$2"
  jq -n \
    --arg a "$iso_a" --arg b "$iso_b" \
    '(($b | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime)
      - ($a | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime))'
}

# latency_owner_span <comments_json> <attempt_id>
# comments_json: a JSON array of {"body":..,"created_at":..} comments
# already fetched from the OWNER wake target (same shape
# owner-liveness-lib.sh consumes). Prints
# {"attempt_id":..,"start":ISO_or_null,"terminal":ISO_or_null,
#  "duration_seconds":N_or_null} covering "OWNER start -> OWNER
# terminal/reconciled" from issue #212's section 8.
latency_owner_span() {
  local comments_json="$1" attempt_id="$2"
  jq -c \
    --arg attempt_id "$attempt_id" \
    '
    def first_nonblank_line:
      (. // "")
      | split("\n")
      | map(select(test("[^\\s]")))
      | (.[0] // "")
      | sub("^\\s+"; "");

    def is_terminal_for($id):
      (. | contains("[OWNER_ATTEMPT_ID: " + $id + "]"))
      and (first_nonblank_line | test("^(DISPATCHED:|WAIT: (AI|EXTERNAL|PARKED)\\s*[—-]|CALVIN REQUIRED:)"));

    ( map(select(.body | first_nonblank_line | startswith("OWNER ATTEMPT START: " + $attempt_id)))
      | sort_by(.created_at) | (.[0].created_at // null)
    ) as $start
    | ( map(select(.body | is_terminal_for($attempt_id)))
        | sort_by(.created_at) | (.[0].created_at // null)
      ) as $terminal
    | {
        attempt_id: $attempt_id,
        start: $start,
        terminal: $terminal,
        duration_seconds: (
          if ($start != null and $terminal != null) then
            (($terminal | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime)
             - ($start | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime))
          else null end
        )
      }
    ' <<<"$comments_json"
}

# latency_shadow_span <event_created_at> <decision_created_at>
# Prints {"event":..,"decision":..,"duration_seconds":N} covering "event
# -> shadow decision" from issue #212's section 8.
latency_shadow_span() {
  local event_created_at="$1" decision_created_at="$2"
  jq -nc \
    --arg event "$event_created_at" \
    --arg decision "$decision_created_at" \
    --argjson duration "$(latency_duration_seconds "$event_created_at" "$decision_created_at")" \
    '{event:$event, decision:$decision, duration_seconds:$duration}'
}
