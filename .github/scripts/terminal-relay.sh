#!/usr/bin/env bash
# CF-WORKFLOW-RESET-TERMINAL-HANDOFF-REPAIR-02
#
# #361 fired one BUILD, which opened PR #362 and left CI green, but the
# BUILD's own terminal never correlated on the wake target the runtime was
# watching. terminal-watch.sh (correctly) posted its own fail-closed
# `BLOCKED: AI` receipt after the lease expired — but that comment was
# itself posted with the observing job's GITHUB_TOKEN, and GitHub Actions
# does not start a new workflow run from an event its own GITHUB_TOKEN
# produced. So cc-auto-fire.yml's fire-owner-on-terminal job, which exists
# specifically to react to a child `BLOCKED:` terminal, never saw the
# event, and PR #362 sat open, green, and orphaned. This is the same root
# cause calvin-ruling-lib.sh's header already documents for a different
# edge (the CALVIN RULING label hop); this file generalizes the fix: route
# a workflow-authored terminal directly into OWNER's own admission-and-fire
# procedure, inside the same job that authored it, instead of depending on
# an event that structurally cannot arrive.
#
# This does not add a second controller, queue, or notification service —
# it reuses fire-owner-on-terminal's exact admission check
# (runtime_actor_attempt_open) and posts the exact same "OWNER START:" /
# "BLOCKED:" receipts that job already posts, from a job that already has
# the OWNER_FIRE_URL/OWNER_FIRE_TOKEN secrets and the runtime's own
# GH_TOKEN in scope. Call terminal_relay_owner once, immediately after any
# step posts a workflow-authored (GH_TOKEN-authored) terminal comment.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=runtime-lib.sh
source "${SCRIPT_DIR}/runtime-lib.sh"
# shellcheck source=fire-auth-lib.sh
source "${SCRIPT_DIR}/fire-auth-lib.sh"
# shellcheck source=calvin-slack-notify.sh
source "${SCRIPT_DIR}/calvin-slack-notify.sh"

# terminal_relay_owner_needed <line>
# Pure. True exactly when OWNER.md's own wake rule ("child DONE: EVIDENCE,
# STOP:, BLOCKED: or CALVIN REQUIRED: terminal") applies to <line> — the
# same predicate every OWNER wake (event-triggered or relayed) uses, named
# here so call sites read as policy rather than incidental reuse. Also
# false for OWNER's own terminals (tagged OWNER_ATTEMPT_ID), which is what
# keeps a relay called from an OWNER-firing step's own failure path from
# looping back into firing OWNER again.
terminal_relay_owner_needed() {
  runtime_is_child_terminal "$1"
}

terminal_relay_fetch_comments() {
  local repo="$1" number="$2"
  gh api --paginate "repos/${repo}/issues/${number}/comments" \
    --jq '[.[] | {body: .body, created_at: .created_at}]' | jq -s 'add // []'
}

terminal_relay_post_comment() {
  local repo="$1" number="$2" body="$3"
  gh api --method POST "repos/${repo}/issues/${number}/comments" -f body="$body" >/dev/null
}

# _terminal_relay_owner_blocked <repo> <number> <attempt_id> <secret> <code>
# Posts the same typed BLOCKED receipt fire-owner-on-terminal's own "Fire
# OWNER" step posts on transport failure, then relays it to Slack directly
# too (an OWNER-relay transport failure is exactly the kind of
# workflow-authored BLOCKED: ACTIONABLE that cannot recursively reach
# calvin-slack-alert.yml either). Never re-enters terminal_relay_owner:
# doing so would fire OWNER over its own infra failure, which is not a
# BUILD/REVIEW/OWNER transition for OWNER to reconcile.
_terminal_relay_owner_blocked() {
  local repo="$1" number="$2" attempt_id="$3" secret="$4" code="$5" body
  if [ "$(fire_auth_status "$code")" = auth ]; then
    body="BLOCKED: ACTIONABLE — OWNER relay transport unavailable (${code}); refresh ${secret}. No worker started. [OWNER_ATTEMPT_ID: ${attempt_id}]"
  else
    body="BLOCKED: AI — OWNER relay transport failed (${code}). [OWNER_ATTEMPT_ID: ${attempt_id}]"
  fi
  terminal_relay_post_comment "$repo" "$number" "$body"
  calvin_slack_send "$body" "$repo" "https://github.com/${repo}/issues/${number}" || true
}

