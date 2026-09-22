#!/usr/bin/env bash
# CF-OWNER-FASTPATH-SHADOW-01
#
# Read-mostly I/O wrapper around stall-sweep-lib.sh (issue #212, scope item
# 5). Runs on a schedule (see cf-stall-sweep.yml), gathers cheap GitHub-
# native evidence, and — only on a genuine positive finding — wakes OWNER
# through the exact same fire transport and `cf-owner-single-writer`
# concurrency group both existing OWNER fire paths already share. This is
# a safety net for a missed event, not a second orchestrator: on any
# ambiguous or partial signal it does nothing and exits 0.
#
# Deliberately GitHub-native rather than Notion-native for its own
# evidence: issue #212's OBSERVED FAILURE CLASS names Notion projection
# latency as a cause of a project looking stale even when native work is
# valid, so a sweep that itself read Notion to decide whether to wake
# OWNER could inherit exactly that staleness. OWNER's own process (see
# OWNER.md) still reconciles Project Home from fresh evidence on every
# wake, including this one.
#
# Required env: GH_TOKEN, OWNER_FIRE_URL, OWNER_FIRE_TOKEN, TARGET_REPO,
# LEDGER_ISSUE_NUMBER.
# Optional env: STALL_SWEEP_LOOKBACK_MINUTES (default 120 — comfortably
# covers OWNER's own worst-case liveness+recovery window from
# owner-liveness-guard.sh, roughly two 20-minute leases, with margin).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=stall-sweep-lib.sh
source "${SCRIPT_DIR}/stall-sweep-lib.sh"
# shellcheck source=owner-single-writer-lib.sh
source "${SCRIPT_DIR}/owner-single-writer-lib.sh"
# shellcheck source=execution-ledger-lib.sh
source "${SCRIPT_DIR}/execution-ledger-lib.sh"
# shellcheck source=latency-report-lib.sh
source "${SCRIPT_DIR}/latency-report-lib.sh"

LOOKBACK_MINUTES="${STALL_SWEEP_LOOKBACK_MINUTES:-120}"

now_iso() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

since_iso() {
  date -u -d "-${LOOKBACK_MINUTES} minutes" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
    || date -u -v -"${LOOKBACK_MINUTES}"M +%Y-%m-%dT%H:%M:%SZ
}

fetch_repo_comments_since() {
  local since="$1"
  gh api --paginate \
    "repos/${TARGET_REPO}/issues/comments?since=${since}&sort=created&direction=asc" \
    --jq '[.[] | {body: .body, created_at: .created_at, issue_number: (.issue_url | capture("/issues/(?<n>[0-9]+)$").n | tonumber)}]' \
    | jq -s 'add // []'
}

fetch_ledger_comments() {
  gh api --paginate \
    "repos/${TARGET_REPO}/issues/${LEDGER_ISSUE_NUMBER}/comments" \
    --jq '[.[] | {body: .body, created_at: .created_at}]' \
    | jq -s 'add // []'
}

open_label_count() {
  local label="$1"
  gh api --paginate \
    "search/issues?q=repo:${TARGET_REPO}+is:open+label:${label}" \
    --jq '.total_count' 2>/dev/null | head -n1
}

open_pr_count() {
  gh api --paginate \
    "search/issues?q=repo:${TARGET_REPO}+is:open+is:pr" \
    --jq '.total_count' 2>/dev/null | head -n1
}

post_comment() {
  local number="$1" body="$2"
  gh api --method POST \
    "repos/${TARGET_REPO}/issues/${number}/comments" \
    -f body="$body" >/dev/null
}

# fire_owner_stall_recovery <attempt_id> <ledger_active_outcome_id>
# Fires OWNER through the exact same transport owner-on-merge.yml already
# uses, on the ledger's own active_outcome_id issue (the concrete evidence
# this sweep found stalled). Posts the same "OWNER ATTEMPT START:" receipt
# so owner-liveness-guard.sh's terminal-correlation contract applies
# identically to this wake as to a merge/terminal wake.
fire_owner_stall_recovery() {
  local attempt_id="$1" target_number="$2"
  local prompt request_body response_file http_code

  prompt="Repository ${TARGET_REPO}, item #${target_number}. This is CF-OWNER-FASTPATH-SHADOW-01's deterministic stall sweep (issue #212): the execution ledger reports this outcome as active with no active attempt, no pending Calvin gate, no WAIT/PARKED reason, and no in-flight dispatch — a genuinely stalled state, not merely between events. Follow .github/ai-routines/OWNER.md exactly: reconcile first, then decide. This run's OWNER_ATTEMPT_ID is ${attempt_id}; your terminal receipt's first non-empty line must be one of the typed forms and must also include the exact tag [OWNER_ATTEMPT_ID: ${attempt_id}]."
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
    post_comment "$target_number" "$(printf 'OWNER ATTEMPT START: %s\nwake_class: STALL_SWEEP\nCF-OWNER-FASTPATH-SHADOW-01: fired CALBOARD-OWNER (deterministic stall sweep) (HTTP %s). session: %s (%s)' \
      "$attempt_id" "$http_code" "$session_id" "$session_url")"
    rm -f "$response_file"
    return 0
  fi

  echo "::error::stall-sweep: OWNER fire failed (HTTP ${http_code})." >&2
  rm -f "$response_file"
  return 1
}

