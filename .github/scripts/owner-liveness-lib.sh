#!/usr/bin/env bash
# CF-OWNER-LIVENESS-01
#
# Pure, network-free classification helpers shared by
# owner-liveness-guard.sh and its unit tests (owner-liveness-lib.test.sh).
# Every function here takes a JSON array of {"body":..,"created_at":..}
# comment objects (already fetched by the caller) and returns a decision —
# no gh/curl calls happen in this file, so the classification logic can be
# exercised deterministically in CI without hitting GitHub or the OWNER
# fire endpoint.
#
# The terminal contract these functions enforce (see OWNER.md's "Terminal
# rule" and "Liveness correlation" sections): an OWNER attempt is complete
# only once the wake target carries a comment, created after that attempt's
# own "OWNER ATTEMPT START: <id>" receipt, whose first non-empty line is one
# of the five typed terminal forms AND also carries the exact tag
# "[OWNER_ATTEMPT_ID: <id>]" on that same line. `OWNER RECONCILED:` is a
# separate reconciliation receipt and never satisfies this on its own.

set -uo pipefail

# owner_liveness_find_start <comments_json> <attempt_id>
# comments_json is a JSON array of {"body":..,"created_at":..} as a string.
# Prints the earliest comment whose body starts with
# "OWNER ATTEMPT START: <attempt_id>", or nothing if none exists.
owner_liveness_find_start() {
  local comments_json="$1" attempt_id="$2"
  local marker="OWNER ATTEMPT START: ${attempt_id}"
  jq -c --arg marker "$marker" '
    map(select(.body | startswith($marker)))
    | sort_by(.created_at)
    | (.[0] // empty)
  ' <<<"$comments_json"
}

# owner_liveness_find_terminal <comments_json> <attempt_id> <after_iso>
# Prints the earliest comment created strictly after after_iso, tagged with
# "[OWNER_ATTEMPT_ID: <attempt_id>]", whose first non-blank line matches one
# of the five typed terminal forms. Prints nothing if none qualifies.
owner_liveness_find_terminal() {
  local comments_json="$1" attempt_id="$2" after_iso="$3"
  local tag="[OWNER_ATTEMPT_ID: ${attempt_id}]"
  jq -c --arg after "$after_iso" --arg tag "$tag" '
    def first_nonblank_line:
      (. // "")
      | split("\n")
      | map(select(test("[^\\s]")))
      | (.[0] // "")
      | sub("^\\s+"; "");
    map(select(.created_at > $after))
    | map(select(.body | contains($tag)))
    | map(select(.body | first_nonblank_line | test("^(DISPATCHED:|WAIT: (AI|EXTERNAL|PARKED)\\s*[—-]|CALVIN REQUIRED:)")))
    | sort_by(.created_at)
    | (.[0] // empty)
  ' <<<"$comments_json"
}

# owner_liveness_status <comments_json> <attempt_id> <after_iso>
# Echoes "complete" or "missing".
owner_liveness_status() {
  local comments_json="$1" attempt_id="$2" after_iso="$3"
  local match
  match="$(owner_liveness_find_terminal "$comments_json" "$attempt_id" "$after_iso")"
  if [ -n "$match" ]; then
    echo "complete"
  else
    echo "missing"
  fi
}
