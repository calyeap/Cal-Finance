#!/usr/bin/env bash
# CF-HANDOFF-FAIL-CLOSED-01
#
# BUILD's own thin configuration over worker-liveness-lib.sh's generic
# engine — the BUILD analogue of owner-liveness-lib.sh (CF-OWNER-LIVENESS-01).
#
# BUILD has no dedicated "BUILD ATTEMPT START:" comment of its own: the
# fire-build job's existing "BUILD FIRED: HTTP <code> ..." receipt (see
# build-duplicate-lib.sh, which keys duplicate suppression off that exact
# prefix and is unaffected by anything here) now also carries the attempt
# tag, so the start receipt is that same comment, not a second one. The
# terminal contract mirrors OWNER's: an attempt is complete only once the
# wake target carries a comment, created after that "BUILD FIRED:" receipt,
# whose first non-blank line is one of BUILD.md's typed terminal forms
# (DONE:, BLOCKED:, STOP:, CALVIN REQUIRED:) AND also carries the exact tag
# "[BUILD_ATTEMPT_ID: <id>]" on that same line.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=worker-liveness-lib.sh
source "${SCRIPT_DIR}/worker-liveness-lib.sh"

BUILD_LIVENESS_START_PREFIX="BUILD FIRED:"
BUILD_LIVENESS_TERMINAL_REGEX='^(DONE:|BLOCKED:|STOP:|CALVIN REQUIRED:)'

# build_liveness_find_start <comments_json> <attempt_id>
build_liveness_find_start() {
  local comments_json="$1" attempt_id="$2"
  local tag="[BUILD_ATTEMPT_ID: ${attempt_id}]"
  worker_liveness_find_start_by_tag "$comments_json" "$BUILD_LIVENESS_START_PREFIX" "$tag"
}

# build_liveness_find_terminal <comments_json> <attempt_id> <after_iso>
build_liveness_find_terminal() {
  local comments_json="$1" attempt_id="$2" after_iso="$3"
  local tag="[BUILD_ATTEMPT_ID: ${attempt_id}]"
  worker_liveness_find_terminal_by_tag "$comments_json" "$tag" "$BUILD_LIVENESS_TERMINAL_REGEX" "$after_iso"
}

# build_liveness_status <comments_json> <attempt_id> <after_iso>
build_liveness_status() {
  local comments_json="$1" attempt_id="$2" after_iso="$3"
  local tag="[BUILD_ATTEMPT_ID: ${attempt_id}]"
  worker_liveness_status_by_tag "$comments_json" "$tag" "$BUILD_LIVENESS_TERMINAL_REGEX" "$after_iso"
}
