#!/usr/bin/env bash
# CF-OWNER-LIVENESS-01 — simplified 28 Sep 2026
#
# Detection-only liveness guard for the parent OWNER.
#
# One OWNER wake gets one OWNER attempt. If the parent does not produce a
# correlated terminal receipt inside the bounded lease, this guard reports one
# durable actionable workflow block and stops. It never fires a replacement
# OWNER. That keeps parent state observable without creating a second control
# execution that may race the first.
#
# Required env: GH_TOKEN, TARGET_REPO, TARGET_NUMBER, ATTEMPT_ID, WAKE_CLASS.
# Optional env: OWNER_LIVENESS_LEASE_MINUTES (default 20),
# OWNER_LIVENESS_POLL_SECONDS (default 60).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=owner-liveness-lib.sh
source "${SCRIPT_DIR}/owner-liveness-lib.sh"

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${TARGET_REPO:?TARGET_REPO is required}"
: "${TARGET_NUMBER:?TARGET_NUMBER is required}"
: "${ATTEMPT_ID:?ATTEMPT_ID is required}"
: "${WAKE_CLASS:?WAKE_CLASS is required}"

LEASE_MINUTES="${OWNER_LIVENESS_LEASE_MINUTES:-20}"
POLL_SECONDS="${OWNER_LIVENESS_POLL_SECONDS:-60}"

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
  echo "owner-liveness: watching attempt ${attempt_id} for up to ${LEASE_MINUTES}m (started ${started_at}), polling every ${POLL_SECONDS}s" >&2
  local deadline
  deadline=$(( $(date +%s) + LEASE_MINUTES * 60 ))
  local comments status
  while :; do
    comments="$(fetch_comments)"
    status="$(owner_liveness_status "$comments" "$attempt_id" "$started_at")"
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

post_blocked() {
  post_comment "WORKFLOW BLOCKED — LIVENESS

actor: OWNER
attempt: ${ATTEMPT_ID}
wake_class: ${WAKE_CLASS}
first_broken_transition: OWNER fire -> correlated parent terminal

No correlated OWNER terminal receipt arrived inside ${LEASE_MINUTES}m. No automatic OWNER recovery was fired. Reconcile the current GitHub target before any explicit re-drive."
}

main() {
  local own_start started_at status
  own_start="$(owner_liveness_find_start "$(fetch_comments)" "$ATTEMPT_ID")"
  if [ -z "$own_start" ]; then
    echo "::error::owner-liveness: no OWNER ATTEMPT START receipt found for ${ATTEMPT_ID}; refusing to guess a start time." >&2
    exit 1
  fi
  started_at="$(jq -r '.created_at' <<<"$own_start")"

  status="$(wait_and_check "$ATTEMPT_ID" "$started_at")"
  if [ "$status" = "complete" ]; then
    echo "owner-liveness: attempt ${ATTEMPT_ID} completed."
    exit 0
  fi

  echo "::error::owner-liveness: attempt ${ATTEMPT_ID} produced no correlated terminal receipt; reporting one actionable block with no recovery fire." >&2
  post_blocked
  exit 1
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main
fi
