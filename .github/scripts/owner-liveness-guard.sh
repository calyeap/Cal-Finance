#!/usr/bin/env bash
# CF-OWNER-LIVENESS-01
#
# Shared post-fire liveness guard for both native OWNER fire paths: the
# merge wake in owner-on-merge.yml and the terminal wake in
# cc-auto-fire.yml's fire-owner-on-terminal job. Called once that
# workflow's own "Fire CALBOARD-OWNER API trigger" step has already
# succeeded and posted the "OWNER ATTEMPT START: $ATTEMPT_ID" receipt on
# the exact wake target.
#
# Scope only: wait one bounded observation window, check the wake target
# for a correlated terminal receipt (see owner-liveness-lib.sh), and — if
# and only if none exists — fire exactly one recovery through the existing
# OWNER_FIRE_URL/OWNER_FIRE_TOKEN transport, wait one more bounded window,
# check again, and post a durable exhaustion receipt if that also produced
# no correlated terminal result. Never loops, never fires a second
# recovery, never touches BUILD/REVIEW/Project Home itself — that stays
# OWNER.md's job.
#
# Required env: GH_TOKEN, OWNER_FIRE_URL, OWNER_FIRE_TOKEN, TARGET_REPO,
# TARGET_NUMBER, ATTEMPT_ID, WAKE_CLASS (MERGE|TERMINAL).
# Optional env: OWNER_LIVENESS_LEASE_MINUTES (default 20 — see AUTHORITY in
# issue CF-OWNER-LIVENESS-01 for why 20 is the current bound).
#
# CF-OWNER-SINGLE-WRITER-01: this job now runs inside the shared
# `cf-owner-single-writer` concurrency group (see owner-on-merge.yml and
# cc-auto-fire.yml), so every minute this script spends waiting is a
# minute a later, legitimate OWNER wake is queued behind it. wait_and_check
# below therefore polls in OWNER_LIVENESS_POLL_SECONDS increments (default
# 60) and returns the moment a correlated terminal receipt appears, instead
# of always sleeping the full lease before checking even once — the
# bounded lease is still the hard ceiling, only the common healthy case
# gets faster.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=owner-liveness-lib.sh
source "${SCRIPT_DIR}/owner-liveness-lib.sh"
# shellcheck source=fire-auth-lib.sh
source "${SCRIPT_DIR}/fire-auth-lib.sh"

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

# wait_and_check <attempt_id> <started_at>
# Polls every POLL_SECONDS for a correlated terminal receipt, returning
# "complete" as soon as one appears. If none has appeared once
# LEASE_MINUTES have elapsed since started_at, returns "missing" — the same
# bound as before, just checked incrementally instead of only once at the
# end.
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