# terminal_relay_owner <repo> <number> <line> <source>
# Network I/O. Call immediately after any step posts a workflow-authored
# comment <line> on <repo>#<number>. <source> is a short label (e.g.
# fire-build-resolve, observe-build-timeout) folded into the relay's own
# OWNER_ATTEMPT_ID so its origin is legible in the transcript.
#
# No-ops when <line> is not a child terminal, or when OWNER already has an
# open attempt — the same admission check every OWNER wake performs. That
# second check is what makes this safe to call unconditionally even though
# a *genuine* worker-authored terminal (posted by BUILD/REVIEW/OWNER's own
# session, not GITHUB_TOKEN) already reaches OWNER through the normal
# issue_comment trigger: whichever path observes the open attempt first
# wins the admission race, and the other no-ops rather than firing a
# second OWNER. Requires GH_TOKEN, OWNER_FIRE_URL, OWNER_FIRE_TOKEN.
terminal_relay_owner() {
  local repo="$1" number="$2" line="$3" source="$4"
  if [ "$(terminal_relay_owner_needed "$line")" != true ]; then
    return 0
  fi

  local comments
  comments="$(terminal_relay_fetch_comments "$repo" "$number")"
  if [ "$(runtime_actor_attempt_open "$comments" OWNER)" = true ]; then
    echo "terminal-relay(${source}): OWNER attempt already open for ${repo}#${number}; no relay fire." >&2
    return 0
  fi

  local attempt_id="OWNER-RELAY-${source}-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"

  if [ -z "${OWNER_FIRE_URL:-}" ]; then
    _terminal_relay_owner_blocked "$repo" "$number" "$attempt_id" OWNER_FIRE_URL missing_secret
    return 0
  fi
  if [ -z "${OWNER_FIRE_TOKEN:-}" ]; then
    _terminal_relay_owner_blocked "$repo" "$number" "$attempt_id" OWNER_FIRE_TOKEN missing_secret
    return 0
  fi

  local prompt request code
  prompt="Repository ${repo}, item #${number}, relay wake: a workflow-authored terminal (\"${line}\") could not recursively trigger the event path. Follow current .github/ai-routines/OWNER.md exactly for this wake. This run's OWNER_ATTEMPT_ID is ${attempt_id}; parent terminal first line must carry [OWNER_ATTEMPT_ID: ${attempt_id}]."
  request=$(jq -n --arg text "$prompt" '{text:$text}')
  code=$(curl -sS -o /tmp/terminal-relay-owner.json -w '%{http_code}' --request POST "$OWNER_FIRE_URL" \
    --header "Authorization: Bearer $OWNER_FIRE_TOKEN" --header "anthropic-version: 2023-06-01" \
    --header "anthropic-beta: experimental-cc-routine-2026-04-01" --header "Content-Type: application/json" \
    --data "$request") || code=curl_error

  if [ "$code" != curl_error ] && [ "$code" -ge 200 ] 2>/dev/null && [ "$code" -lt 300 ] 2>/dev/null; then
    local session url
    session=$(jq -r '.claude_code_session_id // "unknown"' /tmp/terminal-relay-owner.json)
    url=$(jq -r '.claude_code_session_url // "unknown"' /tmp/terminal-relay-owner.json)
    terminal_relay_post_comment "$repo" "$number" \
      "OWNER START: wake=RELAY · session ${session} (${url}) [OWNER_ATTEMPT_ID: ${attempt_id}]"
  else
    _terminal_relay_owner_blocked "$repo" "$number" "$attempt_id" OWNER_FIRE_TOKEN "$code"
  fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  : "${RELAY_REPO:?RELAY_REPO is required}"
  : "${RELAY_NUMBER:?RELAY_NUMBER is required}"
  : "${RELAY_LINE:?RELAY_LINE is required}"
  : "${RELAY_SOURCE:?RELAY_SOURCE is required}"
  : "${GH_TOKEN:?GH_TOKEN is required}"
  terminal_relay_owner "$RELAY_REPO" "$RELAY_NUMBER" "$RELAY_LINE" "$RELAY_SOURCE"
fi
