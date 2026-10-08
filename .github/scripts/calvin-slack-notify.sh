#!/usr/bin/env bash
# CF-WORKFLOW-RESET-TERMINAL-HANDOFF-REPAIR-02
#
# Shared Slack terminal notifier. Previously calvin-slack-alert.yml's own
# "Send Slack terminal" step was the only place that built the Slack
# payload and posted it, which meant it could only ever run from that
# workflow's own `issue_comment` trigger. That trigger never fires for a
# comment a workflow step posted itself using the repository's own
# GITHUB_TOKEN (GitHub Actions does not start a new run from an event its
# own GITHUB_TOKEN produced), so a workflow-generated `BLOCKED: ACTIONABLE`
# — e.g. a fire step's own "transport unavailable, refresh this secret"
# receipt — never reached Slack. Factoring the payload/send logic out here
# lets any step call it directly, in the same job, immediately after it
# posts such a comment, instead of depending on a recursive event that
# structurally cannot arrive. calvin-slack-alert.yml's own event-triggered
# path (genuine human/worker-authored comments, which do trigger normally)
# calls the same function, so there is exactly one Slack-eligibility and
# payload definition.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=runtime-lib.sh
source "${SCRIPT_DIR}/runtime-lib.sh"

# calvin_slack_payload <raw> <repo> <comment_url> [<comments_json> <created_at>]
# Pure. <raw> is a raw terminal comment (or just its first line); any
# BUILD_/REVIEW_/OWNER_ATTEMPT_ID tag is stripped before it reaches Slack
# since it is internal runtime bookkeeping, not part of the human-facing
# message. Prints the JSON webhook payload and returns 0 when
# runtime_slack_kind classifies <raw> as Slack-eligible; prints nothing and
# returns 1 otherwise. Kind is always computed from <raw> itself, never
# from the already tag-stripped display line below — runtime_slack_kind's
# own `stopped` classification depends on finding an OWNER_ATTEMPT_ID tag
# that a pre-stripped line would have already lost.
#
# Two kinds are a real human gate and get an `<!channel>` ping:
# `calvin_required` ("CALVIN REQUIRED"), `actionable_blocked` ("ACTIONABLE
# BLOCKED"). Two more are one-time informational notices with no ping, per
# CF-TERMINAL-NOTIFY-RELIABILITY-01 (issue #408), which explicitly
# supersedes CF-SLACK-ACTION-ONLY-01's (issue #377) blanket exclusion of
# `COMPLETE:` for final delegated-task outcomes: `finished` (OWNER's own
# `COMPLETE:`, header "FINISHED") and `stopped` (OWNER's own definitively
# terminal `BLOCKED: AI`/`BLOCKED: EXTERNAL`, header "STOPPED").
#
# <comments_json>/<created_at> are optional: when both are given (the
# thread's prior comments, and this comment's own created_at), a terminal
# that runtime_slack_is_duplicate finds restates the same still-open gate —
# keyed by canonical item + Slack kind + open/resolved state, per
# CF-SLACK-DEDUPE-02, never by a worker attempt ID — is also treated as
# ineligible (return 1), which bounds every kind (including `finished`/
# `stopped`) to at most one same-outcome notification. This covers both the
# #365 class (BUILD's alert and OWNER's reconciling restatement of the same
# actionable blocker) and any other actor restating the same unresolved
# gate, without depending on one comment literally referencing another's
# attempt ID. Omitting them skips the duplicate check (always eligible on
# its own terms), which is correct for a call site with no thread to
# consult, such as a fresh OWNER-relay transport-failure receipt.
calvin_slack_payload() {
  local raw="$1" repo="$2" comment_url="$3" comments_json="${4:-}" created_at="${5:-}" line kind header pingable
  kind="$(runtime_slack_kind "$raw")"
  case "$kind" in
    calvin_required) header="CALVIN REQUIRED"; pingable=true ;;
    actionable_blocked) header="ACTIONABLE BLOCKED"; pingable=true ;;
    finished) header="FINISHED"; pingable=false ;;
    stopped) header="STOPPED"; pingable=false ;;
    *) return 1 ;;
  esac
  if [ -n "$comments_json" ] && [ -n "$created_at" ] \
    && [ "$(runtime_slack_is_duplicate "$comments_json" "$created_at" "$raw")" = true ]; then
    return 1
  fi
  line="$(runtime_terminal_line "$raw")"
  line="$(printf '%s' "$line" | sed -E 's/[[:space:]]*\[(BUILD|REVIEW|OWNER)_ATTEMPT_ID:[^]]+\][[:space:]]*$//')"
  if [ "$pingable" = true ]; then
    # A real Calvin decision/action gate. Include one channel mention so
    # Slack creates an actual notification instead of only dropping a
    # quiet webhook message.
    jq -n --arg h "$header" --arg repo "$repo" --arg line "$line" --arg url "$comment_url" \
      '{text: ($h + " — " + $repo + "\n" + $line + "\n" + $url + "\n<!channel>")}'
  else
    # A one-time informational notice: no action is implied, so no ping.
    jq -n --arg h "$header" --arg repo "$repo" --arg line "$line" --arg url "$comment_url" \
      '{text: ($h + " — " + $repo + "\n" + $line + "\n" + $url)}'
  fi
}

# calvin_slack_send <line> <repo> <comment_url> [<comments_json> <created_at>]
# — network I/O. Requires SLACK_WEBHOOK_URL in the environment. A no-op
# (exit 0, no request sent) when <line> is not Slack-eligible or is a
# duplicate restatement (see calvin_slack_payload), so every call site —
# the event path and every direct relay call alike — can call this
# unconditionally right after posting any workflow-authored terminal
# comment.
calvin_slack_send() {
  local raw="$1" repo="$2" comment_url="$3" comments_json="${4:-}" created_at="${5:-}" payload code
  payload="$(calvin_slack_payload "$raw" "$repo" "$comment_url" "$comments_json" "$created_at")" || return 0
  : "${SLACK_WEBHOOK_URL:?SLACK_WEBHOOK_URL is required to send a Slack-eligible terminal}"
  code=$(curl -sS -o /tmp/calvin-slack-notify.out -w '%{http_code}' --request POST "$SLACK_WEBHOOK_URL" \
    --header 'Content-Type: application/json' --data "$payload") || code=curl_error
  if [ "$code" = curl_error ] || [ "$code" -lt 200 ] || [ "$code" -ge 300 ]; then
    echo "::error::calvin_slack_send: Slack webhook failed (${code})" >&2
    return 1
  fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  : "${SLACK_LINE:?SLACK_LINE is required}"
  : "${SLACK_REPO:?SLACK_REPO is required}"
  : "${SLACK_COMMENT_URL:?SLACK_COMMENT_URL is required}"
  calvin_slack_send "$SLACK_LINE" "$SLACK_REPO" "$SLACK_COMMENT_URL"
fi
