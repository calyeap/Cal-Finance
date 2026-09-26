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
# only once the wake target carries a comment, created after that
# attempt's own "OWNER ATTEMPT START: <id>" receipt, whose first non-empty
# line is one of the five typed terminal forms AND also carries the exact
# tag "[OWNER_ATTEMPT_ID: <id>]" on that same line. `OWNER RECONCILED:` is a
# separate reconciliation receipt and never satisfies this on its own.
#
# CF-HANDOFF-FAIL-CLOSED-01: the terminal-correlation half of this
# (find_terminal / status) is now a thin wrapper over
# worker-liveness-lib.sh's generic, tag/regex-driven engine — the same
# engine build-liveness-lib.sh and review-liveness-lib.sh use for their own
# BUILD/REVIEW liveness contracts. This file's own function names, argument
# order, and behaviour are unchanged, so owner-liveness-lib.test.sh and
# owner-liveness-guard.test.sh keep passing without modification. Only
# find_start keeps its own OWNER-specific implementation (a dedicated
# "OWNER ATTEMPT START: <id>" comment, rather than a tag embedded in an
# existing fire receipt), since that shape predates and differs from
# BUILD/REVIEW's.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=worker-liveness-lib.sh
source "${SCRIPT_DIR}/worker-liveness-lib.sh"

# OWNER's own typed terminal forms (OWNER.md's "Terminal rule").
OWNER_LIVENESS_TERMINAL_REGEX='^(DISPATCHED:|WAIT: (AI|EXTERNAL|PARKED)\s*[—-]|CALVIN REQUIRED:)'

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
  worker_liveness_find_terminal_by_tag "$comments_json" "$tag" "$OWNER_LIVENESS_TERMINAL_REGEX" "$after_iso"
}

# owner_liveness_status <comments_json> <attempt_id> <after_iso>
# Echoes "complete" or "missing".
owner_liveness_status() {
  local comments_json="$1" attempt_id="$2" after_iso="$3"
  local tag="[OWNER_ATTEMPT_ID: ${attempt_id}]"
  worker_liveness_status_by_tag "$comments_json" "$tag" "$OWNER_LIVENESS_TERMINAL_REGEX" "$after_iso"
}
