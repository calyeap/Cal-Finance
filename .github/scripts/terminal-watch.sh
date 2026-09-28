#!/usr/bin/env bash
# CF-WORKFLOW-RESET-RUNTIME-01
# Detect-only terminal watch. It never re-fires a worker. A missing terminal
# becomes a durable AI-owned BLOCKED receipt so the parent can reconcile
# without violating the one-active-execution invariant.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=runtime-lib.sh
source "${SCRIPT_DIR}/runtime-lib.sh"

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${TARGET_REPO:?TARGET_REPO is required}"
: "${TARGET_NUMBER:?TARGET_NUMBER is required}"
: "${ACTOR:?ACTOR is required}"
: "${ATTEMPT_ID:?ATTEMPT_ID is required}"

LEASE_MINUTES="${TERMINAL_LEASE_MINUTES:-20}"
POLL_SECONDS="${TERMINAL_POLL_SECONDS:-60}"
TAG_NAME="$(runtime_attempt_tag "$ACTOR")"
START_PREFIX="$(runtime_attempt_start_prefix "$ACTOR")"

fetch_comments() {
  gh api --paginate "repos/${TARGET_REPO}/issues/${TARGET_NUMBER}/comments" \
    --jq '[.[] | {body: .body, created_at: .created_at}]' | jq -s 'add // []'
}

post_comment() {
  gh api --method POST "repos/${TARGET_REPO}/issues/${TARGET_NUMBER}/comments" -f body="$1" >/dev/null
}

find_start() {
  local comments="$1"
  jq -c --arg prefix "$START_PREFIX" --arg tag "$TAG_NAME" --arg id "$ATTEMPT_ID" '
    def first_nonblank:
      (. // "") | split("\n") | map(select(test("[^\\s]"))) | (.[0] // "")
      | sub("^\\s+"; "") | sub("\\s+$"; "");
    [ .[] | . + {line: (.body | first_nonblank)}
      | select(.line | startswith($prefix))
      | select(.line | contains("[" + $tag + ": " + $id + "]"))
    ] | sort_by(.created_at) | (.[-1] // null)
  ' <<< "$comments"
}

main() {
  local comments start started_at deadline status
  comments="$(fetch_comments)"
  start="$(find_start "$comments")"
  if [ "$start" = "null" ] || [ -z "$start" ]; then
    echo "::error::terminal-watch(${ACTOR}): missing start receipt for ${ATTEMPT_ID}; refusing to invent liveness." >&2
    return 1
  fi
  started_at="$(jq -r '.created_at' <<< "$start")"
  deadline=$(( $(date +%s) + LEASE_MINUTES * 60 ))

  while :; do
    comments="$(fetch_comments)"
    status="$(runtime_attempt_status "$comments" "$ACTOR" "$ATTEMPT_ID" "$started_at")"
    if [ "$status" = "complete" ]; then
      echo "terminal-watch(${ACTOR}): ${ATTEMPT_ID} completed."
      return 0
    fi
    if [ "$(date +%s)" -ge "$deadline" ]; then
      break
    fi
    sleep "$POLL_SECONDS"
  done

  post_comment "BLOCKED: AI — ${ACTOR} attempt ${ATTEMPT_ID} produced no correlated terminal receipt inside ${LEASE_MINUTES} minutes. No automatic re-fire was attempted, preserving the one-active-execution invariant. [${TAG_NAME}: ${ATTEMPT_ID}]"
  echo "::error::terminal-watch(${ACTOR}): ${ATTEMPT_ID} timed out; fail closed without recovery fire." >&2
  return 1
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main
fi