main() {
  : "${GH_TOKEN:?GH_TOKEN is required}"
  : "${OWNER_FIRE_URL:?OWNER_FIRE_URL is required}"
  : "${OWNER_FIRE_TOKEN:?OWNER_FIRE_TOKEN is required}"
  : "${TARGET_REPO:?TARGET_REPO is required}"
  : "${LEDGER_ISSUE_NUMBER:?LEDGER_ISSUE_NUMBER is required}"

  local ledger_comments ledger active_outcome_id ledger_state
  ledger_comments="$(fetch_ledger_comments)"
  ledger="$(ledger_latest_from_comments "$ledger_comments")"
  if [ -z "$ledger" ]; then
    echo "stall-sweep: no ledger state exists yet; nothing to sweep."
    return 0
  fi
  ledger_state="$(jq -r '.state' <<<"$ledger")"
  active_outcome_id="$(jq -r '.active_outcome_id // empty' <<<"$ledger")"

  local now since repo_comments has_active_attempt has_pending_gate \
    has_wait_parked_reason has_inflight_dispatch continuation_expected
  now="$(now_iso)"
  since="$(since_iso)"
  repo_comments="$(fetch_repo_comments_since "$since")"

  [ "$(owner_single_writer_status "$repo_comments" "$now")" = "active" ] \
    && has_active_attempt=true || has_active_attempt=false

  stall_sweep_latest_owner_terminal_is_parked "$repo_comments" \
    && has_wait_parked_reason=true || has_wait_parked_reason=false

  local gate_count dispatch_count pr_count
  gate_count="$(open_label_count needs-owner-wake)"
  [ "${gate_count:-0}" -gt 0 ] 2>/dev/null && has_pending_gate=true || has_pending_gate=false

  dispatch_count="$(open_label_count needs-build-wake)"
  pr_count="$(open_pr_count)"
  if { [ "${dispatch_count:-0}" -gt 0 ] 2>/dev/null; } || { [ "${pr_count:-0}" -gt 0 ] 2>/dev/null; }; then
    has_inflight_dispatch=true
  else
    has_inflight_dispatch=false
  fi

  [ -n "$active_outcome_id" ] && continuation_expected=true || continuation_expected=false

  local status
  status="$(stall_sweep_status "$ledger_state" "$has_active_attempt" "$has_pending_gate" \
    "$has_wait_parked_reason" "$has_inflight_dispatch" "$continuation_expected")"

  echo "stall-sweep: ledger_state=${ledger_state} has_active_attempt=${has_active_attempt} has_pending_gate=${has_pending_gate} has_wait_parked_reason=${has_wait_parked_reason} has_inflight_dispatch=${has_inflight_dispatch} continuation_expected=${continuation_expected} -> ${status}"

  # Scope item 8 ("measure latency"): cheap, read-mostly, logged to this
  # run's own durable workflow log — no new storage. Best-effort only; a
  # still-open attempt or one with no correlated terminal yet simply
  # reports null timestamps, which is not an error.
  local active_attempt_id
  active_attempt_id="$(jq -r '.active_attempt_id // empty' <<<"$ledger")"
  if [ -n "$active_attempt_id" ]; then
    echo "stall-sweep: latency for active_attempt_id=${active_attempt_id}: $(latency_owner_span "$repo_comments" "$active_attempt_id")"
  fi

  if [ "$status" != "stall" ]; then
    return 0
  fi

  # active_outcome_id is expected to be a bare issue/PR number in this
  # outcome's ledger usage; if it is not a plain integer, this sweep has
  # nothing safe to wake, so it logs and stops rather than guessing a
  # target.
  if ! [[ "$active_outcome_id" =~ ^[0-9]+$ ]]; then
    echo "::warning::stall-sweep: active_outcome_id '${active_outcome_id}' is not a bare issue number; skipping fire (nothing safe to wake)."
    return 0
  fi

  local attempt_id
  attempt_id="STALL-$(date -u +%s)-${GITHUB_RUN_ATTEMPT:-1}"
  fire_owner_stall_recovery "$attempt_id" "$active_outcome_id"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main
fi