# fire_owner_recovery <recovery_attempt_id>
# Fires the single bounded OWNER recovery and posts its own
# "OWNER ATTEMPT START:" receipt (which also carries the RECOVERY_ATTEMPT
# marker). Returns non-zero only if the recovery fire itself failed to
# reach OWNER at all, in which case it posts the exhaustion receipt
# directly since no recovery attempt was ever live to observe.
fire_owner_recovery() {
  local recovery_attempt_id="$1"
  local prompt response_file http_code request_body

  prompt="Repository ${TARGET_REPO}, item #${TARGET_NUMBER}. This is CF-OWNER-LIVENESS-01's one bounded OWNER recovery: the ${WAKE_CLASS} wake attempt ${ATTEMPT_ID} produced no correlated terminal receipt inside its observation window. Reread current native GitHub state and Cal Finance Project Home truth before acting — do not assume the original attempt did nothing. Do not create a duplicate of an already-created next issue and do not re-fire BUILD or REVIEW. Continue only the missing already-authorised step from .github/ai-routines/OWNER.md, then end with exactly one typed terminal result (DISPATCHED: / WAIT: AI — / WAIT: EXTERNAL — / WAIT: PARKED — / CALVIN REQUIRED:) whose first non-empty line also includes the exact tag [OWNER_ATTEMPT_ID: ${recovery_attempt_id}]."
  request_body="$(jq -n --arg text "$prompt" '{text: $text}')"
  response_file="$(mktemp)"

  http_code=$(curl -sS -o "$response_file" -w '%{http_code}' \
    --request POST "$OWNER_FIRE_URL" \
    --header "Authorization: Bearer $OWNER_FIRE_TOKEN" \
    --header "anthropic-version: 2023-06-01" \
    --header "anthropic-beta: experimental-cc-routine-2026-04-01" \
    --header "Content-Type: application/json" \
    --data "$request_body") || http_code="curl_error"

  if [ "$http_code" != "curl_error" ] && [ "$http_code" -ge 200 ] 2>/dev/null && [ "$http_code" -lt 300 ] 2>/dev/null; then
    local session_id session_url
    session_id=$(jq -r '.claude_code_session_id // "unknown"' "$response_file")
    session_url=$(jq -r '.claude_code_session_url // "unknown"' "$response_file")
    post_comment "$(printf 'OWNER ATTEMPT START: %s\nwake_class: %s\nRECOVERY_ATTEMPT: 1 OF 1 (original: %s)\nCF-OWNER-LIVENESS-01: fired the one bounded OWNER recovery (HTTP %s). session: %s (%s)' \
      "$recovery_attempt_id" "$WAKE_CLASS" "$ATTEMPT_ID" "$http_code" "$session_id" "$session_url")"
    rm -f "$response_file"
    return 0
  fi

  # CF-HANDOFF-FAIL-CLOSED-01: a missing secret / 401 / 403 on the recovery
  # fire is a credential problem, not ordinary liveness exhaustion — name it
  # as such (actor + exact secret to refresh) instead of folding it into
  # the generic RECONCILIATION REQUIRED receipt, and never print the
  # response body, which may carry the credential itself.
  if [ "$(fire_auth_status "$http_code")" = "auth" ]; then
    post_comment "$(fire_auth_blocked_body OWNER OWNER_FIRE_TOKEN "$http_code")"
  else
    post_comment "$(printf 'OWNER LIVENESS EXHAUSTED — RECONCILIATION REQUIRED\n\nOriginal attempt %s (%s wake) produced no correlated terminal receipt inside its observation window, and the one bounded recovery fire itself failed to reach OWNER (HTTP %s). First broken transition: OWNER fire -> HTTP acceptance. No further recovery will be attempted.' \
      "$ATTEMPT_ID" "$WAKE_CLASS" "$http_code")"
  fi
  rm -f "$response_file"
  return 1
}

post_exhaustion() {
  local recovery_attempt_id="$1"
  post_comment "$(printf 'OWNER LIVENESS EXHAUSTED — RECONCILIATION REQUIRED\n\nOriginal attempt %s (%s wake) produced no correlated terminal receipt inside its observation window. Recovery attempt %s was fired and also produced no correlated terminal receipt inside its observation window. First broken transition: OWNER fire -> correlated terminal receipt. No further recovery will be attempted; this is exhaustion, not a live attempt.' \
    "$ATTEMPT_ID" "$WAKE_CLASS" "$recovery_attempt_id")"
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
    echo "owner-liveness: attempt ${ATTEMPT_ID} completed with zero recovery."
    exit 0
  fi

  local recovery_attempt_id="${ATTEMPT_ID}-recovery-1"
  local recovery_start
  recovery_start="$(owner_liveness_find_start "$(fetch_comments)" "$recovery_attempt_id")"

  if [ -n "$recovery_start" ]; then
    echo "owner-liveness: recovery ${recovery_attempt_id} already fired; not firing a second recovery (duplicate suppression)."
  else
    echo "owner-liveness: attempt ${ATTEMPT_ID} missing a correlated terminal receipt; firing the one bounded recovery."
    if ! fire_owner_recovery "$recovery_attempt_id"; then
      exit 1
    fi
    recovery_start="$(owner_liveness_find_start "$(fetch_comments)" "$recovery_attempt_id")"
  fi

  local recovery_started_at recovery_status
  recovery_started_at="$(jq -r '.created_at' <<<"$recovery_start")"
  recovery_status="$(wait_and_check "$recovery_attempt_id" "$recovery_started_at")"
  if [ "$recovery_status" = "complete" ]; then
    echo "owner-liveness: recovery ${recovery_attempt_id} completed; liveness closed cleanly."
    exit 0
  fi

  echo "::error::owner-liveness: recovery ${recovery_attempt_id} also produced no correlated terminal receipt; posting exhaustion receipt."
  post_exhaustion "$recovery_attempt_id"
  exit 1
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main
fi
