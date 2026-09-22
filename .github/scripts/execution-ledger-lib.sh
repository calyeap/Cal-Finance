#!/usr/bin/env bash
# CF-OWNER-FASTPATH-SHADOW-01
#
# Pure, network-free helpers for Cal Finance's tiny execution ledger — the
# smallest machine execution-state record described in issue #212. No
# gh/curl calls happen here, so every invariant below (dedupe, compare-and-
# set/fencing, crash-safe outbox reconciliation) can be exercised
# deterministically in CI without hitting GitHub.
#
# Storage: the ledger has no new external store. It lives as a sequence of
# comments on one dedicated, non-semantic tracking issue (#213 — "do not
# close"), one comment per ledger version, each shaped:
#
#   LEDGER STATE: version=<N>
#   <compact ledger JSON>
#
# The current ledger is simply the comment with the highest embedded
# version — GitHub comment POST is a single atomic append, and the same
# `cf-owner-single-writer` concurrency group both OWNER fire paths already
# share (see owner-single-writer-lib.sh) is reused here too, so at most one
# writer ever appends a new ledger version at a time (scope item 2: "Reuse
# the existing single-writer boundary").
#
# The ledger JSON itself is explicitly NON-SEMANTIC: it holds only
# execution state (project_id, active_outcome_id, state, version,
# last_event_id, active_attempt_id, next_approved_outcome_id,
# projected_version, pending_intent, recent_event_ids, updated_at). It is
# never a second source of truth for product meaning, methodology,
# acceptance, or roadmap — those stay in Notion Project Home / this repo's
# own PRs per AGENTS.md.
#
# execution-ledger-guard.sh is the thin, always-best-effort I/O wrapper
# that actually fetches/posts these comments; this file has zero gh/curl
# calls so its logic is testable without either.

set -uo pipefail

LEDGER_MARKER_PREFIX="LEDGER STATE: version="

# ledger_marker_line <version>
ledger_marker_line() {
  local version="$1"
  printf '%s%s' "$LEDGER_MARKER_PREFIX" "$version"
}

# ledger_initial <project_id> <now_iso>
# Prints the seed ledger (version 0, idle, nothing in flight).
ledger_initial() {
  local project_id="$1" now_iso="$2"
  jq -nc \
    --arg project_id "$project_id" \
    --arg now "$now_iso" \
    '{
      project_id: $project_id,
      active_outcome_id: null,
      state: "idle",
      version: 0,
      last_event_id: null,
      active_attempt_id: null,
      next_approved_outcome_id: null,
      projected_version: null,
      pending_intent: null,
      recent_event_ids: [],
      updated_at: $now
    }'
}

# ledger_comment_body <ledger_json>
# Formats a ledger state as the exact comment body to post — the marker
# line the reader depends on, plus the compact JSON payload.
ledger_comment_body() {
  local ledger_json="$1"
  local version
  version="$(jq -r '.version' <<<"$ledger_json")"
  printf '%s\n%s' "$(ledger_marker_line "$version")" "$(jq -c '.' <<<"$ledger_json")"
}

# ledger_body_version <comment_body>
# Prints the embedded version if the body's first line is a ledger state
# marker, or nothing otherwise.
ledger_body_version() {
  local body="$1"
  printf '%s' "$body" | head -n1 | sed -n "s/^${LEDGER_MARKER_PREFIX}\\([0-9]\\+\\)\$/\\1/p"
}

# ledger_body_payload <comment_body>
# Prints the JSON payload (everything after the first line), or nothing if
# it does not parse as an object.
ledger_body_payload() {
  local body="$1" payload
  payload="$(printf '%s' "$body" | tail -n +2)"
  jq -e '.' <<<"$payload" >/dev/null 2>&1 || return 0
  jq -c '.' <<<"$payload"
}

