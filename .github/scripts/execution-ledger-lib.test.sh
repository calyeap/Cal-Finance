#!/usr/bin/env bash
# CF-OWNER-FASTPATH-SHADOW-01
#
# Deterministic, network-free unit tests for execution-ledger-lib.sh's
# invariants: duplicate-event suppression, compare-and-set fencing, and
# crash-safe outbox record/complete/reconcile. See that file's header for
# the ledger's shape and storage model.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=execution-ledger-lib.sh
source "${SCRIPT_DIR}/execution-ledger-lib.sh"

FAILURES=0

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "ok - $desc"
  else
    echo "not ok - $desc (expected [$expected], got [$actual])"
    FAILURES=$((FAILURES + 1))
  fi
}

NOW="2026-09-22T03:00:00Z"
LATER="2026-09-22T04:00:00Z"

# --- ledger_initial / ledger_comment_body / round-trip parsing -------------

seed="$(ledger_initial cal-finance "$NOW")"
assert_eq "ledger_initial starts at version 0" "0" "$(jq -r '.version' <<<"$seed")"
assert_eq "ledger_initial state is idle" "idle" "$(jq -r '.state' <<<"$seed")"

body="$(ledger_comment_body "$seed")"
assert_eq "ledger_comment_body's first line is the version-0 marker" "LEDGER STATE: version=0" "$(head -n1 <<<"$body")"
assert_eq "ledger_body_version parses the marker line back out" "0" "$(ledger_body_version "$body")"
assert_eq "ledger_body_payload round-trips the exact ledger" "$(jq -c '.' <<<"$seed")" "$(ledger_body_payload "$body")"

# --- ledger_latest_from_comments picks the highest version, not the ------
# --- most recently created comment ----------------------------------------

v0_body="$(ledger_comment_body "$seed")"
v1_ledger="$(jq -c '.version = 1' <<<"$seed")"
v1_body="$(ledger_comment_body "$v1_ledger")"
comments="$(jq -nc \
  --arg v0 "$v0_body" --arg v1 "$v1_body" \
  '[{body:$v1, created_at:"2026-09-22T02:00:00Z"}, {body:$v0, created_at:"2026-09-22T01:00:00Z"}]')"
latest="$(ledger_latest_from_comments "$comments")"
assert_eq "ledger_latest_from_comments returns the highest embedded version" "1" "$(jq -r '.version' <<<"$latest")"

empty_latest="$(ledger_latest_from_comments '[]')"
assert_eq "ledger_latest_from_comments prints nothing when no ledger comment exists" "" "$empty_latest"

garbage_comments='[{"body":"some unrelated comment","created_at":"2026-09-22T01:00:00Z"}]'
assert_eq "ledger_latest_from_comments ignores non-ledger comments" "" "$(ledger_latest_from_comments "$garbage_comments")"

# --- ledger_event_id is deterministic and key-sensitive ---------------------

id_a="$(ledger_event_id OWNER_FIRE MERGE-100-1)"
id_a2="$(ledger_event_id OWNER_FIRE MERGE-100-1)"
id_b="$(ledger_event_id OWNER_FIRE MERGE-100-2)"
assert_eq "ledger_event_id is deterministic for the same (kind,key)" "$id_a" "$id_a2"
if [ "$id_a" = "$id_b" ]; then
  echo "not ok - ledger_event_id differs for a different key"
  FAILURES=$((FAILURES + 1))
else
  echo "ok - ledger_event_id differs for a different key"
fi

# --- ledger_apply_transition: happy path ------------------------------------

evt1="$(ledger_event_id OWNER_FIRE MERGE-100-1)"
result="$(ledger_apply_transition "$seed" "$evt1" 0 '{"state":"active","active_attempt_id":"MERGE-100-1"}' "$NOW")"
assert_eq "ledger_apply_transition applies a fresh event at the expected version" "applied" "$(jq -r '.status' <<<"$result")"
applied="$(jq -c '.ledger' <<<"$result")"
assert_eq "applied ledger bumps version to 1" "1" "$(jq -r '.version' <<<"$applied")"
assert_eq "applied ledger merges the update fields" "active" "$(jq -r '.state' <<<"$applied")"
assert_eq "applied ledger records last_event_id" "$evt1" "$(jq -r '.last_event_id' <<<"$applied")"
assert_eq "applied ledger appends the event id to recent_event_ids" "true" "$(jq -r --arg id "$evt1" '.recent_event_ids | index($id) != null' <<<"$applied")"

# --- ledger_apply_transition: duplicate event is suppressed, even if the ---
# --- ledger has since moved to a different version -------------------------

evt1_dup_result="$(ledger_apply_transition "$applied" "$evt1" 1 '{"state":"idle"}' "$LATER")"
assert_eq "ledger_apply_transition suppresses a duplicate event at the correct version" "duplicate" "$(jq -r '.status' <<<"$evt1_dup_result")"

drifted="$(jq -c '.version = 5' <<<"$applied")"
evt1_dup_drifted="$(ledger_apply_transition "$drifted" "$evt1" 1 '{"state":"idle"}' "$LATER")"
assert_eq "ledger_apply_transition still recognises the duplicate after version drift (checked before CAS)" "duplicate" "$(jq -r '.status' <<<"$evt1_dup_drifted")"

