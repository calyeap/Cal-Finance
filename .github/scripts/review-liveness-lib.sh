#!/usr/bin/env bash
# CF-HANDOFF-FAIL-CLOSED-01
#
# REVIEW's own thin configuration over worker-liveness-lib.sh's generic
# engine — the REVIEW analogue of build-liveness-lib.sh /
# owner-liveness-lib.sh (CF-OWNER-LIVENESS-01).
#
# Mirrors build-liveness-lib.sh exactly, except the start receipt is
# fire-review's existing "REVIEW FIRED: HTTP <code> ..." comment (now also
# carrying the attempt tag) and the typed terminal forms are REVIEW's own
# (CC.md's terminal rule): ACCEPT:, CORRECT:, STOP:, CALVIN REQUIRED:.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=worker-liveness-lib.sh
source "${SCRIPT_DIR}/worker-liveness-lib.sh"

REVIEW_LIVENESS_START_PREFIX="REVIEW FIRED:"
REVIEW_LIVENESS_TERMINAL_REGEX='^(ACCEPT:|CORRECT:|STOP:|CALVIN REQUIRED:)'

# review_liveness_find_start <comments_json> <attempt_id>
review_liveness_find_start() {
  local comments_json="$1" attempt_id="$2"
  local tag="[REVIEW_ATTEMPT_ID: ${attempt_id}]"
  worker_liveness_find_start_by_tag "$comments_json" "$REVIEW_LIVENESS_START_PREFIX" "$tag"
}

# review_liveness_find_terminal <comments_json> <attempt_id> <after_iso>
review_liveness_find_terminal() {
  local comments_json="$1" attempt_id="$2" after_iso="$3"
  local tag="[REVIEW_ATTEMPT_ID: ${attempt_id}]"
  worker_liveness_find_terminal_by_tag "$comments_json" "$tag" "$REVIEW_LIVENESS_TERMINAL_REGEX" "$after_iso"
}

# review_liveness_status <comments_json> <attempt_id> <after_iso>
review_liveness_status() {
  local comments_json="$1" attempt_id="$2" after_iso="$3"
  local tag="[REVIEW_ATTEMPT_ID: ${attempt_id}]"
  worker_liveness_status_by_tag "$comments_json" "$tag" "$REVIEW_LIVENESS_TERMINAL_REGEX" "$after_iso"
}