# ledger_latest_from_comments <comments_json>
# comments_json: a JSON array of {"body":..,"created_at":..} comments
# already fetched from the ledger tracking issue (order does not matter).
# Prints the payload of the comment carrying the highest embedded version,
# or nothing if no valid ledger state comment exists yet (a fresh repo —
# the caller should seed with ledger_initial).
ledger_latest_from_comments() {
  local comments_json="$1"
  local count i body version payload best_version="" best_payload=""

  count="$(jq 'length' <<<"$comments_json")"
  for ((i = 0; i < count; i++)); do
    body="$(jq -r ".[$i].body" <<<"$comments_json")"
    version="$(ledger_body_version "$body")"
    [ -n "$version" ] || continue
    payload="$(ledger_body_payload "$body")"
    [ -n "$payload" ] || continue
    if [ -z "$best_version" ] || [ "$version" -gt "$best_version" ]; then
      best_version="$version"
      best_payload="$payload"
    fi
  done

  [ -n "$best_payload" ] && printf '%s' "$best_payload"
}

# ledger_event_id <kind> <key>
# Deterministic idempotency key: the same (kind, key) pair always hashes to
# the same id, shaped from existing project/task/attempt identity the
# caller already has (e.g. kind="OWNER_FIRE", key="MERGE-12345-1").
ledger_event_id() {
  local kind="$1" key="$2"
  printf '%s|%s' "$kind" "$key" | sha256sum | cut -c1-16
}

# ledger_is_duplicate_event <ledger_json> <event_id>
# True (exit 0) when event_id is already in recent_event_ids.
ledger_is_duplicate_event() {
  local ledger_json="$1" event_id="$2"
  jq -e --arg id "$event_id" '.recent_event_ids // [] | index($id) != null' \
    <<<"$ledger_json" >/dev/null
}

# ledger_cas_status <ledger_json> <expected_version>
# Echoes "ok" or "stale".
ledger_cas_status() {
  local ledger_json="$1" expected_version="$2"
  local current
  current="$(jq -r '.version' <<<"$ledger_json")"
  if [ "$current" = "$expected_version" ]; then
    echo "ok"
  else
    echo "stale"
  fi
}

# ledger_apply_transition <ledger_json> <event_id> <expected_version> <updates_json> <now_iso>
# Applies updates_json (an object merged onto the ledger) as a new version,
# after checking dedupe (checked first, so a legitimate retry of an
# already-applied event is recognised even if the ledger has since moved
# on) and then compare-and-set against expected_version. Prints one of:
#   {"status":"duplicate"}
#   {"status":"stale","current_version":N}
#   {"status":"applied","ledger":{...}}
# recent_event_ids is capped to the most recent 20 ids so the ledger stays
# tiny.
ledger_apply_transition() {
  local ledger_json="$1" event_id="$2" expected_version="$3" updates_json="$4" now_iso="$5"

  if ledger_is_duplicate_event "$ledger_json" "$event_id"; then
    jq -nc '{status:"duplicate"}'
    return
  fi

  if [ "$(ledger_cas_status "$ledger_json" "$expected_version")" != "ok" ]; then
    jq -nc --argjson current "$(jq '.version' <<<"$ledger_json")" \
      '{status:"stale",current_version:$current}'
    return
  fi

  jq -nc \
    --argjson ledger "$ledger_json" \
    --argjson updates "$updates_json" \
    --arg event_id "$event_id" \
    --arg now "$now_iso" \
    '{
      status: "applied",
      ledger: (
        $ledger
        + $updates
        + {
            version: ($ledger.version + 1),
            last_event_id: $event_id,
            updated_at: $now,
            recent_event_ids: (
              (($ledger.recent_event_ids // []) + [$event_id]) as $ids
              | $ids[-20:]
            )
          }
      )
    }'
}

# ledger_record_intent <ledger_json> <intent_id> <kind> <target> <active_outcome_id> <active_attempt_id> <expected_version> <now_iso>
# Outbox step 1 ("record intent"): CAS-guarded, sets pending_intent to an
# open envelope. Also populates state/active_outcome_id/active_attempt_id
# — the ledger's own scope-item-1 fields — with this transition's identity,
# so a production writer actually reaches them (previously only
# pending_intent/version/updated_at were ever merged, leaving state
# permanently "idle" and active_outcome_id permanently null in every real
# fire, which made the stall sweep's continuation_expected check
# structurally unreachable and the latency report's active_attempt_id
# lookup always empty). Prints the same {"status":...} shape as
# ledger_apply_transition (no dedupe check — an intent_id is generated
# fresh per dispatch attempt by the caller, dedupe is meaningless here).
ledger_record_intent() {
  local ledger_json="$1" intent_id="$2" kind="$3" target="$4" \
    active_outcome_id="$5" active_attempt_id="$6" expected_version="$7" now_iso="$8"

  if [ "$(ledger_cas_status "$ledger_json" "$expected_version")" != "ok" ]; then
    jq -nc --argjson current "$(jq '.version' <<<"$ledger_json")" \
      '{status:"stale",current_version:$current}'
    return
  fi

  jq -nc \
    --argjson ledger "$ledger_json" \
    --arg intent_id "$intent_id" \
    --arg kind "$kind" \
    --arg target "$target" \
    --arg active_outcome_id "$active_outcome_id" \
    --arg active_attempt_id "$active_attempt_id" \
    --arg now "$now_iso" \
    '{
      status: "applied",
      ledger: (
        $ledger
        + {
            version: ($ledger.version + 1),
            updated_at: $now,
            state: "active",
            active_outcome_id: $active_outcome_id,
            active_attempt_id: $active_attempt_id,
            pending_intent: {
              intent_id: $intent_id,
              kind: $kind,
              target: $target,
              status: "open",
              created_at: $now
            }
          }
      )
    }'
}

