#!/usr/bin/env bash
# CF-WORKFLOW-RESET-RUNTIME-01
# Detect-only terminal watch. It never re-fires a worker. A missing terminal
# becomes a durable AI-owned BLOCKED receipt so the parent can reconcile
# without violating the one-active-execution invariant.
#
# CF-WORKFLOW-RESET-TERMINAL-HANDOFF-REPAIR-02: that BLOCKED receipt is
# posted with this job's own GH_TOKEN, which cannot recursively trigger
# the issue_comment-based OWNER wake that receipt exists to cause (GitHub
# Actions does not start a new run from an event its own GITHUB_TOKEN
# produced) — the #361/#362 defect this outcome repairs. The caller (see
# cc-auto-fire.yml's observe-build/observe-review jobs) relays this
# terminal to OWNER directly instead. To do that without re-deriving (and
# risking drifting from) this exact wording, the timed-out line is also
# written to TERMINAL_BLOCKED_LINE_FILE so the caller reads the one
# canonical text back rather than reconstructing it.

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
BLOCKED_LINE_FILE="${TERMINAL_BLOCKED_LINE_FILE:-/tmp/terminal-watch-blocked-line.txt}"

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
  local comments start started_at deadline status blocked_line
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

  blocked_line="BLOCKED: AI — ${ACTOR} attempt ${ATTEMPT_ID} produced no correlated terminal receipt inside ${LEASE_MINUTES} minutes. No automatic re-fire was attempted, preserving the one-active-execution invariant. [${TAG_NAME}: ${ATTEMPT_ID}]"
  printf '%s' "$blocked_line" > "$BLOCKED_LINE_FILE"
  post_comment "$blocked_line"
  echo "::error::terminal-watch(${ACTOR}): ${ATTEMPT_ID} timed out; fail closed without starting another worker." >&2
  return 1
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main
fi
