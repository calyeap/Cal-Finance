#!/usr/bin/env bash
# CF-GATE-PUSH-01 (issue #221)
#
# Sends one immediate phone push for one Notion CALVIN GATES OPEN row,
# closing the delivery-latency gap the hourly "Calvin Gates Watch" poll
# left (PR #218 reached CALVIN REQUIRED at ~15:16 SGT on 22 Sep 2026; the
# OPEN gate was created correctly in Notion but nothing alerted Calvin's
# phone until the next hourly poll).
#
# Called exactly once, by CALBOARD-OWNER (.github/ai-routines/OWNER.md),
# immediately after OWNER has created the OPEN row in Notion CALVIN GATES
# for this exact gate and read it back successfully. Never called
# speculatively, never called again on resolution, and never called from
# anywhere else — the Notion gate is the sole attention truth; this script
# is delivery only and its failure must never touch that gate (SCOPE #4).
#
# Required env: GH_TOKEN, TARGET_REPO, TARGET_NUMBER, GATE_ID, PROJECT,
# ASK. TARGET_REPO/TARGET_NUMBER identify the GitHub item this run's
# CALVIN REQUIRED terminal marker landed on — the same item OWNER is
# already reconciling — and are used only to record/read the dedupe
# marker comment, never to decide gate state.
#
# Optional env: CALVIN_PUSH_WEBHOOK_URL, CALVIN_PUSH_WEBHOOK_TOKEN. Kept
# deliberately provider-agnostic: a plain HTTPS POST of
# {project, gate_id, ask} JSON, with an optional bearer token, to whatever
# minimal relay/provider endpoint Calvin configures (for example a
# Pushover- or ntfy-style webhook, or a small relay in front of one). If
# CALVIN_PUSH_WEBHOOK_URL is unset, this exits 0 having sent nothing —
# see SCOPE and DONE WHEN: missing config is a safe explicit no-send
# state, never a workflow failure, and never blocks gate creation (which
# has already happened by the time this script runs).
#
# Exit code is informational only for the caller's own logging: a network
# failure here (exit 1) must not be treated as a gate-altering error by
# whatever invoked this script. The Notion gate this script's caller
# already created stays OPEN either way.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=calvin-gate-push-lib.sh
source "${SCRIPT_DIR}/calvin-gate-push-lib.sh"

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${TARGET_REPO:?TARGET_REPO is required}"
: "${TARGET_NUMBER:?TARGET_NUMBER is required}"
: "${GATE_ID:?GATE_ID is required}"
: "${PROJECT:?PROJECT is required}"
: "${ASK:?ASK is required}"

fetch_comments() {
  gh api --paginate \
    "repos/${TARGET_REPO}/issues/${TARGET_NUMBER}/comments" \
    --jq '[.[] | {body: .body}]' \
    | jq -s 'add // []'
}

post_comment() {
  local body="$1"
  gh api --method POST \
    "repos/${TARGET_REPO}/issues/${TARGET_NUMBER}/comments" \
    -f body="$body" >/dev/null
}

# send_push <webhook_url> <webhook_token> <payload_json>
# Echoes the HTTP status code, or "curl_error" if the request itself
# could not be made.
send_push() {
  local webhook_url="$1" webhook_token="$2" payload="$3"
  local response_file http_code
  response_file="$(mktemp)"
  if [ -n "$webhook_token" ]; then
    http_code=$(curl -sS -o "$response_file" -w '%{http_code}' \
      --request POST "$webhook_url" \
      --header "Authorization: Bearer $webhook_token" \
      --header "Content-Type: application/json" \
      --data "$payload") || http_code="curl_error"
  else
    http_code=$(curl -sS -o "$response_file" -w '%{http_code}' \
      --request POST "$webhook_url" \
      --header "Content-Type: application/json" \
      --data "$payload") || http_code="curl_error"
  fi
  rm -f "$response_file"
  echo "$http_code"
}

main() {
  local dedupe_key marker comments already_sent
  local webhook_url webhook_token payload http_code

  dedupe_key="$(calvin_gate_push_dedupe_key "$GATE_ID" "$ASK")"
  marker="$(calvin_gate_push_marker "$dedupe_key")"
  comments="$(fetch_comments)"
  already_sent="$(calvin_gate_push_already_sent "$comments" "$dedupe_key")"

  if [ "$already_sent" = "true" ]; then
    echo "calvin-gate-push: duplicate suppressed for gate ${GATE_ID} (unchanged ask); no push sent."
    exit 0
  fi

  webhook_url="${CALVIN_PUSH_WEBHOOK_URL:-}"
  webhook_token="${CALVIN_PUSH_WEBHOOK_TOKEN:-}"

  if ! calvin_gate_push_config_ready "$webhook_url"; then
    echo "calvin-gate-push: CALVIN_PUSH_WEBHOOK_URL is not configured; explicit no-send for gate ${GATE_ID}. Notion gate stays OPEN; hourly Calvin Gates Watch remains fallback."
    exit 0
  fi

  payload="$(calvin_gate_push_payload "$PROJECT" "$GATE_ID" "$ASK")"
  http_code="$(send_push "$webhook_url" "$webhook_token" "$payload")"

  if [ "$http_code" != "curl_error" ] && [ "$http_code" -ge 200 ] 2>/dev/null && [ "$http_code" -lt 300 ] 2>/dev/null; then
    post_comment "$marker"
    echo "calvin-gate-push: push sent for gate ${GATE_ID} (HTTP ${http_code})."
    exit 0
  fi

  echo "::error::calvin-gate-push: push attempt failed for gate ${GATE_ID} (HTTP ${http_code}). Gate remains OPEN and unaffected; hourly Calvin Gates Watch remains fallback."
  exit 1
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main
fi