# ledger_complete_intent <ledger_json> <intent_id> <outcome> <now_iso>
# Outbox step 3 ("mark complete"). Only clears pending_intent when its
# intent_id matches — a mismatch means a newer intent has already replaced
# it, so this fails closed rather than clobbering that newer state.
# outcome is a short free-text label (e.g. "dispatched", "failed") recorded
# as last_event_id for audit.
ledger_complete_intent() {
  local ledger_json="$1" intent_id="$2" outcome="$3" now_iso="$4"

  local current_intent_id
  current_intent_id="$(jq -r '.pending_intent.intent_id // empty' <<<"$ledger_json")"
  if [ "$current_intent_id" != "$intent_id" ]; then
    jq -nc '{status:"mismatch"}'
    return
  fi

  jq -nc \
    --argjson ledger "$ledger_json" \
    --arg outcome "$outcome" \
    --arg now "$now_iso" \
    '{
      status: "applied",
      ledger: (
        $ledger
        + {
            version: ($ledger.version + 1),
            updated_at: $now,
            last_event_id: ("intent:" + $outcome),
            pending_intent: null
          }
      )
    }'
}

# ledger_intent_is_stale <ledger_json> <now_iso> <max_age_minutes>
# True (exit 0) when a pending_intent exists and is older than
# max_age_minutes — old enough that the process that recorded it plausibly
# crashed before marking it complete, rather than still legitimately being
# in flight.
ledger_intent_is_stale() {
  local ledger_json="$1" now_iso="$2" max_age_minutes="$3"
  jq -e \
    --arg now "$now_iso" \
    --argjson max_age_minutes "$max_age_minutes" \
    '
    .pending_intent != null
    and (
      ($now | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime)
      - (.pending_intent.created_at | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime)
    ) >= ($max_age_minutes * 60)
    ' <<<"$ledger_json" >/dev/null
}

# ledger_reconcile_intent <ledger_json> <resolved> <now_iso>
# Outbox crash recovery: called on re-entry when ledger_intent_is_stale is
# true. resolved is "true" when the caller has independently confirmed,
# from durable GitHub evidence (e.g. a correlated OWNER ATTEMPT START/
# terminal receipt already exists for pending_intent's target), that the
# dispatch this intent describes actually happened before the process
# recording it died; "false" when no such evidence exists, so it is safe
# to abandon the intent and let a fresh attempt retry.
# Prints the same {"status":...} shape as ledger_complete_intent, with
# outcome set to "reconciled-dispatched" or "reconciled-abandoned".
ledger_reconcile_intent() {
  local ledger_json="$1" resolved="$2" now_iso="$3"
  local intent_id outcome
  intent_id="$(jq -r '.pending_intent.intent_id // empty' <<<"$ledger_json")"
  if [ -z "$intent_id" ]; then
    jq -nc '{status:"mismatch"}'
    return
  fi
  if [ "$resolved" = "true" ]; then
    outcome="reconciled-dispatched"
  else
    outcome="reconciled-abandoned"
  fi
  ledger_complete_intent "$ledger_json" "$intent_id" "$outcome" "$now_iso"
}
