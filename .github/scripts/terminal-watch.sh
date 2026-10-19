#!/usr/bin/env bash
# CF-WORKFLOW-RESET-RUNTIME-01
# Detect-only terminal watch. It never re-fires a worker.
#
# CF-TIMEOUT-ACTIONABLE-01 (issue #401): a missing terminal at lease expiry
# is a monitoring incident, not a semantic OWNER reconciliation event, and
# not proof the worker died (#450's BUILD finished after its watch
# expired). So it posts exactly one typed `BLOCKED: ACTIONABLE` (see
# runtime_timeout_line) and sends that same line straight to Slack through
# the shared calvin_slack_send path, in this job — the comment is posted
# with this job's own GH_TOKEN, which cannot recursively trigger
# calvin-slack-alert.yml. It never relays into OWNER: an OWNER run could
# only restate the expiry.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=runtime-lib.sh
source "${SCRIPT_DIR}/runtime-lib.sh"
# shellcheck source=calvin-slack-notify.sh
source "${SCRIPT_DIR}/calvin-slack-notify.sh"

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

# post_comment <body> — prints the posted comment's created_at.
post_comment() {
  gh api --method POST "repos/${TARGET_REPO}/issues/${TARGET_NUMBER}/comments" -f body="$1" --jq '.created_at'
}

# notify_slack <line> <created_at> — the shared Slack send, deduped against
# this thread. Never fails the caller silently: a missing webhook or a
# failed send is logged as an error alongside the posted GitHub receipt.
notify_slack() {
  local line="$1" created_at="$2" comments
  if [ -z "${SLACK_WEBHOOK_URL:-}" ]; then
    echo "::error::terminal-watch(${ACTOR}): SLACK_WEBHOOK_URL unset; timeout receipt posted on GitHub only." >&2
    return 1
  fi
  comments="$(fetch_comments)"
  calvin_slack_send "$line" "$TARGET_REPO" "https://github.com/${TARGET_REPO}/issues/${TARGET_NUMBER}" "$comments" "$created_at"
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
  local comments start started_at deadline status blocked_line session_url created_at
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

  session_url="$(runtime_start_session_url "$(jq -r '.line' <<< "$start")")"
  blocked_line="$(runtime_timeout_line "$ACTOR" "$ATTEMPT_ID" "$LEASE_MINUTES" "$session_url" "$TARGET_REPO" "$TARGET_NUMBER")"
  created_at="$(post_comment "$blocked_line")"
  notify_slack "$blocked_line" "$created_at" || echo "::error::terminal-watch(${ACTOR}): Slack alert for ${ATTEMPT_ID} not delivered." >&2
  echo "::error::terminal-watch(${ACTOR}): ${ATTEMPT_ID} lease expired; actionable incident raised, no worker started." >&2
  return 1
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main
fi
