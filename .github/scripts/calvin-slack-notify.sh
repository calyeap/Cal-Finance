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

# calvin_slack_payload <line> <repo> <comment_url>
# Pure. <line> is a raw terminal comment (or just its first line); the
# OWNER_ATTEMPT_ID tag, if any, is stripped before it reaches Slack since
# it is internal runtime bookkeeping, not part of the human-facing
# message. Prints the JSON webhook payload and returns 0 when
# runtime_slack_kind classifies <line> as Slack-eligible (calvin_required,
# actionable_blocked, complete); prints nothing and returns 1 otherwise.
calvin_slack_payload() {
  local raw="$1" repo="$2" comment_url="$3" line kind header
  line="$(runtime_strip_heading "$(runtime_first_line "$raw")")"
  line="$(printf '%s' "$line" | sed -E 's/[[:space:]]*\[OWNER_ATTEMPT_ID:[^]]+\][[:space:]]*$//')"
  kind="$(runtime_slack_kind "$line")"
  case "$kind" in
    calvin_required) header="CALVIN REQUIRED" ;;
    actionable_blocked) header="ACTIONABLE BLOCKED" ;;
    complete) header="COMPLETE" ;;
    *) return 1 ;;
  esac
  jq -n --arg h "$header" --arg repo "$repo" --arg line "$line" --arg url "$comment_url" \
    '{text: ($h + " — " + $repo + "\n" + $line + "\n" + $url)}'
}

# calvin_slack_send <line> <repo> <comment_url> — network I/O. Requires
# SLACK_WEBHOOK_URL in the environment. A no-op (exit 0, no request sent)
# when <line> is not Slack-eligible, so every call site — the event
# path and every direct relay call alike — can call this unconditionally
# right after posting any workflow-authored terminal comment.
calvin_slack_send() {
  local raw="$1" repo="$2" comment_url="$3" payload code
  payload="$(calvin_slack_payload "$raw" "$repo" "$comment_url")" || return 0
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
