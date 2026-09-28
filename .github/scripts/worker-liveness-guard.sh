#!/usr/bin/env bash
# CF-HANDOFF-FAIL-CLOSED-01 — simplified 28 Sep 2026
#
# Detection-only liveness guard for BUILD and REVIEW.
#
# Reliability invariant:
#   one wake -> one worker attempt -> one correlated terminal receipt.
#
# This guard NEVER fires a replacement worker. The previous recovery fire
# could overlap a slow-but-live original attempt and create two executions for
# one OUTCOME-ID (the failure observed around #352/#353/#354). A missing
# terminal is now converted into one typed terminal receipt on the same target
# so the existing parent/OWNER path can reconcile current GitHub truth without
# spawning a second BUILD/REVIEW session.
#
# Required env: GH_TOKEN, TARGET_REPO, TARGET_NUMBER, ATTEMPT_ID, ACTOR
# (BUILD|REVIEW).
# Optional env: WORKER_LIVENESS_LEASE_MINUTES (default 20),
# WORKER_LIVENESS_POLL_SECONDS (default 60).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=build-liveness-lib.sh
source "${SCRIPT_DIR}/build-liveness-lib.sh"
# shellcheck source=review-liveness-lib.sh
source "${SCRIPT_DIR}/review-liveness-lib.sh"

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${TARGET_REPO:?TARGET_REPO is required}"
: "${TARGET_NUMBER:?TARGET_NUMBER is required}"
: "${ATTEMPT_ID:?ATTEMPT_ID is required}"
: "${ACTOR:?ACTOR is required (BUILD|REVIEW)}"

LEASE_MINUTES="${WORKER_LIVENESS_LEASE_MINUTES:-20}"
POLL_SECONDS="${WORKER_LIVENESS_POLL_SECONDS:-60}"

case "$ACTOR" in
  BUILD) TAG_NAME="BUILD_ATTEMPT_ID" ;;
  REVIEW) TAG_NAME="REVIEW_ATTEMPT_ID" ;;
  *)
    echo "::error::worker-liveness-guard: unknown ACTOR '${ACTOR}' (expected BUILD or REVIEW)" >&2
    exit 1
    ;;
esac

actor_find_start() {
  case "$ACTOR" in
    BUILD) build_liveness_find_start "$1" "$2" ;;
    REVIEW) review_liveness_find_start "$1" "$2" ;;
  esac
}

actor_status() {
  case "$ACTOR" in
    BUILD) build_liveness_status "$1" "$2" "$3" ;;
    REVIEW) review_liveness_status "$1" "$2" "$3" ;;
  esac
}

fetch_comments() {
  gh api --paginate \
    "repos/${TARGET_REPO}/issues/${TARGET_NUMBER}/comments" \
    --jq '[.[] | {body: .body, created_at: .created_at}]' \
    | jq -s 'add // []'
}

post_comment() {
  local body="$1"
  gh api --method POST \
    "repos/${TARGET_REPO}/issues/${TARGET_NUMBER}/comments" \
    -f body="$body" >/dev/null
}

wait_and_check() {
  local attempt_id="$1" started_at="$2"
  echo "worker-liveness(${ACTOR}): watching attempt ${attempt_id} for up to ${LEASE_MINUTES}m (started ${started_at}), polling every ${POLL_SECONDS}s" >&2
  local deadline
  deadline=$(( $(date +%s) + LEASE_MINUTES * 60 ))
  local comments status
  while :; do
    comments="$(fetch_comments)"
    status="$(actor_status "$comments" "$attempt_id" "$started_at")"
    if [ "$status" = "complete" ]; then
      echo "complete"
      return
    fi
    if [ "$(date +%s)" -ge "$deadline" ]; then
      echo "missing"
      return
    fi
    sleep "$POLL_SECONDS"
  done
}

post_missing_terminal() {
  case "$ACTOR" in
    BUILD)
      post_comment "BLOCKED: LIVENESS — no correlated BUILD terminal receipt inside ${LEASE_MINUTES}m [${TAG_NAME}: ${ATTEMPT_ID}]

The original BUILD attempt may still have produced partial work, so no replacement BUILD was fired. OWNER must reread current GitHub truth and resume only if the same outcome still lacks an active execution/PR."
      ;;
    REVIEW)
      post_comment "STOP: LIVENESS — no correlated REVIEW terminal receipt inside ${LEASE_MINUTES}m [${TAG_NAME}: ${ATTEMPT_ID}]

The original REVIEW attempt may still have produced partial evidence, so no replacement REVIEW was fired. OWNER must reread current GitHub truth before any further routing."
      ;;
  esac
}

main() {
  local own_start started_at status
  own_start="$(actor_find_start "$(fetch_comments)" "$ATTEMPT_ID")"
  if [ -z "$own_start" ]; then
    echo "::error::worker-liveness-guard(${ACTOR}): no start receipt found for ${ATTEMPT_ID}; refusing to guess a start time." >&2
    exit 1
  fi
  started_at="$(jq -r '.created_at' <<<"$own_start")"

  status="$(wait_and_check "$ATTEMPT_ID" "$started_at")"
  if [ "$status" = "complete" ]; then
    echo "worker-liveness(${ACTOR}): attempt ${ATTEMPT_ID} completed."
    exit 0
  fi

  echo "::error::worker-liveness-guard(${ACTOR}): attempt ${ATTEMPT_ID} produced no correlated terminal receipt; posting one typed parent-routing terminal and refusing automatic recovery." >&2
  post_missing_terminal
  exit 1
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main
fi
