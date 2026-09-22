#!/usr/bin/env bash
# CF-OWNER-FASTPATH-SHADOW-01
#
# Always-best-effort I/O wrapper around execution-ledger-lib.sh. Called
# from inside the same `cf-owner-single-writer` concurrency group both
# native OWNER fire paths already share (owner-on-merge.yml,
# cc-auto-fire.yml's fire-owner-on-terminal job) — see
# owner-single-writer-guard.sh for why that group is the actual
# single-writer guarantee; this script only appends to the ledger inside
# it, exactly like that guard's own advisory audit trail.
#
# This script never blocks or fails the OWNER fire it runs alongside: every
# path below exits 0. A ledger write is evidence, not a gate — the ledger
# has no execution authority in this outcome (see issue #212's HARD
# BOUNDS), so a ledger failure must never become an OWNER fire failure.
#
# Usage:
#   execution-ledger-guard.sh record-intent   <kind> <target>
#   execution-ledger-guard.sh complete-intent <outcome>
#
# record-intent prints INTENT_ID=<id> on stdout (for the caller to pass to
# the matching complete-intent call) in addition to its own log lines.
#
# Required env: GH_TOKEN, LEDGER_ISSUE_REPO, LEDGER_ISSUE_NUMBER,
# EVENT_KIND, EVENT_KEY (used to derive this call's deterministic event
# id — e.g. EVENT_KIND=OWNER_FIRE, EVENT_KEY=$ATTEMPT_ID).
# Optional env: LEDGER_PROJECT_ID (default "cal-finance"),
# LEDGER_INTENT_STALE_MINUTES (default 50, matching
# OWNER_SINGLE_WRITER_MAX_AGE_MINUTES's own bound).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=execution-ledger-lib.sh
source "${SCRIPT_DIR}/execution-ledger-lib.sh"

PROJECT_ID="${LEDGER_PROJECT_ID:-cal-finance}"
INTENT_STALE_MINUTES="${LEDGER_INTENT_STALE_MINUTES:-50}"

now_iso() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

fetch_ledger_comments() {
  gh api --paginate \
    "repos/${LEDGER_ISSUE_REPO}/issues/${LEDGER_ISSUE_NUMBER}/comments" \
    --jq '[.[] | {body: .body, created_at: .created_at}]' \
    | jq -s 'add // []'
}

post_ledger_comment() {
  local body="$1"
  gh api --method POST \
    "repos/${LEDGER_ISSUE_REPO}/issues/${LEDGER_ISSUE_NUMBER}/comments" \
    -f body="$body" >/dev/null
}

# current_ledger
# Reads the latest ledger state, seeding a fresh one if the tracking issue
# has no ledger comment yet at all.
current_ledger() {
  local comments latest
  comments="$(fetch_ledger_comments)"
  latest="$(ledger_latest_from_comments "$comments")"
  if [ -n "$latest" ]; then
    printf '%s' "$latest"
  else
    ledger_initial "$PROJECT_ID" "$(now_iso)"
  fi
}

# apply_and_publish <result_json>
# Given a {"status":...} envelope from execution-ledger-lib.sh, publishes
# the new ledger comment when applied, and always logs the outcome —
# never exits non-zero.
apply_and_publish() {
  local result="$1" status
  status="$(jq -r '.status' <<<"$result")"
  case "$status" in
    applied)
      local ledger
      ledger="$(jq -c '.ledger' <<<"$result")"
      post_ledger_comment "$(ledger_comment_body "$ledger")" \
        && echo "execution-ledger: applied — now version $(jq -r '.version' <<<"$ledger")." \
        || echo "execution-ledger: applied locally but the comment post failed; continuing (advisory only)."
      ;;
    duplicate)
      echo "execution-ledger: duplicate event — no-op (already applied)."
      ;;
    stale)
      echo "execution-ledger: stale expected_version (current $(jq -r '.current_version' <<<"$result")) — failing closed, no write made."
      ;;
    mismatch)
      echo "execution-ledger: pending_intent mismatch — failing closed, no write made."
      ;;
    *)
      echo "execution-ledger: unrecognised result status '${status}' — no write made."
      ;;
  esac
}

