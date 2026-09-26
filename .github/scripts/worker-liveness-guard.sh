#!/usr/bin/env bash
# CF-HANDOFF-FAIL-CLOSED-01
#
# Shared post-fire liveness guard for BUILD and REVIEW — the BUILD/REVIEW
# analogue of owner-liveness-guard.sh (CF-OWNER-LIVENESS-01), which stays
# untouched and keeps guarding OWNER on its own. Called once cc-auto-fire.yml's
# fire-build or fire-review job has already fired successfully and posted
# its "BUILD FIRED: ... [BUILD_ATTEMPT_ID: <id>]" / "REVIEW FIRED: ...
# [REVIEW_ATTEMPT_ID: <id>]" receipt (that receipt doubles as this
# attempt's start marker — see build-liveness-lib.sh / review-liveness-lib.sh).
#
# Scope only: wait one bounded observation window, check the wake target
# for a correlated terminal receipt, and — if and only if none exists —
# fire exactly one recovery through the same FIRE_URL/FIRE_TOKEN transport
# the original fire used, wait one more bounded window, check again, and
# post a durable `WORKFLOW BLOCKED — LIVENESS` receipt if that also
# produced no correlated terminal result. Never loops, never fires a second
# recovery. A recovery-fire transport failure classified as auth (missing
# secret, 401, 403 — see fire-auth-lib.sh) posts `WORKFLOW BLOCKED — AUTH`
# instead, naming the actor and exact secret to refresh, and never a
# response body or credential.
#
# Required env: GH_TOKEN, TARGET_REPO, TARGET_NUMBER, ATTEMPT_ID, ACTOR
# (BUILD|REVIEW), FIRE_URL, FIRE_TOKEN.
# Optional env: WORKER_LIVENESS_LEASE_MINUTES (default 20, matching
# CF-OWNER-LIVENESS-01's existing bound), WORKER_LIVENESS_POLL_SECONDS
# (default 60).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=build-liveness-lib.sh
source "${SCRIPT_DIR}/build-liveness-lib.sh"
# shellcheck source=review-liveness-lib.sh
source "${SCRIPT_DIR}/review-liveness-lib.sh"
# shellcheck source=fire-auth-lib.sh
source "${SCRIPT_DIR}/fire-auth-lib.sh"

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${TARGET_REPO:?TARGET_REPO is required}"
: "${TARGET_NUMBER:?TARGET_NUMBER is required}"
: "${ATTEMPT_ID:?ATTEMPT_ID is required}"
: "${ACTOR:?ACTOR is required (BUILD|REVIEW)}"

LEASE_MINUTES="${WORKER_LIVENESS_LEASE_MINUTES:-20}"
POLL_SECONDS="${WORKER_LIVENESS_POLL_SECONDS:-60}"

case "$ACTOR" in
  BUILD)
    ADAPTER_FILE=".github/ai-routines/BUILD.md"
    TYPED_FORMS="DONE: / BLOCKED: / STOP: / CALVIN REQUIRED:"
    TAG_NAME="BUILD_ATTEMPT_ID"
    ;;
  REVIEW)
    ADAPTER_FILE=".github/ai-routines/CC.md"
    TYPED_FORMS="ACCEPT: / CORRECT: / STOP: / CALVIN REQUIRED:"
    TAG_NAME="REVIEW_ATTEMPT_ID"
    ;;
  *)
    echo "::error::worker-liveness-guard: unknown ACTOR '${ACTOR}' (expected BUILD or REVIEW)" >&2
    exit 1
    ;;
esac

# actor_find_start <comments_json> <attempt_id>
actor_find_start() {
  case "$ACTOR" in
    BUILD) build_liveness_find_start "$1" "$2" ;;
    REVIEW) review_liveness_find_start "$1" "$2" ;;
  esac
}

# actor_status <comments_json> <attempt_id> <after_iso>
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

# wait_and_check <attempt_id> <started_at>
# Polls every POLL_SECONDS for a correlated terminal receipt, returning
# "complete" as soon as one appears, or "missing" once LEASE_MINUTES have
# elapsed since started_at with none found.
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