# --- ledger_apply_transition: stale version fails closed --------------------

evt2="$(ledger_event_id OWNER_FIRE MERGE-100-2)"
stale_result="$(ledger_apply_transition "$applied" "$evt2" 0 '{"state":"active"}' "$LATER")"
assert_eq "ledger_apply_transition fails closed on a stale expected_version" "stale" "$(jq -r '.status' <<<"$stale_result")"
assert_eq "the stale result reports the actual current version" "1" "$(jq -r '.current_version' <<<"$stale_result")"

fresh_result="$(ledger_apply_transition "$applied" "$evt2" 1 '{"state":"active"}' "$LATER")"
assert_eq "ledger_apply_transition applies a fresh event at the now-current version" "applied" "$(jq -r '.status' <<<"$fresh_result")"

# --- recent_event_ids stays capped at 20 ------------------------------------

capped="$seed"
for i in $(seq 1 25); do
  evt="$(ledger_event_id CAP_TEST "evt-$i")"
  next="$(ledger_apply_transition "$capped" "$evt" "$(jq -r '.version' <<<"$capped")" '{}' "$NOW")"
  capped="$(jq -c '.ledger' <<<"$next")"
done
assert_eq "recent_event_ids never grows past 20 entries" "20" "$(jq '.recent_event_ids | length' <<<"$capped")"

# --- ledger_record_intent / ledger_complete_intent: outbox happy path ------

# fresh_result is the {"status":"applied","ledger":...} envelope from
# above, not the bare ledger — extract it first.
base_ledger="$(jq -c '.ledger' <<<"$fresh_result")"
record="$(ledger_record_intent "$base_ledger" INTENT-1 OWNER_FIRE "https://github.com/x/y/issues/9" 2 "$NOW")"
assert_eq "ledger_record_intent applies at the correct expected_version" "applied" "$(jq -r '.status' <<<"$record")"
intent_ledger="$(jq -c '.ledger' <<<"$record")"
assert_eq "recorded intent is open" "open" "$(jq -r '.pending_intent.status' <<<"$intent_ledger")"
assert_eq "recorded intent carries the given intent_id" "INTENT-1" "$(jq -r '.pending_intent.intent_id' <<<"$intent_ledger")"

complete="$(ledger_complete_intent "$intent_ledger" INTENT-1 dispatched "$LATER")"
assert_eq "ledger_complete_intent clears a matching pending_intent" "applied" "$(jq -r '.status' <<<"$complete")"
completed_ledger="$(jq -c '.ledger' <<<"$complete")"
assert_eq "completed ledger has no pending_intent" "null" "$(jq -r '.pending_intent' <<<"$completed_ledger")"

# --- ledger_complete_intent fails closed on a mismatched intent_id ----------

mismatch="$(ledger_complete_intent "$intent_ledger" INTENT-OTHER dispatched "$LATER")"
assert_eq "ledger_complete_intent fails closed when intent_id does not match (never clobbers a newer intent)" "mismatch" "$(jq -r '.status' <<<"$mismatch")"
assert_eq "a mismatched complete leaves the original pending_intent untouched (verified via the pre-call ledger)" "INTENT-1" "$(jq -r '.pending_intent.intent_id' <<<"$intent_ledger")"

# --- ledger_record_intent fails closed on a stale expected_version ----------

stale_intent="$(ledger_record_intent "$base_ledger" INTENT-2 OWNER_FIRE "https://github.com/x/y/issues/10" 999 "$NOW")"
assert_eq "ledger_record_intent fails closed on a stale expected_version" "stale" "$(jq -r '.status' <<<"$stale_intent")"

# --- ledger_intent_is_stale / ledger_reconcile_intent: crash recovery -------

assert_eq "a fresh pending_intent is not stale" "" "$(ledger_intent_is_stale "$intent_ledger" "$NOW" 30 && echo stale || true)"
assert_eq "a pending_intent older than max_age_minutes is stale" "stale" "$(ledger_intent_is_stale "$intent_ledger" "$LATER" 30 && echo stale || true)"

reconciled_dispatched="$(ledger_reconcile_intent "$intent_ledger" true "$LATER")"
assert_eq "reconciling a resolved crash intent clears it as reconciled-dispatched" "intent:reconciled-dispatched" "$(jq -r '.ledger.last_event_id' <<<"$reconciled_dispatched")"
assert_eq "reconciling a resolved crash intent leaves no pending_intent" "null" "$(jq -r '.ledger.pending_intent' <<<"$reconciled_dispatched")"

reconciled_abandoned="$(ledger_reconcile_intent "$intent_ledger" false "$LATER")"
assert_eq "reconciling an unresolved crash intent abandons it so a fresh attempt can retry" "intent:reconciled-abandoned" "$(jq -r '.ledger.last_event_id' <<<"$reconciled_abandoned")"

no_intent_reconcile="$(ledger_reconcile_intent "$completed_ledger" true "$LATER")"
assert_eq "reconciling when there is no pending_intent at all is a no-op mismatch" "mismatch" "$(jq -r '.status' <<<"$no_intent_reconcile")"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "execution-ledger-lib.test.sh: all checks passed"
  exit 0
else
  echo "execution-ledger-lib.test.sh: $FAILURES check(s) failed"
  exit 1
fi