# reconcile_stale_intent_if_any <ledger_json>
# Outbox crash recovery (scope item 4): before recording a new intent,
# check whether the current ledger already carries a pending_intent old
# enough to plausibly be an orphan from a crashed prior run, and — if so —
# reconcile it against durable evidence before proceeding. This script has
# no independent evidence source of its own beyond the ledger, so it
# reconciles conservatively as "unresolved" (abandoned): the far more
# common case (a normal OWNER fire that itself already posts an
# "OWNER ATTEMPT START:" receipt on the wake target, observable via
# owner-liveness-lib.sh) is covered by that receipt, not by this ledger.
reconcile_stale_intent_if_any() {
  local ledger_json="$1"
  if ledger_intent_is_stale "$ledger_json" "$(now_iso)" "$INTENT_STALE_MINUTES"; then
    # This function's own stdout is a return value consumed via `$(...)`
    # by its caller — only the final ledger JSON belongs there. Every log
    # line goes to stderr so it never contaminates that value.
    echo "execution-ledger: found a pending_intent older than ${INTENT_STALE_MINUTES}m; reconciling as abandoned before continuing." >&2
    local reconciled
    reconciled="$(ledger_reconcile_intent "$ledger_json" false "$(now_iso)")"
    apply_and_publish "$reconciled" >&2
    current_ledger
  else
    printf '%s' "$ledger_json"
  fi
}

cmd_record_intent() {
  local kind="$1" target="$2"
  local ledger intent_id result
  ledger="$(current_ledger)"
  ledger="$(reconcile_stale_intent_if_any "$ledger")"

  intent_id="$(ledger_event_id "INTENT:${kind}" "${EVENT_KEY}")"
  result="$(ledger_record_intent "$ledger" "$intent_id" "$kind" "$target" "$(jq -r '.version' <<<"$ledger")" "$(now_iso)")"
  apply_and_publish "$result"
  echo "INTENT_ID=${intent_id}"
}

cmd_complete_intent() {
  local outcome="$1"
  local ledger event_id apply_result
  ledger="$(current_ledger)"

  local intent_id
  intent_id="$(jq -r '.pending_intent.intent_id // empty' <<<"$ledger")"
  if [ -z "$intent_id" ]; then
    echo "execution-ledger: complete-intent called with no pending_intent open — nothing to do."
    return 0
  fi

  local complete_result
  complete_result="$(ledger_complete_intent "$ledger" "$intent_id" "$outcome" "$(now_iso)")"
  apply_and_publish "$complete_result"

  local completed_status
  completed_status="$(jq -r '.status' <<<"$complete_result")"
  if [ "$completed_status" != "applied" ]; then
    return 0
  fi

  event_id="$(ledger_event_id "${EVENT_KIND}" "${EVENT_KEY}")"
  ledger="$(jq -c '.ledger' <<<"$complete_result")"
  apply_result="$(ledger_apply_transition "$ledger" "$event_id" "$(jq -r '.version' <<<"$ledger")" '{}' "$(now_iso)")"
  apply_and_publish "$apply_result"
}

main() {
  local subcommand="${1:-}" kind="${2:-}" arg3="${3:-}"

  # Deliberately `return 1` here rather than `${VAR:?msg}` — the latter
  # terminates the whole (non-interactive) shell immediately, even inside
  # a function and even when the caller wraps the call in `|| ...`. This
  # script's whole point is to never do that: a misconfigured/missing var
  # must still fall through to the caller's advisory handling below, not
  # take the entire fire step down with it.
  for var_name in GH_TOKEN LEDGER_ISSUE_REPO LEDGER_ISSUE_NUMBER EVENT_KIND EVENT_KEY; do
    if [ -z "${!var_name:-}" ]; then
      echo "::warning::execution-ledger-guard.sh: ${var_name} is required but unset — advisory no-op." >&2
      return 1
    fi
  done

  case "$subcommand" in
    record-intent)
      if [ -z "$kind" ] || [ -z "$arg3" ]; then
        echo "::warning::execution-ledger-guard.sh: record-intent requires <kind> <target> — advisory no-op." >&2
        return 1
      fi
      cmd_record_intent "$kind" "$arg3"
      ;;
    complete-intent)
      if [ -z "$kind" ]; then
        echo "::warning::execution-ledger-guard.sh: complete-intent requires <outcome> — advisory no-op." >&2
        return 1
      fi
      cmd_complete_intent "$kind"
      ;;
    *)
      echo "::warning::execution-ledger-guard.sh: unknown subcommand '${subcommand}' — advisory no-op." >&2
      ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  # Advisory only: never let a ledger failure fail the OWNER fire it runs
  # alongside. Any unexpected error below is caught and logged, not
  # propagated as a non-zero exit.
  main "$@" || echo "::warning::execution-ledger-guard.sh: encountered an error; continuing (advisory only, never blocks)."
  exit 0
fi