# fire_recovery <recovery_attempt_id>
# Fires the single bounded recovery and posts its own start receipt (the
# same "<ACTOR> FIRED:"-shaped comment, tagged for the recovery attempt).
# Returns non-zero only if the recovery fire itself failed to reach the
# worker at all, in which case it posts the appropriate blocked receipt
# directly (WORKFLOW BLOCKED — AUTH for a missing secret/401/403,
# WORKFLOW BLOCKED — LIVENESS otherwise) since no recovery attempt was ever
# live to observe.
fire_recovery() {
  local recovery_attempt_id="$1"
  local prompt response_file http_code request_body

  prompt="Repository ${TARGET_REPO}, item #${TARGET_NUMBER}. This is CF-HANDOFF-FAIL-CLOSED-01's one bounded ${ACTOR} recovery: attempt ${ATTEMPT_ID} produced no correlated terminal receipt inside its observation window. Reread the current target state before acting — do not assume the original attempt did nothing, and do not duplicate an already-open PR/comment it may have already produced. Follow ${ADAPTER_FILE} exactly and continue only the missing step, then end with exactly one of its typed terminal forms (${TYPED_FORMS}) whose first non-empty line also includes the exact tag [${TAG_NAME}: ${recovery_attempt_id}]."
  request_body="$(jq -n --arg text "$prompt" '{text: $text}')"
  response_file="$(mktemp)"

  http_code=$(curl -sS -o "$response_file" -w '%{http_code}' \
    --request POST "$FIRE_URL" \
    --header "Authorization: Bearer $FIRE_TOKEN" \
    --header "anthropic-version: 2023-06-01" \
    --header "anthropic-beta: experimental-cc-routine-2026-04-01" \
    --header "Content-Type: application/json" \
    --data "$request_body") || http_code="curl_error"

  if [ "$http_code" != "curl_error" ] && [ "$http_code" -ge 200 ] 2>/dev/null && [ "$http_code" -lt 300 ] 2>/dev/null; then
    local session_id session_url fired_prefix
    session_id=$(jq -r '.claude_code_session_id // "unknown"' "$response_file")
    session_url=$(jq -r '.claude_code_session_url // "unknown"' "$response_file")
    case "$ACTOR" in
      BUILD) fired_prefix="BUILD FIRED:" ;;
      REVIEW) fired_prefix="REVIEW FIRED:" ;;
    esac
    post_comment "$(printf '%s HTTP %s · session %s (%s)\nRECOVERY_ATTEMPT: 1 OF 1 (original: %s)\nCF-HANDOFF-FAIL-CLOSED-01: fired the one bounded %s recovery. [%s: %s]' \
      "$fired_prefix" "$http_code" "$session_id" "$session_url" "$ATTEMPT_ID" "$ACTOR" "$TAG_NAME" "$recovery_attempt_id")"
    rm -f "$response_file"
    return 0
  fi

  if [ "$(fire_auth_status "$http_code")" = "auth" ]; then
    post_comment "$(fire_auth_blocked_body "$ACTOR" "$(actor_fire_secret_name)" "$http_code")"
  else
    post_comment "$(printf 'WORKFLOW BLOCKED — LIVENESS\n\nactor: %s\noriginal_attempt: %s\nfirst_broken_transition: recovery fire -> HTTP acceptance\n\nOriginal attempt %s produced no correlated terminal receipt inside its observation window, and the one bounded recovery fire itself failed to reach %s (HTTP %s). No further recovery will be attempted.' \
      "$ACTOR" "$ATTEMPT_ID" "$ATTEMPT_ID" "$ACTOR" "$http_code")"
  fi
  rm -f "$response_file"
  return 1
}

# actor_fire_secret_name
# The exact repository secret key to name in a WORKFLOW BLOCKED — AUTH
# receipt for this actor's fire transport. 401/403 point at the bearer
# token; a missing secret could be either half, but the token is the one
# actually presented to the endpoint and the more common rotation target,
# so it is named here — the receipt's `classification` field still states
# the raw code observed.
actor_fire_secret_name() {
  case "$ACTOR" in
    BUILD) echo "BUILD_FIRE_TOKEN" ;;
    REVIEW) echo "CC_AUTO_FIRE_TOKEN" ;;
  esac
}

post_exhaustion() {
  local recovery_attempt_id="$1"
  post_comment "$(printf 'WORKFLOW BLOCKED — LIVENESS\n\nactor: %s\noriginal_attempt: %s\nrecovery_attempt: %s\nfirst_broken_transition: fire -> correlated terminal receipt\n\nOriginal attempt %s produced no correlated terminal receipt inside its observation window. Recovery attempt %s was fired and also produced no correlated terminal receipt inside its observation window. No further recovery will be attempted; this is exhaustion, not a live attempt.' \
    "$ACTOR" "$ATTEMPT_ID" "$recovery_attempt_id" "$ATTEMPT_ID" "$recovery_attempt_id")"
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
    echo "worker-liveness(${ACTOR}): attempt ${ATTEMPT_ID} completed with zero recovery."
    exit 0
  fi

  local recovery_attempt_id="${ATTEMPT_ID}-recovery-1"
  local recovery_start
  recovery_start="$(actor_find_start "$(fetch_comments)" "$recovery_attempt_id")"

  if [ -n "$recovery_start" ]; then
    echo "worker-liveness(${ACTOR}): recovery ${recovery_attempt_id} already fired; not firing a second recovery (duplicate suppression)."
  else
    echo "worker-liveness(${ACTOR}): attempt ${ATTEMPT_ID} missing a correlated terminal receipt; firing the one bounded recovery."
    if ! fire_recovery "$recovery_attempt_id"; then
      exit 1
    fi
    recovery_start="$(actor_find_start "$(fetch_comments)" "$recovery_attempt_id")"
  fi

  local recovery_started_at recovery_status
  recovery_started_at="$(jq -r '.created_at' <<<"$recovery_start")"
  recovery_status="$(wait_and_check "$recovery_attempt_id" "$recovery_started_at")"
  if [ "$recovery_status" = "complete" ]; then
    echo "worker-liveness(${ACTOR}): recovery ${recovery_attempt_id} completed; liveness closed cleanly."
    exit 0
  fi

  echo "::error::worker-liveness-guard(${ACTOR}): recovery ${recovery_attempt_id} also produced no correlated terminal receipt; posting exhaustion receipt." >&2
  post_exhaustion "$recovery_attempt_id"
  exit 1
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  : "${FIRE_URL:?FIRE_URL is required}"
  : "${FIRE_TOKEN:?FIRE_TOKEN is required}"
  main
fi
