#!/usr/bin/env bash
# CF-GATE-PUSH-01 (issue #221)
#
# Pure, network-free helpers for calvin-gate-push.sh: the per-gate dedupe
# key/marker and the outbound push payload. No gh/curl calls happen in
# this file, so the dedupe and payload contract can be exercised
# deterministically in CI (calvin-gate-push-lib.test.sh).
#
# Dedupe model: keyed on (Gate ID, Ask) rather than Gate ID alone, so a
# genuinely new Ask on the same Gate ID still gets its own push while a
# retry/redelivery of the same unchanged gate never duplicates. The key is
# recorded as a marker comment's own first line on the wake target itself
# — the same "a fresh comment's first line is durable state" convention
# owner-liveness-guard.sh (OWNER ATTEMPT START) and calvin-ruling-lib.sh
# already use — rather than a new status store, per this outcome's HARD
# BOUNDS: no new status database.

set -uo pipefail

# calvin_gate_push_dedupe_key <gate_id> <ask>
# sha256 keeps this stable and collision-safe without needing to store the
# full Ask text in the marker comment.
calvin_gate_push_dedupe_key() {
  local gate_id="$1" ask="$2"
  local ask_hash
  ask_hash="$(printf '%s' "$ask" | sha256sum | cut -c1-16)"
  printf '%s:%s' "$gate_id" "$ask_hash"
}

# calvin_gate_push_marker <dedupe_key>
calvin_gate_push_marker() {
  local dedupe_key="$1"
  printf 'CALVIN GATE PUSH SENT: %s' "$dedupe_key"
}

# calvin_gate_push_first_line <text>
# Drops leading blank/all-whitespace lines, then prints the first
# remaining line with its own leading/trailing whitespace trimmed. Mirrors
# calvin_ruling_first_line's convention in calvin-ruling-lib.sh.
calvin_gate_push_first_line() {
  local body="$1"
  printf '%s' "$body" \
    | sed -e '/[^[:space:]]/,$!d' -e 's/^[[:space:]]*//' \
    | head -n1 \
    | sed -e 's/[[:space:]]*$//'
}

# calvin_gate_push_already_sent <comments_json> <dedupe_key>
# comments_json: a JSON array of {"body":...} comment objects for the wake
# target, already fetched by the caller, any order. Echoes "true" when any
# comment's own first line is exactly the marker for this dedupe_key,
# "false" otherwise (including an empty comments_json).
calvin_gate_push_already_sent() {
  local comments_json="$1" dedupe_key="$2"
  local marker
  marker="$(calvin_gate_push_marker "$dedupe_key")"
  jq -r --arg marker "$marker" '
    def first_nonblank_line:
      (. // "")
      | split("\n")
      | map(select(test("[^\\s]")))
      | (.[0] // "")
      | sub("^\\s+"; "")
      | sub("\\s+$"; "");
    any(.[]; (.body | first_nonblank_line) == $marker)
  ' <<<"$comments_json"
}

# calvin_gate_push_payload <project> <gate_id> <ask>
# Exactly the three fields this outcome's SCOPE requires the push message
# to carry: Project, Gate ID, exact Ask. No other field is added here.
calvin_gate_push_payload() {
  local project="$1" gate_id="$2" ask="$3"
  jq -n --arg project "$project" --arg gate_id "$gate_id" --arg ask "$ask" \
    '{project: $project, gate_id: $gate_id, ask: $ask}'
}

# calvin_gate_push_config_ready <webhook_url>
# True (exit 0) only when a push webhook URL is configured. Missing config
# is a safe no-send state, not a caller error — see calvin-gate-push.sh.
calvin_gate_push_config_ready() {
  local webhook_url="$1"
  [ -n "$webhook_url" ]
}

# calvin_gate_push_latest_terminal <comments_json>
# comments_json: a JSON array of {"body":..,"created_at":..} comment
# objects for one target, any order. Echoes the first line of the most
# recent state-changing terminal marker comment (DONE:/BLOCKED:/STOP:/
# CALVIN REQUIRED: — the same set BUILD.md's terminal rule defines, which
# REVIEW/OWNER also emit verbatim), or "" if none exists. This is how
# cc-auto-fire.yml's fire-owner-on-terminal job tells a genuine CALVIN
# REQUIRED gate apart from a STOP once it's already inside the job that
# both outcomes' needs-owner-wake label admits.
calvin_gate_push_latest_terminal() {
  local comments_json="$1"
  jq -r '
    def first_nonblank_line:
      (. // "")
      | split("\n")
      | map(select(test("[^\\s]")))
      | (.[0] // "")
      | sub("^\\s+"; "")
      | sub("\\s+$"; "");
    (map(. + {first_line: (.body | first_nonblank_line)}))
    | map(select(.first_line | test("^(DONE:|BLOCKED:|STOP:|CALVIN REQUIRED:)")))
    | sort_by(.created_at)
    | (.[-1].first_line // "")
  ' <<<"$comments_json"
}

# calvin_gate_push_ask_from_first_line <first_line>
# Extracts the exact Ask from a "CALVIN REQUIRED: ..." first line, with
# any trailing OWNER liveness-correlation tag ("[OWNER_ATTEMPT_ID: ...]",
# see OWNER.md's Liveness correlation rule) stripped — that tag is
# bookkeeping, never part of the Ask itself. Echoes "" when first_line is
# not a CALVIN REQUIRED marker.
calvin_gate_push_ask_from_first_line() {
  local first_line="$1"
  case "$first_line" in
    'CALVIN REQUIRED:'*)
      printf '%s' "$first_line" \
        | sed -e 's/^CALVIN REQUIRED:[[:space:]]*//' \
              -e 's/[[:space:]]*\[OWNER_ATTEMPT_ID:[^]]*\][[:space:]]*$//'
      ;;
    *)
      printf ''
      ;;
  esac
}
